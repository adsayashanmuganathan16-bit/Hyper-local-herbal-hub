import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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

export default function SellerRegister() {
  const [form, setForm] = useState(Object.fromEntries(fields.map(([key]) => [key, ''])));
  const [loading, setLoading] = useState(false);
  const { updateUser } = useAuth();
  const navigate = useNavigate();
  const submit = async (event) => { event.preventDefault(); try { setLoading(true); const payload={...form,address:{address_line1:form.address_line1,city:form.city,state:form.state,pincode:form.pincode}}; delete payload.address_line1;delete payload.city;delete payload.state;delete payload.pincode; const { data } = await financialApi.registerSellerAccount(payload); localStorage.setItem('herbal_hub_token', data.access_token); localStorage.setItem('herbal_hub_refresh_token', data.refresh_token); updateUser(data.user); toast.success('Seller application submitted for admin approval'); navigate('/seller'); } catch (e) { toast.error(e.response?.data?.detail || 'Seller registration failed'); } finally { setLoading(false); } };
  return <div className="auth-page"><div className="auth-card" style={{ maxWidth: 760 }}><div className="auth-header"><h1 className="auth-title">Become a Herbal Hub Seller</h1><p className="auth-subtitle">Your NIC and bank account number are encrypted.</p></div><form className="auth-form" onSubmit={submit}><div className="grid-2">{fields.map(([key, label, type]) => <div className="form-group" key={key}><label className="form-label">{label}</label><input className="form-input" required type={type} minLength={key === 'password' ? 8 : undefined} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })}/></div>)}</div><button className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={loading}>{loading ? 'Submitting…' : 'Submit Seller Application'}</button></form><p className="auth-footer-text">Already registered? <Link to="/login" className="auth-link">Login</Link></p></div></div>;
}
