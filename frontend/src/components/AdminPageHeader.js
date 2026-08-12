import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ADMIN_TITLES = {
  '/admin': 'Dashboard',
  '/admin/dashboard': 'Dashboard',
  '/admin/medicines': 'Products',
  '/admin/orders': 'Orders',
  '/admin/users': 'Customers & Users',
  '/admin/analytics': 'Reports & Analytics',
  '/admin/sellers': 'Sellers',
  '/admin/payouts': 'Payouts',
  '/admin/payments': 'Payments',
  '/admin/reviews': 'Customer Reviews',
  '/admin/subscribers': 'Email Subscribers',
  '/admin/support': 'Support Inbox',
  '/admin/delivery-staff': 'Delivery Operations',
};

const SELLER_TITLES = {
  '/seller': 'Seller Dashboard', '/seller/dashboard': 'Seller Dashboard',
  '/seller/products': 'Products', '/seller/orders': 'Orders',
  '/seller/customers': 'Customers', '/seller/earnings': 'Earnings & Payouts',
  '/seller/payment-setup': 'Business & Payment Setup', '/seller/reviews': 'Customer Reviews',
};

const CUSTOMER_TITLES = {
  '/cart': 'Shopping Cart', '/wishlist': 'Wishlist', '/checkout': 'Checkout',
  '/orders': 'My Orders', '/prescriptions': 'Prescriptions', '/profile': 'My Account',
};

export default function AdminPageHeader() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const admin = pathname.startsWith('/admin');
  const seller = pathname.startsWith('/seller');
  const customerPath = Boolean(CUSTOMER_TITLES[pathname]) || pathname.startsWith('/orders/');
  const customer = customerPath && user?.role === 'customer';
  if (!admin && !seller && !customer) return null;

  const title = admin
    ? (pathname.startsWith('/admin/delivery/') ? 'Delivery Tracking' : ADMIN_TITLES[pathname] || 'Admin Center')
    : seller
      ? (pathname.startsWith('/seller/orders/') ? 'Order Tracking' : SELLER_TITLES[pathname] || 'Seller Center')
      : (pathname.startsWith('/orders/') ? 'Order Details' : CUSTOMER_TITLES[pathname] || 'My Account');
  const dashboard = ['/admin', '/admin/dashboard', '/seller', '/seller/dashboard'].includes(pathname);
  const label = admin ? 'Herbal Hub Admin' : seller ? 'Seller Center' : 'Customer Account';
  const home = admin ? '/admin/dashboard' : seller ? '/seller/dashboard' : '/shop';

  return (
    <div className={`admin-shell-header-wrap workspace-${admin ? 'admin' : seller ? 'seller' : 'customer'}`}>
      <div className="container">
        <header className="admin-shell-header">
          <div>
            <span>{label}</span>
            <h1>{title}</h1>
          </div>
          {dashboard && admin ? (
            <nav aria-label="Dashboard quick actions">
              <Link to="/admin/medicines">Products</Link>
              <Link to="/admin/orders" className="primary">Orders</Link>
            </nav>
          ) : dashboard && seller ? (
            <nav aria-label="Seller quick actions"><Link to="/seller/products">Products</Link><Link to="/seller/orders" className="primary">Orders</Link></nav>
          ) : <Link className="admin-shell-back" to={home}>{admin || seller ? 'Dashboard' : 'Continue shopping'}</Link>}
        </header>
      </div>
    </div>
  );
}
