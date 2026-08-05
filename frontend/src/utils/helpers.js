export const formatCurrency = (amount) => `Rs. ${Number(amount || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Colombo',
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
});

function parseDate(value) {
  if (value instanceof Date) return value;
  if (!value) return null;
  const text = String(value);
  // MongoDB values without an explicit offset are UTC.
  return new Date(/(?:Z|[+-]\d\d:\d\d)$/.test(text) ? text : `${text}Z`);
}

/** Render every user-facing timestamp as "29 Jul 2026, 07:01 PM". */
export const formatDateTime = (value) => {
  const date = parseDate(value);
  if (!date || Number.isNaN(date.getTime())) return '';
  const parts = Object.fromEntries(
    DATE_TIME_FORMATTER.formatToParts(date)
      .filter(({ type }) => type !== 'literal')
      .map(({ type, value: part }) => [type, part]),
  );
  return `${parts.day} ${parts.month} ${parts.year}, ${parts.hour}:${parts.minute} ${parts.dayPeriod}`;
};

// Retained as a compatibility alias so older pages automatically use the
// same required date-and-time format rather than silently rendering date-only.
export const formatDate = formatDateTime;

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
