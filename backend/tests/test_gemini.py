import asyncio
import json

import httpx
import pytest

from app.services.gemini_service import (
    GeminiEnrichmentError,
    generate_bilingual_plant_content,
    extract_tamil_name,
    parse_gemini_response,
)


CONTENT = {
    "description": "A concise English description.",
    "description_tamil": "சுருக்கமான தமிழ் விளக்கம்.",
    "medicinal_uses": "Traditional uses require professional guidance.",
    "medicinal_uses_tamil": "பாரம்பரிய பயன்பாடுகளுக்கு நிபுணர் ஆலோசனை தேவை.",
    "precautions": "Do not consume based only on image identification.",
    "precautions_tamil": "பட அடையாளத்தை மட்டும் நம்பி உட்கொள்ள வேண்டாம்.",
}


def test_parse_gemini_response_extracts_structured_content():
    payload = {
        "candidates": [{
            "content": {"parts": [{"text": json.dumps(CONTENT)}]},
        }],
    }
    assert parse_gemini_response(payload) == CONTENT


def test_parse_gemini_response_rejects_missing_fields():
    payload = {
        "candidates": [{
            "content": {"parts": [{"text": '{"description": "Only one field"}'}]},
        }],
    }
    with pytest.raises(GeminiEnrichmentError):
        parse_gemini_response(payload)


def test_extracts_tamil_name_from_description_when_field_is_missing():
    content = {
        **CONTENT,
        "description_tamil": (
            "எருக்கு என்பது தமிழ்நாட்டில் பரவலாகக் காணப்படும் ஒரு தாவரமாகும்."
        ),
    }
    payload = {
        "candidates": [{
            "content": {"parts": [{"text": json.dumps(content, ensure_ascii=False)}]},
        }],
    }

    result = parse_gemini_response(payload)

    assert result["common_name_tamil"] == "எருக்கு"


def test_explicit_tamil_name_is_preferred_over_description():
    content = {
        **CONTENT,
        "common_name_tamil": "வெள்ளெருக்கு",
        "description_tamil": "எருக்கு என்பது ஒரு தாவரமாகும்.",
    }

    assert extract_tamil_name(content) == "வெள்ளெருக்கு"


def test_generate_bilingual_content_uses_structured_json(monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "GEMINI_API_KEY", "gemini-test-key")
    captured = {}

    async def handler(request: httpx.Request) -> httpx.Response:
        captured["headers"] = request.headers
        captured["body"] = json.loads((await request.aread()).decode())
        return httpx.Response(200, json={
            "candidates": [{
                "content": {"parts": [{"text": json.dumps(CONTENT)}]},
            }],
        })

    async def run_generation():
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            return await generate_bilingual_plant_content(
                common_name="Aloe vera",
                client=client,
            )

    result = asyncio.run(run_generation())

    assert result == CONTENT
    assert captured["headers"]["x-goog-api-key"] == "gemini-test-key"
    assert captured["body"]["generationConfig"]["responseMimeType"] == "application/json"
