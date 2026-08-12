import math
import re

import httpx
from fastapi import HTTPException

from app.config import settings


def normalized(value):
    return re.sub(r"[^a-z0-9]", "", str(value or "").lower())


def point_in_polygon(latitude, longitude, polygon):
    inside = False
    j = len(polygon) - 1
    for i, (lat_i, lng_i) in enumerate(polygon):
        lat_j, lng_j = polygon[j]
        if ((lng_i > longitude) != (lng_j > longitude)) and (
            latitude < (lat_j - lat_i) * (longitude - lng_i) / ((lng_j - lng_i) or 1e-12) + lat_i
        ):
            inside = not inside
        j = i
    return inside


def point_in_area(latitude, longitude, properties, area):
    if area.get("polygon"):
        return point_in_polygon(latitude, longitude, area["polygon"])
    bbox = area.get("bbox")
    if bbox and len(bbox) == 4:
        return bbox[1] <= latitude <= bbox[3] and bbox[0] <= longitude <= bbox[2]
    searchable = " ".join(str(properties.get(key, "")) for key in
                          ("district", "county", "state_district", "city", "formatted"))
    candidate = normalized(searchable)
    return any(normalized(name) in candidate for name in area.get("accepted_names", []))


def feature_location(feature):
    longitude, latitude = feature["geometry"]["coordinates"]
    properties = feature.get("properties", {})
    return {"latitude": latitude, "longitude": longitude, "formatted": properties.get("formatted"),
            "properties": properties}


def matching_location(features, areas, fallback=True):
    """Prefer a geocoder candidate inside an active delivery area."""
    locations = [feature_location(feature) for feature in features]
    return next((location for location in locations if any(
        point_in_area(location["latitude"], location["longitude"], location["properties"], area)
        for area in areas
    )), locations[0] if fallback and locations else None)


def declared_service_area_location(address, areas):
    """Use the configured center when the provider cannot resolve an exact service-area locality."""
    declared_names = {
        normalized(address.get(key))
        for key in ("address_line1", "address_line2", "city", "state")
        if address.get(key)
    }
    for area in areas:
        accepted_names = {normalized(name) for name in area.get("accepted_names", [])}
        accepted_names.add(normalized(area.get("name")))
        latitude = area.get("center_latitude")
        longitude = area.get("center_longitude")
        # Local address spelling often includes suffixes such as "town" or
        # "district". Accept a configured area name contained in a declared
        # address component (or vice versa) instead of requiring exact text.
        declared_in_area = any(
            declared and accepted and (declared in accepted or accepted in declared)
            for declared in declared_names
            for accepted in accepted_names
        )
        if declared_in_area and latitude is not None and longitude is not None:
            city = address.get("city", "")
            return {
                "latitude": latitude,
                "longitude": longitude,
                "formatted": ", ".join(filter(None, [address.get("address_line1"), city,
                                                       address.get("state"), address.get("pincode")])),
                "properties": {
                    "city": city,
                    "county": area.get("name", ""),
                    "state": address.get("state", ""),
                    "postcode": address.get("pincode", ""),
                    "location_source": "configured_service_area",
                },
            }
    return None


async def geocode_address(address, areas=None):
    if not settings.GEOAPIFY_API_KEY:
        raise HTTPException(503, "Geoapify geocoding is not configured")
    address_parts = [address.get("address_line1"), address.get("address_line2"), address.get("city"),
                     address.get("state"), address.get("pincode"), "Sri Lanka"]
    queries = [
        ", ".join(filter(None, address_parts)),
        ", ".join(filter(None, [address.get("pincode"), address.get("city"),
                                  address.get("state"), "Sri Lanka"])),
        ", ".join(filter(None, [address.get("city"), "District", "Sri Lanka"])),
    ]
    queries = list(dict.fromkeys(query for query in queries if query.strip(", ")))
    try:
        async with httpx.AsyncClient(timeout=12) as client:
            centered_area = next((area for area in (areas or [])
                                  if area.get("center_latitude") is not None
                                  and area.get("center_longitude") is not None), None)
            features = []
            for query in queries:
                params = {"text": query, "format": "geojson", "limit": 5,
                          "filter": "countrycode:lk", "apiKey": settings.GEOAPIFY_API_KEY}
                if centered_area:
                    params["bias"] = (f"proximity:{centered_area['center_longitude']},"
                                      f"{centered_area['center_latitude']}")
                response = await client.get("https://api.geoapify.com/v1/geocode/search", params=params)
                response.raise_for_status()
                features.extend(response.json().get("features", []))
                if matching_location(features, areas or [], fallback=False):
                    break
    except httpx.HTTPError as exc:
        raise HTTPException(503, "Delivery address validation is temporarily unavailable") from exc
    location = matching_location(features, areas or [])
    if not location:
        location = declared_service_area_location(address, areas or [])
    if not location:
        raise HTTPException(422, "Delivery address could not be located")
    return location


