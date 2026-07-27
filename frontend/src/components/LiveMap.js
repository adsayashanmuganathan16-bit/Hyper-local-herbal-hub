import React, { useEffect, useRef, useState } from 'react';
import { FiMapPin } from 'react-icons/fi';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const GEOAPIFY_KEY = process.env.REACT_APP_GEOAPIFY_API_KEY;
const UPDATE_INTERVAL_MS = 3000;

function markerIcon(label, className) {
  return L.divIcon({
    className: '',
    html: `<div class="geo-marker ${className}"><span>${label}</span></div>`,
    iconSize: [44, 44],
    iconAnchor: [22, 40],
    popupAnchor: [0, -38],
  });
}

function validPoint(point) {
  return point && Number.isFinite(Number(point.lat)) && Number.isFinite(Number(point.lng));
}

function geometryToLatLngs(geometry) {
  if (!geometry?.coordinates) return [];
  const lines = geometry.type === 'MultiLineString' ? geometry.coordinates : [geometry.coordinates];
  return lines.flat().map(([lng, lat]) => [lat, lng]);
}

export default function LiveMap({ origin, destination, courier, onRouteInfo }) {
  const elementRef = useRef(null);
  const mapRef = useRef(null);
  const courierMarkerRef = useRef(null);
  const travelledRef = useRef(null);
  const routeCoordinatesRef = useRef([]);
  const latestCourierRef = useRef(courier);
  const [error, setError] = useState('');

  useEffect(() => { latestCourierRef.current = courier; }, [courier]);

  useEffect(() => {
    if (!elementRef.current || mapRef.current || !validPoint(origin) || !validPoint(destination)) return undefined;
    const map = L.map(elementRef.current, { scrollWheelZoom: false, zoomControl: true });
    mapRef.current = map;

    if (!GEOAPIFY_KEY) {
      setError('Add REACT_APP_GEOAPIFY_API_KEY to display the delivery map.');
      map.setView([destination.lat, destination.lng], 12);
      return () => { map.remove(); mapRef.current = null; };
    }

    L.tileLayer(
      `https://maps.geoapify.com/v1/tile/osm-bright/{z}/{x}/{y}.png?apiKey=${encodeURIComponent(GEOAPIFY_KEY)}`,
      {
        maxZoom: 20,
        attribution: 'Powered by Geoapify | © OpenStreetMap contributors',
      }
    ).addTo(map);

    const sellerPoint = [Number(origin.lat), Number(origin.lng)];
    const customerPoint = [Number(destination.lat), Number(destination.lng)];
    L.marker(sellerPoint, { icon: markerIcon('S', 'geo-marker-seller') })
      .addTo(map).bindPopup(`<strong>Seller location</strong><br>${origin.label || 'Herbal Hub seller'}`);
    L.marker(customerPoint, { icon: markerIcon('C', 'geo-marker-customer') })
      .addTo(map).bindPopup(`<strong>Customer location</strong><br>${destination.label || 'Delivery address'}`);
    if (validPoint(courier)) {
      courierMarkerRef.current = L.marker(
        [courier.lat, courier.lng],
        { icon: markerIcon('●', 'geo-marker-courier'), zIndexOffset: 1000 }
      ).addTo(map).bindPopup('<strong>Courier location</strong><br>Live location');
    }

    map.fitBounds(L.latLngBounds([sellerPoint, customerPoint]), { padding: [55, 55] });

    const controller = new AbortController();
    const routeOrigin = validPoint(courier) ? courier : origin;
    const waypoints = `${routeOrigin.lat},${routeOrigin.lng}|${destination.lat},${destination.lng}`;
    const routingUrl = `https://api.geoapify.com/v1/routing?waypoints=${encodeURIComponent(waypoints)}&mode=drive&apiKey=${encodeURIComponent(GEOAPIFY_KEY)}`;
    fetch(routingUrl, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('Geoapify could not calculate this route');
        return response.json();
      })
      .then((result) => {
        const feature = result.features?.[0];
        const coordinates = geometryToLatLngs(feature?.geometry);
        if (coordinates.length < 2) throw new Error('No driving route was found');
        routeCoordinatesRef.current = coordinates;
        L.polyline(coordinates, { color: '#86b397', weight: 7, opacity: .75 }).addTo(map);
        travelledRef.current = L.polyline([coordinates[0]], { color: '#143d2b', weight: 7 }).addTo(map);
        const visibleBounds = L.latLngBounds(coordinates);
        visibleBounds.extend(sellerPoint);
        map.fitBounds(visibleBounds, { padding: [55, 55] });
        onRouteInfo?.({
          distanceKm: Number(feature.properties?.distance || 0) / 1000,
          timeMinutes: Number(feature.properties?.time || 0) / 60,
        });
      })
      .catch((routeError) => {
        if (routeError.name !== 'AbortError') setError(routeError.message);
      });

    const markerTimer = window.setInterval(() => {
      const position = latestCourierRef.current;
      if (!validPoint(position) || !courierMarkerRef.current) return;
      courierMarkerRef.current.setLatLng([position.lat, position.lng]);
      const route = routeCoordinatesRef.current;
      if (route.length && travelledRef.current) {
        const progress = Math.max(0, Math.min(1, Number(position.t || 0)));
        const index = Math.floor(progress * (route.length - 1));
        travelledRef.current.setLatLngs([...route.slice(0, index + 1), [position.lat, position.lng]]);
      }
    }, UPDATE_INTERVAL_MS);

    return () => {
      controller.abort();
      window.clearInterval(markerTimer);
      map.remove();
      mapRef.current = null;
    };
  }, [origin?.lat, origin?.lng, destination?.lat, destination?.lng, courier?.lat, courier?.lng, onRouteInfo]);

  return <div className="geoapify-map-shell">
    <div ref={elementRef} className="live-map" aria-label="Live Geoapify delivery map" />
    <div className="geoapify-map-brand"><FiMapPin /> Geoapify · OpenStreetMap</div>
    {error && <div className="geoapify-map-error">{error}</div>}
  </div>;
}
