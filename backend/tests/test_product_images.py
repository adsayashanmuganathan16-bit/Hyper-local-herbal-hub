from app.services.s3_service import s3_service
from app.utils.helpers import get_product_image, serialize_doc, serialize_medicine


def test_legacy_product_image_fields_are_normalized():
    assert serialize_medicine({"_id": "product", "image_url": "/uploads/product.jpg"})["images"] == [
        "/uploads/product.jpg"
    ]
    assert serialize_medicine({"_id": "product", "imageUrl": "https://example.com/product.jpg"})["images"] == [
        "https://example.com/product.jpg"
    ]


def test_cart_item_images_are_made_browser_accessible(monkeypatch):
    monkeypatch.setattr(s3_service, "display_url", lambda value: f"signed:{value}")
    cart = serialize_doc({"items": [{"image": "https://bucket/product.jpg"}]})
    assert cart["items"][0]["image"] == "signed:https://bucket/product.jpg"


def test_first_available_product_image_supports_all_fields():
    assert get_product_image({"images": ["primary.jpg"], "image": "legacy.jpg"}) == "primary.jpg"
    assert get_product_image({"image": "legacy.jpg"}) == "legacy.jpg"
    assert get_product_image({"image_url": "snake.jpg"}) == "snake.jpg"
    assert get_product_image({"imageUrl": "camel.jpg"}) == "camel.jpg"
