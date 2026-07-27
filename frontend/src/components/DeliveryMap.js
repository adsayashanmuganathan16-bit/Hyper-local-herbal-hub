import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const GEOAPIFY_KEY = process.env.REACT_APP_GEOAPIFY_API_KEY;

export default function DeliveryMap({ latitude, longitude, label = 'Delivery location' }) {
  const elementRef = useRef(null);

  useEffect(() => {
    if (!elementRef.current || latitude == null || longitude == null || !GEOAPIFY_KEY) return undefined;
    const map = L.map(elementRef.current, { scrollWheelZoom: false }).setView([latitude, longitude], 15);
    L.tileLayer(
      `https://maps.geoapify.com/v1/tile/osm-bright/{z}/{x}/{y}.png?apiKey=${encodeURIComponent(GEOAPIFY_KEY)}`,
      { maxZoom: 20, attribution: 'Powered by Geoapify | © OpenStreetMap contributors' }
    ).addTo(map);
    L.circleMarker([latitude, longitude], {
      radius: 10, color: '#fff', weight: 3, fillColor: '#143d2b', fillOpacity: 1,
    }).addTo(map).bindPopup(label).openPopup();
    return () => map.remove();
  }, [latitude, longitude, label]);

  if (latitude == null || longitude == null) return <div className="delivery-map delivery-map--empty">Location unavailable</div>;
  if (!GEOAPIFY_KEY) return <div className="delivery-map delivery-map--empty">Geoapify API key is not configured</div>;
  return <div ref={elementRef} className="delivery-map" aria-label={label} />;
}
