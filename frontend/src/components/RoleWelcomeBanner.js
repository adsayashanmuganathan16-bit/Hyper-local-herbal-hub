import React from 'react';

export default function RoleWelcomeBanner({ user }) {
  if (!['customer', 'seller', 'admin'].includes(user?.role)) return null;
  const displayName = user.role === 'seller'
    ? user.store_name || user.business_name || user.name
    : user.name;

  return (
    <section className={`role-welcome role-welcome-${user.role}`} aria-label="Welcome">
      <h1>Welcome, {displayName || 'Herbal Hub user'}!</h1>
    </section>
  );
}
