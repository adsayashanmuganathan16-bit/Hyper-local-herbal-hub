import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import { financialApi } from '../../api/financialApi';

const fields = [
  ['name', 'Full Name'], ['email', 'Email'], ['phone', 'Mobile (+94...)'], ['nic', 'NIC Number'],
  ['business_name', 'Store Name'], ['address_line1', 'Store Address'], ['city', 'Store City'],
  ['state', 'Province'], ['pincode', 'Postal Code'], ['bank_name', 'Bank Name'], ['branch', 'Branch'],
  ['account_holder_name', 'Account Holder Name'], ['account_number', 'Account Number'],
];

export default function SellerBankSetup() {
  const [form, setForm] = useState(Object.fromEntries(fields.map(([key]) => [key, ''])));
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const submit = async (event) => { event.preventDefault(); try { setSaving(true); const payload={...form,address:{address_line1:form.address_line1,city:form.city,state:form.state,pincode:form.pincode}}; delete payload.address_line1;delete payload.city;delete payload.state;delete payload.pincode; await financialApi.registerSeller(payload); toast.success('Seller banking profile submitted for approval'); navigate('/seller/earnings'); } catch (e) { toast.error(e.response?.data?.detail || 'Registration failed'); } finally { setSaving(false); } };
  return <div className="page-wrapper"><section className="dashboard-page"><div className="container-sm">
    <div className="dashboard-header"><div className="dashboard-header-copy"><span className="dashboard-eyebrow">Secure seller onboarding</span><h1 className="dashboard-title">Seller Payment Setup</h1><p className="dashboard-subtitle">Connect your verified Sri Lankan bank account for marketplace payouts.</p></div></div>
    <form className="admin-card" onSubmit={submit}><h2 className="dashboard-section-title">Business and banking details</h2><p className="text-gray mb-6">Your NIC and full account number are encrypted and never shown in list views.</p><div className="grid-2">{fields.map(([key, label]) => <div className="form-group" key={key}><label className="form-label">{label}</label><input className="form-input" type={key === 'email' ? 'email' : 'text'} required value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} autoComplete={key === 'account_number' ? 'off' : undefined}/></div>)}</div><button className="btn btn-primary" disabled={saving}>{saving ? 'Submitting…' : 'Submit for Approval'}</button></form>
  </div></section></div>;
}
