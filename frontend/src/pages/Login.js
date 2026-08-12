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
  const googleRoleRef = useRef(selectedRole || 'customer');
  const googleButtonRef = useRef(null);

  function chooseRole(role) {
    if (role === 'seller') {
      navigate('/seller-register');
      return;
    }
    setSelectedRole(role);
  }

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  useEffect(() => { googleRoleRef.current = selectedRole || 'customer'; }, [selectedRole]);

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
      if (loggedInUser?.role !== selectedRole) {
        logout();
        throw new Error(`This is not a ${selectedRole} account`);
      }
      toast.success(loggedInUser?.name ? `Welcome, ${loggedInUser.name}!` : 'Welcome back!');
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
      toast.error(err.response?.data?.detail || err.message || 'Login failed');
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
        {process.env.REACT_APP_GOOGLE_CLIENT_ID && <div className="google-auth-block">
          <div className="auth-divider"><span>or continue with Google</span></div>
          <div className="google-button-wrap" ref={googleButtonRef} />
        </div>}
        {selectedRole === 'admin' && <div className="auth-demo">
          <p className="auth-demo-title">Administrator quick fill</p>
          <div className="auth-demo-btns">
            <button type="button" className="auth-demo-btn" onClick={() => setForm({ email: 'adsayashanmuganathan16@gmail.com', password: 'Adsaya#16' })}>
              Admin
            </button>
          </div>
        </div>}
        <p className="auth-footer-text">{selectedRole === 'seller' ? <>New seller? <Link to="/seller-register" className="auth-link">Complete seller application</Link></> : <>Don't have an account? <Link to="/register" className="auth-link">Create Account</Link></>}</p>
      </div>
    </div>
  );
}

function locationRole(state) {
  return ['customer', 'seller', 'admin'].includes(state?.selectedRole) ? state.selectedRole : null;
}
