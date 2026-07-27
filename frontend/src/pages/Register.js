import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { authApi } from '../api/authApi';

const EMPTY = { role: 'customer', name: '', owner_name: '', store_name: '', store_address: '', email: '', phone: '', password: '', confirm_password: '' };
export default function Register() {
  const [form, setForm] = useState(EMPTY), [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const change = e => setForm({...form,[e.target.name]:e.target.value});
  const submit = async e => { e.preventDefault();
    if (form.password.length < 6) return toast.error('Password must be at least 6 characters');
    if (form.password !== form.confirm_password) return toast.error('Passwords do not match');
    const seller=form.role==='seller';
    const payload={role:form.role,name:seller?form.owner_name:form.name,owner_name:seller?form.owner_name:undefined,
      store_name:seller?form.store_name:undefined,store_address:seller?form.store_address:undefined,
      email:form.email,phone:form.phone,password:form.password};
    try { setLoading(true); await authApi.register(payload); toast.success('Account created. Please log in.'); navigate('/login'); }
    catch(error){toast.error(error.response?.data?.detail||'Registration failed');} finally{setLoading(false);}
  };
  return <div className="auth-page"><div className="auth-card" style={{maxWidth:650}}><div className="auth-header"><h1 className="auth-title">Create Account</h1><p className="auth-subtitle">Join the Hyper-Local Herbal Hub</p></div>
    <form className="auth-form" onSubmit={submit}><div className="form-group"><label className="form-label">Register As</label><div className="payment-options">
      {['customer','seller'].map(role=><label key={role} className={`payment-option ${form.role===role?'selected':''}`}><input type="radio" name="role" value={role} checked={form.role===role} onChange={change}/><b>{role[0].toUpperCase()+role.slice(1)}</b></label>)}</div></div>
      {form.role==='customer'?<div className="form-group"><label className="form-label">Full Name</label><input required name="name" className="form-input" value={form.name} onChange={change}/></div>:<>
        <div className="grid-2"><div className="form-group"><label className="form-label">Store Name</label><input required name="store_name" className="form-input" value={form.store_name} onChange={change}/></div><div className="form-group"><label className="form-label">Owner Name</label><input required name="owner_name" className="form-input" value={form.owner_name} onChange={change}/></div></div>
        <div className="form-group"><label className="form-label">Store Address</label><textarea required name="store_address" className="form-input" value={form.store_address} onChange={change} placeholder="Complete store address inside Kilinochchi District"/></div></>}
      <div className="grid-2"><div className="form-group"><label className="form-label">Email</label><input required type="email" name="email" className="form-input" value={form.email} onChange={change}/></div><div className="form-group"><label className="form-label">Phone</label><input required name="phone" className="form-input" value={form.phone} onChange={change}/></div></div>
      <div className="grid-2"><div className="form-group"><label className="form-label">Password</label><input required type="password" name="password" className="form-input" value={form.password} onChange={change}/></div><div className="form-group"><label className="form-label">Confirm Password</label><input required type="password" name="confirm_password" className="form-input" value={form.confirm_password} onChange={change}/></div></div>
      <button className="btn btn-primary btn-lg" style={{width:'100%'}} disabled={loading}>{loading?'Creating Account…':'Create Account'}</button></form>
    <p className="auth-footer-text">Already registered? <Link to="/login" className="auth-link">Login</Link></p></div></div>;
}
