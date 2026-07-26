import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiUsers, FiPackage, FiDollarSign, FiFileText, FiTrendingUp, FiArrowRight } from 'react-icons/fi';
import { adminApi } from '../../api/adminApi';
import { formatCurrency, formatDateTime, formatStatus, getStatusColor } from '../../utils/helpers';
import Loading from '../../components/Loading';
import { useAuth } from '../../context/AuthContext';

export default function AdminDashboard() {
  const { user } = useAuth();
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
    { label: 'Total Revenue', value: formatCurrency(stats.total_revenue), icon: <FiDollarSign size={22} />, bg: '#dcfce7', color: '#166534' },
    { label: "Today's Orders", value: stats.todays_orders, icon: <FiTrendingUp size={22} />, bg: '#fef3c7', color: '#92400e' },
    { label: 'Total Orders', value: stats.total_orders, icon: <FiPackage size={22} />, bg: '#f3e8ff', color: '#6b21a8' },
    { label: 'Pending Rx', value: stats.pending_prescriptions, icon: <FiFileText size={22} />, bg: '#fef2f2', color: '#991b1b' },
    { label: 'Admin Commission', value: formatCurrency(stats.total_commission), icon: <FiDollarSign size={22} />, bg: '#dcfce7', color: '#166534' },
    { label: 'Delivery Charges', value: formatCurrency(stats.delivery_charges), icon: <FiTrendingUp size={22} />, bg: '#dbeafe', color: '#1e40af' },
    { label: 'Pending Payouts', value: formatCurrency(stats.pending_payouts), icon: <FiFileText size={22} />, bg: '#fef3c7', color: '#92400e' },
    { label: 'Completed Payouts', value: formatCurrency(stats.completed_payouts), icon: <FiDollarSign size={22} />, bg: '#e8f5ec', color: '#237044' },
  ];

  return (
    <div className="page-wrapper">
      <section className="dashboard-page">
        <div className="container">
          <div className="dashboard-header">
            <div className="dashboard-header-copy">
              <span className="dashboard-eyebrow">Herbal Hub control centre</span>
              <h1 className="dashboard-title">Welcome, {user?.name || 'Admin'}</h1>
              <p className="dashboard-subtitle">A clear view of customers, orders, products and platform growth.</p>
            </div>
            <div className="dashboard-header-actions">
              <Link to="/admin/medicines" className="btn btn-secondary btn-sm">Manage Products</Link>
              <Link to="/admin/orders" className="btn btn-primary btn-sm">Manage Orders</Link>
            </div>
          </div>

          <div className="dashboard-stats">
            {statCards.map((s, i) => (
              <div key={i} className="stat-card">
                <div className="stat-icon" style={{ background: s.bg, color: s.color }}>{s.icon}</div>
                <div className="stat-value">{s.value}</div>
                <div className="stat-label">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Orders by Status */}
          <div className="admin-card mb-8">
            <h2 className="admin-card-title">Orders by Status</h2>
            <div className="status-bars">
              {Object.entries(stats.orders_by_status || {}).map(([status, count]) => (
                <div key={status} className="status-bar-row">
                  <span className="text-sm font-medium" style={{ minWidth: 140 }}>{formatStatus(status)}</span>
                  <div className="status-bar-track">
                    <div className="status-bar-fill" style={{ width: `${Math.min(100, (count / stats.total_orders) * 100)}%` }} />
                  </div>
                  <span className="text-sm font-semibold" style={{ minWidth: 40, textAlign: 'right' }}>{count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Orders */}
          <div className="admin-card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="admin-card-title" style={{ marginBottom: 0 }}>Recent Orders</h2>
              <Link to="/admin/orders" className="btn-ghost text-sm text-green">View All <FiArrowRight size={14} /></Link>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Order ID</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Payment</th>
                    <th>Date</th>
                  </tr>
                </thead>
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
      </section>
    </div>
  );
}
