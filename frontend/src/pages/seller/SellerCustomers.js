import React, { useCallback, useEffect, useState } from 'react';
import { FiSearch, FiTrash2 } from 'react-icons/fi';
import { toast } from 'react-toastify';
import Loading from '../../components/Loading';
import { sellerApi } from '../../api/sellerApi';
import { formatDate } from '../../utils/helpers';

export default function SellerCustomers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const load = useCallback(async () => {
    try {
      const { data } = await sellerApi.getCustomers();
      setCustomers(data.items || []);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Unable to load customers');
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const remove = async (customer) => {
    if (!window.confirm(`Remove ${customer.name} from your customer list? Existing orders will remain available.`)) return;
    try {
      await sellerApi.archiveCustomer(customer.id);
      setCustomers((rows) => rows.filter((row) => row.id !== customer.id));
      toast.success('Customer removed from your list');
    } catch (error) { toast.error(error.response?.data?.detail || 'Unable to remove customer'); }
  };
  const term = search.trim().toLowerCase();
  const rows = customers.filter((item) => !term || [item.name, item.email, item.phone].some((value) => String(value || '').toLowerCase().includes(term)));
  if (loading) return <Loading />;
  return <div className="page-wrapper"><section className="dashboard-page"><div className="container">
    <div className="input-icon-wrap mb-6" style={{ maxWidth: 360 }}><FiSearch className="input-icon" size={16}/>
      <input className="form-input has-icon" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search customers..." /></div>
    <div className="admin-card dashboard-table-card"><div className="table-scroll"><table className="data-table"><thead><tr>
      <th>Customer</th><th>Phone</th><th>Bank Account</th><th>Orders</th><th>Seller sales</th><th>Last order</th><th>Action</th>
    </tr></thead><tbody>{rows.map((customer) => <tr key={customer.id}>
      <td><strong>{customer.name}</strong><br/><small className="text-gray">{customer.email}</small></td><td>{customer.phone || '—'}</td><td>{customer.bank_account ? <><strong>{customer.bank_account.account_number}</strong><br/><small className="text-gray">{customer.bank_account.bank_name}</small></> : '—'}</td>
      <td>{customer.order_count}</td><td>LKR {Number(customer.total_spent || 0).toFixed(2)}</td><td>{formatDate(customer.last_order_at)}</td>
      <td><button className="btn btn-secondary btn-sm" onClick={() => remove(customer)}><FiTrash2 size={14}/> Remove</button></td>
    </tr>)}{!rows.length && <tr><td colSpan="7" className="dashboard-empty">No customers found.</td></tr>}</tbody></table></div></div>
  </div></section></div>;
}
