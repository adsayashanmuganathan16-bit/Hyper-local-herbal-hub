import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { financialApi } from '../api/financialApi';
import { useAuth } from '../context/AuthContext';

const fields = [
  ['name', 'Full Name', 'text'], ['email', 'Email', 'email'], ['phone', 'Mobile Number (+94...)', 'tel'],
  ['nic', 'NIC Number', 'text'], ['business_name', 'Store Name', 'text'], ['address_line1', 'Store Address', 'text'],
  ['city', 'Store City', 'text'], ['state', 'Province', 'text'], ['pincode', 'Postal Code', 'text'], ['bank_name', 'Bank Name', 'text'],
  ['branch', 'Branch', 'text'], ['account_holder_name', 'Account Holder Name', 'text'],
  ['account_number', 'Account Number', 'text'], ['password', 'Password', 'password'],
];

function validate(form) {
  const errors = {};
  fields.forEach(([key, label]) => { if (!form[key].trim()) errors[key] = `${label} is required`; });
  if (form.name.trim() && form.name.trim().length < 2) errors.name = 'Full name must contain at least 2 characters';
  if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) errors.email = 'Enter a valid email address';
  if (form.phone.trim() && !/^\+?94\d{9}$/.test(form.phone.replace(/[\s-]/g, ''))) errors.phone = 'Use a Sri Lankan number such as +94771234567';
  if (form.nic.trim() && !/^(.{10,12})$/.test(form.nic.trim())) errors.nic = 'NIC number must contain 10 to 12 characters';
  if (form.account_number.trim() && !/^.{6,34}$/.test(form.account_number.trim())) errors.account_number = 'Account number must contain 6 to 34 characters';
  if (form.password && form.password.length < 8) errors.password = 'Password must contain at least 8 characters';
  return errors;
}

export default function SellerRegister() {
  const location = useLocation();
  const basic = location.state?.basicRegistration || {};
  const [form, setForm] = useState(() => ({
    ...Object.fromEntries(fields.map(([key]) => [key, ''])),
    name: basic.name || '', email: basic.email || '', phone: basic.phone || '', password: basic.password || '',
  }));
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const { updateUser } = useAuth();
  const navigate = useNavigate();

  const change = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: '', form: '' }));
  };

  const submit = async (event) => {
    event.preventDefault();
    const validationErrors = validate(form);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length) return;
    try {
      setLoading(true);
      const payload = { ...form, email: form.email.trim().toLowerCase(), phone: form.phone.replace(/[\s-]/g, ''), address: { address_line1: form.address_line1, city: form.city, state: form.state, pincode: form.pincode } };
      delete payload.address_line1; delete payload.city; delete payload.state; delete payload.pincode;
      const { data } = await financialApi.registerSellerAccount(payload);
      localStorage.setItem('herbal_hub_token', data.access_token);
      localStorage.setItem('herbal_hub_refresh_token', data.refresh_token);
      updateUser(data.user);
      toast.success('Seller application submitted for admin approval');
      navigate('/seller');
    } catch (error) {
      const detail = error.response?.data?.detail;
      if (Array.isArray(detail)) {
        const next = {};
        detail.forEach((item) => { const key = item.loc?.at(-1); if (key && Object.hasOwn(form, key)) next[key] = item.msg; else next.form = item.msg; });
        setErrors(next);
      } else {
        const message = detail || 'Seller registration failed';
        setErrors((current) => ({ ...current, form: message }));
        toast.error(message);
      }
    } finally { setLoading(false); }
  };

  return <div className="auth-page"><div className="auth-card" style={{ maxWidth: 760 }}>
    <div className="auth-header"><h1 className="auth-title">Become a Herbal Hub Seller</h1><p className="auth-subtitle">Complete every identity, store, and payment field before entering your seller account. Your NIC and bank account number are encrypted.</p></div>
    <form className="auth-form" onSubmit={submit} noValidate><div className="grid-2">
      {fields.map(([key, label, type]) => <div className="form-group" key={key}>
        <label className="form-label" htmlFor={`seller-register-${key}`}>{label}</label>
        <input id={`seller-register-${key}`} className={`form-input${errors[key] ? ' input-error' : ''}`} required type={type} value={form[key]} onChange={(event) => change(key, event.target.value)} aria-invalid={Boolean(errors[key])} aria-describedby={errors[key] ? `seller-register-${key}-error` : undefined}/>
        {errors[key] && <span id={`seller-register-${key}-error`} className="form-error" role="alert">{errors[key]}</span>}
      </div>)}
    </div>
    {errors.form && <p className="form-error form-error-summary" role="alert">{errors.form}</p>}
    <button className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={loading}>{loading ? 'Submitting…' : 'Complete Details & Continue'}</button></form>
    <p className="auth-footer-text">Already completed your seller application? <Link to="/login" state={{ selectedRole: 'seller' }} className="auth-link">Seller Login</Link></p>
  </div></div>;
}
