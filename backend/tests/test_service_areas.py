from app.services.service_area_service import (
    configured_area_fallback,
    declared_service_area_location,
    distance_km,
    matching_location,
    point_in_area,
)


def test_kilinochchi_district_name_is_accepted_from_config():
    area = {"accepted_names": ["Kilinochchi District"]}
    assert point_in_area(9.38, 80.40, {"county": "Kilinochchi District", "country_code": "lk"}, area)


def test_outside_district_is_rejected():
    area = {"accepted_names": ["Kilinochchi District"]}
    assert not point_in_area(6.93, 79.86, {"city": "Colombo", "state_district": "Colombo District"}, area)


def test_configurable_polygon_boundary():
    area = {"accepted_names": ["Future District"], "polygon": [[9.0, 80.0], [10.0, 80.0], [10.0, 81.0], [9.0, 81.0]]}
    assert point_in_area(9.5, 80.5, {}, area)
    assert not point_in_area(8.5, 80.5, {}, area)


def test_nearest_seller_distance():
    near = distance_km(9.38, 80.40, 9.39, 80.41)
    far = distance_km(9.38, 80.40, 9.70, 80.70)
    assert near < far


def test_geocoder_prefers_candidate_inside_service_area():
    features = [
        {"geometry": {"coordinates": [79.86, 6.93]},
         "properties": {"city": "Colombo", "formatted": "Colombo, Sri Lanka"}},
        {"geometry": {"coordinates": [80.40, 9.38]},
         "properties": {"county": "Kilinochchi District", "formatted": "Kilinochchi, Sri Lanka"}},
    ]
    location = matching_location(features, [{"accepted_names": ["Kilinochchi District", "Kilinochchi"]}])
    assert location["properties"]["county"] == "Kilinochchi District"


def test_exact_declared_city_uses_configured_center_when_geocoder_is_empty():
    area = {"name": "Kilinochchi District", "accepted_names": ["Kilinochchi"],
            "center_latitude": 9.3803, "center_longitude": 80.3770}
    location = declared_service_area_location(
        {"address_line1": "Kanagapuram", "city": "kilinochchi", "state": "Northern", "pincode": "44000"},
        [area],
    )
    assert location["latitude"] == 9.3803
    assert location["properties"]["location_source"] == "configured_service_area"


def test_unknown_declared_city_does_not_use_service_area_center():
    area = {"name": "Kilinochchi District", "accepted_names": ["Kilinochchi"],
            "center_latitude": 9.3803, "center_longitude": 80.3770}
    assert declared_service_area_location({"city": "Colombo"}, [area]) is None


def test_declared_city_with_locality_suffix_uses_configured_center():
    area = {"name": "Kilinochchi District", "accepted_names": ["Kilinochchi"],
            "center_latitude": 9.3803, "center_longitude": 80.3770}
    location = declared_service_area_location(
        {"address_line1": "Hospital Road", "city": "Kilinochchi Town", "state": "Northern Province"},
        [area],
    )
    assert location["latitude"] == 9.3803


def test_admin_reviewed_seller_address_can_use_configured_area_fallback():
    area = {"_id": "area-1", "name": "Kilinochchi District",
            "center_latitude": 9.3803, "center_longitude": 80.3770}
    location = configured_area_fallback(
        {"address_line1": "Remote village road", "city": "Kilinochchi", "pincode": "44000"}, area
    )
    assert location["service_area_id"] == "area-1"
    assert location["properties"]["location_source"] == "configured_service_area_fallback"
