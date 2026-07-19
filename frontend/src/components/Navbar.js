import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { FiShoppingCart, FiUser, FiLogOut, FiMenu, FiX, FiBell, FiPackage, FiFileText, FiBarChart2, FiUsers, FiGrid, FiSearch } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { notificationApi } from '../api/notificationApi';
import SearchBar from './SearchBar';

const LOGO_URL = process.env.PUBLIC_URL + '/logo.png';

export default function Navbar() {
  const { user, isAdmin, isAuthenticated, logout } = useAuth();
  const { totalItems } = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const profileRef = useRef(null);
  const notifRef = useRef(null);

  useEffect(() => {
    if (isAuthenticated) {
      notificationApi.getNotifications({ page: 1, unread_only: true }).then(({ data }) => {
        setNotifications(data.items || []);
        setUnreadCount(data.unread_count || 0);
      }).catch(() => {});
    }
  }, [isAuthenticated, location]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    setProfileOpen(false);
    navigate('/');
  };

  const markNotifRead = async (id) => {
    await notificationApi.markRead(id);
    setUnreadCount((c) => Math.max(0, c - 1));
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const navLinks = [
    { to: '/', label: 'Home' },
    { to: '/shop', label: 'Shop' },
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="navbar">
      <div className="container navbar-inner">
        {/* Logo */}
        <Link to="/" className="navbar-logo">
          <img src={LOGO_URL} alt="Herbal Hub" className="navbar-logo-img" />
        </Link>

        {/* Desktop Nav */}
        <div className="navbar-links">
          {navLinks.map((link) => (
            <Link key={link.to} to={link.to} className={`navbar-link ${isActive(link.to) ? 'active' : ''}`}>
              {link.label}
            </Link>
          ))}
        </div>

        {/* Right Section */}
        <div className="navbar-right">
          <SearchBar compact />

          {isAuthenticated ? (
            <>
              {/* Notifications */}
              <div className="navbar-icon-wrap" ref={notifRef}>
                <button className="navbar-icon-btn" onClick={() => setNotifOpen(!notifOpen)}>
                  <FiBell size={20} />
                  {unreadCount > 0 && <span className="notif-badge">{unreadCount}</span>}
                </button>
                {notifOpen && (
                  <div className="dropdown-panel notif-dropdown animate-slideDown">
                    <div className="dropdown-header">
                      <span className="font-semibold">Notifications</span>
                      <button className="btn-ghost text-sm" onClick={async () => {
                        await notificationApi.markAllRead();
                        setNotifications([]);
                        setUnreadCount(0);
                      }}>Mark all read</button>
                    </div>
                    <div className="dropdown-body">
                      {notifications.length === 0 ? (
                        <p className="text-gray text-sm text-center" style={{ padding: '20px 0' }}>No new notifications</p>
                      ) : (
                        notifications.slice(0, 5).map((n) => (
                          <Link
                            key={n.id}
                            to={n.link || '#'}
                            className="notif-item"
                            onClick={() => { markNotifRead(n.id); setNotifOpen(false); }}
                          >
                            <div>
                              <p className="font-medium text-sm">{n.title}</p>
                              <p className="text-gray text-xs">{n.message}</p>
                            </div>
                          </Link>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Cart */}
              <Link to="/cart" className="navbar-icon-btn cart-btn">
                <FiShoppingCart size={20} />
                {totalItems > 0 && <span className="cart-badge">{totalItems}</span>}
              </Link>

              {/* Profile Dropdown */}
              <div className="navbar-icon-wrap" ref={profileRef}>
                <button className="navbar-avatar" onClick={() => setProfileOpen(!profileOpen)}>
                  {user?.profile_image ? (
                    <img src={user.profile_image} alt="" className="avatar-img" />
                  ) : (
                    <span className="avatar-initial">{user?.name?.[0]?.toUpperCase() || 'U'}</span>
                  )}
                </button>
                {profileOpen && (
                  <div className="dropdown-panel profile-dropdown animate-slideDown">
                    <div className="dropdown-header">
                      <p className="font-semibold">{user?.name}</p>
                      <p className="text-gray text-xs">{user?.email}</p>
                    </div>
                    <div className="dropdown-body">
                      <Link to="/profile" className="dropdown-item" onClick={() => setProfileOpen(false)}>
                        <FiUser size={16} /> My Profile
                      </Link>
                      <Link to="/orders" className="dropdown-item" onClick={() => setProfileOpen(false)}>
                        <FiPackage size={16} /> My Orders
                      </Link>
                      <Link to="/prescriptions" className="dropdown-item" onClick={() => setProfileOpen(false)}>
                        <FiFileText size={16} /> Prescriptions
                      </Link>
                      {isAdmin && (
                        <>
                          <div className="divider" style={{ margin: '8px 0' }} />
                          <Link to="/admin" className="dropdown-item" onClick={() => setProfileOpen(false)}>
                            <FiBarChart2 size={16} /> Admin Dashboard
                          </Link>
                          <Link to="/admin/medicines" className="dropdown-item" onClick={() => setProfileOpen(false)}>
                            <FiGrid size={16} /> Manage Medicines
                          </Link>
                          <Link to="/admin/orders" className="dropdown-item" onClick={() => setProfileOpen(false)}>
                            <FiPackage size={16} /> Manage Orders
                          </Link>
                          <Link to="/admin/users" className="dropdown-item" onClick={() => setProfileOpen(false)}>
                            <FiUsers size={16} /> Manage Users
                          </Link>
                        </>
                      )}
                      <div className="divider" style={{ margin: '8px 0' }} />
                      <button className="dropdown-item logout-item" onClick={handleLogout}>
                        <FiLogOut size={16} /> Logout
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="navbar-auth">
              <Link to="/login" className="btn btn-secondary btn-sm">Login</Link>
              <Link to="/register" className="btn btn-primary btn-sm">Register</Link>
            </div>
          )}

          {/* Mobile Menu Toggle */}
          <button className="navbar-mobile-toggle" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <FiX size={24} /> : <FiMenu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {menuOpen && (
        <div className="mobile-menu animate-slideDown">
          {navLinks.map((link) => (
            <Link key={link.to} to={link.to} className={`mobile-menu-link ${isActive(link.to) ? 'active' : ''}`} onClick={() => setMenuOpen(false)}>
              {link.label}
            </Link>
          ))}
          {isAuthenticated ? (
            <>
              <Link to="/cart" className="mobile-menu-link" onClick={() => setMenuOpen(false)}>Cart ({totalItems})</Link>
              <Link to="/orders" className="mobile-menu-link" onClick={() => setMenuOpen(false)}>My Orders</Link>
              <Link to="/prescriptions" className="mobile-menu-link" onClick={() => setMenuOpen(false)}>Prescriptions</Link>
              <button className="mobile-menu-link logout" onClick={handleLogout}>Logout</button>
            </>
          ) : (
            <div className="mobile-menu-auth">
              <Link to="/login" className="btn btn-secondary" onClick={() => setMenuOpen(false)}>Login</Link>
              <Link to="/register" className="btn btn-primary" onClick={() => setMenuOpen(false)}>Register</Link>
            </div>
          )}
        </div>
      )}
    </nav>
  );
}