import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FiDownload, FiPackage, FiRefreshCw, FiShoppingBag, FiTrendingUp, FiUsers } from 'react-icons/fi';
import { toast } from 'react-toastify';
import { analyticsApi } from '../../api/analyticsApi';
import { formatCurrency } from '../../utils/helpers';
import Loading from '../../components/Loading';

const periods = [
  ['7d', '7 Days'], ['30d', '30 Days'], ['90d', '90 Days'], ['1y', '1 Year'],
];

function EmptyReport({ children }) {
  return <div className="analytics-empty">{children}</div>;
}

export default function Analytics() {
  const [salesData, setSalesData] = useState(null);
  const [userData, setUserData] = useState(null);
  const [period, setPeriod] = useState('30d');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [salesRes, userRes] = await Promise.all([
        analyticsApi.getSales(period), analyticsApi.getUsers(),
      ]);
      setSalesData(salesRes.data);
      setUserData(userRes.data);
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Reports could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { load(); }, [load]);

  const exportOrders = async () => {
    try {
      setExporting(true);
      const { data } = await analyticsApi.exportOrders('csv');
      const blob = new Blob([data.data || ''], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `herbal-hub-orders-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      toast.success('Order report downloaded');
    } catch (requestError) {
      toast.error(requestError.response?.data?.detail || 'Unable to export the order report');
    } finally {
      setExporting(false);
    }
  };

  const summary = salesData?.summary || {};
  const maxRevenue = useMemo(() => Math.max(...(salesData?.daily_sales || []).map((row) => Number(row.revenue)), 1), [salesData]);
  const maxUsers = useMemo(() => Math.max(...(userData?.user_growth || []).map((row) => Number(row.count)), 1), [userData]);
  const maxCategory = useMemo(() => Math.max(...(salesData?.category_distribution || []).map((row) => Number(row.count)), 1), [salesData]);

  if (loading) return <Loading />;

  if (error) return <div className="page-wrapper"><section className="dashboard-page"><div className="container">
    <div className="analytics-error"><FiTrendingUp /><h2>Reports unavailable</h2><p>{error}</p><button className="btn btn-primary" onClick={load}><FiRefreshCw /> Try Again</button></div>
  </div></section></div>;

  return <div className="page-wrapper"><section className="dashboard-page analytics-page"><div className="container">
    <div className="analytics-toolbar">
      <div><span>REPORTING PERIOD</span><strong>{periods.find(([value]) => value === period)?.[1]}</strong></div>
      <div className="analytics-periods" aria-label="Report period">
        {periods.map(([value, label]) => <button key={value} className={period === value ? 'active' : ''} onClick={() => setPeriod(value)}>{label}</button>)}
      </div>
      <button className="btn btn-secondary" onClick={exportOrders} disabled={exporting}><FiDownload /> {exporting ? 'Preparing…' : 'Export Orders'}</button>
    </div>

    <div className="analytics-kpis">
      <article><span className="analytics-kpi-icon revenue"><FiTrendingUp /></span><small>PAID REVENUE</small><strong>{formatCurrency(summary.total_revenue || 0)}</strong><p>Completed payments in this period</p></article>
      <article><span className="analytics-kpi-icon orders"><FiPackage /></span><small>PAID ORDERS</small><strong>{summary.total_orders || 0}</strong><p>Successfully paid marketplace orders</p></article>
      <article><span className="analytics-kpi-icon average"><FiShoppingBag /></span><small>AVERAGE ORDER</small><strong>{formatCurrency(summary.average_order_value || 0)}</strong><p>Average value per completed order</p></article>
      <article><span className="analytics-kpi-icon users"><FiUsers /></span><small>ACTIVE USERS</small><strong>{userData?.summary?.active_users || 0}</strong><p>From {userData?.summary?.total_users || 0} registered accounts</p></article>
    </div>

    <div className="analytics-panel analytics-revenue-panel">
      <header><div><span>SALES PERFORMANCE</span><h2>Revenue trend</h2></div><p>Paid orders only · {summary.items_sold || 0} items sold</p></header>
      {salesData?.daily_sales?.length ? <div className="analytics-chart" role="img" aria-label="Revenue by date">
        {salesData.daily_sales.map((day) => <div key={day._id} className="analytics-bar-col">
          <span>{formatCurrency(day.revenue)}</span>
          <div className="analytics-bar-track"><i style={{ height: `${Math.max(3, (Number(day.revenue) / maxRevenue) * 100)}%` }} title={`${day.orders} paid orders`} /></div>
          <small>{period === '1y' ? day._id : day._id?.slice(5)}</small>
        </div>)}
      </div> : <EmptyReport>No paid sales were recorded during this period.</EmptyReport>}
    </div>

    <div className="analytics-grid">
      <div className="analytics-panel"><header><div><span>PRODUCT PERFORMANCE</span><h2>Top-selling products</h2></div></header>
        {salesData?.top_medicines?.length ? <div className="analytics-ranking">{salesData.top_medicines.slice(0, 6).map((product, index) => <div key={product._id || product.name}>
          <b>{String(index + 1).padStart(2, '0')}</b><p><strong>{product.name || 'Unnamed product'}</strong><small>{product.total_sold || 0} units sold</small></p><span>{formatCurrency(product.revenue || 0)}</span>
        </div>)}</div> : <EmptyReport>No paid product sales yet.</EmptyReport>}
      </div>

      <div className="analytics-panel"><header><div><span>CATALOGUE MIX</span><h2>Products by category</h2></div></header>
        {salesData?.category_distribution?.length ? <div className="analytics-distribution">{salesData.category_distribution.map((category) => <div key={category._id || 'uncategorized'}>
          <p><span>{String(category._id || 'Uncategorized').replaceAll('_', ' ')}</span><strong>{category.count}</strong></p><div><i style={{ width: `${(category.count / maxCategory) * 100}%` }} /></div>
        </div>)}</div> : <EmptyReport>No active products are available.</EmptyReport>}
      </div>

      <div className="analytics-panel"><header><div><span>ACCOUNT GROWTH</span><h2>New users by month</h2></div><p>{userData?.summary?.new_users_6_months || 0} in six months</p></header>
        {userData?.user_growth?.length ? <div className="analytics-mini-chart">{userData.user_growth.map((month) => <div key={month._id}><span>{month.count}</span><i style={{ height: `${Math.max(4, (month.count / maxUsers) * 100)}%` }} /><small>{month._id}</small></div>)}</div> : <EmptyReport>No new accounts in this period.</EmptyReport>}
      </div>

      <div className="analytics-panel"><header><div><span>PLATFORM AUDIENCE</span><h2>Users by role</h2></div></header>
        <div className="analytics-roles">{Object.entries(userData?.role_distribution || {}).sort((a, b) => b[1] - a[1]).map(([role, count]) => <div key={role}><span>{role.replaceAll('_', ' ')}</span><strong>{count}</strong></div>)}</div>
      </div>
    </div>
  </div></section></div>;
}
