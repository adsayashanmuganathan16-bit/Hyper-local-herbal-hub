import React from 'react';

export default function Loading({ text = 'Loading...', compact = false }) {
  return (
    <div className={`loading-wrap ${compact ? 'loading-compact' : ''}`} role="status" aria-live="polite">
      <span className="sr-only">{text}</span>
      <div className="loading-skeleton-shell" aria-hidden="true">
        <div className="loading-skeleton-heading" />
        <div className="loading-skeleton-grid">
          {[0, 1, 2].map((item) => <div className="loading-skeleton-card" key={item}><span /><i /><i /></div>)}
        </div>
      </div>
      <p className="loading-text">{text}</p>
    </div>
  );
}
