import React from 'react';
import { FiStar } from 'react-icons/fi';

export default function ReviewStars({ rating, size = 16 }) {
  const stars = [];
  const fullStars = Math.floor(rating);
  const hasHalf = rating - fullStars >= 0.5;

  for (let i = 0; i < 5; i++) {
    if (i < fullStars) {
      stars.push(<FiStar key={i} size={size} style={{ fill: '#eab308', color: '#eab308' }} />);
    } else if (i === fullStars && hasHalf) {
      stars.push(
        <span key={i} style={{ position: 'relative', width: size, height: size, display: 'inline-block' }}>
          <FiStar size={size} style={{ color: '#d4d4d4', position: 'absolute' }} />
          <span style={{ position: 'absolute', overflow: 'hidden', width: '50%', height: '100%' }}>
            <FiStar size={size} style={{ fill: '#eab308', color: '#eab308' }} />
          </span>
        </span>
      );
    } else {
      stars.push(<FiStar key={i} size={size} style={{ color: '#d4d4d4' }} />);
    }
  }

  return <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>{stars}</div>;
}