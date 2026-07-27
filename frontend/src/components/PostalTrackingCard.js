import React from 'react';
import { FiCalendar, FiClock, FiPackage, FiTruck } from 'react-icons/fi';
import { formatCurrency, formatDateTime } from '../utils/helpers';
import { formatParcelWeight } from '../utils/shipping';

const STEPS = [
  ['pending', 'Pending'],
  ['accepted', 'Accepted'],
  ['packed', 'Packed'],
  ['shipped', 'Shipped via Sri Lanka Post'],
  ['in_transit', 'In Transit'],
  ['delivered', 'Delivered'],
];

export default function PostalTrackingCard({ order }) {
  const currentStatus = order.delivery_status || 'pending';
  const activeIndex = Math.max(0, STEPS.findIndex(([key]) => key === currentStatus));

  return (
    <section className="track-card postal-tracking-card">
      <div className="postal-card-heading">
        <div>
          <span>Manual postal tracking</span>
          <h3>Sri Lanka Post shipment</h3>
        </div>
        <span className={`postal-current-status status-${currentStatus}`}>
          {STEPS[activeIndex]?.[1] || currentStatus}
        </span>
      </div>

      <div className="postal-detail-grid">
        <div><FiTruck /><span>Courier Service<strong>{order.courier_service || 'Sri Lanka Post'}</strong></span></div>
        <div><FiPackage /><span>Tracking Number<strong>{order.tracking_number || 'Assigned after dispatch'}</strong></span></div>
        <div><FiCalendar /><span>Shipping Date<strong>{order.shipping_date ? formatDateTime(order.shipping_date) : 'Not shipped yet'}</strong></span></div>
        <div><FiPackage /><span>Parcel Weight<strong>{formatParcelWeight(order.parcel_weight)}</strong></span></div>
        <div><FiTruck /><span>Shipping Fee<strong>{formatCurrency(order.shipping_fee ?? order.delivery_charge ?? 0)}</strong></span></div>
        <div><FiClock /><span>Last Updated<strong>{order.last_status_updated ? formatDateTime(order.last_status_updated) : formatDateTime(order.updated_at)}</strong></span></div>
      </div>

      <div className="postal-timeline" aria-label="Postal delivery progress">
        {STEPS.map(([key, label], index) => (
          <div className={`postal-step ${index <= activeIndex ? 'complete' : ''} ${index === activeIndex ? 'current' : ''}`} key={key}>
            <span>{index < activeIndex ? '✓' : index + 1}</span>
            <small>{label}</small>
          </div>
        ))}
      </div>
    </section>
  );
}
