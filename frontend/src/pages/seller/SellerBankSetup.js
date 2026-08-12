import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import { financialApi } from '../../api/financialApi';
import { useAuth } from '../../context/AuthContext';

const fields = [
  ['name', 'Full Name'], ['email', 'Email'], ['phone', 'Mobile (+94...)'], ['nic', 'NIC Number'],
  ['business_name', 'Store Name'], ['address_line1', 'Store Address'], ['city', 'Store City'],
  ['state', 'Province'], ['pincode', 'Postal Code'], ['bank_name', 'Bank Name'], ['branch', 'Branch'],
  ['account_holder_name', 'Account Holder Name'], ['account_number', 'Account Number'],
];

const initialForm = Object.fromEntries(fields.map(([key]) => [key, '']));

function validate(form) {
  const errors = {};
  fields.forEach(([key, label]) => {
    if (!form[key].trim()) errors[key] = `${label} is required`;
  });
  if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
    errors.email = 'Enter a valid email address';
  }
  if (form.phone && !/^\+?94\d{9}$/.test(form.phone.replace(/\s/g, ''))) {
    errors.phone = 'Use a Sri Lankan mobile number such as +94771234567';
  }
  if (form.nic && (form.nic.trim().length < 10 || form.nic.trim().length > 12)) {
    errors.nic = 'NIC number must contain 10 to 12 characters';
  }
  if (form.account_number && form.account_number.trim().length < 6) {
    errors.account_number = 'Account number must contain at least 6 characters';
  }
  return errors;
}

function apiErrorMessage(error) {
  const detail = error.response?.data?.detail;
  if (Array.isArray(detail)) {
    return detail.map((item) => item.msg).filter(Boolean).join('. ');
  }
  return typeof detail === 'string' ? detail : 'Unable to save seller payment details';
}

export default function SellerBankSetup() {
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();

  useEffect(() => {
    setForm((current) => ({
      ...current,
      name: current.name || user?.name || '',
      email: current.email || user?.email || '',
      phone: current.phone || user?.phone || '',
      business_name: current.business_name || user?.business_name || user?.store_name || '',
    }));
  }, [user]);

  const updateField = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const submit = async (event) => {
    event.preventDefault();
    if (saving) return;

    const validationErrors = validate(form);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length) {
      toast.error('Please correct the highlighted fields');
      return;
    }

    const payload = {
      ...form,
      phone: form.phone.replace(/\s/g, ''),
      address: {
        address_line1: form.address_line1,
        city: form.city,
        state: form.state,
        pincode: form.pincode,
      },
    };
    delete payload.address_line1;
    delete payload.city;
    delete payload.state;
    delete payload.pincode;

    try {
      setSaving(true);
      const { data } = await financialApi.registerSeller(payload);
      updateUser({
        name: form.name,
        phone: payload.phone,
        business_name: form.business_name,
        store_name: form.business_name,
        address: payload.address,
        onboarding_required: false,
      });
      toast.success(data?.message || 'Seller payment details saved successfully');
      navigate('/seller/dashboard', { replace: true });
    } catch (error) {
      if (error.response?.status === 401) {
        toast.error('Your session has expired. Please sign in again.');
        navigate('/login');
        return;
      }
      toast.error(apiErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return <div className="page-wrapper"><section className="dashboard-page"><div className="container-sm">
    <form className="admin-card" onSubmit={submit} noValidate><h2 className="dashboard-section-title">Complete your seller profile</h2><p className="text-gray mb-6">Enter your business and payment details to unlock the seller dashboard. Your NIC and full account number are encrypted.</p><div className="grid-2">{fields.map(([key, label]) => <div className="form-group" key={key}><label className="form-label" htmlFor={`seller-payment-${key}`}>{label}</label><input id={`seller-payment-${key}`} className={`form-input${errors[key] ? ' input-error' : ''}`} type={key === 'email' ? 'email' : 'text'} value={form[key]} onChange={(e) => updateField(key, e.target.value)} readOnly={key === 'email' && Boolean(user?.email)} autoComplete={key === 'account_number' ? 'off' : undefined} aria-invalid={Boolean(errors[key])} aria-describedby={errors[key] ? `seller-payment-${key}-error` : undefined}/>{errors[key] && <span id={`seller-payment-${key}-error`} className="form-error" role="alert">{errors[key]}</span>}</div>)}</div><button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving profile…' : 'Complete Seller Profile'}</button></form>
  </div></section></div>;
}
