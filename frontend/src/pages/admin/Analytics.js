import React, { useState, useEffect } from 'react';
import { FiDownload } from 'react-icons/fi';
import { analyticsApi } from '../../api/analyticsApi';
import { formatCurrency } from '../../utils/helpers';
import Loading from '../../components/Loading';

export default function Analytics() {
  const [salesData, setSalesData] = useState(null);
  const [userData, setUserData] = useState(null);
  const [period, setPeriod] = useState('30d');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([analyticsApi.getSales(period), analyticsApi.getUsers()])
      .then(([salesRes, userRes]) => {
        setSalesData(salesRes.data);
        setUserData(userRes.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [period]);

  if (loading) return <Loading />;

  return (
    <div className="page-wrapper">
      <section className="section" style={{ paddingTop: '32px' }}>
        <div className="container">
          <div className="flex items-center justify-between mb-8" style={{ flexWrap: 'wrap', gap: 16 }}>
            <h1 className="section-title" style={{ marginBottom: 0 }}>Reports & Analytics</h1>
            <div className="flex gap-2">
              {['7d', '30d', '90d', '1y'].map((p) => (
                <button
                  key={p}
                  className={`btn btn-sm ${period === p ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setPeriod(p)}
                >
                  {p === '7d' ? '7 Days' : p === '30d' ? '30 Days' : p === '90d' ? '90 Days' : '1 Year'}
                </button>
              ))}
              <button
                className="btn btn-ghost btn-sm"
                style={{ color: 'var(--green-800)' }}
                onClick={() => {
                  analyticsApi.exportOrders('csv').then(({ data }) => {
                    const blob = new Blob([data.data], { type: 'text/csv' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'orders_export.csv';
                    a.click();
                    URL.revokeObjectURL(url);
                  });
                }}
              >
                <FiDownload size={14} /> Export CSV
              </button>
            </div>
          </div>

          {/* Sales Chart (Simple Bar Representation) */}
          <div className="admin-card mb-6">
            <h2 className="admin-card-title">Daily Revenue ({period})</h2>
            {salesData?.daily_sales?.length > 0 ? (
              <div className="chart-bars">
                {salesData.daily_sales.map((day, i) => {
                  const maxRevenue = Math.max(...salesData.daily_sales.map((d) => d.revenue), 1);
                  const height = (day.revenue / maxRevenue) * 200;
                  return (
                    <div key={i} className="chart-bar-col">
                      <div className="chart-bar-value">{formatCurrency(day.revenue)}</div>
                      <div
                        className="chart-bar"
                        style={{ height: `${Math.max(4, height)}px` }}
                        title={`${day._id}: ${formatCurrency(day.revenue)} (${day.orders} orders)`}
                      />
                      <div className="chart-bar-label">{day._id?.slice(-5)}</div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-gray text-center" style={{ padding: 40 }}>No sales data for this period</p>
            )}
          </div>

          <div className="grid-2">
            {/* Top Products */}
            <div className="admin-card">
              <h2 className="admin-card-title">Top Selling Products</h2>
              {salesData?.top_medicines?.length > 0 ? (
                <div className="flex flex-col gap-3">
                  {salesData.top_medicines.map((med, i) => (
                    <div key={i} className="top-product-row">
                      <div className="top-product-rank">#{i + 1}</div>
                      <div className="top-product-info">
                        <span className="font-medium text-sm">{med.name}</span>
                        <span className="text-xs text-gray">{med.total_sold} sold</span>
                      </div>
                      <span className="font-semibold text-sm text-green">{formatCurrency(med.revenue)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray text-sm text-center" style={{ padding: 20 }}>No data</p>
              )}
            </div>

            {/* Category Distribution */}
            <div className="admin-card">
              <h2 className="admin-card-title">Category Distribution</h2>
              {salesData?.category_distribution?.length > 0 ? (
                <div className="flex flex-col gap-3">
                  {salesData.category_distribution.map((cat, i) => {
                    const maxCount = Math.max(...salesData.category_distribution.map((c) => c.count), 1);
                    return (
                      <div key={i} className="cat-dist-row">
                        <span className="text-sm font-medium" style={{ minWidth: 160 }}>{cat._id?.replace(/_/g, ' ')}</span>
                        <div className="cat-dist-bar-track">
                          <div className="cat-dist-bar-fill" style={{ width: `${(cat.count / maxCount) * 100}%` }} />
                        </div>
                        <span className="text-sm font-semibold" style={{ minWidth: 40, textAlign: 'right' }}>{cat.count}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-gray text-sm text-center" style={{ padding: 20 }}>No data</p>
              )}
            </div>

            {/* User Growth */}
            <div className="admin-card">
              <h2 className="admin-card-title">User Growth (6 months)</h2>
              {userData?.user_growth?.length > 0 ? (
                <div className="chart-bars" style={{ maxHeight: 180 }}>
                  {userData.user_growth.map((month, i) => {
                    const maxCount = Math.max(...userData.user_growth.map((m) => m.count), 1);
                    const height = (month.count / maxCount) * 140;
                    return (
                      <div key={i} className="chart-bar-col">
                        <div className="chart-bar-value">{month.count}</div>
                        <div className="chart-bar" style={{ height: `${Math.max(4, height)}px`, background: 'var(--green-500)' }} />
                        <div className="chart-bar-label">{month._id?.slice(-5)}</div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-gray text-sm text-center" style={{ padding: 20 }}>No data</p>
              )}
            </div>

            {/* User Role Distribution */}
            <div className="admin-card">
              <h2 className="admin-card-title">User Roles</h2>
              {userData?.role_distribution && (
                <div className="flex flex-col gap-4" style={{ padding: '8px 0' }}>
                  {Object.entries(userData.role_distribution).map(([role, count]) => (
                    <div key={role} className="flex items-center justify-between">
                      <span className="font-medium">{role?.replace(/_/g, ' ').toUpperCase()}</span>
                      <span className="badge badge-green" style={{ fontSize: 14, padding: '6px 16px' }}>{count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}