import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
const KEY = process.env.REACT_APP_GEOAPIFY_API_KEY;
const COLORS = { Available: '#22c55e', Busy: '#f59e0b', Offline: '#6b7280' };
export default function DeliveryStaffMap({ staff }) {
  const ref = useRef(null), mapRef = useRef(null), layerRef = useRef(null);
  useEffect(() => { if (!ref.current || mapRef.current) return; const map=L.map(ref.current).setView([7.8731,80.7718],7); mapRef.current=map;
    L.tileLayer(`https://maps.geoapify.com/v1/tile/osm-bright/{z}/{x}/{y}.png?apiKey=${encodeURIComponent(KEY||'')}`,{maxZoom:20,attribution:'Powered by Geoapify | © OpenStreetMap'}).addTo(map);
    layerRef.current=L.layerGroup().addTo(map); return()=>{map.remove();mapRef.current=null;}; },[]);
  useEffect(()=>{const layer=layerRef.current;if(!layer)return;layer.clearLayers();const points=[];staff.forEach(s=>{if(!s.location)return;const p=[s.location.latitude,s.location.longitude];points.push(p);L.circleMarker(p,{radius:10,color:'#fff',weight:2,fillColor:COLORS[s.status]||COLORS.Offline,fillOpacity:1}).bindPopup(`<b>${s.name}</b><br>${s.status}`).addTo(layer);});if(points.length)mapRef.current.fitBounds(points,{padding:[40,40]});},[staff]);
  return <><div ref={ref} className="live-map" style={{height:420}}/><p className="text-sm text-gray">Green = Available · Orange = Busy · Gray = Offline</p></>;
}
