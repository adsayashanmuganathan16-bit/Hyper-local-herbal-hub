import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { FiLock, FiEye, FiEyeOff } from 'react-icons/fi';
import { authApi } from '../api/authApi';
import { toast } from 'react-toastify';

const LOGO_URL = process.env.PUBLIC_URL + '/logo.png';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [form, setForm] = useState({ password: '', confirmPassword: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
    setErrors((current) => ({ ...current, [name]: '', form: '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationErrors = {};
    if (!token) validationErrors.form = 'Missing or invalid reset token';
    if (!form.password) validationErrors.password = 'New password is required';
    else if (form.password.length < 6) validationErrors.password = 'Password must be at least 6 characters';
    if (!form.confirmPassword) validationErrors.confirmPassword = 'Please confirm your new password';
    else if (form.password !== form.confirmPassword) validationErrors.confirmPassword = 'Passwords do not match';
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length) return;
    try {
      setLoading(true);
      await authApi.resetPassword(token, form.password);
      toast.success('Password reset successfully. Please log in.');
      navigate('/login');
    } catch (err) {
      const message = err.response?.data?.detail || 'Password reset failed';
      setErrors((current) => ({ ...current, form: message }));
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <img src={LOGO_URL} alt="Herbal Hub" className="auth-logo" />
          <h1 className="auth-title">Reset Password</h1>
          <p className="auth-subtitle">Choose a new password for your account</p>
        </div>

        {!token ? (
          <p className="text-gray" style={{ textAlign: 'center' }}>
            This reset link is invalid or incomplete.{' '}
            <Link to="/forgot-password" className="auth-link">Request a new one</Link>.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="auth-form" noValidate>
            <div className="form-group">
              <label className="form-label">New Password</label>
              <div className="input-icon-wrap">
                <FiLock size={18} className="input-icon" />
                <input
                  type={showPass ? 'text' : 'password'}
                  name="password"
                  className={`form-input has-icon${errors.password ? ' input-error' : ''}`}
                  placeholder="Min 6 characters"
                  value={form.password}
                  onChange={handleChange}
                  aria-invalid={Boolean(errors.password)}
                />
                <button type="button" className="input-icon-right" onClick={() => setShowPass(!showPass)}>
                  {showPass ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                </button>
              </div>
              {errors.password && <span className="form-error" role="alert">{errors.password}</span>}
            </div>
            <div className="form-group">
              <label className="form-label">Confirm New Password</label>
              <div className="input-icon-wrap">
                <FiLock size={18} className="input-icon" />
                <input
                  type="password"
                  name="confirmPassword"
                  className={`form-input has-icon${errors.confirmPassword ? ' input-error' : ''}`}
                  placeholder="Re-enter password"
                  value={form.confirmPassword}
                  onChange={handleChange}
                  aria-invalid={Boolean(errors.confirmPassword)}
                />
              </div>
              {errors.confirmPassword && <span className="form-error" role="alert">{errors.confirmPassword}</span>}
            </div>
            {errors.form && <p className="form-error form-error-summary" role="alert">{errors.form}</p>}
            <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={loading}>
              {loading ? 'Resetting...' : 'Reset Password'}
            </button>
          </form>
        )}

        <p className="auth-footer-text">
          <Link to="/login" className="auth-link">Back to Login</Link>
        </p>
      </div>
    </div>
  );
}
