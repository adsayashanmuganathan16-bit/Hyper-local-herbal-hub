import React, { useState, useEffect } from 'react';
import { FiSearch, FiTrash2, FiUserCheck, FiUserX } from 'react-icons/fi';
import { adminApi } from '../../api/adminApi';
import { formatDate } from '../../utils/helpers';
import { toast } from 'react-toastify';
import Loading from '../../components/Loading';

export default function ManageUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  useEffect(() => {
    const params = {};
    if (search) params.search = search;
    if (roleFilter) params.role = roleFilter;
    adminApi.getUsers(params).then(({ data }) => setUsers(data.items || []))
      .catch(() => {}).finally(() => setLoading(false));
  }, [search, roleFilter]);

  const handleToggle = async (userId, currentStatus) => {
    const action = currentStatus ? 'deactivate' : 'activate';
    if (!window.confirm(`Are you sure you want to ${action} this user?`)) return;
    try {
      await adminApi.toggleUserActive(userId);
      toast.success(`User ${action}d`);
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, is_active: !currentStatus } : u));
    } catch { toast.error('Action failed'); }
  };

  const handleRemove = async (user) => {
    if (!window.confirm(`Remove ${user.name}? Their order and payment history will be preserved.`)) return;
    try {
      await adminApi.removeUser(user.id);
      toast.success('User removed');
      setUsers((prev) => prev.map((item) => item.id === user.id ? { ...item, is_active: false, removed_at: new Date().toISOString() } : item));
    } catch (error) { toast.error(error.response?.data?.detail || 'Remove failed'); }
  };

  return (
    <div className="page-wrapper">
      <section className="section" style={{ paddingTop: '32px' }}>
        <div className="container">
          <h1 className="section-title mb-6">Manage Users</h1>

          <div className="flex gap-3 mb-6" style={{ flexWrap: 'wrap' }}>
            <div className="input-icon-wrap" style={{ maxWidth: 300, flex: 1 }}>
              <FiSearch size={16} className="input-icon" />
              <input className="form-input has-icon" placeholder="Search by name, email, phone..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <select className="form-input form-select" style={{ width: 'auto' }} value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
              <option value="">All Roles</option>
              <option value="customer">Customer</option>
              <option value="admin">Admin</option>
              <option value="seller">Seller</option>
              <option value="delivery_partner">Delivery Partner</option>
            </select>
          </div>

          {loading ? <Loading /> : (
            <div className="admin-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Phone</th>
                      <th>Role</th>
                      <th>Joined</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.length === 0 ? (
                      <tr><td colSpan={6} className="text-center text-gray" style={{ padding: 40 }}>No users found</td></tr>
                    ) : users.map((user) => (
                      <tr key={user.id}>
                        <td>
                          <div className="flex items-center gap-3">
                            <div style={{
                              width: 38, height: 38, borderRadius: '50%',
                              background: user.is_active ? 'var(--green-100)' : 'var(--gray-100)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontWeight: 700, fontSize: 14, color: user.is_active ? 'var(--green-800)' : 'var(--gray-400)',
                              flexShrink: 0,
                            }}>
                              {user.name?.[0]?.toUpperCase()}
                            </div>
                            <div>
                              <span className="font-medium text-sm">{user.name}</span>
                              <br /><span className="text-xs text-gray">{user.email}</span>
                            </div>
                          </div>
                        </td>
                        <td className="text-sm">{user.phone}</td>
                        <td>
                          <span className={`badge ${user.role === 'admin' ? 'badge-green' : user.role === 'delivery_partner' ? 'badge-yellow' : 'badge-gray'}`}>
                            {user.role?.replace(/_/g, ' ').toUpperCase()}
                          </span>
                        </td>
                        <td className="text-sm text-gray">{formatDate(user.created_at)}</td>
                        <td>
                          <span className={`badge ${user.is_active ? 'badge-green' : 'badge-red'}`}>
                            {user.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td>
                          <button
                            className={`btn-ghost btn-sm ${user.is_active ? '' : ''}`}
                            style={{ color: user.is_active ? 'var(--red-500)' : 'var(--green-700)' }}
                            onClick={() => handleToggle(user.id, user.is_active)}
                            title={user.is_active ? 'Deactivate' : 'Activate'}
                          >
                            {user.is_active ? <FiUserX size={16} /> : <FiUserCheck size={16} />}
                          </button>
                          {user.role !== 'admin' && <button className="btn-ghost btn-sm" style={{ color: 'var(--red-500)' }}
                            onClick={() => handleRemove(user)} title="Remove user"><FiTrash2 size={16} /></button>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
