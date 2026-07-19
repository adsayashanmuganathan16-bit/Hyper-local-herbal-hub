export const formatCurrency = (amount) => `₹${Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

export const formatDateTime = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export const truncateText = (text, maxLen = 100) => {
  if (!text || text.length <= maxLen) return text;
  return text.slice(0, maxLen).trim() + '...';
};

export const getStatusColor = (status) => {
  const map = {
    placed: 'badge-yellow',
    confirmed: 'badge-green',
    packed: 'badge-green',
    shipped: 'badge-green',
    out_for_delivery: 'badge-green',
    delivered: 'badge-green',
    cancelled: 'badge-red',
    returned: 'badge-red',
    pending: 'badge-yellow',
    completed: 'badge-green',
    failed: 'badge-red',
    uploaded: 'badge-yellow',
    verifying: 'badge-yellow',
    approved: 'badge-green',
    rejected: 'badge-red',
    expired: 'badge-gray',
    assigned: 'badge-yellow',
    picked_up: 'badge-green',
    in_transit: 'badge-green',
    near_location: 'badge-green',
  };
  return map[status] || 'badge-gray';
};

export const formatStatus = (status) => {
  return status ? status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '';
};

export const getDiscountPercent = (price, discountPrice) => {
  if (!discountPrice || discountPrice >= price) return 0;
  return Math.round(((price - discountPrice) / price) * 100);
};