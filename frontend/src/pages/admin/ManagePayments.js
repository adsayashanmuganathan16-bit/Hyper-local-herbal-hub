import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { financialApi } from '../../api/financialApi';
import { formatCurrency, formatDateTime } from '../../utils/helpers';
import Loading from '../../components/Loading';

export default function ManagePayments() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { financialApi.payments().then(({ data }) => setRows(data)).catch(() => toast.error('Unable to load payments')).finally(() => setLoading(false)); }, []);
  if (loading) return <Loading />;
  return <div className="page-wrapper"><section className="dashboard-page"><div className="container">
    <div className="dashboard-header"><div className="dashboard-header-copy"><span className="dashboard-eyebrow">Payment ledger</span><h1 className="dashboard-title">Marketplace Payments</h1><p className="dashboard-subtitle">Monitor mock, OnePay, PayHere and cash-on-delivery transactions.</p></div></div>
    <div className="admin-card dashboard-table-card table-scroll"><table className="data-table"><thead><tr><th>Order</th><th>Gateway</th><th>Transaction</th><th>Amount</th><th>Status</th><th>Paid</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td><strong>#{row.order_id?.slice(0, 8).toUpperCase()}</strong></td><td>{row.payment_gateway?.toUpperCase()}</td><td>{row.transaction_id || '—'}</td><td><strong>{formatCurrency(row.amount)}</strong></td><td><span className={`dashboard-status status-${String(row.status).toLowerCase()}`}>{row.status}</span></td><td>{row.paid_at ? formatDateTime(row.paid_at) : '—'}</td></tr>)}{!rows.length && <tr><td className="dashboard-empty" colSpan="6">No payments yet.</td></tr>}</tbody></table></div>
  </div></section></div>;
}
