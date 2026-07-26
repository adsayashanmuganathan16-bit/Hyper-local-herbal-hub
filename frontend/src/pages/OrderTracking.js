import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { FiMapPin, FiTruck, FiPackage, FiCheck, FiArrowLeft } from 'react-icons/fi';
import { orderApi } from '../api/orderApi';
import { deliveryApi } from '../api/deliveryApi';
import { formatCurrency, formatDateTime, formatStatus, getStatusColor } from '../utils/helpers';
import Loading from '../components/Loading';
import RealtimeDeliveryTracker from '../components/RealtimeDeliveryTracker';
import DeliveryMap from '../components/DeliveryMap';
import ReviewForm from '../components/ReviewForm';
import ReviewStars from '../components/ReviewStars';
import { reviewApi } from '../api/reviewApi';
import PostalTrackingCard from '../components/PostalTrackingCard';
import { toast } from 'react-toastify';

const STATUS_STEPS = [
  { key: 'placed', label: 'Pending', icon: <FiPackage size={18} /> },
  { key: 'confirmed', label: 'Accepted', icon: <FiCheck size={18} /> },
  { key: 'preparing', label: 'Preparing', icon: <FiCheck size={18} /> },
  { key: 'delivery_assigned', label: 'Assigned to Courier', icon: <FiTruck size={18} /> },
  { key: 'picked_up', label: 'Picked Up', icon: <FiTruck size={18} /> },
  { key: 'on_the_way', label: 'Out for Delivery', icon: <FiTruck size={18} /> },
  { key: 'delivered', label: 'Delivered', icon: <FiMapPin size={18} /> },
];

const STATUS_PROGRESS = {
  placed: 0,
  pending: 0,
  confirmed: 1,
  pickup_accepted: 1,
  preparing: 2,
  packed: 2,
  ready_for_pickup: 2,
  delivery_assigned: 3,
  assigned: 3,
  picked_up: 4,
  on_the_way: 5,
  in_transit: 5,
  near_location: 5,
  out_for_delivery: 5,
  delivered: 6,
};

