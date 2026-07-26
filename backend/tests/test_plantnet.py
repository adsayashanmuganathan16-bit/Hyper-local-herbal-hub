import asyncio

import httpx
import pytest

from app.services.plantnet_service import (
    PlantNetIdentificationError,
    identify_plant,
    parse_identification,
)


def test_parse_identification_normalizes_top_result():
    result = parse_identification({
        "bestMatch": "Azadirachta indica A.Juss.",
        "results": [{
            "score": 0.87321,
            "species": {
                "scientificNameWithoutAuthor": "Azadirachta indica",
                "commonNames": ["Neem"],
                "family": {"scientificNameWithoutAuthor": "Meliaceae"},
            },
        }],
    })

    assert result["common_name"] == "Neem"
    assert result["scientific_name"] == "Azadirachta indica"
    assert result["family"] == "Meliaceae"
    assert result["confidence"] == "87.32%"
    assert result["common_name_tamil"] == "வேம்பு"
    assert result["scientific_name_tamil"] == "Azadirachta indica"
    assert result["confidence_tamil"] == "87.32%"
    assert "description" not in result
    assert "medicinal_uses" not in result
    assert "precautions" not in result


def test_parse_identification_rejects_empty_results():
    with pytest.raises(PlantNetIdentificationError):
        parse_identification({"results": []})


def test_english_localized_fallback_does_not_replace_known_tamil_name():
    english_payload = {
        "results": [{
            "score": 0.91,
            "species": {
                "scientificNameWithoutAuthor": "Aloe vera",
                "commonNames": ["Aloe vera"],
                "family": {"scientificNameWithoutAuthor": "Asphodelaceae"},
            },
        }],
    }
    tamil_payload = {
        "results": [{
            "score": 0.91,
            "species": {"commonNames": ["Aloe vera"]},
        }],
    }

    result = parse_identification(english_payload, tamil_payload)

    assert result["common_name_tamil"] == "கற்றாழை"


def test_identify_plant_sends_expected_multipart(monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "PLANTNET_API_KEY", "test-key")
    requested_languages = []

    async def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.params["api-key"] == "test-key"
        requested_languages.append(request.url.params["lang"])
        assert b'name="images"; filename="leaf.jpg"' in await request.aread()
        common_names = ["துளசி"] if request.url.params["lang"] == "ta" else ["Holy basil"]
        return httpx.Response(200, json={
            "results": [{
                "score": 0.55,
                "species": {
                    "scientificNameWithoutAuthor": "Ocimum tenuiflorum",
                    "commonNames": common_names,
                    "family": {"scientificNameWithoutAuthor": "Lamiaceae"},
                },
            }],
        })

    async def run_identification():
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            return await identify_plant(
                image=b"image-bytes",
                filename="leaf.jpg",
                content_type="image/jpeg",
                client=client,
            )

    result = asyncio.run(run_identification())
    assert result["confidence"] == "55.00%"
    assert result["common_name_tamil"] == "துளசி"
    assert requested_languages == ["en", "ta"]
