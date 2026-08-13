import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Loading from './Loading';

export default function ProtectedRoute({ children, adminOnly, sellerOnly, customerOnly }) {
  const { user, isAuthenticated, isAdmin, isSeller, isCustomer, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Loading />;
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location }} />;
  if (adminOnly && !isAdmin) return <Navigate to="/" replace />;
  if (sellerOnly && !isSeller) return <Navigate to="/" replace />;
  if (sellerOnly && user?.onboarding_required && location.pathname !== '/seller/payment-setup') {
    return <Navigate to="/seller/payment-setup" replace state={{ onboarding: true }} />;
  }
  if (customerOnly && !isCustomer) return <Navigate to="/" replace />;

  return children;
}
