import React from 'react';

export default function LoadingSpinner({ text = 'Identifying plant…' }) {
  return (
    <span className="plant-loading" role="status" aria-live="polite">
      <span className="identify-spinner" aria-hidden="true" />
      <span>{text}</span>
    </span>
  );
}
