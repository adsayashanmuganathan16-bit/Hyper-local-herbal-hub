import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { financialApi } from '../../api/financialApi';
import { formatCurrency, formatDateTime } from '../../utils/helpers';
import Loading from '../../components/Loading';
import { FiDownload, FiPercent } from 'react-icons/fi';
import './ManagePayouts.css';

export default function ManagePayouts() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [commission, setCommission] = useState('10');
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [updatingId, setUpdatingId] = useState(null);
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
  const changeStatus = async (id, status) => {
    try {
      setUpdatingId(id);
      const { data } = await financialApi.updatePayoutStatus(id, status);
      setRows((current) => current.map((row) => row.id === id ? { ...row, ...data } : row));
      toast.success(status === 'paid' ? `Payout confirmed as paid (${data.transaction_reference})` : 'Payout moved to processing');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Unable to update payout');
    } finally {
      setUpdatingId(null);
    }
  };
  const retry = async (id) => { try { await financialApi.retryPayout(id); toast.success('Payout queued for retry'); load(); } catch (e) { toast.error(e.response?.data?.detail || 'Unable to retry payout'); } };
  const saveCommission = async (event) => { event.preventDefault(); try { const { data } = await financialApi.setCommission(commission); setCommission(data.percentage); toast.success('Commission updated for future orders'); } catch (e) { toast.error(e.response?.data?.detail || 'Unable to update commission'); } };
  const exportReport = async () => { try { const { data } = await financialApi.report(); const url = URL.createObjectURL(data); const link = document.createElement('a'); link.href = url; link.download = 'payouts.csv'; link.click(); URL.revokeObjectURL(url); } catch (e) { toast.error('Unable to export payout report'); } };
  const openReceipt = async (id) => { try { const { data } = await financialApi.adminReceipt(id); const url = URL.createObjectURL(data); window.open(url, '_blank', 'noopener,noreferrer'); setTimeout(() => URL.revokeObjectURL(url), 60000); } catch (e) { toast.error(e.response?.data?.detail || 'Unable to open receipt'); } };
  if (loading) return <Loading />;
  const normalizedSearch = search.trim().toLowerCase();
  const visibleRows = rows.filter((row) => {
    const status = String(row.payout_status || row.status || '').toLowerCase();
    const matchesFilter = filter === 'all' || status === filter || (filter === 'pending' && status === 'ready_for_manual_transfer');
    const haystack = `${row.business_name || ''} ${row.seller_name || ''} ${row.seller_id || ''} ${row.order_id || ''} ${row.transaction_reference || ''}`.toLowerCase();
    return matchesFilter && (!normalizedSearch || haystack.includes(normalizedSearch));
  });
  return <div className="page-wrapper"><section className="dashboard-page payout-page"><div className="container">
    <div className="admin-page-actions"><button className="btn btn-secondary" onClick={exportReport}><FiDownload /> Export CSV</button></div>
    <form className="admin-card commission-card" onSubmit={saveCommission}>
      <div className="commission-card-copy"><h2><FiPercent size={18} /> Marketplace commission</h2><p>This rate applies only to future paid orders.</p></div>
      <div className="commission-form"><input aria-label="Commission percentage" className="form-input" type="number" min="0" max="100" step="0.01" value={commission} onChange={(e) => setCommission(e.target.value)} /><button className="btn btn-primary">Save rate</button></div>
    </form>
    <div className="payout-toolbar"><div className="payout-filters">{['all', 'pending', 'processing', 'paid'].map((value) => <button key={value} type="button" className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>{value}</button>)}</div><input className="form-input payout-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search seller, order or reference" aria-label="Search payouts" /></div>
    <div className="admin-card dashboard-table-card table-scroll"><table className="data-table"><thead><tr><th>Date</th><th>Seller</th><th>Order ID</th><th>Gross</th><th>Commission</th><th>Net Payout</th><th>Payment Status</th><th>Payout Status</th><th>Reference</th><th>Action</th></tr></thead><tbody>{visibleRows.map((row) => { const status = String(row.payout_status || row.status || '').toUpperCase(); const busy = updatingId === row.id; return <tr key={row.id}><td>{formatDateTime(row.created_at)}</td><td><strong>{row.business_name || row.seller_name || 'Unknown seller'}</strong><br/><small className="text-gray">#{String(row.seller_id || '').slice(0, 8).toUpperCase()}</small></td><td>#{String(row.order_id || '').slice(0, 8).toUpperCase()}</td><td>{formatCurrency(row.gross_amount)}</td><td>{formatCurrency(row.commission_amount)}</td><td><strong>{formatCurrency(row.net_amount)}</strong></td><td><span className={`dashboard-status status-${String(row.payment_status).toLowerCase().replaceAll('_', '-')}`}>{String(row.payment_status).replaceAll('_', ' ')}</span></td><td><span className={`dashboard-status status-${status.toLowerCase().replaceAll('_', '-')}`}>{status.replaceAll('_', ' ')}</span></td><td>{row.transaction_reference || '—'}</td><td><div className="payout-actions"><button type="button" className="btn btn-secondary btn-sm" onClick={() => openReceipt(row.id)}><FiDownload /> Receipt</button>{['PENDING','READY_FOR_MANUAL_TRANSFER'].includes(status) && <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => changeStatus(row.id, 'processing')}>Processing</button>}{['PENDING','READY_FOR_MANUAL_TRANSFER','PROCESSING'].includes(status) && <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => changeStatus(row.id, 'paid')}>{busy ? 'Updating…' : 'Mark as Paid'}</button>}{status === 'FAILED' && row.retry_count < 3 ? <button type="button" className="btn btn-secondary btn-sm" onClick={() => retry(row.id)}>Retry</button> : null}</div></td></tr>; })}{!visibleRows.length && <tr><td className="dashboard-empty" colSpan="10">No payouts match these filters.</td></tr>}</tbody></table></div>
  </div></section></div>;
}
