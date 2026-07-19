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
  const [devToken, setDevToken] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) return toast.error('Please enter your email');
    try {
      setLoading(true);
      const { data } = await authApi.forgotPassword(email);
      setSent(true);
      // Demo helper: the mock backend returns the reset token so you can test the flow.
      if (data?.reset_token) setDevToken(data.reset_token);
      toast.success('If that email exists, a reset link has been sent');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Request failed');
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
            {devToken && (
              <div style={{ marginTop: 16 }}>
                <p className="text-sm text-gray">Demo mode — use this reset link:</p>
                <Link to={`/reset-password?token=${devToken}`} className="auth-link">
                  Reset your password
                </Link>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <div className="input-icon-wrap">
                <FiMail size={18} className="input-icon" />
                <input
                  type="email"
                  className="form-input has-icon"
                  placeholder="you@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
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
