import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiPackage, FiAlertTriangle, FiShoppingBag, FiDollarSign, FiTrendingUp } from 'react-icons/fi';
import { sellerApi } from '../../api/sellerApi';
import { formatCurrency, formatDateTime, formatStatus, getStatusColor } from '../../utils/helpers';
import Loading from '../../components/Loading';

export default function SellerDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    sellerApi.getDashboard().then(({ data }) => setStats(data)).finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading />;
  if (!stats) return <div className="empty-state"><h3>Failed to load seller dashboard</h3></div>;
  const cards = [
    ['My Products', stats.total_products, <FiPackage size={22} />, '#dbeafe', '#1e40af'],
    ['Low Stock', stats.low_stock_products, <FiAlertTriangle size={22} />, '#fef3c7', '#92400e'],
    ['Seller Orders', stats.total_orders, <FiShoppingBag size={22} />, '#f3e8ff', '#6b21a8'],
    ['Units Sold', stats.units_sold, <FiTrendingUp size={22} />, '#dcfce7', '#166534'],
    ['Product Revenue', formatCurrency(stats.total_revenue), <FiDollarSign size={22} />, 'var(--green-100)', 'var(--green-800)'],
  ];

  return <div className="page-wrapper"><section className="dashboard-page"><div className="container">
    <div className="dashboard-stats">{cards.map(([label, value, icon, bg, color]) => <div className="stat-card" key={label}><div className="stat-icon" style={{ background: bg, color }}>{icon}</div><div className="stat-value">{value}</div><div className="stat-label">{label}</div></div>)}</div>
    <div className="admin-card"><div className="flex items-center justify-between mb-4"><h2 className="admin-card-title" style={{ marginBottom: 0 }}>Recent Orders</h2><Link to="/seller/orders" className="text-green text-sm">View all</Link></div>
      <div style={{ overflowX: 'auto' }}><table className="data-table"><thead><tr><th>Order</th><th>Customer</th><th>Status</th><th>Total</th><th>Date</th></tr></thead><tbody>
        {(stats.recent_orders || []).map((order) => <tr key={order.id}><td className="font-semibold">#{order.id.slice(0, 8).toUpperCase()}</td><td>{order.user_name}</td><td><span className={`badge ${getStatusColor(order.status)}`}>{formatStatus(order.status)}</span></td><td>{formatCurrency(order.final_amount)}</td><td className="text-gray text-sm">{formatDateTime(order.created_at)}</td></tr>)}
      </tbody></table></div>
    </div>
  </div></section></div>;
}
