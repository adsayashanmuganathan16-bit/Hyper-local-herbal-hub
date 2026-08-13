import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FiClock, FiMapPin, FiNavigation, FiTruck } from 'react-icons/fi';
import { deliveryApi } from '../api/deliveryApi';
import LiveMap from './LiveMap';
import { formatDateTime } from '../utils/helpers';
import { websocketBaseUrl } from '../utils/apiBase';

const KEY = process.env.REACT_APP_GEOAPIFY_API_KEY;
const POLL_INTERVAL_MS = 7000;

const STATUS_LABELS = {
  pending_assignment: 'Pending',
  placed: 'Pending',
  confirmed: 'Accepted',
  pickup_accepted: 'Accepted',
  preparing: 'Preparing',
  ready_for_pickup: 'Preparing',
  delivery_assigned: 'Assigned to Courier',
  assigned: 'Assigned to Courier',
  picked_up: 'Picked Up',
  on_the_way: 'Out for Delivery',
  in_transit: 'Out for Delivery',
  near_location: 'Out for Delivery',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
};

function point(value, fallbackLabel) {
  if (!value) return null;
  const lat = Number(value.latitude ?? value.lat);
  const lng = Number(value.longitude ?? value.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return {
    lat,
    lng,
    label: value.label || value.formatted || fallbackLabel,
    updatedAt: value.updated_at,
  };
}

function addressText(address) {
  if (!address) return '';
  if (typeof address === 'string') return address;
  return [
    address.address_line1,
    address.address_line2,
    address.city,
    address.state,
    address.pincode,
  ].filter(Boolean).join(', ');
}

async function geocode(address) {
  const text = [
    address?.address_line1,
    address?.address_line2,
    address?.city,
    address?.state,
    address?.pincode,
    'Sri Lanka',
  ].filter(Boolean).join(', ');
  if (!text || !KEY) return null;
  const response = await fetch(
    `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(text)}&limit=1&apiKey=${encodeURIComponent(KEY)}`
  );
  if (!response.ok) return null;
  const feature = (await response.json()).features?.[0];
  return feature
    ? { lat: feature.geometry.coordinates[1], lng: feature.geometry.coordinates[0], label: text }
    : null;
}

export default function RealtimeDeliveryTracker({ orderId }) {
  const [tracking, setTracking] = useState(null);
  const [customerFallback, setCustomerFallback] = useState(null);
  const [sellerFallback, setSellerFallback] = useState(null);
  const [route, setRoute] = useState(null);
  const [refreshError, setRefreshError] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await deliveryApi.track(orderId);
      setTracking(data);
      setRefreshError(false);
    } catch {
      setRefreshError(true);
    }
  }, [orderId]);

  useEffect(() => {
    load();
    const polling = window.setInterval(load, POLL_INTERVAL_MS);
    return () => window.clearInterval(polling);
  }, [load]);

  useEffect(() => {
    const base = websocketBaseUrl();
    const token = localStorage.getItem('herbal_hub_token');
    const socket = new WebSocket(
      `${base}/ws/tracking/${orderId}?token=${encodeURIComponent(token || '')}`
    );
    socket.onmessage = (event) => {
      const payload = JSON.parse(event.data);
      if (payload.type === 'delivery.location') {
        setTracking((current) => ({
          ...current,
          courier_location: payload,
          location: payload,
        }));
      } else {
        load();
      }
    };
    const keepalive = window.setInterval(() => {
      if (socket.readyState === WebSocket.OPEN) socket.send('ping');
    }, 25000);
    return () => {
      window.clearInterval(keepalive);
      socket.close();
    };
  }, [orderId, load]);

  useEffect(() => {
    if (!tracking?.customer_location && tracking?.customer_address) {
      geocode(tracking.customer_address).then(setCustomerFallback);
    }
  }, [tracking?.customer_location, tracking?.customer_address]);

  useEffect(() => {
    if (!tracking?.seller_location && tracking?.seller_address) {
      geocode(tracking.seller_address).then(setSellerFallback);
    }
  }, [tracking?.seller_location, tracking?.seller_address]);

  const customer = useMemo(
    () => point(tracking?.customer_location, 'Customer location') || customerFallback,
    [tracking?.customer_location, customerFallback]
  );
  const seller = useMemo(
    () => point(tracking?.seller_location, 'Seller location') || sellerFallback,
    [tracking?.seller_location, sellerFallback]
  );
  const courier = useMemo(
    () => point(tracking?.courier_location || tracking?.location, 'Courier location'),
    [tracking?.courier_location, tracking?.location]
  );
  const sellerAddress = addressText(tracking?.seller_address);
  const statusKey = tracking?.order_status || tracking?.status || 'placed';
  const displayStatus = STATUS_LABELS[statusKey] || 'Pending';

  return (
    <section className="track-card live-tracking-card mt-6">
      <div className="live-tracking-heading">
        <div>
          <span className="live-tracking-eyebrow">Live courier tracking</span>
          <h3>Delivery journey</h3>
        </div>
        <span className={`live-status-pill status-${statusKey}`}>{displayStatus}</span>
      </div>

      <div className="tracking-location-summary">
        <div>
          <span className="tracking-summary-icon seller"><FiMapPin /></span>
          <p><small>Pickup</small><strong>{seller?.label || 'Seller location pending'}</strong></p>
        </div>
        <div>
          <span className="tracking-summary-icon courier"><FiTruck /></span>
          <p>
            <small>Courier</small>
            <strong>{courier ? (tracking?.staff?.name || 'Live location active') : 'Awaiting GPS update'}</strong>
          </p>
        </div>
        <div>
          <span className="tracking-summary-icon customer"><FiNavigation /></span>
          <p><small>Destination</small><strong>{customer?.label || 'Customer location pending'}</strong></p>
        </div>
      </div>

      {seller && customer ? (
        <LiveMap
          origin={{ ...seller, label: [seller.label, sellerAddress].filter(Boolean).join(' · ') }}
          destination={customer}
          courier={courier}
          onRouteInfo={setRoute}
        />
      ) : (
        <div className="tracking-map-placeholder">
          <FiMapPin size={25} />
          <p>The map will appear when seller and customer coordinates are available.</p>
        </div>
      )}

      <div className="tracking-map-footer">
        <div className="tracking-legend">
          <span><i className="seller" /> Seller</span>
          <span><i className="courier" /> Courier</span>
          <span><i className="customer" /> Customer</span>
        </div>
        {route && (
          <p className="tracking-eta">
            <FiClock />
            <strong>{route.distanceKm.toFixed(1)} km</strong>
            <span>· approximately {Math.ceil(route.timeMinutes)} min</span>
          </p>
        )}
      </div>

      {courier?.updatedAt && (
        <p className="tracking-last-update">
          Courier GPS refreshed {formatDateTime(courier.updatedAt)}
          {' '}· automatically updates every 7 seconds
        </p>
      )}
      {refreshError && (
        <p className="tracking-refresh-error">Live refresh paused. Reconnecting automatically…</p>
      )}
    </section>
  );
}
