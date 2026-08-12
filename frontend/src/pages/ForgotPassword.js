import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { FiMail } from 'react-icons/fi';
import { authApi } from '../api/authApi';
import { toast } from 'react-toastify';

const LOGO_URL = process.env.PUBLIC_URL + '/logo.png';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) return setError('Email address is required');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) return setError('Enter a valid email address');
    try {
      setLoading(true);
      setError('');
      await authApi.forgotPassword(normalizedEmail);
      setEmail(normalizedEmail);
      setSent(true);
      toast.success('If that email exists, a reset link has been sent');
    } catch (err) {
      const message = err.response?.data?.detail || 'Unable to request a reset link';
      setError(message);
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
          <h1 className="auth-title">Forgot Password</h1>
          <p className="auth-subtitle">Enter your email to receive a reset link</p>
        </div>

        {sent ? (
          <div className="auth-form">
            <p className="text-gray" style={{ textAlign: 'center' }}>
              If an account with <strong>{email}</strong> exists, we've sent a password reset link.
              Please check your inbox.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="auth-form" noValidate>
            <div className="form-group">
              <label className="form-label" htmlFor="forgot-email">Email Address</label>
              <div className="input-icon-wrap">
                <FiMail size={18} className="input-icon" />
                <input
                  id="forgot-email"
                  type="email"
                  className={`form-input has-icon${error ? ' input-error' : ''}`}
                  placeholder="you@email.com"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(''); }}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? 'forgot-email-error' : undefined}
                />
              </div>
              {error && <span id="forgot-email-error" className="form-error" role="alert">{error}</span>}
            </div>
            <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={loading}>
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>
        )}

        <p className="auth-footer-text">
          Remembered your password? <Link to="/login" className="auth-link">Back to Login</Link>
        </p>
      </div>
    </div>
  );
}
