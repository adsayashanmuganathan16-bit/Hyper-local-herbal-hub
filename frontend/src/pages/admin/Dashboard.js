import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiUsers, FiPackage, FiDollarSign, FiFileText, FiArrowRight } from 'react-icons/fi';
import { adminApi } from '../../api/adminApi';
import { formatCurrency, formatDateTime, formatStatus, getStatusColor } from '../../utils/helpers';
import Loading from '../../components/Loading';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.getDashboard().then(({ data }) => setStats(data))
      .catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading />;
  if (!stats) return <div className="empty-state"><h3>Failed to load dashboard</h3></div>;

  const statCards = [
    { label: 'Total Users', value: stats.total_users, icon: <FiUsers size={22} />, bg: 'var(--green-100)', color: 'var(--green-800)' },
    { label: 'Total Products', value: stats.total_medicines, icon: <FiPackage size={22} />, bg: '#dbeafe', color: '#1e40af' },
    { label: 'Total Orders', value: stats.total_orders, icon: <FiPackage size={22} />, bg: '#f3e8ff', color: '#6b21a8' },
    { label: 'Total Revenue', value: formatCurrency(stats.total_revenue), icon: <FiDollarSign size={22} />, bg: '#dcfce7', color: '#166534' },
    { label: 'Admin Commission', value: formatCurrency(stats.total_commission), icon: <FiDollarSign size={22} />, bg: '#dcfce7', color: '#166534' },
    { label: 'Pending Payouts', value: formatCurrency(stats.pending_payouts), icon: <FiFileText size={22} />, bg: '#fef3c7', color: '#92400e' },
  ];

  return (
    <div className="page-wrapper">
      <section className="dashboard-page admin-dashboard-page">
        <div className="container">
          <div className="dashboard-stats">
            {statCards.map((s) => (
              <div key={s.label} className="stat-card admin-stat-card">
                <div className="stat-card-head">
                  <div className="stat-icon" style={{ background: s.bg, color: s.color }}>{s.icon}</div>
                  <span>Platform metric</span>
                </div>
                <div className="stat-value">{s.value}</div>
                <div className="stat-label">{s.label}</div>
              </div>
            ))}
          </div>

          <div className="dashboard-overview-grid">
            {/* Orders by Status */}
            <div className="admin-card dashboard-status-card">
              <div className="admin-panel-heading">
                <div><span>Order health</span><h2 className="admin-card-title">Orders by Status</h2></div>
                <strong>{stats.total_orders || 0}</strong>
              </div>
              <div className="status-bars">
                {Object.entries(stats.orders_by_status || {}).map(([status, count]) => (
                  <div key={status} className="status-bar-row">
                    <span className="text-sm font-medium">{formatStatus(status)}</span>
                    <div className="status-bar-track">
                      <div className="status-bar-fill" style={{ width: `${Math.min(100, stats.total_orders ? (count / stats.total_orders) * 100 : 0)}%` }} />
                    </div>
                    <span className="status-count">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Orders */}
            <div className="admin-card dashboard-recent-card">
              <div className="admin-panel-heading">
                <div><span>Latest activity</span><h2 className="admin-card-title">Recent Orders</h2></div>
                <Link to="/admin/orders" className="admin-view-all">View all <FiArrowRight size={14} /></Link>
              </div>
              <div className="dashboard-table-scroll">
                <table className="data-table">
                  <thead><tr><th>Order ID</th><th>Amount</th><th>Status</th><th>Payment</th><th>Date</th></tr></thead>
                  <tbody>
                    {(stats.recent_orders || []).map((order) => (
                      <tr key={order.id}>
                        <td><Link to={`/orders/${order.id}`} className="font-semibold text-green">#{order.id?.slice(0, 8).toUpperCase()}</Link></td>
                        <td className="font-semibold">{formatCurrency(order.final_amount)}</td>
                        <td><span className={`badge ${getStatusColor(order.status)}`}>{formatStatus(order.status)}</span></td>
                        <td><span className={`badge ${getStatusColor(order.payment_status)}`}>{formatStatus(order.payment_status)}</span></td>
                        <td className="text-gray text-sm">{formatDateTime(order.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
