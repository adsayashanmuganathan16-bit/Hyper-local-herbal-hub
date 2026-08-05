import React from 'react';
import { formatDateTime } from '../utils/helpers';

export default function NotificationPanel({ notifications = [], onClose, onMarkRead }) {
  return (
    <aside className="notification-panel" aria-label="Notifications">
      <header className="notification-panel__header">
        <h2>Notifications</h2>
        <button type="button" onClick={onClose} aria-label="Close notifications">×</button>
      </header>
      <div className="notification-panel__list">
        {notifications.map((item) => (
          <button key={item.id || item._id} type="button" className={`notification-panel__item ${item.is_read ? '' : 'is-unread'}`} onClick={() => onMarkRead?.(item.id || item._id)}>
            <strong>{item.title}</strong>
            <span>{item.message}</span>
            {item.created_at && <time>{formatDateTime(item.created_at)}</time>}
          </button>
        ))}
        {!notifications.length && <p className="notification-panel__empty">No notifications yet.</p>}
      </div>
    </aside>
  );
}
