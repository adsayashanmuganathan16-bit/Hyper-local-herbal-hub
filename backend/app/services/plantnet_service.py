from typing import Any

import httpx

from app.config import settings


class PlantNetConfigurationError(RuntimeError):
    """Raised when plant identification is not configured on the server."""


class PlantNetIdentificationError(RuntimeError):
    """Raised when Pl@ntNet cannot return a usable identification."""


TAMIL_PLANT_NAMES = {
    "aloe vera": "கற்றாழை",
    "azadirachta indica": "வேம்பு",
    "neem": "வேம்பு",
    "curcuma longa": "மஞ்சள்",
    "turmeric": "மஞ்சள்",
    "moringa oleifera": "முருங்கை",
    "moringa": "முருங்கை",
    "ocimum tenuiflorum": "துளசி",
    "holy basil": "துளசி",
    "centella asiatica": "வல்லாரை",
    "gotu kola": "வல்லாரை",
    "hibiscus rosa-sinensis": "செம்பருத்தி",
    "hibiscus": "செம்பருத்தி",
    "cocos nucifera": "தென்னை",
    "coconut": "தென்னை",
    "mangifera indica": "மாமரம்",
    "mango": "மாமரம்",
    "musa × paradisiaca": "வாழை",
    "banana": "வாழை",
    "zingiber officinale": "இஞ்சி",
    "ginger": "இஞ்சி",
    "allium sativum": "பூண்டு",
    "garlic": "பூண்டு",
    "cinnamomum verum": "இலவங்கப்பட்டை",
    "cinnamon": "இலவங்கப்பட்டை",
    "phyllanthus emblica": "நெல்லிக்காய்",
    "indian gooseberry": "நெல்லிக்காய்",
    "withania somnifera": "அமுக்கரா",
    "ashwagandha": "அமுக்கரா",
    "cymbopogon citratus": "எலுமிச்சைப் புல்",
    "lemongrass": "எலுமிச்சைப் புல்",
    "carica papaya": "பப்பாளி",
    "papaya": "பப்பாளி",
    "psidium guajava": "கொய்யா",
    "guava": "கொய்யா",
}


def _contains_tamil(value: str) -> bool:
    return any("\u0b80" <= character <= "\u0bff" for character in value)


def parse_identification(
    payload: dict[str, Any],
    tamil_payload: dict[str, Any] | None = None,
) -> dict[str, str]:
    """Normalize Pl@ntNet's top-ranked result into our public API contract."""
    results = payload.get("results")
    if not isinstance(results, list) or not results:
        raise PlantNetIdentificationError(
            "The image did not contain a plant that could be identified."
        )

    top_result = results[0]
    species = top_result.get("species") or {}
    family_data = species.get("family") or {}
    common_names = species.get("commonNames") or []

    scientific_name = (
        species.get("scientificNameWithoutAuthor")
        or species.get("scientificName")
        or payload.get("bestMatch")
        or "Unknown"
    )
    family = family_data.get("scientificNameWithoutAuthor") or family_data.get(
        "scientificName", "Unknown"
    )
    common_name = common_names[0] if common_names else scientific_name
    tamil_results = (tamil_payload or {}).get("results") or []
    tamil_species = tamil_results[0].get("species", {}) if tamil_results else {}
    tamil_names = tamil_species.get("commonNames") or []
    localized_tamil_name = next(
        (str(name) for name in tamil_names if _contains_tamil(str(name))),
        "",
    )
    tamil_common_name = (
        localized_tamil_name
        or TAMIL_PLANT_NAMES.get(str(scientific_name).lower())
        or TAMIL_PLANT_NAMES.get(str(common_name).lower())
        or "தமிழ் பெயர் கிடைக்கவில்லை"
    )

    try:
        confidence_value = max(0.0, min(1.0, float(top_result.get("score", 0))))
    except (TypeError, ValueError):
        confidence_value = 0.0

    confidence = f"{confidence_value * 100:.2f}%"

    return {
        "common_name": str(common_name),
        "common_name_tamil": str(tamil_common_name),
        "scientific_name": str(scientific_name),
        # Scientific taxonomy remains in its original Latin form in both rows.
        "scientific_name_tamil": str(scientific_name),
        "family": str(family),
        "family_tamil": str(family),
        "confidence": confidence,
        "confidence_tamil": confidence,
    }


async def identify_plant(
    *,
    image: bytes,
    filename: str,
    content_type: str,
    client: httpx.AsyncClient | None = None,
) -> dict[str, str]:
    """Send one image to Pl@ntNet and return its normalized top result."""
    api_key = settings.PLANTNET_API_KEY.strip()
    if not api_key or api_key == "YOUR_API_KEY":
        raise PlantNetConfigurationError(
            "Plant identification is not configured. Add PLANTNET_API_KEY to backend/.env."
        )

    owns_client = client is None
    http_client = client or httpx.AsyncClient(timeout=settings.PLANTNET_TIMEOUT_SECONDS)

    try:
        response = await http_client.post(
            settings.PLANTNET_API_URL,
            params={"api-key": api_key, "lang": "en", "nb-results": 1},
            # Pl@ntNet expects the binary under the plural `images` field.
            files={"images": (filename, image, content_type)},
            data={"organs": "auto"},
        )
        response.raise_for_status()
        english_payload = response.json()

        # A localized second request provides Tamil common names when Pl@ntNet
        # has one. Failure is non-fatal because safe Tamil explanatory text is
        # generated locally and taxonomy can remain in Latin.
        tamil_payload = None
        try:
            tamil_response = await http_client.post(
                settings.PLANTNET_API_URL,
                params={"api-key": api_key, "lang": "ta", "nb-results": 1},
                files={"images": (filename, image, content_type)},
                data={"organs": "auto"},
            )
            tamil_response.raise_for_status()
            tamil_payload = tamil_response.json()
        except (httpx.HTTPError, ValueError):
            pass

        return parse_identification(english_payload, tamil_payload)
    except PlantNetIdentificationError:
        raise
    except httpx.TimeoutException as exc:
        raise PlantNetIdentificationError(
            "Plant identification timed out. Please try again."
        ) from exc
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code in {401, 403}:
            message = "Plant identification service credentials were rejected."
        elif exc.response.status_code == 429:
            message = "Plant identification limit reached. Please try again later."
        else:
            message = "Plant identification service is currently unavailable."
        raise PlantNetIdentificationError(message) from exc
    except (httpx.HTTPError, ValueError) as exc:
        raise PlantNetIdentificationError(
            "Plant identification service returned an invalid response."
        ) from exc
    finally:
        if owns_client:
            await http_client.aclose()
