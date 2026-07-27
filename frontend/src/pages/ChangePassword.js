import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { authApi } from '../api/authApi';

export default function ChangePassword() {
  const [form, setForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [saving, setSaving] = useState(false);
  const submit = async (event) => {
    event.preventDefault();
    if (form.new_password !== form.confirm_password) return toast.error('New passwords do not match');
    try { setSaving(true); await authApi.changePassword(form.current_password, form.new_password); toast.success('Password changed'); setForm({ current_password: '', new_password: '', confirm_password: '' }); }
    catch (error) { toast.error(error.response?.data?.detail || 'Password change failed'); }
    finally { setSaving(false); }
  };
  return <div className="change-password-page"><form className="change-password-card" onSubmit={submit}><h1>Change password</h1>
    <input required type="password" placeholder="Current password" value={form.current_password} onChange={(e) => setForm({ ...form, current_password: e.target.value })} />
    <input required minLength="6" type="password" placeholder="New password" value={form.new_password} onChange={(e) => setForm({ ...form, new_password: e.target.value })} />
    <input required type="password" placeholder="Confirm new password" value={form.confirm_password} onChange={(e) => setForm({ ...form, confirm_password: e.target.value })} />
    <button className="btn btn-primary" disabled={saving}>{saving ? 'Updating…' : 'Update password'}</button>
  </form></div>;
}
