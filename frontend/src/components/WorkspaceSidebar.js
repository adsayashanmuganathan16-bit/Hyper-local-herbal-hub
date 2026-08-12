import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  FiBarChart2, FiCreditCard, FiFileText, FiHeart, FiPackage,
  FiShoppingBag, FiShoppingCart, FiStar, FiUser, FiUsers,
} from 'react-icons/fi';

export const sellerNavigation = [
  { to: '/seller/dashboard', label: 'Overview', icon: FiBarChart2 },
  { to: '/seller/products', label: 'My Products', icon: FiShoppingBag },
  { to: '/seller/orders', label: 'Orders', icon: FiPackage },
  { to: '/seller/customers', label: 'Customers', icon: FiUsers },
  { to: '/seller/earnings', label: 'Earnings & Payouts', icon: FiCreditCard },
  { to: '/seller/payment-setup', label: 'Business & Payments', icon: FiFileText },
  { to: '/seller/reviews', label: 'Customer Reviews', icon: FiStar },
  { to: '/profile', label: 'My Profile', icon: FiUser },
];

export const customerNavigation = [
  { to: '/orders', label: 'My Orders', icon: FiPackage },
  { to: '/wishlist', label: 'Wishlist', icon: FiHeart },
  { to: '/cart', label: 'Shopping Cart', icon: FiShoppingCart },
  { to: '/prescriptions', label: 'Prescriptions', icon: FiFileText },
  { to: '/profile', label: 'My Profile', icon: FiUser },
  { to: '/shop', label: 'Continue Shopping', icon: FiShoppingBag },
];

export default function WorkspaceSidebar({ role }) {
  const seller = role === 'seller';
  const navigation = seller ? sellerNavigation : customerNavigation;
  return <aside className={`admin-sidebar workspace-sidebar workspace-sidebar-${role}`} aria-label={`${role} navigation`}>
    <div className="admin-sidebar-brand">
      <span>{seller ? <FiShoppingBag /> : <FiUser />}</span>
      <div><small>{seller ? 'SELLER WORKSPACE' : 'CUSTOMER ACCOUNT'}</small><strong>{seller ? 'Store Center' : 'My Herbal Hub'}</strong></div>
    </div>
    <nav className="admin-sidebar-nav">
      {navigation.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} className={({ isActive }) => isActive ? 'active' : ''}>
        <Icon aria-hidden="true" /><span>{label}</span>
      </NavLink>)}
    </nav>
    <div className="admin-sidebar-foot"><span className="admin-sidebar-status" /> {seller ? 'Seller account active' : 'Secure account area'}</div>
  </aside>;
}
