import React, { useState, useEffect } from 'react';
import { adminApi } from '../../api/adminApi';
import { formatCurrency, formatDateTime, formatStatus, getStatusColor } from '../../utils/helpers';
import { toast } from 'react-toastify';
import Loading from '../../components/Loading';
import PostalShippingControls from '../../components/PostalShippingControls';
import { Calendar, CreditCard, Package, Truck, UserRound } from 'lucide-react';
import { productImageUrl, useProductImageFallback } from '../../utils/productImage';

const STATUSES = ['placed', 'preparing', 'ready_for_pickup', 'delivery_assigned', 'pickup_accepted', 'picked_up', 'on_the_way', 'delivered', 'cancelled', 'returned'];

export default function ManageOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  const loadOrders = () => {
    setLoading(true);
    adminApi.getAllOrders(filter ? { status: filter } : {}).then(({ data }) => setOrders(data.items || []))
      .catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => {
    loadOrders();
  }, [filter]);

  return (
    <div className="page-wrapper">
      <section className="section" style={{ paddingTop: '32px' }}>
        <div className="container">
          <h1 className="section-title mb-6">Manage Orders</h1>
          <div className="tab-nav" style={{ marginBottom: 24 }}>
            <button className={`tab-btn ${!filter ? 'active' : ''}`} onClick={() => setFilter('')}>All</button>
            {STATUSES.map((s) => (
              <button key={s} className={`tab-btn ${filter === s ? 'active' : ''}`} onClick={() => setFilter(s)}>{formatStatus(s)}</button>
            ))}
          </div>
          {loading ? <Loading /> : (
            orders.length === 0 ? <div className="empty-state"><Package/><h3>No orders found</h3><p>Orders matching this status will appear here.</p></div> :
            <div className="admin-order-card-grid">
              {orders.map((order) => <article className="admin-order-card" key={order.id}>
                <header><div><span>ORDER</span><strong>#{order.id?.slice(0,8).toUpperCase()}</strong></div><time><Calendar/> {formatDateTime(order.created_at)}</time></header>
                <div className="admin-order-card-content">
                  <div className="admin-order-item"><img src={productImageUrl(order.items?.[0])} alt="" onError={useProductImageFallback}/><div><h3>{order.items?.[0]?.name || 'Marketplace order'}</h3><p>{order.items?.length || 0} item(s) · {order.items?.reduce((sum,item)=>sum+item.quantity,0) || 0} units</p><b>{formatCurrency(order.final_amount)}</b></div></div>
                  <div className="admin-order-meta">
                    <span><CreditCard/><small>Payment</small><b>{formatStatus(order.payment_method)} · {formatStatus(order.payment_status)}</b></span>
                    <span><Truck/><small>Delivery</small><b>{formatStatus(order.delivery_status || order.status)}</b></span>
                    <span><UserRound/><small>Customer response</small><b>{order.customer_confirmed_received?'Received':order.customer_reported_not_received?'Not arrived':'Waiting'}</b></span>
                  </div>
                  <div className="admin-order-badges"><span className={`badge ${getStatusColor(order.payment_status)}`}>{formatStatus(order.payment_status)}</span><span className={`badge ${getStatusColor(order.delivery_status||order.status)}`}>{formatStatus(order.delivery_status||order.status)}</span></div>
                  <PostalShippingControls order={order} onUpdated={loadOrders}/>
                </div>
              </article>)}
            </div>
                    )}
                  </div>
                </section>
              </div>
            );
          }
