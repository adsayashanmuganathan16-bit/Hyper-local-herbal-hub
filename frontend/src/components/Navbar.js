import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { FiShoppingCart, FiUser, FiLogOut, FiMenu, FiX, FiBell, FiPackage, FiFileText, FiBarChart2, FiUsers, FiGrid, FiSearch, FiDollarSign, FiStar, FiMail, FiTrash2, FiHeart } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { notificationApi } from '../api/notificationApi';
import SearchBar from './SearchBar';
import { formatDateTime } from '../utils/helpers';
import { wishlistIds } from '../utils/wishlist';
import { adminNavigation } from './AdminSidebar';
import { customerNavigation, sellerNavigation } from './WorkspaceSidebar';
import { websocketBaseUrl } from '../utils/apiBase';

const LOGO_URL = process.env.PUBLIC_URL + '/logo.png';

export default function Navbar() {
  const { user, isAdmin, isSeller, isCustomer, isDeliveryStaff, isAuthenticated, logout } = useAuth();
  const { totalItems } = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [wishlistCount, setWishlistCount] = useState(() => wishlistIds().length);
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
    if (!isAuthenticated) return undefined;
    const base = websocketBaseUrl();
    const socket=new WebSocket(`${base}/api/notifications/ws?token=${encodeURIComponent(localStorage.getItem('herbal_hub_token')||'')}`);
    socket.onmessage=event=>{const payload=JSON.parse(event.data);if(payload.type==='notification.created'){
      setNotifications(previous=>[payload.notification,...previous.filter(item=>item.id!==payload.notification.id)]);
      setUnreadCount(count=>count+1);
    }};
    const keepalive=setInterval(()=>socket.readyState===WebSocket.OPEN&&socket.send('ping'),25000);
    return()=>{clearInterval(keepalive);socket.close();};
  },[isAuthenticated]);

  useEffect(() => {
    const updateWishlistCount = (event) => setWishlistCount((event.detail || wishlistIds()).length);
    window.addEventListener('herbal:wishlist', updateWishlistCount);
    return () => window.removeEventListener('herbal:wishlist', updateWishlistCount);
  }, []);

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

  const deleteNotification = async (event, id) => {
    event.preventDefault();
    event.stopPropagation();
    await notificationApi.delete(id);
    setNotifications((previous) => previous.filter((item) => item.id !== id));
    setUnreadCount((count) => Math.max(0, count - 1));
  };

  const navLinks = [
    { to: '/', label: 'Home' },
    { to: '/shop', label: 'Shop' },
    { to: '/identify-plant', label: 'Identify Plant' },
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <nav className={`navbar ${location.pathname === '/' ? 'navbar-home' : ''}`}>
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
          <SearchBar compact placeholder="Search" />

          {isAuthenticated ? (
            <>
              {/* Notifications */}
              <div className="navbar-icon-wrap" ref={notifRef}>
                <button className="navbar-icon-btn" onClick={() => setNotifOpen(!notifOpen)} aria-label="Notifications" title="Notifications">
                  <FiBell size={20} />
                  {unreadCount > 0 && <span className="notif-badge">{unreadCount}</span>}
                </button>
                {notifOpen && (
                  <div className="dropdown-panel notif-dropdown animate-slideDown">
                    <div className="dropdown-header">
                      <span className="font-semibold">Notifications</span>
                      <div className="notif-header-actions">
                        <button className="btn-ghost text-sm" onClick={async () => {
                          await notificationApi.markAllRead();
                          setNotifications([]);
                          setUnreadCount(0);
                        }}>Mark read</button>
                        <button className="btn-ghost text-sm notif-clear-button" onClick={async () => {
                          if (!window.confirm('Delete all your notifications?')) return;
                          await notificationApi.deleteAll();
                          setNotifications([]);
                          setUnreadCount(0);
                        }}>Clear all</button>
                      </div>
                    </div>
                    <div className="dropdown-body">
                      {notifications.length === 0 ? (
                        <p className="text-gray text-sm text-center" style={{ padding: '20px 0' }}>No new notifications</p>
                      ) : (
                        notifications.slice(0, 5).map((n) => (
                          <div className="notif-item-row" key={n.id}>
                            <Link
                              to={n.link || '#'}
                              className="notif-item"
                              onClick={() => { markNotifRead(n.id); setNotifOpen(false); }}
                            >
                              <div>
                                <p className="font-medium text-sm">{n.title}</p>
                                <p className="text-gray text-xs">{n.message}</p>
                                {n.created_at && <time className="text-gray text-xs">{formatDateTime(n.created_at)}</time>}
                              </div>
                            </Link>
                            <button
                              className="notif-delete-button"
                              aria-label="Delete notification"
                              title="Delete notification"
                              onClick={(event) => deleteNotification(event, n.id)}
                            >
                              <FiTrash2 size={15} />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Cart */}
              {isCustomer && <Link to="/wishlist" className="navbar-icon-btn" aria-label="Wishlist" title="Wishlist">
                <FiHeart size={20} />
                {wishlistCount > 0 && <span className="cart-badge">{wishlistCount}</span>}
              </Link>}
              {isCustomer && <Link to="/cart" className="navbar-icon-btn cart-btn" aria-label="Shopping cart" title="Shopping cart">
                <FiShoppingCart size={20} />
                {totalItems > 0 && <span className="cart-badge">{totalItems}</span>}
              </Link>}

              {/* Profile Dropdown */}
              <div className="navbar-icon-wrap" ref={profileRef}>
                <button className="navbar-avatar" onClick={() => setProfileOpen(!profileOpen)} aria-label="Open profile menu" title="Profile">
                  {user?.profile_image ? (
                    <img src={user.profile_image} alt="" className="avatar-img" />
                  ) : (
                    <span className="avatar-initial">{user?.name?.[0]?.toUpperCase() || 'U'}</span>
                  )}
                </button>
                {profileOpen && (
                  <div className="dropdown-panel profile-dropdown animate-slideDown">
                    <div className="dropdown-header profile-dropdown-header">
                      <p className="font-semibold">{isSeller ? (user?.store_name || user?.business_name || 'Seller Company') : user?.name}</p>
                      <p className="text-gray text-xs">{user?.email}</p>
                    </div>
                    <div className="dropdown-body">
                      <Link to="/profile" className="dropdown-item" onClick={() => setProfileOpen(false)}>
                        <FiUser size={16} /> My Profile
                      </Link>
                      {isCustomer && <Link to="/orders" className="dropdown-item" onClick={() => setProfileOpen(false)}>
                        <FiPackage size={16} /> Open Customer Account
                      </Link>}
                      {isAdmin && (
                        <>
                          <div className="divider" style={{ margin: '8px 0' }} />
                          <Link to="/admin/dashboard" className="dropdown-item" onClick={() => setProfileOpen(false)}>
                            <FiGrid size={16} /> Open Admin Center
                          </Link>
                        </>
                      )}
                      {isSeller && (
                        <>
                          <div className="divider" style={{ margin: '8px 0' }} />
                          <Link to="/seller/dashboard" className="dropdown-item" onClick={() => setProfileOpen(false)}><FiBarChart2 size={16} /> Open Seller Center</Link>
                        </>
                      )}
                      {isDeliveryStaff && <Link to="/delivery-staff" className="dropdown-item" onClick={() => setProfileOpen(false)}><FiPackage size={16} /> Assigned Deliveries</Link>}
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
          <button className="navbar-mobile-toggle" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}>
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
              {isAdmin && adminNavigation.map(({ to, label }) => <Link key={to} to={to} className="mobile-menu-link" onClick={() => setMenuOpen(false)}>{label}</Link>)}
              {isSeller && sellerNavigation.map(({ to, label }) => <Link key={to} to={to} className="mobile-menu-link" onClick={() => setMenuOpen(false)}>{label}</Link>)}
              {isCustomer && customerNavigation.map(({ to, label }) => <Link key={to} to={to} className="mobile-menu-link" onClick={() => setMenuOpen(false)}>{label}</Link>)}
              {isDeliveryStaff && <Link to="/delivery-staff" className="mobile-menu-link" onClick={() => setMenuOpen(false)}>Delivery Dashboard</Link>}
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