export default function OrderTracking() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [delivery, setDelivery] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState([]);
  const [reviewingItem, setReviewingItem] = useState(null);
  const [confirmingReceipt, setConfirmingReceipt] = useState(false);
  const [reportingMissing, setReportingMissing] = useState(false);

  useEffect(() => {
    async function fetch() {
      try {
        const { data } = await orderApi.getOrder(id);
        setOrder(data);
        const { data: reviewData } = await reviewApi.getMyReviews({ page: 1 });
        setReviews((reviewData.items || []).filter((review) => review.order_id === id));
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
  const currentStepIndex = STATUS_PROGRESS[order.status] ?? 0;

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

          <PostalTrackingCard order={order} />

          {order.status === 'delivered' && (
            <div className={`receipt-confirmation ${order.customer_confirmed_received ? 'confirmed' : ''}`}>
              <div>
                <strong>
                  {order.customer_confirmed_received
                    ? 'Parcel received and seller informed'
                    : 'Have you received your parcel?'}
                </strong>
                <p>
                  {order.customer_confirmed_received
                    ? `Confirmed ${order.customer_received_at ? formatDateTime(order.customer_received_at) : ''}. You can now review the products.`
                    : 'Confirm receipt to notify the seller and unlock product reviews.'}
                </p>
              </div>
              {!order.customer_confirmed_received && (
                <div className="receipt-actions">
                  <button
                    className="btn btn-primary"
                    disabled={confirmingReceipt || reportingMissing}
                    onClick={async () => {
                      setConfirmingReceipt(true);
                      try {
                        const { data } = await orderApi.confirmReceived(id);
                        setOrder((current) => ({
                          ...current,
                          customer_confirmed_received: true,
                          customer_received_at: data.customer_received_at,
                          customer_reported_not_received: false,
                        }));
                        toast.success(data.message);
                      } catch (error) {
                        toast.error(error.response?.data?.detail || 'Could not confirm receipt');
                      } finally {
                        setConfirmingReceipt(false);
                      }
                    }}
                  >
                    {confirmingReceipt ? 'Confirming…' : 'Confirm Parcel Received'}
                  </button>
                  {!order.customer_reported_not_received ? (
                    <button
                      className="btn btn-secondary"
                      disabled={confirmingReceipt || reportingMissing}
                      onClick={async () => {
                        if (!window.confirm('Report that this parcel has not arrived?')) return;
                        setReportingMissing(true);
                        try {
                          const { data } = await orderApi.reportNotReceived(id);
                          setOrder((current) => ({
                            ...current,
                            customer_reported_not_received: true,
                            not_received_reported_at: data.not_received_reported_at,
                          }));
                          toast.success(data.message);
                        } catch (error) {
                          toast.error(error.response?.data?.detail || 'Could not report the parcel');
                        } finally {
                          setReportingMissing(false);
                        }
                      }}
                    >
                      {reportingMissing ? 'Reporting…' : 'Parcel Not Arrived'}
                    </button>
                  ) : (
                    <span className="missing-parcel-reported">Not-arrived report sent</span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Advanced live delivery tracking */}
          {!isCancelled && <RealtimeDeliveryTracker orderId={id} />}

          {!!order.fulfillments?.length && <div className="track-card mt-6"><h3>Seller Parcels</h3>
            {order.fulfillments.map(parcel=><div className="admin-card mb-4" key={parcel.id}>
              <div className="flex items-center justify-between"><b>{parcel.seller_location?.label||'Seller parcel'}</b><span className={`badge ${getStatusColor(parcel.status)}`}>{formatStatus(parcel.status)}</span></div>
              <p className="text-sm">{parcel.items?.map(item=>`${item.name} × ${item.quantity}`).join(', ')}</p>
              {parcel.courier_company&&<p className="text-sm"><b>Courier:</b> {parcel.courier_company}<br/><b>Tracking:</b> {parcel.tracking_number} {parcel.tracking_url&&<a href={parcel.tracking_url} target="_blank" rel="noreferrer">Open courier tracking</a>}</p>}
              <DeliveryMap latitude={parcel.seller_location?.latitude} longitude={parcel.seller_location?.longitude} label={parcel.seller_location?.label||'Seller company'}/>
            </div>)}
          </div>}

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
                  <div className="track-item-review">
                    <span className="font-semibold">{formatCurrency(item.price * item.quantity)}</span>
                    {order.customer_confirmed_received && (() => {
                      const review = reviews.find((entry) => entry.medicine_id === item.medicine_id);
                      return review
                        ? <span className="order-review-complete"><ReviewStars rating={review.rating} size={13} /> Reviewed</span>
                        : <button className="btn btn-primary btn-sm" onClick={() => setReviewingItem(item)}>Rate &amp; Review</button>;
                    })()}
                  </div>
                </div>
              ))}
              {reviewingItem && (
                <ReviewForm
                  orderId={id}
                  item={reviewingItem}
                  onCancel={() => setReviewingItem(null)}
                  onSubmitted={(review) => {
                    setReviews((current) => [review, ...current]);
                    setReviewingItem(null);
                  }}
                />
              )}
              <div className="divider" />
              <div className="cart-summary-row"><span>Subtotal</span><span>{formatCurrency(order.total_amount)}</span></div>
              <div className="cart-summary-row"><span>Shipping Fee</span><span>{formatCurrency(order.shipping_fee ?? order.delivery_charge ?? 0)}</span></div>
              {order.discount > 0 && <div className="cart-summary-row"><span>Discount</span><span className="text-green">-{formatCurrency(order.discount)}</span></div>}
              <div className="divider" />
              <div className="cart-summary-row total"><span>Order Total</span><span>{formatCurrency(order.final_amount)}</span></div>
            </div>

            <div className="track-card">
              <h3>Delivery Address</h3>
              <p className="text-sm" style={{ lineHeight: 1.6 }}>
                {order.address?.name}<br />
                {order.address?.address_line1}<br />
                {order.address?.address_line2 && <>{order.address.address_line2}<br /></>}
                {order.address?.city}, {order.address?.state} - {order.address?.pincode}<br />
                <span className="text-gray">Phone: {order.address?.phone}</span>
                {order.landmark && <><br/><span>Landmark: {order.landmark}</span></>}
                {order.delivery_note && <><br/><span>Delivery note: {order.delivery_note}</span></>}
              </p>
            </div>

            <div className="track-card">
              <h3>Payment Info</h3>
              <div className="cart-summary-row">
                <span>Method</span>
                <span className="font-medium">{order.payment_method === 'cod' ? 'Cash on Delivery' : order.payment_method === 'mock' ? 'Demo Card Payment' : order.payment_method === 'onepay' ? 'OnePay Online Payment' : order.payment_method === 'payhere' ? 'PayHere Online Payment' : formatStatus(order.payment_method)}</span>
              </div>
              <div className="cart-summary-row">
                <span>Status</span>
                <span className={`badge ${getStatusColor(order.payment_status)}`}>{order.payment_status === 'pending' ? (order.payment_method === 'cod' ? 'Awaiting Cash on Delivery' : `Awaiting ${order.payment_method === 'mock' ? 'Demo Payment' : order.payment_method === 'onepay' ? 'OnePay' : 'PayHere'} Confirmation`) : formatStatus(order.payment_status)}</span>
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
