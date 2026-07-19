import React, { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FiCheckCircle, FiXCircle, FiLoader } from 'react-icons/fi';
import { authApi } from '../api/authApi';

const LOGO_URL = process.env.PUBLIC_URL + '/logo.png';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [status, setStatus] = useState('verifying'); // verifying | success | error
  const [message, setMessage] = useState('Verifying your email...');
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    if (!token) {
      setStatus('error');
      setMessage('This verification link is invalid or incomplete.');
      return;
    }
    authApi
      .verifyEmail(token)
      .then(({ data }) => {
        setStatus('success');
        setMessage(data?.message || 'Your email has been verified.');
      })
      .catch((err) => {
        setStatus('error');
        setMessage(err.response?.data?.detail || 'Verification failed or the link has expired.');
      });
  }, [token]);

  const icon = {
    verifying: <FiLoader size={48} className="verify-spin" style={{ color: 'var(--green-700)' }} />,
    success: <FiCheckCircle size={48} style={{ color: 'var(--green-700)' }} />,
    error: <FiXCircle size={48} style={{ color: '#d32f2f' }} />,
  }[status];

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <img src={LOGO_URL} alt="Herbal Hub" className="auth-logo" />
          <h1 className="auth-title">Email Verification</h1>
        </div>
        <div style={{ textAlign: 'center', padding: '12px 0 8px' }}>
          <div style={{ marginBottom: 16 }}>{icon}</div>
          <p className="text-gray">{message}</p>
        </div>
        <p className="auth-footer-text">
          {status === 'success' ? (
            <Link to="/login" className="auth-link">Continue to Login</Link>
          ) : (
            <Link to="/" className="auth-link">Back to Home</Link>
          )}
        </p>
      </div>
    </div>
  );
}
