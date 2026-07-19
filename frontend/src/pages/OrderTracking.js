import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { FiMapPin, FiTruck, FiPackage, FiCheck, FiArrowLeft } from 'react-icons/fi';
import { orderApi } from '../api/orderApi';
import { deliveryApi } from '../api/deliveryApi';
import { formatCurrency, formatDateTime, formatStatus, getStatusColor } from '../utils/helpers';
import Loading from '../components/Loading';
import DeliveryTracker from '../components/DeliveryTracker';

const STATUS_STEPS = [
  { key: 'placed', label: 'Order Placed', icon: <FiPackage size={18} /> },
  { key: 'confirmed', label: 'Confirmed', icon: <FiCheck size={18} /> },
  { key: 'packed', label: 'Packed', icon: <FiPackage size={18} /> },
  { key: 'shipped', label: 'Shipped', icon: <FiTruck size={18} /> },
  { key: 'out_for_delivery', label: 'Out for Delivery', icon: <FiTruck size={18} /> },
  { key: 'delivered', label: 'Delivered', icon: <FiMapPin size={18} /> },
];

export default function OrderTracking() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [delivery, setDelivery] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      try {
        const { data } = await orderApi.getOrder(id);
        setOrder(data);
        if (data.delivery) setDelivery(data.delivery);
        else {
          try {
            const { data: dData } = await deliveryApi.track(id);
            if (dData.order_id) setDelivery(dData);
          } catch {}
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetch();
  }, [id]);

  if (loading) return <Loading />;
  if (!order) return <div className="empty-state"><h3>Order Not Found</h3></div>;

  const isCancelled = order.status === 'cancelled' || order.status === 'returned';
  const currentStepIndex = STATUS_STEPS.findIndex((s) => s.key === order.status);

  return (
    <div className="page-wrapper">
      <section className="section" style={{ paddingTop: '40px' }}>
        <div className="container-sm">
          <Link to="/orders" className="btn-ghost flex items-center gap-2 mb-6" style={{ color: 'var(--green-800)' }}>
            <FiArrowLeft size={16} /> Back to Orders
          </Link>

          <div className="track-header">
            <div>
              <h1 className="section-title" style={{ marginBottom: 4 }}>Order #{id.slice(0, 8).toUpperCase()}</h1>
              <p className="text-gray text-sm">Placed on {formatDateTime(order.created_at)}</p>
            </div>
            <span className={`badge ${getStatusColor(order.status)}`} style={{ fontSize: 14, padding: '6px 16px' }}>
              {formatStatus(order.status)}
            </span>
          </div>

          {/* Timeline */}
          {!isCancelled && (
            <div className="track-timeline">
              {STATUS_STEPS.map((step, i) => (
                <div key={step.key} className={`timeline-step ${i <= currentStepIndex ? 'completed' : ''} ${i === currentStepIndex ? 'current' : ''}`}>
                  <div className="timeline-dot">{step.icon}</div>
                  <span className="timeline-label">{step.label}</span>
                  {i < STATUS_STEPS.length - 1 && <div className="timeline-line" />}
                </div>
              ))}
            </div>
          )}

          {/* Advanced live delivery tracking */}
          {!isCancelled && delivery && delivery.agent && (
            <DeliveryTracker delivery={delivery} status={order.status} />
          )}

          {/* Order Details */}
          <div className="track-details">
            <div className="track-card">
              <h3>Items Ordered</h3>
              {order.items?.map((item, i) => (
                <div key={i} className="track-item">
                  <div className="flex items-center gap-3">
                    {item.image && <img src={item.image} alt="" style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover' }} />}
                    <div>
                      <span className="font-medium text-sm">{item.name}</span>
                      <span className="text-gray text-xs">Qty: {item.quantity}</span>
                    </div>
                  </div>
                  <span className="font-semibold">{formatCurrency(item.price * item.quantity)}</span>
                </div>
              ))}
              <div className="divider" />
              <div className="cart-summary-row"><span>Subtotal</span><span>{formatCurrency(order.total_amount)}</span></div>
              <div className="cart-summary-row"><span>Delivery</span><span>{order.delivery_charge === 0 ? 'FREE' : formatCurrency(order.delivery_charge)}</span></div>
              {order.discount > 0 && <div className="cart-summary-row"><span>Discount</span><span className="text-green">-{formatCurrency(order.discount)}</span></div>}
              <div className="divider" />
              <div className="cart-summary-row total"><span>Total Paid</span><span>{formatCurrency(order.final_amount)}</span></div>
            </div>

            <div className="track-card">
              <h3>Delivery Address</h3>
              <p className="text-sm" style={{ lineHeight: 1.6 }}>
                {order.address?.name}<br />
                {order.address?.address_line1}<br />
                {order.address?.address_line2 && <>{order.address.address_line2}<br /></>}
                {order.address?.city}, {order.address?.state} - {order.address?.pincode}<br />
                <span className="text-gray">Phone: {order.address?.phone}</span>
              </p>
            </div>

            <div className="track-card">
              <h3>Payment Info</h3>
              <div className="cart-summary-row">
                <span>Method</span>
                <span className="font-medium">{order.payment_method?.replace(/_/g, ' ').toUpperCase()}</span>
              </div>
              <div className="cart-summary-row">
                <span>Status</span>
                <span className={`badge ${getStatusColor(order.payment_status)}`}>{formatStatus(order.payment_status)}</span>
              </div>
            </div>
          </div>

          {order.status === 'delivered' && (
            <div className="text-center mt-6">
              <Link to={`/orders/${id}`} className="btn btn-secondary btn-sm">Download Invoice</Link>
            </div>
          )}
          {!isCancelled && order.status !== 'delivered' && (
            <div className="text-center mt-6">
              <button className="btn btn-danger btn-sm" onClick={async () => {
                if (window.confirm('Cancel this order?')) {
                  await orderApi.cancelOrder(id);
                  window.location.reload();
                }
              }}>Cancel Order</button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}