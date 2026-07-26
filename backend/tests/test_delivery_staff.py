import asyncio

import pytest
from pydantic import ValidationError

from app.financial.delivery_schemas import DeliveryLocationUpdate, DeliveryStaffCreate
from app.main import app
from app.services.delivery_realtime import DeliveryConnectionManager


def test_delivery_staff_profile_validation():
    staff = DeliveryStaffCreate(name="Nimal Perera", email="nimal@example.com", phone="0771234567",
        password="secret12", vehicle_type="Bike", nic="991234567V")
    assert staff.vehicle_type.value == "Bike"
    with pytest.raises(ValidationError):
        DeliveryStaffCreate(name="N", email="bad", phone="1", password="x", vehicle_type="Car", nic="1")


def test_location_validation():
    location = DeliveryLocationUpdate(order_id="order", latitude=6.9271, longitude=79.8612, accuracy=4)
    assert location.latitude == 6.9271
    with pytest.raises(ValidationError):
        DeliveryLocationUpdate(order_id="order", latitude=100, longitude=79)


def test_courier_location_and_tracking_routes_are_registered():
    routes = {(route.path, method) for route in app.routes for method in getattr(route, "methods", set())}
    assert ("/api/courier/location", "POST") in routes
    assert ("/api/orders/{order_id}/tracking", "GET") in routes


def test_websocket_broadcast_reaches_order_and_admin():
    class Socket:
        def __init__(self): self.events = []
        async def send_json(self, payload): self.events.append(payload)

    async def scenario():
        manager = DeliveryConnectionManager()
        order_socket, admin_socket = Socket(), Socket()
        manager._orders["order-1"].add(order_socket)
        manager._admins.add(admin_socket)
        await manager.broadcast("order-1", {"type": "delivery.location", "latitude": 6.9})
        assert order_socket.events == admin_socket.events
        assert order_socket.events[0]["type"] == "delivery.location"

    asyncio.run(scenario())
