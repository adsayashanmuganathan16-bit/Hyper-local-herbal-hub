import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

function emojiIcon(emoji, cls) {
  return L.divIcon({
    className: '',
    html: `<div class="map-pin ${cls || ''}">${emoji}</div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
}

export default function LiveMap({ origin, destination, route = [], courier, heading = 0 }) {
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const courierRef = useRef(null);
  const traveledRef = useRef(null);

  // Init map once.
  useEffect(() => {
    if (!elRef.current || mapRef.current) return;
    const map = L.map(elRef.current, {
      zoomControl: true,
      attributionControl: true,
      scrollWheelZoom: false,
    });
    mapRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    const line = route.length >= 2 ? route : [
      [origin.lat, origin.lng],
      [destination.lat, destination.lng],
    ];

    // Full route (faint) + traveled portion (bold).
    L.polyline(line, { color: '#94d2bd', weight: 5, opacity: 0.6, dashArray: '2,10' }).addTo(map);
    traveledRef.current = L.polyline([line[0]], { color: '#2d6a4f', weight: 5 }).addTo(map);

    L.marker([origin.lat, origin.lng], { icon: emojiIcon('🏪', 'pin-store') })
      .addTo(map)
      .bindPopup(`<b>Pickup</b><br/>${origin.label}`);
    L.marker([destination.lat, destination.lng], { icon: emojiIcon('🏠', 'pin-home') })
      .addTo(map)
      .bindPopup(`<b>Delivering to</b><br/>${destination.label}`);

    courierRef.current = L.marker([courier?.lat ?? origin.lat, courier?.lng ?? origin.lng], {
      icon: emojiIcon('🛵', 'pin-courier'),
      zIndexOffset: 1000,
    })
      .addTo(map)
      .bindPopup('<b>Your delivery partner</b>');

    map.fitBounds(L.latLngBounds(line), { padding: [40, 40] });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []); // eslint-disable-line

  // Move courier + grow traveled path as position updates.
  useEffect(() => {
    if (!mapRef.current || !courier) return;
    if (courierRef.current) courierRef.current.setLatLng([courier.lat, courier.lng]);
    if (traveledRef.current) {
      const line = route.length >= 2 ? route : [
        [origin.lat, origin.lng],
        [destination.lat, destination.lng],
      ];
      // Traveled = route points already passed + current courier position.
      const passed = line.filter((_, i) => i / (line.length - 1) <= (courier.t ?? 0));
      traveledRef.current.setLatLngs([...passed, [courier.lat, courier.lng]]);
    }
  }, [courier, route, origin, destination]);

  return <div ref={elRef} className="live-map" />;
}
