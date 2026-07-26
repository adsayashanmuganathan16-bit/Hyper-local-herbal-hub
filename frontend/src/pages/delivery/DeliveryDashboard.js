import React, { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { deliveryApi } from '../../api/deliveryApi';
import Loading from '../../components/Loading';
import { formatCurrency, formatStatus } from '../../utils/helpers';
import RealtimeDeliveryTracker from '../../components/RealtimeDeliveryTracker';

const ACTIONS = {
  assigned: [['accept', 'Accept Delivery'], ['reject', 'Reject']],
  pickup_accepted: [['picked_up', 'Confirm Pickup']],
  picked_up: [['start', 'Start Delivery']],
  on_the_way: [['near', 'Near Customer'], ['complete', 'Complete Delivery']],
  near_location: [['complete', 'Complete Delivery']],
};

export default function DeliveryDashboard() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const watchRef = useRef(null);
  const lastSentRef = useRef(0);
  const active = items.find(({ delivery }) => ['on_the_way', 'near_location'].includes(delivery.status));
  const load = useCallback(() => deliveryApi.getAssignments().then(({ data }) => setItems(data.items || [])).finally(() => setLoading(false)), []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!active || !navigator.geolocation) return undefined;
    watchRef.current = navigator.geolocation.watchPosition(({ coords }) => {
      const now = Date.now();
      if (now - lastSentRef.current < 7000) return;
      lastSentRef.current = now;
      deliveryApi.updateLocation({ order_id: active.order.id, latitude: coords.latitude, longitude: coords.longitude,
        accuracy: coords.accuracy, heading: coords.heading, speed: coords.speed })
        .catch((error) => toast.error(error.response?.data?.detail || 'Live location update failed.'));
    }, () => toast.error('Enable location access to provide live delivery tracking.'), { enableHighAccuracy: true, maximumAge: 2000 });
    return () => navigator.geolocation.clearWatch(watchRef.current);
  }, [active?.order?.id]);
  const act = async (id, action) => {
    try { await deliveryApi.action(id, action); toast.success(`Delivery ${formatStatus(action)}`); await load(); }
    catch (error) { toast.error(error.response?.data?.detail || 'Delivery update failed'); }
  };
  if (loading) return <Loading />;
  return <div className="page-wrapper"><section className="section"><div className="container">
    <h1 className="section-title">Delivery Staff Dashboard</h1>
    <p className="text-gray mb-6">Your live GPS is shared only while an accepted delivery is active.</p>
    <div className="dashboard-grid">
      {items.map(({ delivery, order }) => <article className="admin-card" key={delivery.id}>
        <h3>Order #{order.id.slice(0, 8).toUpperCase()}</h3>
        <p><b>Status:</b> {formatStatus(delivery.status)}</p><p><b>Amount:</b> {formatCurrency(order.final_amount)}</p>
        <p><b>Pickup:</b> Seller location shown in live tracking</p>
        <p><b>Customer:</b> {order.address?.address_line1}, {order.address?.city}</p>
        <div className="flex gap-2 mt-4">{(ACTIONS[delivery.status] || []).map(([action, label]) =>
          <button key={action} className={`btn ${action === 'reject' ? 'btn-danger' : 'btn-primary'} btn-sm`} onClick={() => act(delivery.id, action)}>{label}</button>)}</div>
        {!['assigned','delivered','pending_assignment'].includes(delivery.status) && <RealtimeDeliveryTracker orderId={order.id}/>} 
      </article>)}
      {!items.length && <div className="admin-card dashboard-empty">No deliveries assigned.</div>}
    </div>
  </div></section></div>;
}
