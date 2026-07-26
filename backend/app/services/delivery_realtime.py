import asyncio
from collections import defaultdict

from fastapi import WebSocket


class DeliveryConnectionManager:
    def __init__(self):
        self._orders: dict[str, set[WebSocket]] = defaultdict(set)
        self._admins: set[WebSocket] = set()
        self._lock = asyncio.Lock()

    async def connect_order(self, order_id: str, socket: WebSocket):
        await socket.accept()
        async with self._lock:
            self._orders[order_id].add(socket)

    async def connect_admin(self, socket: WebSocket):
        await socket.accept()
        async with self._lock:
            self._admins.add(socket)

    async def disconnect(self, socket: WebSocket):
        async with self._lock:
            self._admins.discard(socket)
            for sockets in self._orders.values():
                sockets.discard(socket)

    async def broadcast(self, order_id: str, payload: dict):
        sockets = list(self._orders.get(order_id, set()) | self._admins)
        for socket in sockets:
            try:
                await socket.send_json(payload)
            except Exception:
                await self.disconnect(socket)


delivery_connections = DeliveryConnectionManager()
