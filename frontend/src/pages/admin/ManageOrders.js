import React, { useState, useEffect } from 'react';
import { adminApi } from '../../api/adminApi';
import { formatCurrency, formatDateTime, formatStatus, getStatusColor } from '../../utils/helpers';
import { toast } from 'react-toastify';
import Loading from '../../components/Loading';
import PostalShippingControls from '../../components/PostalShippingControls';

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
                        <div className="admin-card" style={{ padding: 0, overflow: 'hidden' }}>
                        <div style={{ overflowX: 'auto' }}>
                          <table className="data-table">
                            <thead>
                              <tr>
                                <th>Order ID</th>
                                <th>Items</th>
                                <th>Amount</th>
                                <th>Payment</th>
                                <th>Status</th>
                                <th>Customer Answer</th>
                                <th>Date</th>
                                <th>Postal Shipping</th>
                              </tr>
                            </thead>
                            <tbody>
                              {orders.length === 0 ? (
                                <tr><td colSpan={8} className="text-center text-gray" style={{ padding: 40 }}>No orders found</td></tr>
                              ) : orders.map((order) => (
                                <tr key={order.id}>
                                  <td>
                                    <span className="font-semibold text-green">#{order.id?.slice(0, 8).toUpperCase()}</span>
                                    <br /><span className="text-xs text-gray">{order.items?.length} item(s)</span>
                                  </td>
                                  <td className="text-sm">
                                    {order.items?.slice(0, 2).map((item, i) => (
                                      <span key={i}>{item.name} ×{item.quantity}{i < Math.min(2, order.items.length) - 1 ? ', ' : ''}</span>
                                    ))}
                                    {order.items?.length > 2 && <span className="text-gray"> +{order.items.length - 2}</span>}
                                  </td>
                                  <td className="font-semibold">{formatCurrency(order.final_amount)}</td>
                                  <td>
                                    <span className={`badge ${getStatusColor(order.payment_status)}`}>
                                      {formatStatus(order.payment_status)}
                                    </span>
                                    <br /><span className="text-xs text-gray">{order.payment_method?.replace(/_/g, ' ').toUpperCase()}</span>
                                  </td>
                                  <td><span className={`badge ${getStatusColor(order.delivery_status || order.status)}`}>{formatStatus(order.delivery_status || order.status)}</span></td>
                                  <td>{order.customer_confirmed_received ? <span className="badge badge-green">Parcel Received</span> : order.customer_reported_not_received ? <span className="badge badge-red">Not Arrived</span> : <span className="text-xs text-gray">Waiting</span>}</td>
                                  <td className="text-sm text-gray">{formatDateTime(order.created_at)}</td>
                                  <td>
                                    <PostalShippingControls order={order} onUpdated={loadOrders} />
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                </section>
              </div>
            );
          }
