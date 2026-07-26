import React from 'react';
import { FiAlertCircle } from 'react-icons/fi';

export default function ErrorMessage({ english, tamil, variant = 'error' }) {
  if (!english && !tamil) return null;

  return (
    <div className={`identify-message identify-message--${variant}`} role="alert">
      <FiAlertCircle aria-hidden="true" />
      <div className="plant-message-copy">
        {english && <p>{english}</p>}
        {tamil && <p lang="ta">{tamil}</p>}
      </div>
    </div>
  );
}
