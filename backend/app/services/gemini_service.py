import json
import logging
import re
from typing import Any

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


class GeminiEnrichmentError(RuntimeError):
    """Raised when Gemini cannot produce valid bilingual plant content."""


ENRICHMENT_FIELDS = (
    "description",
    "description_tamil",
    "medicinal_uses",
    "medicinal_uses_tamil",
    "precautions",
    "precautions_tamil",
)

RESPONSE_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "common_name_tamil": {
            "type": "STRING",
            "description": "The established or commonly used Tamil plant name.",
        },
        **{field: {"type": "STRING"} for field in ENRICHMENT_FIELDS},
    },
    "required": list(ENRICHMENT_FIELDS),
}

TAMIL_NAME_PATTERN = re.compile(
    r"^\s*[\"'“”‘’(\[]*"
    r"(?P<name>[\u0B80-\u0BFF][\u0B80-\u0BFF\u200c\u200d ]{0,79}?)"
    r"\s+(?:என்பது|எனப்படும்|என்றழைக்கப்படும்|ஒரு)(?:\s|$)"
)
TAMIL_NAME_UNAVAILABLE = "தமிழ் பெயர் கிடைக்கவில்லை"


def _contains_tamil(value: str) -> bool:
    return any("\u0b80" <= character <= "\u0bff" for character in value)


def extract_tamil_name(content: dict[str, Any]) -> str:
    """Return Gemini's explicit Tamil name or infer it from its Tamil description."""
    for field in ("common_name_tamil", "tamil_name"):
        value = content.get(field)
        if (
            isinstance(value, str)
            and value.strip()
            and value.strip() != TAMIL_NAME_UNAVAILABLE
            and _contains_tamil(value)
        ):
            return value.strip()

    description = content.get("description_tamil")
    if not isinstance(description, str):
        return ""
    match = TAMIL_NAME_PATTERN.match(description)
    if not match:
        return ""
    candidate = " ".join(match.group("name").split()).strip(" ,:;.-–—")
    return candidate if candidate and _contains_tamil(candidate) else ""


def parse_gemini_response(payload: dict[str, Any]) -> dict[str, str]:
    """Extract and validate Gemini's schema-constrained JSON response."""
    logger.debug(
        "Raw Gemini plant enrichment response: %s",
        json.dumps(payload, ensure_ascii=False, default=str),
    )
    try:
        parts = payload["candidates"][0]["content"]["parts"]
        text = "".join(str(part.get("text", "")) for part in parts)
        content = json.loads(text)
    except (KeyError, IndexError, TypeError, json.JSONDecodeError) as exc:
        raise GeminiEnrichmentError("Gemini returned an invalid response.") from exc

    normalized = {}
    for field in ENRICHMENT_FIELDS:
        value = content.get(field)
        if not isinstance(value, str) or not value.strip():
            raise GeminiEnrichmentError(f"Gemini omitted the required field: {field}.")
        normalized[field] = value.strip()
    tamil_name = extract_tamil_name(content)
    if tamil_name:
        normalized["common_name_tamil"] = tamil_name
    return normalized


async def generate_bilingual_plant_content(
    *,
    common_name: str,
    client: httpx.AsyncClient | None = None,
) -> dict[str, str]:
    """Generate concise, safety-aware English and Tamil plant information."""
    api_key = settings.GEMINI_API_KEY.strip()
    if not api_key:
        raise GeminiEnrichmentError("Gemini is not configured.")

    prompt = f"""
Create concise public-facing plant information for:
- Common name: {common_name}

Return the established or commonly used Tamil plant name in
`common_name_tamil`, plus English and natural Tamil for the description,
traditional medicinal uses, and precautions. Begin `description_tamil` with
the Tamil plant name when one is known. If no established Tamil name is known,
return an empty string for `common_name_tamil`; do not invent a translation.
Use only well-established general information. Do not diagnose, prescribe,
recommend dosage, or claim that the plant cures disease. Clearly state that
image identification is not sufficient for consumption or medical use.
Narrative values must be plain text, 2-4 sentences, with no Markdown.
""".strip()

    url = (
        f"{settings.GEMINI_API_BASE_URL.rstrip('/')}/models/"
        f"{settings.GEMINI_MODEL}:generateContent"
    )
    request_body = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {
            "responseMimeType": "application/json",
            "responseSchema": RESPONSE_SCHEMA,
        },
    }

    owns_client = client is None
    http_client = client or httpx.AsyncClient(timeout=settings.GEMINI_TIMEOUT_SECONDS)
    try:
        response = await http_client.post(
            url,
            headers={"x-goog-api-key": api_key, "Content-Type": "application/json"},
            json=request_body,
        )
        response.raise_for_status()
        return parse_gemini_response(response.json())
    except GeminiEnrichmentError:
        raise
    except httpx.TimeoutException as exc:
        raise GeminiEnrichmentError("Gemini timed out.") from exc
    except httpx.HTTPStatusError as exc:
        try:
            api_message = exc.response.json().get("error", {}).get("message", "")
        except (TypeError, ValueError):
            api_message = ""
        logger.error(
            "Gemini API request failed (model=%s, status=%s): %s",
            settings.GEMINI_MODEL,
            exc.response.status_code,
            api_message or exc,
        )
        if exc.response.status_code == 404:
            raise GeminiEnrichmentError(
                f"The configured Gemini model '{settings.GEMINI_MODEL}' is unavailable."
            ) from exc
        raise GeminiEnrichmentError("Gemini is currently unavailable.") from exc
    except (httpx.HTTPError, ValueError) as exc:
        raise GeminiEnrichmentError("Gemini is currently unavailable.") from exc
    finally:
        if owns_client:
            await http_client.aclose()
