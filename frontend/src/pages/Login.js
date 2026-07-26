import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FiMail, FiLock, FiEye, FiEyeOff } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';

const LOGO_URL = process.env.PUBLIC_URL + '/logo.png';

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const canAccessRequestedPath = (path, role) => {
    if (!path) return false;
    if (path.startsWith('/admin')) return role === 'admin';
    if (path.startsWith('/seller')) return role === 'seller';
    if (path.startsWith('/delivery-staff')) {
      return ['delivery_staff', 'delivery_partner'].includes(role);
    }
    if (['/cart', '/checkout', '/orders', '/prescriptions'].some((prefix) => path.startsWith(prefix))) {
      return role === 'customer';
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password) return toast.error('Please fill all fields');
    try {
      setLoading(true);
      const loggedInUser = await login(form.email, form.password);
      toast.success('Welcome back!');
      const requestedPath = location.state?.from?.pathname;
      const roleHome = ['delivery_staff', 'delivery_partner'].includes(loggedInUser?.role)
        ? '/delivery-staff'
        : loggedInUser?.role === 'seller'
          ? '/seller/dashboard'
          : loggedInUser?.role === 'admin'
            ? '/admin/dashboard'
            : '/shop';
      navigate(
        canAccessRequestedPath(requestedPath, loggedInUser?.role) ? requestedPath : roleHome,
        { replace: true }
      );
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <img src={LOGO_URL} alt="Herbal Hub" className="auth-logo" />
          <h1 className="auth-title">Welcome Back</h1>
          <p className="auth-subtitle">Login to your Herbal Hub account</p>
        </div>
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <div className="input-icon-wrap">
              <FiMail size={18} className="input-icon" />
              <input type="email" name="email" className="form-input has-icon" placeholder="you@email.com" value={form.email} onChange={handleChange} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <div className="input-icon-wrap">
              <FiLock size={18} className="input-icon" />
              <input type={showPass ? 'text' : 'password'} name="password" className="form-input has-icon" placeholder="••••••••" value={form.password} onChange={handleChange} />
              <button type="button" className="input-icon-right" onClick={() => setShowPass(!showPass)}>
                {showPass ? <FiEyeOff size={18} /> : <FiEye size={18} />}
              </button>
            </div>
          </div>
          <div style={{ textAlign: 'right', marginBottom: 12 }}>
            <Link to="/forgot-password" className="auth-link">Forgot password?</Link>
          </div>
          <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
        <div className="auth-demo">
          <p className="auth-demo-title">Demo accounts — click to fill</p>
          <div className="auth-demo-btns">
            <button type="button" className="auth-demo-btn" onClick={() => setForm({ email: 'admin@herbalhub.com', password: 'Admin@123' })}>
              Admin
            </button>
            <button type="button" className="auth-demo-btn" onClick={() => setForm({ email: 'customer@herbalhub.com', password: 'Customer@123' })}>
              Customer
            </button>
            <button type="button" className="auth-demo-btn" onClick={() => setForm({ email: 'seller@herbalhub.com', password: 'Seller@123' })}>
              Seller
            </button>
          </div>
        </div>
        <p className="auth-footer-text">
          Don't have an account? <Link to="/register" className="auth-link">Create Account</Link>
        </p>
      </div>
    </div>
  );
}
