import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { financialApi } from '../../api/financialApi';
import { formatCurrency, formatDateTime } from '../../utils/helpers';
import Loading from '../../components/Loading';
import { FiCreditCard, FiDollarSign, FiTrendingUp, FiClock, FiDownload, FiTruck } from 'react-icons/fi';

export default function SellerEarnings() {
  const [data, setData] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { Promise.all([financialApi.sellerEarnings(), financialApi.sellerProfile()]).then(([earnings, seller]) => { setData(earnings.data); setProfile(seller.data); }).catch(() => toast.error('Complete your seller payment setup to view earnings')).finally(() => setLoading(false)); }, []);
  if (loading) return <Loading />;
  if (!data) return <div className="empty-state">Complete your seller financial registration to view earnings.</div>;
  const openReceipt = async (id) => { try { const { data: receipt } = await financialApi.sellerReceipt(id); const url = URL.createObjectURL(receipt); window.open(url, '_blank', 'noopener,noreferrer'); setTimeout(() => URL.revokeObjectURL(url), 60000); } catch (e) { toast.error(e.response?.data?.detail || 'Unable to open receipt'); } };
  const cards = [['Total Sales', data.total_sales, <FiTrendingUp />], ['Commission', data.commission, <FiDollarSign />], ['Available Balance', data.available_balance, <FiClock />], ['Completed Payouts', data.completed_payouts, <FiCreditCard />], ['Delivery Fees Handled by Platform', data.delivery_charges_handled, <FiTruck />]];
  return <div className="page-wrapper"><section className="dashboard-page"><div className="container">
    <div className="dashboard-header"><div className="dashboard-header-copy"><span className="dashboard-eyebrow">Seller finance</span><h1 className="dashboard-title">Earnings &amp; Payouts</h1><p className="dashboard-subtitle">Understand every sale, commission and transfer to your bank.</p></div></div>
    <div className="dashboard-stats">{cards.map(([label, value, icon]) => <div className="stat-card" key={label}><div className="stat-icon">{icon}</div><div className="stat-value">{formatCurrency(value)}</div><div className="stat-label">{label}</div></div>)}</div>
    {profile?.bank_account && <div className="admin-card bank-summary"><div><h2>Bank details</h2><p><strong>{profile.bank_account.bank_name}</strong> · {profile.bank_account.branch}</p><p>{profile.bank_account.account_holder_name} · {profile.bank_account.account_number}</p></div><span className={`dashboard-status ${profile.verification_status === 'VERIFIED' ? 'status-approved' : 'status-pending'}`}>{profile.verification_status === 'VERIFIED' ? 'Verified' : String(profile.verification_status || 'PENDING').replaceAll('_', ' ')}</span></div>}
    <div className="admin-card dashboard-table-card mt-6"><div style={{ padding: '24px 24px 8px' }}><h2 className="dashboard-section-title">Transaction history</h2></div><div className="table-scroll"><table className="data-table"><thead><tr><th>Date</th><th>Gross</th><th>Commission</th><th>Net</th><th>Payment Status</th><th>Payout Status</th><th>Reference</th><th>Receipt</th></tr></thead><tbody>{(data.transactions || []).map((row) => <tr key={row.id}><td>{formatDateTime(row.created_at)}</td><td>{formatCurrency(row.gross_amount)}</td><td>{formatCurrency(row.commission_amount)}</td><td><strong>{formatCurrency(row.net_amount)}</strong></td><td><span className={`dashboard-status status-${String(row.payment_status).toLowerCase()}`}>{row.payment_status}</span></td><td><span className={`dashboard-status status-${String(row.payout_status).toLowerCase().replaceAll('_', '-')}`}>{String(row.payout_status).replaceAll('_', ' ')}</span></td><td>{row.transaction_reference || '—'}</td><td><button className="btn btn-secondary btn-sm" onClick={() => openReceipt(row.id)}><FiDownload /> Receipt</button></td></tr>)}{!(data.transactions || []).length && <tr><td className="dashboard-empty" colSpan="8">No transactions yet.</td></tr>}</tbody></table></div></div>
  </div></section></div>;
}
