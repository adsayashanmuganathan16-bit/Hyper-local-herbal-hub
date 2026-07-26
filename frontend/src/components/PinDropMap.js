import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const KEY = process.env.REACT_APP_GEOAPIFY_API_KEY;
const pinIcon = L.divIcon({ className: '', html: '<div class="pin-drop-marker">●</div>', iconSize: [38, 46], iconAnchor: [19, 42] });

export default function PinDropMap({ center, position, onSelect }) {
  const elementRef = useRef(null), mapRef = useRef(null), markerRef = useRef(null), callbackRef = useRef(onSelect);
  useEffect(() => { callbackRef.current = onSelect; }, [onSelect]);
  useEffect(() => {
    if (!elementRef.current || mapRef.current || !center) return undefined;
    const map = L.map(elementRef.current).setView([center.lat, center.lng], 12); mapRef.current = map;
    L.tileLayer(`https://maps.geoapify.com/v1/tile/osm-bright/{z}/{x}/{y}.png?apiKey=${encodeURIComponent(KEY || '')}`,
      { maxZoom: 20, attribution: 'Powered by Geoapify | © OpenStreetMap contributors' }).addTo(map);
    const setPin = (latlng) => {
      if (!markerRef.current) {
        markerRef.current = L.marker(latlng, { draggable: true, icon: pinIcon }).addTo(map);
        markerRef.current.on('dragend', e => callbackRef.current?.(e.target.getLatLng()));
      } else markerRef.current.setLatLng(latlng);
    };
    map.on('click', event => { setPin(event.latlng); callbackRef.current?.(event.latlng); });
    return () => { map.remove(); mapRef.current = null; markerRef.current = null; };
  }, [center?.lat, center?.lng]);
  useEffect(() => { if (position && mapRef.current) { if (!markerRef.current) markerRef.current = L.marker([position.lat, position.lng], { draggable: true, icon: pinIcon }).addTo(mapRef.current).on('dragend', e => callbackRef.current?.(e.target.getLatLng())); else markerRef.current.setLatLng([position.lat, position.lng]); mapRef.current.panTo([position.lat, position.lng]); } }, [position?.lat, position?.lng]);
  const currentLocation = () => navigator.geolocation?.getCurrentPosition(({coords}) => callbackRef.current?.({lat:coords.latitude,lng:coords.longitude}), () => callbackRef.current?.(null, 'Location permission was denied'), {enableHighAccuracy:true});
  return <div><div ref={elementRef} className="live-map" style={{height:420}} aria-label="Choose delivery location on map"/>
    <button type="button" className="btn btn-secondary mt-3" onClick={currentLocation}>Use My Current Location</button>
    <p className="text-gray text-sm mt-2">Click the map or drag the pin to your exact delivery entrance.</p></div>;
}
