import React, { useEffect, useState } from 'react';
import { sellerApi } from '../../api/sellerApi';
import { formatCurrency, formatDateTime, formatStatus, getStatusColor } from '../../utils/helpers';
import Loading from '../../components/Loading';
import { toast } from 'react-toastify';
import { Link } from 'react-router-dom';
import PostalShippingControls from '../../components/PostalShippingControls';

export default function SellerOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const load = () => sellerApi.getOrders().then(({ data }) => setOrders(data.items || [])).finally(() => setLoading(false));
  useEffect(() => { load(); const base=(process.env.REACT_APP_API_URL||'http://localhost:8000').replace(/^http/,'ws').replace(/\/$/,'');
    const socket=new WebSocket(`${base}/api/notifications/ws?token=${encodeURIComponent(localStorage.getItem('herbal_hub_token')||'')}`);
    socket.onmessage=event=>{const payload=JSON.parse(event.data);if(payload.type==='notification.created'){load();toast.info(payload.notification.title);}};
    const keepalive=setInterval(()=>socket.readyState===WebSocket.OPEN&&socket.send('ping'),25000);
    return()=>{clearInterval(keepalive);socket.close();}; }, []);
  if (loading) return <Loading />;
  return <div className="page-wrapper"><section className="dashboard-page"><div className="container">
    <div className="dashboard-header"><div className="dashboard-header-copy"><span className="dashboard-eyebrow">Order fulfilment</span><h1 className="dashboard-title">Seller Orders</h1><p className="dashboard-subtitle">Orders containing products supplied by your store.</p></div></div>
    <div className="admin-card dashboard-table-card"><div style={{ overflowX: 'auto' }}><table className="data-table"><thead><tr><th>Order</th><th>Customer</th><th>Your items</th><th>Seller total</th><th>Status</th><th>Customer Answer</th><th>Date</th><th>Action</th></tr></thead><tbody>
      {orders.map((order) => <tr key={order.id}><td className="font-semibold">#{order.id.slice(0, 8).toUpperCase()}</td><td>{order.customer?.name}<br/><small>{order.customer?.phone}</small></td><td>{order.items.map((item) => `${item.name} × ${item.quantity}`).join(', ')}</td><td className="font-semibold">{formatCurrency(order.items.reduce((sum, item) => sum + item.price * item.quantity, 0))}</td><td><span className={`badge ${getStatusColor(order.delivery_status||order.status)}`}>{formatStatus(order.delivery_status||order.status)}</span></td><td>{order.customer_confirmed_received ? <span className="badge badge-green">Parcel Received</span> : order.customer_reported_not_received ? <span className="badge badge-red">Not Arrived</span> : <span className="text-gray text-xs">Waiting for customer</span>}</td><td className="text-gray text-sm">{formatDateTime(order.created_at)}</td><td><PostalShippingControls order={order} onUpdated={load} /><Link className="btn btn-secondary btn-sm" to={`/seller/orders/${order.id}/tracking`}>Customer Location</Link></td></tr>)}
      {!orders.length && <tr><td colSpan="8" className="dashboard-empty">No seller orders yet.</td></tr>}
    </tbody></table></div></div>
  </div></section></div>;
}
