import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { authApi } from '../api/authApi';

export default function ChangePassword() {
  const [form, setForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const change = (name, value) => {
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: '', form: '' }));
  };
  const submit = async (event) => {
    event.preventDefault();
    const next = {};
    if (!form.current_password) next.current_password = 'Current password is required';
    if (!form.new_password) next.new_password = 'New password is required';
    else if (form.new_password.length < 6) next.new_password = 'New password must contain at least 6 characters';
    else if (form.new_password === form.current_password) next.new_password = 'New password must be different from the current password';
    if (!form.confirm_password) next.confirm_password = 'Please confirm your new password';
    else if (form.new_password !== form.confirm_password) next.confirm_password = 'New passwords do not match';
    setErrors(next);
    if (Object.keys(next).length) return;
    try { setSaving(true); await authApi.changePassword(form.current_password, form.new_password); toast.success('Password changed'); setForm({ current_password: '', new_password: '', confirm_password: '' }); }
    catch (error) { const message = error.response?.data?.detail || 'Password change failed'; setErrors((current) => ({ ...current, form: message })); toast.error(message); }
    finally { setSaving(false); }
  };
  const field = (name, placeholder) => <div><input className={errors[name] ? 'input-error' : ''} aria-invalid={Boolean(errors[name])} type="password" placeholder={placeholder} value={form[name]} onChange={(event) => change(name, event.target.value)} />{errors[name] && <span className="form-error" role="alert">{errors[name]}</span>}</div>;
  return <div className="change-password-page"><form className="change-password-card" onSubmit={submit} noValidate><h1>Change password</h1>
    {field('current_password', 'Current password')}
    {field('new_password', 'New password')}
    {field('confirm_password', 'Confirm new password')}
    {errors.form && <p className="form-error form-error-summary" role="alert">{errors.form}</p>}
    <button className="btn btn-primary" disabled={saving}>{saving ? 'Updating…' : 'Update password'}</button>
  </form></div>;
}
