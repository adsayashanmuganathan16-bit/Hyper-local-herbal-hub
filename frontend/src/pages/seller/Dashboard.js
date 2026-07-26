import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiPackage, FiAlertTriangle, FiShoppingBag, FiDollarSign, FiTrendingUp } from 'react-icons/fi';
import { sellerApi } from '../../api/sellerApi';
import { formatCurrency, formatDateTime, formatStatus, getStatusColor } from '../../utils/helpers';
import Loading from '../../components/Loading';
import { useAuth } from '../../context/AuthContext';

export default function SellerDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    sellerApi.getDashboard().then(({ data }) => setStats(data)).finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading />;
  if (!stats) return <div className="empty-state"><h3>Failed to load seller dashboard</h3></div>;
  const companyName = stats.company_name || user?.store_name || user?.business_name || 'Your Company';

  const cards = [
    ['My Products', stats.total_products, <FiPackage size={22} />, '#dbeafe', '#1e40af'],
    ['Low Stock', stats.low_stock_products, <FiAlertTriangle size={22} />, '#fef3c7', '#92400e'],
    ['Seller Orders', stats.total_orders, <FiShoppingBag size={22} />, '#f3e8ff', '#6b21a8'],
    ['Units Sold', stats.units_sold, <FiTrendingUp size={22} />, '#dcfce7', '#166534'],
    ['Product Revenue', formatCurrency(stats.total_revenue), <FiDollarSign size={22} />, 'var(--green-100)', 'var(--green-800)'],
  ];

  return <div className="page-wrapper"><section className="dashboard-page"><div className="container">
    <div className="dashboard-header">
      <div className="dashboard-header-copy"><span className="dashboard-eyebrow">Your seller workspace</span><h1 className="dashboard-title">Welcome, {user?.name || 'Seller'}</h1><h2 style={{margin:'6px 0',color:'#f4d28e',fontSize:24,fontWeight:800,opacity:1,textShadow:'0 1px 2px rgba(0,0,0,.35)'}}>{companyName}</h2><p className="dashboard-subtitle">Track products, sales and company performance in one place.</p></div>
      <div className="dashboard-header-actions"><Link to="/seller/products" className="btn btn-primary btn-sm">Manage Products</Link><Link to="/seller/orders" className="btn btn-secondary btn-sm">View Orders</Link></div>
    </div>
    <div className="dashboard-stats">{cards.map(([label, value, icon, bg, color]) => <div className="stat-card" key={label}><div className="stat-icon" style={{ background: bg, color }}>{icon}</div><div className="stat-value">{value}</div><div className="stat-label">{label}</div></div>)}</div>
    <div className="admin-card"><div className="flex items-center justify-between mb-4"><h2 className="admin-card-title" style={{ marginBottom: 0 }}>Recent Orders</h2><Link to="/seller/orders" className="text-green text-sm">View all</Link></div>
      <div style={{ overflowX: 'auto' }}><table className="data-table"><thead><tr><th>Order</th><th>Customer</th><th>Status</th><th>Total</th><th>Date</th></tr></thead><tbody>
        {(stats.recent_orders || []).map((order) => <tr key={order.id}><td className="font-semibold">#{order.id.slice(0, 8).toUpperCase()}</td><td>{order.user_name}</td><td><span className={`badge ${getStatusColor(order.status)}`}>{formatStatus(order.status)}</span></td><td>{formatCurrency(order.final_amount)}</td><td className="text-gray text-sm">{formatDateTime(order.created_at)}</td></tr>)}
      </tbody></table></div>
    </div>
  </div></section></div>;
}
