import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiEye, FiEyeOff } from 'react-icons/fi';
import { toast } from 'react-toastify';
import { authApi } from '../api/authApi';

const EMPTY = { role: 'customer', name: '', email: '', phone: '', password: '', confirm_password: '' };

function validate(form) {
  const errors = {};
  if (!form.name.trim()) errors.name = 'Full name is required';
  else if (form.name.trim().length < 2) errors.name = 'Full name must contain at least 2 characters';
  if (!form.email.trim()) errors.email = 'Email is required';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errors.email = 'Enter a valid email address';
  if (!form.phone.trim()) errors.phone = 'Phone is required';
  else if (!/^\+?94\d{9}$/.test(form.phone.replace(/[\s-]/g, ''))) errors.phone = 'Use a Sri Lankan number such as +94771234567';
  if (!form.password) errors.password = 'Password is required';
  else if (form.password.length < 6) errors.password = 'Password must contain at least 6 characters';
  if (!form.confirm_password) errors.confirm_password = 'Confirm password is required';
  else if (form.password !== form.confirm_password) errors.confirm_password = 'Passwords do not match';
  return errors;
}

function backendErrors(error) {
  const detail = error.response?.data?.detail;
  if (!Array.isArray(detail)) return null;
  return detail.reduce((result, item) => {
    const field = item.loc?.at(-1);
    if (field && Object.hasOwn(EMPTY, field)) result[field] = item.msg;
    return result;
  }, {});
}

export default function Register() {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const navigate = useNavigate();

  const change = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => {
      if (!current[name]) return current;
      const next = { ...current };
      delete next[name];
      return next;
    });
  };

  const submit = async (event) => {
    event.preventDefault();
    const validationErrors = validate(form);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length) return;

    if (form.role === 'seller') {
      navigate('/seller-register', { state: { basicRegistration: form } });
      return;
    }

    try {
      setLoading(true);
      await authApi.register({
        role: 'customer', name: form.name.trim(), email: form.email.trim(),
        phone: form.phone.replace(/[\s-]/g, ''), password: form.password,
      });
      toast.success('Account created. Please log in.');
      navigate('/login', { state: { selectedRole: 'customer' } });
    } catch (error) {
      const fieldErrors = backendErrors(error);
      if (fieldErrors && Object.keys(fieldErrors).length) setErrors(fieldErrors);
      else toast.error(error.response?.data?.detail || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const field = (name, label, type = 'text', extra = {}) => (
    <div className="form-group">
      <label className="form-label" htmlFor={`register-${name}`}>{label} <span aria-hidden="true">*</span></label>
      <input id={`register-${name}`} required name={name} type={type} className={`form-input${errors[name] ? ' input-error' : ''}`} value={form[name]} onChange={change} aria-invalid={Boolean(errors[name])} aria-describedby={errors[name] ? `register-${name}-error` : undefined} {...extra}/>
      {errors[name] && <span id={`register-${name}-error`} className="form-error" role="alert">{errors[name]}</span>}
    </div>
  );

  const passwordField = (name, label, visible, toggle) => (
    <div className="form-group">
      <label className="form-label" htmlFor={`register-${name}`}>{label} <span aria-hidden="true">*</span></label>
      <div className="input-icon-wrap">
        <input id={`register-${name}`} required name={name} type={visible ? 'text' : 'password'} className={`form-input password-input${errors[name] ? ' input-error' : ''}`} value={form[name]} onChange={change} autoComplete={name === 'password' ? 'new-password' : 'new-password'} aria-invalid={Boolean(errors[name])} aria-describedby={errors[name] ? `register-${name}-error` : undefined}/>
        <button type="button" className="input-icon-right" onClick={toggle} aria-label={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`}>{visible ? <FiEyeOff size={18}/> : <FiEye size={18}/>}</button>
      </div>
      {errors[name] && <span id={`register-${name}-error`} className="form-error" role="alert">{errors[name]}</span>}
    </div>
  );

  return <div className="auth-page"><div className="auth-card" style={{maxWidth:650}}>
    <div className="auth-header"><h1 className="auth-title">Create Account</h1><p className="auth-subtitle">Join the Hyper-Local Herbal Hub</p></div>
    <form className="auth-form" onSubmit={submit} noValidate>
      <div className="form-group"><label className="form-label">Register As</label><div className="payment-options" role="radiogroup" aria-label="Choose account type">
        {['customer', 'seller'].map((role) => <label key={role} className={`payment-option${form.role === role ? ' selected' : ''}`}><input type="radio" name="role" value={role} checked={form.role === role} onChange={change}/><b>{role[0].toUpperCase() + role.slice(1)}</b></label>)}
      </div>{form.role === 'seller' && <small className="text-gray">You’ll complete identity, store, address, banking and verification details in the next step.</small>}</div>
      {field('name', 'Full Name', 'text', { autoComplete: 'name' })}
      <div className="grid-2">{field('email', 'Email', 'email', { autoComplete: 'email' })}{field('phone', 'Phone', 'tel', { autoComplete: 'tel' })}</div>
      <div className="grid-2">{passwordField('password', 'Password', showPassword, () => setShowPassword((value) => !value))}{passwordField('confirm_password', 'Confirm Password', showConfirmPassword, () => setShowConfirmPassword((value) => !value))}</div>
      <button className="btn btn-primary btn-lg" style={{width:'100%'}} disabled={loading}>{loading ? 'Creating Account…' : form.role === 'seller' ? 'Continue as Seller' : 'Create Account'}</button>
    </form>
    <p className="auth-footer-text">Already registered? <Link to="/login" className="auth-link">Login</Link></p>
  </div></div>;
}
