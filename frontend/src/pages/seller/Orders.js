import React, { useEffect, useMemo, useState } from 'react';
import {
  FiCalendar, FiCreditCard, FiEye, FiMapPin, FiPackage, FiPhone,
  FiShoppingBag, FiTrash2, FiTruck, FiUser, FiX,
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import { sellerApi } from '../../api/sellerApi';
import { formatCurrency, formatDateTime, formatStatus, getStatusColor } from '../../utils/helpers';
import Loading from '../../components/Loading';
import PostalShippingControls from '../../components/PostalShippingControls';
import { productImageUrl, useProductImageFallback } from '../../utils/productImage';
import './SellerOrders.css';

const TIMELINE = [
  ['placed', 'Order placed'],
  ['confirmed', 'Confirmed'],
  ['preparing', 'Processing'],
  ['packed', 'Packed'],
  ['shipped', 'Shipped'],
  ['in_transit', 'In transit'],
  ['delivered', 'Delivered'],
];
const STATUS_RANK = {
  placed: 0, pending: 0, confirmed: 1, accepted: 1, preparing: 2, processing: 2,
  packed: 3, ready_to_dispatch: 3, shipped: 4, dispatched: 4,
  in_transit: 5, on_the_way: 5, delivered: 6,
};

function Modal({ title, children, onClose, wide = false }) {
  useEffect(() => {
    const close = (event) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [onClose]);
  return (
    <div className="seller-order-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className={`seller-order-modal ${wide ? 'wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header><div><span>Seller Central</span><h2>{title}</h2></div><button type="button" onClick={onClose} aria-label="Close"><FiX /></button></header>
        {children}
      </section>
    </div>
  );
}

function StatusBadge({ value, type }) {
  return <span className={`seller-order-badge ${type || ''} ${getStatusColor(value)}`}>{formatStatus(value || 'pending')}</span>;
}

function orderDeliveryStatus(order) {
  return order.fulfillment?.status || order.delivery_status || order.status || 'pending';
}

function sellerTotal(order) {
  return (order.items || []).reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0);
}

function canDelete(order) {
  const payment = String(order.payment_status || 'pending').toLowerCase();
  const status = String(order.status || 'pending').toLowerCase();
  const delivery = String(orderDeliveryStatus(order)).toLowerCase();
  const protectedState = ['paid', 'completed'].includes(payment)
    || ['processing', 'ready_to_dispatch', 'packed', 'shipped', 'dispatched', 'in_transit', 'delivered'].includes(delivery)
    || ['processing', 'preparing', 'packed', 'shipped', 'delivered'].includes(status);
  return !protectedState && (
    status === 'cancelled'
    || payment === 'failed'
    || (payment === 'pending' && ['pending', 'awaiting_payment', 'cancelled'].includes(delivery))
  );
}

function Address({ order }) {
  const address = order.customer_address || order.address || {};
  return (
    <>
      {address.address_line1 || address.street || 'Address not provided'}
      {address.address_line2 && <>, {address.address_line2}</>}
      {address.area && <>, {address.area}</>}
      {(address.city || address.state) && <><br />{[address.city, address.state].filter(Boolean).join(', ')}</>}
      {address.pincode && <> {address.pincode}</>}
    </>
  );
}

function DetailsModal({ order, onClose }) {
  const deliveryStatus = orderDeliveryStatus(order);
  const activeRank = STATUS_RANK[deliveryStatus] ?? STATUS_RANK[order.status] ?? 0;
  const stopped = ['cancelled', 'failed', 'returned'].includes(String(order.status).toLowerCase())
    || order.payment_status === 'failed';
  return (
    <Modal title={`Order #${order.id.slice(0, 8).toUpperCase()}`} onClose={onClose} wide>
      <div className="seller-order-modal-body">
        <div className="seller-order-detail-grid">
          <article className="seller-order-detail-panel">
            <h3><FiUser /> Customer information</h3>
            <dl>
              <div><dt>Name</dt><dd>{order.customer?.name || order.address?.name || 'Customer'}</dd></div>
              <div><dt>Phone</dt><dd>{order.customer?.phone || order.address?.phone || 'Not provided'}</dd></div>
              <div><dt>Shipping address</dt><dd><Address order={order} /></dd></div>
            </dl>
          </article>
          <article className="seller-order-detail-panel">
            <h3><FiCreditCard /> Payment information</h3>
            <dl>
              <div><dt>Method</dt><dd>{order.payment_method === 'stripe' ? 'Stripe' : order.payment_method === 'cod' ? 'Cash on Delivery' : formatStatus(order.payment_method)}</dd></div>
              <div><dt>Status</dt><dd><StatusBadge value={order.payment_status} type="payment" /></dd></div>
              <div><dt>Seller total</dt><dd>{formatCurrency(sellerTotal(order))}</dd></div>
              {order.payment?.paid_at && <div><dt>Paid at</dt><dd>{formatDateTime(order.payment.paid_at)}</dd></div>}
            </dl>
          </article>
        </div>

        <article className="seller-order-detail-panel">
          <h3><FiShoppingBag /> Ordered products</h3>
          <div className="seller-order-modal-products">
            {(order.items || []).map((item, index) => (
              <div key={`${item.medicine_id}-${index}`}>
                <img src={productImageUrl(item)} alt="" onError={useProductImageFallback} />
                <div><strong>{item.name}</strong><span>{formatCurrency(item.price)} each</span></div>
                <b>{item.quantity} × {formatCurrency(item.price * item.quantity)}</b>
              </div>
            ))}
          </div>
        </article>

        <article className="seller-order-detail-panel">
          <h3><FiTruck /> Delivery information</h3>
          <div className="seller-order-delivery-details">
            <div><span>Status</span><StatusBadge value={deliveryStatus} type="delivery" /></div>
            <div><span>Courier</span><strong>{order.fulfillment?.courier_company || order.courier_service || 'Not assigned'}</strong></div>
            <div><span>Tracking number</span><strong>{order.fulfillment?.tracking_number || order.tracking_number || 'Not available'}</strong></div>
          </div>
        </article>

        <article className="seller-order-detail-panel">
          <h3><FiPackage /> Complete status timeline</h3>
          {stopped && <div className="seller-order-stopped">Order {formatStatus(order.payment_status === 'failed' ? 'failed' : order.status)}</div>}
          <div className={`seller-order-timeline ${stopped ? 'stopped' : ''}`}>
            {TIMELINE.map(([key, label], index) => (
              <div className={index <= activeRank && !stopped ? 'complete' : ''} key={key}>
                <span>{index < activeRank ? '✓' : index + 1}</span><small>{label}</small>
              </div>
            ))}
          </div>
        </article>
      </div>
    </Modal>
  );
}

export default function SellerOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [trackingOrder, setTrackingOrder] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const load = () => sellerApi.getOrders()
    .then(({ data }) => setOrders(data.items || []))
    .catch((error) => toast.error(error.response?.data?.detail || 'Could not load seller orders'))
    .finally(() => setLoading(false));

  useEffect(() => {
    load();
    const base = (process.env.REACT_APP_API_URL || 'http://localhost:8000').replace(/^http/, 'ws').replace(/\/$/, '');
    const socket = new WebSocket(`${base}/api/notifications/ws?token=${encodeURIComponent(localStorage.getItem('herbal_hub_token') || '')}`);
    socket.onmessage = (event) => {
      const payload = JSON.parse(event.data);
      if (payload.type === 'notification.created') { load(); toast.info(payload.notification.title); }
    };
    const keepalive = setInterval(() => socket.readyState === WebSocket.OPEN && socket.send('ping'), 25000);
    return () => { clearInterval(keepalive); socket.close(); };
  }, []);

  const counts = useMemo(() => ({
    total: orders.length,
    action: orders.filter((order) => ['pending', 'awaiting_payment', 'processing'].includes(orderDeliveryStatus(order))).length,
    shipped: orders.filter((order) => ['shipped', 'dispatched', 'in_transit'].includes(orderDeliveryStatus(order))).length,
  }), [orders]);

  const confirmDelete = async () => {
    if (!canDelete(deleting)) {
      toast.error('Delivered or paid orders cannot be deleted.');
      setDeleting(null);
      return;
    }
    setDeleteBusy(true);
    try {
      await sellerApi.deleteOrder(deleting.id);
      setOrders((current) => current.filter((order) => order.id !== deleting.id));
      setDeleting(null);
      toast.success('Order deleted successfully.');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Could not delete order');
    } finally {
      setDeleteBusy(false);
    }
  };

  if (loading) return <Loading />;
  return (
    <div className="page-wrapper"><section className="dashboard-page seller-orders-page"><div className="container">
      <div className="seller-order-summary seller-order-summary-standalone"><div><b>{counts.total}</b><span>Total orders</span></div><div><b>{counts.action}</b><span>Need attention</span></div><div><b>{counts.shipped}</b><span>In delivery</span></div></div>

      <div className="seller-order-grid">
        {orders.map((order) => {
          const delivery = orderDeliveryStatus(order);
          const product = order.items?.[0] || {};
          const extra = Math.max(0, (order.items?.length || 0) - 1);
          const tracking = order.fulfillment?.tracking_number || order.tracking_number;
          return (
            <article className="seller-order-card" key={order.id}>
              <header>
                <div><span>ORDER ID</span><strong>#{order.id.slice(0, 8).toUpperCase()}</strong></div>
                <time><FiCalendar /> {formatDateTime(order.created_at)}</time>
              </header>
              <div className="seller-order-card-body">
                <div className="seller-order-product">
                  <img src={productImageUrl(product)} alt={product.name || ''} onError={useProductImageFallback} />
                  <div><h2>{product.name || 'Order products'}</h2><p>Quantity: {product.quantity || 0}{extra ? ` · +${extra} more product${extra > 1 ? 's' : ''}` : ''}</p><strong>{formatCurrency(sellerTotal(order))}</strong></div>
                </div>
                <div className="seller-order-facts">
                  <div><FiUser /><span>Customer<strong>{order.customer?.name || order.address?.name || 'Customer'}</strong></span></div>
                  <div><FiCreditCard /><span>Payment<strong>{order.payment_method === 'stripe' ? 'Stripe' : order.payment_method === 'cod' ? 'Cash on Delivery' : formatStatus(order.payment_method)}</strong></span></div>
                  <div><FiTruck /><span>Tracking<strong>{tracking || 'Not available yet'}</strong></span></div>
                </div>
                <div className="seller-order-statuses"><StatusBadge value={order.payment_status} type="payment" /><StatusBadge value={delivery} type="delivery" /></div>
              </div>
              <footer>
                <button className="seller-card-action primary" type="button" onClick={() => setSelected(order)}><FiEye /> View Details</button>
                <button className="seller-card-action" type="button" onClick={() => setTrackingOrder(order)}><FiTruck /> Edit Tracking</button>
                <button className="seller-card-action danger" type="button" onClick={() => setDeleting(order)}><FiTrash2 /> Delete Order</button>
              </footer>
            </article>
          );
        })}
      </div>
      {!orders.length && <div className="seller-order-empty"><FiPackage /><h2>No orders yet</h2><p>New orders from your customers will appear here.</p></div>}
    </div></section>

    {selected && <DetailsModal order={selected} onClose={() => setSelected(null)} />}
    {trackingOrder && <Modal title={`Tracking · #${trackingOrder.id.slice(0, 8).toUpperCase()}`} onClose={() => setTrackingOrder(null)}>
      <div className="seller-order-modal-body">
        <p className="seller-order-modal-intro">Add or update courier and tracking information as this order moves through fulfilment.</p>
        <PostalShippingControls order={trackingOrder} onUpdated={() => { load(); setTrackingOrder(null); }} />
        {!['packed', 'shipped', 'in_transit', 'delivered'].includes(trackingOrder.delivery_status || 'pending') && <p className="seller-order-help">Tracking becomes editable after the order is packed.</p>}
      </div>
    </Modal>}
    {deleting && <Modal title="Delete order" onClose={() => !deleteBusy && setDeleting(null)}>
      <div className="seller-order-delete">
        <span><FiTrash2 /></span>
        <p>Are you sure you want to delete this order? This action cannot be undone.</p>
        {!canDelete(deleting) && <div className="seller-order-delete-warning">Delivered or paid orders cannot be deleted.</div>}
        <div><button className="btn btn-secondary" type="button" disabled={deleteBusy} onClick={() => setDeleting(null)}>Keep Order</button><button className="btn btn-danger" type="button" disabled={deleteBusy || !canDelete(deleting)} onClick={confirmDelete}>{deleteBusy ? 'Deleting…' : 'Delete Order'}</button></div>
      </div>
    </Modal>}
    </div>
  );
}
