import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  FiPhone, FiStar, FiTruck, FiNavigation, FiBell, FiMessageSquare, FiMail, FiMapPin, FiClock,
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import LiveMap from './LiveMap';

// How long (seconds) a live "out for delivery" run takes in this demo.
const RUN_SECONDS = 75;

const START_T = {
  shipped: 0.12,
  out_for_delivery: 0.25,
  delivered: 1,
};

function pointAt(route, t) {
  if (!route || route.length === 0) return null;
  if (t <= 0) return { lat: route[0][0], lng: route[0][1], t: 0 };
  if (t >= 1) return { lat: route[route.length - 1][0], lng: route[route.length - 1][1], t: 1 };
  const seg = (route.length - 1) * t;
  const i = Math.floor(seg);
  const f = seg - i;
  const a = route[i];
  const b = route[i + 1];
  return { lat: a[0] + (b[0] - a[0]) * f, lng: a[1] + (b[1] - a[1]) * f, t };
}

function maskPhone(p) {
  if (!p) return '';
  const digits = p.replace(/\s/g, '');
  return `${digits.slice(0, 3)} ***** ${digits.slice(-3)}`;
}
function maskEmail(e) {
  if (!e || !e.includes('@')) return e || '';
  const [u, d] = e.split('@');
  return `${u.slice(0, 2)}${'*'.repeat(Math.max(1, u.length - 2))}@${d}`;
}

const CHANNEL_META = {
  sms: { icon: <FiMessageSquare size={14} />, label: 'SMS', cls: 'feed-sms' },
  email: { icon: <FiMail size={14} />, label: 'Email', cls: 'feed-email' },
  push: { icon: <FiBell size={14} />, label: 'Push', cls: 'feed-push' },
  status: { icon: <FiTruck size={14} />, label: 'Update', cls: 'feed-status' },
};

