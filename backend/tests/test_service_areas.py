from app.services.service_area_service import distance_km, point_in_area


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
