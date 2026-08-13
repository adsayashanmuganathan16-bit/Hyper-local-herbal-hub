import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FiMail, FiLock, FiEye, FiEyeOff, FiShoppingBag, FiBriefcase, FiArrowLeft } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';

const LOGO_URL = process.env.PUBLIC_URL + '/logo.png';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, googleLogin, logout } = useAuth();
  const [selectedRole, setSelectedRole] = useState(() => locationRole(location.state));
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const googleRoleRef = useRef(selectedRole || 'customer');
  const googleButtonRef = useRef(null);

  function chooseRole(role) {
    if (role === 'seller') {
      navigate('/seller-register');
      return;
    }
    setSelectedRole(role);
  }

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
    setErrors((current) => ({ ...current, [name]: '', form: '' }));
  };

  useEffect(() => { googleRoleRef.current = selectedRole || 'customer'; }, [selectedRole]);

  const canAccessRequestedPath = (path, role) => {
    if (!path) return false;
    if (path.startsWith('/admin')) return role === 'admin';
    if (path.startsWith('/seller')) return role === 'seller';
    if (['/cart', '/checkout', '/orders', '/prescriptions'].some((prefix) => path.startsWith(prefix))) {
      return role === 'customer';
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationErrors = {};
    if (!form.email.trim()) validationErrors.email = 'Email address is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) validationErrors.email = 'Enter a valid email address';
    if (!form.password) validationErrors.password = 'Password is required';
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length) return;
    try {
      setLoading(true);
      const loggedInUser = await login(form.email, form.password);
      if (loggedInUser?.role !== selectedRole) {
        logout();
        throw new Error(`This is not a ${selectedRole} account`);
      }
      toast.success(loggedInUser?.name ? `Welcome, ${loggedInUser.name}!` : 'Welcome back!');
      const requestedPath = location.state?.from?.pathname;
      const roleHome = loggedInUser?.role === 'seller'
          ? '/seller/dashboard'
          : loggedInUser?.role === 'admin'
            ? '/admin/dashboard'
            : '/shop';
      navigate(
        canAccessRequestedPath(requestedPath, loggedInUser?.role) ? requestedPath : roleHome,
        { replace: true }
      );
    } catch (err) {
      const message = err.response?.data?.detail || err.message || 'Login failed';
      setErrors((current) => ({ ...current, form: message }));
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const finishLogin = (loggedInUser) => {
    const requestedPath = location.state?.from?.pathname;
    const roleHome = loggedInUser?.role === 'seller'
      ? (loggedInUser.onboarding_required ? '/seller/payment-setup' : '/seller/dashboard')
      : loggedInUser?.role === 'admin'
        ? '/admin/dashboard'
        : '/shop';
    navigate(
      canAccessRequestedPath(requestedPath, loggedInUser?.role) ? requestedPath : roleHome,
      { replace: true }
    );
  };

  useEffect(() => {
    const clientId = process.env.REACT_APP_GOOGLE_CLIENT_ID;
    if (!clientId) return undefined;
    let timer;
    const initializeGoogle = () => {
      if (!window.google?.accounts?.id || !googleButtonRef.current) return false;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async ({ credential }) => {
          try {
            setLoading(true);
            const loggedInUser = await googleLogin(credential, googleRoleRef.current);
            toast.success(loggedInUser?.name ? `Welcome, ${loggedInUser.name}!` : 'Welcome back!');
            finishLogin(loggedInUser);
          } catch (error) {
            toast.error(error.response?.data?.detail || 'Google sign-in failed');
          } finally {
            setLoading(false);
          }
        },
      });
      googleButtonRef.current.innerHTML = '';
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        type: 'standard', theme: 'outline', size: 'large', shape: 'pill', width: 344,
      });
      return true;
    };
    if (!initializeGoogle()) timer = window.setInterval(() => initializeGoogle() && window.clearInterval(timer), 250);
    return () => window.clearInterval(timer);
  }, [googleLogin]);

  if (!selectedRole) return (
    <div className="auth-page">
      <div className="auth-card role-choice-card">
        <div className="auth-header">
          <img src={LOGO_URL} alt="Herbal Hub" className="auth-logo" />
          <h1 className="auth-title">How will you use Herbal Hub?</h1>
          <p className="auth-subtitle">Choose your account type to continue.</p>
        </div>
        <div className="login-role-choices">
          <button type="button" className="login-role-card" onClick={() => chooseRole('customer')}>
            <span><FiShoppingBag /></span><div><strong>Customer</strong><small>Log in and shop herbal products</small></div>
          </button>
          <button type="button" className="login-role-card" onClick={() => chooseRole('seller')}>
            <span><FiBriefcase /></span><div><strong>Seller</strong><small>Complete your seller details to continue</small></div>
          </button>
        </div>
        <button type="button" className="staff-login-link" onClick={() => setSelectedRole('admin')}>Admin login</button>
      </div>
    </div>
  );

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <img src={LOGO_URL} alt="Herbal Hub" className="auth-logo" />
          <button type="button" className="auth-back-button" onClick={() => setSelectedRole(null)}><FiArrowLeft /> Change account type</button>
          <h1 className="auth-title">{selectedRole === 'customer' ? 'Customer Login' : selectedRole === 'seller' ? 'Seller Login' : 'Admin Login'}</h1>
          <p className="auth-subtitle">Login to your Herbal Hub account</p>
        </div>
        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          <div className="form-group">
            <label className="form-label" htmlFor="login-email">Email Address</label>
            <div className="input-icon-wrap">
              <FiMail size={18} className="input-icon" />
              <input id="login-email" type="email" name="email" className={`form-input has-icon${errors.email ? ' input-error' : ''}`} placeholder="you@email.com" value={form.email} onChange={handleChange} autoComplete="email" aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? 'login-email-error' : undefined} />
            </div>
            {errors.email && <span id="login-email-error" className="form-error" role="alert">{errors.email}</span>}
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="login-password">Password</label>
            <div className="input-icon-wrap">
              <FiLock size={18} className="input-icon" />
              <input id="login-password" type={showPass ? 'text' : 'password'} name="password" className={`form-input has-icon${errors.password ? ' input-error' : ''}`} placeholder="••••••••" value={form.password} onChange={handleChange} autoComplete="current-password" aria-invalid={Boolean(errors.password)} aria-describedby={errors.password ? 'login-password-error' : undefined} />
              <button type="button" className="input-icon-right" onClick={() => setShowPass(!showPass)}>
                {showPass ? <FiEyeOff size={18} /> : <FiEye size={18} />}
              </button>
            </div>
            {errors.password && <span id="login-password-error" className="form-error" role="alert">{errors.password}</span>}
          </div>
          {errors.form && <p className="form-error form-error-summary" role="alert">{errors.form}</p>}
          <div style={{ textAlign: 'right', marginBottom: 12 }}>
            <Link to="/forgot-password" className="auth-link">Forgot password?</Link>
          </div>
          <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
        {process.env.REACT_APP_GOOGLE_CLIENT_ID && <div className="google-auth-block">
          <div className="auth-divider"><span>or continue with Google</span></div>
          <div className="google-button-wrap" ref={googleButtonRef} />
        </div>}
        <p className="auth-footer-text">{selectedRole === 'seller' ? <>New seller? <Link to="/seller-register" className="auth-link">Complete seller application</Link></> : <>Don't have an account? <Link to="/register" className="auth-link">Create Account</Link></>}</p>
      </div>
    </div>
  );
}

function locationRole(state) {
  return ['customer', 'seller', 'admin'].includes(state?.selectedRole) ? state.selectedRole : null;
}