export default function DeliveryTracker({ delivery, status }) {
  const { user } = useAuth();
  const isLive = status === 'out_for_delivery' || status === 'shipped';
  const isDelivered = status === 'delivered';

  const [t, setT] = useState(START_T[status] ?? 0);
  const [feed, setFeed] = useState([]);
  const [pushEnabled, setPushEnabled] = useState(
    typeof Notification !== 'undefined' && Notification.permission === 'granted'
  );

  const firedRef = useRef(new Set());
  const feedIdRef = useRef(0);

  const route = delivery.route || [];
  const courier = useMemo(() => pointAt(route, t) || { lat: delivery.origin.lat, lng: delivery.origin.lng, t: 0 },
    [route, t, delivery.origin]);

  const etaMinutes = Math.max(
    isDelivered ? 0 : 1,
    Math.round((delivery.base_eta_minutes || 20) * (1 - t))
  );
  const remainingKm = Math.max(0, Math.round((delivery.distance_km || 5) * (1 - t) * 10) / 10);

  const notify = useMemo(() => {
    return (channel, title, text, { push } = {}) => {
      feedIdRef.current += 1;
      setFeed((prev) => [
        { id: feedIdRef.current, channel, title, text, time: new Date() },
        ...prev,
      ]);
      if (push && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        try {
          // eslint-disable-next-line no-new
          new Notification(title, { body: text, icon: '/logo.png' });
        } catch { /* ignore */ }
      }
    };
  }, []);

  const enablePush = async () => {
    if (typeof Notification === 'undefined') {
      toast.info('This browser does not support notifications');
      return;
    }
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      setPushEnabled(true);
      notify('push', 'Notifications enabled', 'We\'ll alert you as your order gets closer.', { push: true });
      toast.success('Push notifications enabled');
    } else {
      toast.info('Notifications blocked in browser settings');
    }
  };

  // Seed the activity feed based on current status.
  useEffect(() => {
    const agent = delivery.agent?.name || 'your delivery partner';
    const seeded = [];
    const add = (channel, title, text) => {
      feedIdRef.current += 1;
      seeded.push({ id: feedIdRef.current, channel, title, text, time: new Date() });
    };
    if (isDelivered) {
      add('status', 'Delivered', 'Your order was delivered. Enjoy!');
      add('email', 'Email sent', `Delivery receipt sent to ${maskEmail(user?.email)}`);
      add('sms', 'SMS sent', `Delivered by ${agent}. Rate your experience.`);
    } else if (status === 'out_for_delivery') {
      add('sms', 'SMS sent', `${agent} is out for delivery to ${maskPhone(delivery.recipient_phone)}`);
      add('push', 'Out for delivery', `${agent} picked up your order and is on the way.`);
      add('status', 'Dispatched', 'Left the Herbal Hub store.');
    } else if (status === 'shipped') {
      add('status', 'Shipped', 'Your order has been shipped and is in transit.');
      add('email', 'Email sent', `Shipping details sent to ${maskEmail(user?.email)}`);
    } else {
      add('status', 'Order confirmed', 'We are preparing your order for dispatch.');
    }
    setFeed(seeded.reverse());
  }, []); // eslint-disable-line

  // Live animation: advance t toward ~0.98 over RUN_SECONDS.
  useEffect(() => {
    if (!isLive) return undefined;
    const start = START_T[status] ?? 0.2;
    const stepPerSec = (0.98 - start) / RUN_SECONDS;
    const id = setInterval(() => {
      setT((prev) => Math.min(0.98, prev + stepPerSec));
    }, 1000);
    return () => clearInterval(id);
  }, [isLive, status]);

  // Fire milestone notifications as the courier progresses.
  useEffect(() => {
    if (!isLive) return;
    const agent = delivery.agent?.name || 'Your partner';
    const fire = (key, fn) => {
      if (firedRef.current.has(key)) return;
      firedRef.current.add(key);
      fn();
    };
    if (t >= 0.5) {
      fire('half', () => notify('push', 'On the way', `${agent} is halfway to you.`, { push: true }));
    }
    if (t >= 0.8) {
      fire('near', () => {
        notify('sms', 'SMS sent', `Arriving soon (~${Math.max(1, Math.round((delivery.base_eta_minutes || 20) * 0.2))} min). Please be available.`);
        notify('push', 'Almost there', `${agent} is arriving shortly.`, { push: true });
        toast.info('Your delivery is arriving shortly');
      });
    }
    if (t >= 0.97) {
      fire('arrived', () => notify('push', 'At your doorstep', `${agent} has reached your location.`, { push: true }));
    }
  }, [t, isLive, notify, delivery.agent, delivery.base_eta_minutes]);

  const agent = delivery.agent || {};

  return (
    <div className="dt">
      {/* ETA banner */}
      <div className={`dt-eta ${isDelivered ? 'dt-eta-done' : ''}`}>
        <div className="dt-eta-main">
          <FiClock size={22} />
          <div>
            <span className="dt-eta-value">
              {isDelivered ? 'Delivered' : `Arriving in ~${etaMinutes} min`}
            </span>
            <span className="dt-eta-sub">
              {isDelivered
                ? 'Thanks for shopping with Herbal Hub'
                : `${remainingKm} km away • ${delivery.distance_km} km total`}
            </span>
          </div>
        </div>
        {isLive && (
          <div className="dt-eta-pulse">
            <span className="dot" /> Live
          </div>
        )}
      </div>

      {/* Map */}
      <LiveMap
        origin={delivery.origin}
        destination={delivery.destination}
        route={route}
        courier={courier}
      />

      {/* Agent + notifications */}
      <div className="dt-grid">
        <div className="dt-card dt-agent">
          <div className="dt-agent-head">
            <img src={agent.photo} alt={agent.name} className="dt-agent-photo" />
            <div>
              <span className="dt-agent-name">{agent.name}</span>
              <span className="dt-agent-role">Delivery Partner</span>
              <span className="dt-agent-rating"><FiStar size={13} /> {agent.rating?.toFixed(1)}</span>
            </div>
          </div>
          <div className="dt-agent-meta">
            <div><FiTruck size={15} /> {agent.vehicle}</div>
            <div><FiNavigation size={15} /> {agent.vehicle_number}</div>
            <div><FiMapPin size={15} /> {delivery.destination?.label}</div>
          </div>
          <a href={`tel:${(agent.phone || '').replace(/\s/g, '')}`} className="btn btn-primary btn-sm dt-call">
            <FiPhone size={15} /> Call {agent.name?.split(' ')[0]}
          </a>
        </div>

        <div className="dt-card dt-feed-card">
          <div className="dt-feed-head">
            <h3>Notifications</h3>
            {!pushEnabled && (
              <button className="btn btn-ghost btn-sm" onClick={enablePush}>
                <FiBell size={14} /> Enable push
              </button>
            )}
            {pushEnabled && <span className="dt-push-on"><FiBell size={13} /> Push on</span>}
          </div>
          <div className="dt-feed">
            {feed.map((f) => {
              const meta = CHANNEL_META[f.channel] || CHANNEL_META.status;
              return (
                <div key={f.id} className={`dt-feed-item ${meta.cls}`}>
                  <span className="dt-feed-icon">{meta.icon}</span>
                  <div className="dt-feed-body">
                    <div className="dt-feed-top">
                      <span className="dt-feed-title">{f.title}</span>
                      <span className="dt-feed-tag">{meta.label}</span>
                    </div>
                    <span className="dt-feed-text">{f.text}</span>
                    <span className="dt-feed-time">
                      {f.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
