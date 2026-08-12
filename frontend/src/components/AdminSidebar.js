import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  FiBarChart2, FiBox, FiCreditCard, FiDollarSign, FiFileText,
  FiGrid, FiHeadphones, FiMail, FiPackage, FiStar, FiUsers,
} from 'react-icons/fi';

export const adminNavigation = [
  { to: '/admin/dashboard', label: 'Overview', icon: FiGrid, end: true },
  { to: '/admin/medicines', label: 'Products', icon: FiBox },
  { to: '/admin/orders', label: 'Orders', icon: FiPackage },
  { to: '/admin/users', label: 'Customers & Users', icon: FiUsers },
  { to: '/admin/sellers', label: 'Sellers', icon: FiUsers },
  { to: '/admin/analytics', label: 'Reports & Analytics', icon: FiBarChart2 },
  { to: '/admin/payments', label: 'Payments', icon: FiCreditCard },
  { to: '/admin/payouts', label: 'Seller Payouts', icon: FiDollarSign },
  { to: '/admin/reviews', label: 'Customer Reviews', icon: FiStar },
  { to: '/admin/subscribers', label: 'Email Subscribers', icon: FiMail },
  { to: '/admin/support', label: 'Support Inbox', icon: FiHeadphones },
];

export default function AdminSidebar() {
  return (
    <aside className="admin-sidebar" aria-label="Admin navigation">
      <div className="admin-sidebar-brand">
        <span><FiFileText /></span>
        <div><small>ADMIN WORKSPACE</small><strong>Control Center</strong></div>
      </div>
      <nav className="admin-sidebar-nav">
        {adminNavigation.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => isActive ? 'active' : ''}>
            <Icon aria-hidden="true" /><span>{label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="admin-sidebar-foot"><span className="admin-sidebar-status" /> System operational</div>
    </aside>
  );
}