async def reverse_geocode(latitude, longitude):
    if not settings.GEOAPIFY_API_KEY:
        raise HTTPException(503, "Geoapify reverse geocoding is not configured")
    try:
        async with httpx.AsyncClient(timeout=12) as client:
            response = await client.get("https://api.geoapify.com/v1/geocode/reverse", params={
                "lat": latitude, "lon": longitude, "format": "geojson", "limit": 1,
                "apiKey": settings.GEOAPIFY_API_KEY})
            response.raise_for_status()
            feature = response.json().get("features", [None])[0]
            if feature and not feature.get("properties", {}).get("postcode"):
                postcode_response = await client.get("https://api.geoapify.com/v1/geocode/reverse", params={
                    "lat": latitude, "lon": longitude, "type": "postcode", "format": "geojson", "limit": 1,
                    "apiKey": settings.GEOAPIFY_API_KEY})
                if postcode_response.is_success:
                    postcode_feature = postcode_response.json().get("features", [None])[0]
                    postcode = (postcode_feature or {}).get("properties", {}).get("postcode")
                    if postcode:
                        feature["properties"]["postcode"] = postcode
    except httpx.HTTPError as exc:
        raise HTTPException(503, "Delivery location lookup is temporarily unavailable") from exc
    if not feature:
        raise HTTPException(422, "The selected delivery location has no recognized address")
    return feature.get("properties", {})


async def validate_service_coordinates(db, latitude, longitude):
    properties = await reverse_geocode(latitude, longitude)
    areas = await db.service_areas.find({"is_active": True}).to_list(length=None)
    matched = next((area for area in areas if point_in_area(latitude, longitude, properties, area)), None)
    if not matched:
        raise HTTPException(422, settings.SERVICE_AREA_REJECTION_MESSAGE)
    return {"latitude": latitude, "longitude": longitude, "service_area_id": str(matched["_id"]),
        "service_area_name": matched["name"], "address": {
            "address_line1": properties.get("address_line1") or properties.get("name") or properties.get("street", ""),
            "street": properties.get("street", ""), "area": properties.get("suburb") or properties.get("district") or properties.get("county", ""),
            "city": properties.get("city") or properties.get("town") or properties.get("village") or "",
            "state": properties.get("state", ""), "pincode": properties.get("postcode", ""),
            "formatted": properties.get("formatted", "")}}


def configured_area_fallback(address, area):
    """Place an unresolvable typed address at its configured area centre.

    This is intended for admin-reviewed seller applications, not customer
    delivery validation, which continues to require a map coordinate.
    """
    latitude = area.get("center_latitude")
    longitude = area.get("center_longitude")
    if latitude is None or longitude is None:
        return None
    return {
        "latitude": latitude,
        "longitude": longitude,
        "formatted": ", ".join(filter(None, [address.get("address_line1"), address.get("city"),
                                                address.get("state"), address.get("pincode")])),
        "properties": {"location_source": "configured_service_area_fallback"},
        "service_area_id": str(area["_id"]),
        "service_area_name": area["name"],
    }


async def validate_service_address(db, address, allow_configured_fallback=False):
    areas = await db.service_areas.find({"is_active": True}).to_list(length=None)
    if not areas:
        raise HTTPException(422, "No active delivery area is configured")
    try:
        location = await geocode_address(address, areas)
    except HTTPException as exc:
        if not allow_configured_fallback or exc.status_code not in {422, 503}:
            raise
        fallback = configured_area_fallback(address, areas[0])
        if not fallback:
            raise
        return fallback
    matched = next((area for area in areas if point_in_area(location["latitude"], location["longitude"],
                                                              location["properties"], area)), None)
    if not matched:
        raise HTTPException(422, settings.SERVICE_AREA_REJECTION_MESSAGE)
    return {**location, "service_area_id": str(matched["_id"]), "service_area_name": matched["name"]}


def distance_km(a_lat, a_lng, b_lat, b_lng):
    radius = 6371.0
    dlat, dlng = math.radians(b_lat - a_lat), math.radians(b_lng - a_lng)
    value = math.sin(dlat / 2) ** 2 + math.cos(math.radians(a_lat)) * math.cos(math.radians(b_lat)) * math.sin(dlng / 2) ** 2
    return radius * 2 * math.atan2(math.sqrt(value), math.sqrt(1 - value))
