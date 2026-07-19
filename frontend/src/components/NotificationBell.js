import React from 'react';
import { FiBell } from 'react-icons/fi';

export default function NotificationBell({ count, onClick }) {
  return (
    <button className="notif-bell" onClick={onClick}>
      <FiBell size={20} />
      {count > 0 && <span className="notif-bell-count">{count > 99 ? '99+' : count}</span>}
    </button>
  );
}