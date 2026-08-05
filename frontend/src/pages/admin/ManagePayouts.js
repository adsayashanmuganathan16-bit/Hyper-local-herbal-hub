import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { financialApi } from '../../api/financialApi';
import { formatCurrency, formatDateTime } from '../../utils/helpers';
import Loading from '../../components/Loading';
import { FiDownload, FiPercent } from 'react-icons/fi';

export default function ManagePayouts() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [commission, setCommission] = useState('10');
  const load = useCallback(async () => {
    try {
      const [payouts, currentCommission] = await Promise.all([financialApi.payouts(), financialApi.commission()]);
      setRows(Array.isArray(payouts.data) ? payouts.data : []);
      setCommission(currentCommission.data.percentage);
    } catch {
      setRows([]);
      toast.error('Unable to load payouts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);
  const paid = async (id) => { const reference = window.prompt('Enter the bank transfer reference'); if (!reference) return; try { await financialApi.markPaid(id, reference); toast.success('Payout marked as paid'); load(); } catch (e) { toast.error(e.response?.data?.detail || 'Unable to complete payout'); } };
  const retry = async (id) => { try { await financialApi.retryPayout(id); toast.success('Payout queued for retry'); load(); } catch (e) { toast.error(e.response?.data?.detail || 'Unable to retry payout'); } };
  const saveCommission = async (event) => { event.preventDefault(); try { const { data } = await financialApi.setCommission(commission); setCommission(data.percentage); toast.success('Commission updated for future orders'); } catch (e) { toast.error(e.response?.data?.detail || 'Unable to update commission'); } };
  const exportReport = async () => { try { const { data } = await financialApi.report(); const url = URL.createObjectURL(data); const link = document.createElement('a'); link.href = url; link.download = 'payouts.csv'; link.click(); URL.revokeObjectURL(url); } catch (e) { toast.error('Unable to export payout report'); } };
  const openReceipt = async (id) => { try { const { data } = await financialApi.adminReceipt(id); const url = URL.createObjectURL(data); window.open(url, '_blank', 'noopener,noreferrer'); setTimeout(() => URL.revokeObjectURL(url), 60000); } catch (e) { toast.error(e.response?.data?.detail || 'Unable to open receipt'); } };
  if (loading) return <Loading />;
  return <div className="page-wrapper"><section className="dashboard-page"><div className="container">
    <div className="dashboard-header">
      <div className="dashboard-header-copy"><span className="dashboard-eyebrow">Marketplace finance</span><h1 className="dashboard-title">Seller Payouts</h1><p className="dashboard-subtitle">Review balances, complete bank transfers and monitor payout history.</p></div>
      <div className="dashboard-header-actions"><button className="btn btn-secondary" onClick={exportReport}><FiDownload /> Export CSV</button></div>
    </div>
    <form className="admin-card commission-card" onSubmit={saveCommission}>
      <div className="commission-card-copy"><h2><FiPercent size={18} /> Marketplace commission</h2><p>This rate applies only to future paid orders.</p></div>
      <div className="commission-form"><input aria-label="Commission percentage" className="form-input" type="number" min="0" max="100" step="0.01" value={commission} onChange={(e) => setCommission(e.target.value)} /><button className="btn btn-primary">Save rate</button></div>
    </form>
    <div className="admin-card dashboard-table-card table-scroll"><table className="data-table"><thead><tr><th>Created</th><th>Seller</th><th>Gross Amount</th><th>Commission</th><th>Net Amount</th><th>Payment Status</th><th>Payout Status</th><th>Actions</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td>{formatDateTime(row.created_at)}</td><td><strong>{row.business_name || row.seller_name || 'Unknown seller'}</strong><br/><small className="text-gray">#{String(row.seller_id || '').slice(0, 8).toUpperCase()}</small></td><td>{formatCurrency(row.gross_amount)}</td><td>{formatCurrency(row.commission_amount)}</td><td><strong>{formatCurrency(row.net_amount)}</strong></td><td><span className={`dashboard-status status-${String(row.payment_status).toLowerCase().replaceAll('_', '-')}`}>{String(row.payment_status).replaceAll('_', ' ')}</span></td><td><span className={`dashboard-status status-${String(row.payout_status).toLowerCase().replaceAll('_', '-')}`}>{String(row.payout_status).replaceAll('_', ' ')}</span></td><td><div className="flex gap-2"><button className="btn btn-secondary btn-sm" onClick={() => openReceipt(row.id)}><FiDownload /> Receipt</button>{['PENDING','READY_FOR_MANUAL_TRANSFER'].includes(row.payout_status) ? <button className="btn btn-primary btn-sm" onClick={() => paid(row.id)}>Mark Paid</button> : row.payout_status === 'FAILED' && row.retry_count < 3 ? <button className="btn btn-secondary btn-sm" onClick={() => retry(row.id)}>Retry</button> : null}</div></td></tr>)}{!rows.length && <tr><td className="dashboard-empty" colSpan="8">No payout records yet.</td></tr>}</tbody></table></div>
  </div></section></div>;
}
