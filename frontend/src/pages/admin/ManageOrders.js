import React, { useState, useEffect } from 'react';
import { adminApi } from '../../api/adminApi';
import { formatCurrency, formatDateTime, formatStatus, getStatusColor } from '../../utils/helpers';
import { toast } from 'react-toastify';
import Loading from '../../components/Loading';

const STATUSES = ['placed', 'confirmed', 'packed', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'returned'];

export default function ManageOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    adminApi.getAllOrders(filter ? { status: filter } : {}).then(({ data }) => setOrders(data.items || []))
      .catch(() => {}).finally(() => setLoading(false));
  }, [filter]);

  const handleStatusUpdate = async (orderId, newStatus) => {
    try {
      await adminApi.updateOrderStatus(orderId, { status: newStatus });
      toast.success(`Order updated to ${formatStatus(newStatus)}`);
      setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, status: newStatus } : o));
    } catch { toast.error('Update failed'); }
  };

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
                                <th>Date</th>
                                <th>Update Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {orders.length === 0 ? (
                                <tr><td colSpan={7} className="text-center text-gray" style={{ padding: 40 }}>No orders found</td></tr>
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
                                  <td><span className={`badge ${getStatusColor(order.status)}`}>{formatStatus(order.status)}</span></td>
                                  <td className="text-sm text-gray">{formatDateTime(order.created_at)}</td>
                                  <td>
                                    <select
                                      className="form-input form-select"
                                      style={{ padding: '6px 30px 6px 10px', fontSize: 13, minWidth: 140 }}
                                      value={order.status}
                                      onChange={(e) => handleStatusUpdate(order.id, e.target.value)}
                                    >
                                      {STATUSES.map((s) => <option key={s} value={s}>{formatStatus(s)}</option>)}
                                    </select>
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