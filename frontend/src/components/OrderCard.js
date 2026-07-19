import React from 'react';
import { Link } from 'react-router-dom';
import { FiChevronRight } from 'react-icons/fi';
import { formatCurrency, formatDateTime, formatStatus, getStatusColor } from '../utils/helpers';

export default function OrderCard({ order }) {
  const statusSteps = ['placed', 'confirmed', 'packed', 'shipped', 'out_for_delivery', 'delivered'];
  const currentStepIndex = statusSteps.indexOf(order.status);
  const isCancelled = order.status === 'cancelled' || order.status === 'returned';

  return (
    <div className="order-card">
      <div className="order-card-header">
        <div>
          <span className="font-bold">Order #{order.id?.slice(0, 8).toUpperCase()}</span>
          <span className="text-gray text-sm" style={{ marginLeft: 12 }}>{formatDateTime(order.created_at)}</span>
        </div>
        <span className={`badge ${getStatusColor(order.status)}`}>{formatStatus(order.status)}</span>
      </div>

      {!isCancelled && (
        <div className="order-progress">
          {statusSteps.map((step, i) => (
            <div key={step} className={`progress-step ${i <= currentStepIndex ? 'active' : ''} ${i === currentStepIndex ? 'current' : ''}`}>
              <div className="progress-dot" />
              {i < statusSteps.length - 1 && <div className="progress-line" />}
            </div>
          ))}
        </div>
      )}

      <div className="order-card-items">
        {order.items?.slice(0, 3).map((item, i) => (
          <div key={i} className="order-card-item-row">
            <span className="text-sm">{item.name} × {item.quantity}</span>
            <span className="text-sm font-semibold">{formatCurrency(item.price * item.quantity)}</span>
          </div>
        ))}
        {order.items?.length > 3 && <p className="text-gray text-xs">+{order.items.length - 3} more items</p>}
      </div>

      <div className="order-card-footer">
        <div className="order-card-total">
          <span className="text-gray text-sm">Total:</span>
          <span className="font-bold text-lg text-green">{formatCurrency(order.final_amount)}</span>
        </div>
        <Link to={`/orders/${order.id}`} className="btn btn-ghost btn-sm">
          View Details <FiChevronRight size={14} />
        </Link>
      </div>
    </div>
  );
}
