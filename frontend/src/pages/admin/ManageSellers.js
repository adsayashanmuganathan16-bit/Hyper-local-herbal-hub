import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { financialApi } from '../../api/financialApi';
import Loading from '../../components/Loading';

export default function ManageSellers() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    try {
      const { data } = await financialApi.sellers();
      setRows(Array.isArray(data) ? data : []);
    } catch {
      setRows([]);
      toast.error('Unable to load financial sellers');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);
  const decide = async (id, decision) => {
    try {
      await financialApi.decideSeller(id, decision);
      toast.success(decision === 'request-changes' ? 'Changes requested' : `Seller ${decision}d`);
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Action failed');
    }
  };
  if (loading) return <Loading />;
  return <div className="page-wrapper"><section className="dashboard-page"><div className="container">
    <div className="admin-card dashboard-table-card"><div className="table-scroll"><table className="data-table"><thead><tr><th>Seller</th><th>Business</th><th>Phone</th><th>Bank Account</th><th>Status</th><th>Actions</th></tr></thead><tbody>
      {rows.map((seller) => <tr key={seller.id}><td><strong>{seller.name}</strong><br/><small className="text-gray">{seller.email}</small></td><td>{seller.business_name}</td><td>{seller.phone}</td><td>{seller.bank_account ? <><strong>{seller.bank_account.account_number}</strong><br/><small className="text-gray">{seller.bank_account.bank_name} · {seller.bank_account.account_holder_name}</small></> : '—'}</td><td><span className={`dashboard-status status-${String(seller.verification_status).toLowerCase().replaceAll('_', '-')}`}>{String(seller.verification_status).replaceAll('_', ' ')}</span></td><td><div className="flex gap-2"><button className="btn btn-primary btn-sm" onClick={() => decide(seller.id, 'approve')} disabled={seller.verification_status === 'VERIFIED'}>Approve</button><button className="btn btn-secondary btn-sm" onClick={() => decide(seller.id, 'reject')} disabled={seller.verification_status === 'REJECTED'}>Reject</button><button className="btn btn-secondary btn-sm" onClick={() => decide(seller.id, 'request-changes')} disabled={seller.verification_status === 'CHANGES_REQUESTED'}>Request Changes</button></div></td></tr>)}
      {!rows.length && <tr><td className="dashboard-empty" colSpan="6">No financial seller applications.</td></tr>}
    </tbody></table></div></div>
  </div></section></div>;
}
