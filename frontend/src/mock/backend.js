// Mock backend: routes API requests to the localStorage-backed db.
// Mimics the shape of the original FastAPI backend responses.
import { db, CATEGORIES, uid } from './db';

const PAGE_SIZE = 12;

class ApiError extends Error {
  constructor(status, detail) {
    super(detail);
    this.response = { status, data: { detail } };
  }
}

const TOKEN_KEY = 'herbal_hub_token';

function currentUser() {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return null;
  // token format: "mock.<userId>"
  const userId = token.startsWith('mock.') ? token.slice(5) : token;
  return db.getUsers().find((u) => u.id === userId) || null;
}

function requireAuth() {
  const user = currentUser();
  if (!user) throw new ApiError(401, 'Not authenticated');
  return user;
}

function requireAdmin() {
  const user = requireAuth();
  if (user.role !== 'admin') throw new ApiError(403, 'Admin access required');
  return user;
}

const publicUser = (u) => {
  if (!u) return null;
  const { password, ...rest } = u;
  return rest;
};

function fileToUrl(formData, field = 'file') {
  try {
    const file = formData.get(field);
    if (file && typeof file === 'object' && 'name' in file) {
      return { url: URL.createObjectURL(file), name: file.name };
    }
  } catch {
    /* ignore */
  }
  return { url: null, name: 'upload' };
}

// ---- Cart helpers ----
function getUserCart(userId) {
  const carts = db.getCarts();
  return carts[userId] || [];
}
function setUserCart(userId, items) {
  const carts = db.getCarts();
  carts[userId] = items;
  db.setCarts(carts);
}
function cartTotals(items) {
  const total_items = items.reduce((s, i) => s + i.quantity, 0);
  const total_amount = items.reduce((s, i) => s + (i.discount_price || i.price) * i.quantity, 0);
  return { items, total_items, total_amount };
}

function addNotification(userId, title, message, link) {
  const notifs = db.getNotifications();
  notifs.unshift({
    id: uid(),
    user_id: userId,
    title,
    message,
    link: link || null,
    read: false,
    created_at: new Date().toISOString(),
  });
  db.setNotifications(notifs);
}

// ---- Delivery geo helpers (deterministic, no external services) ----
const CITY_COORDS = {
  bengaluru: [12.9716, 77.5946],
  bangalore: [12.9716, 77.5946],
  mumbai: [19.076, 72.8777],
  delhi: [28.6139, 77.209],
  'new delhi': [28.6139, 77.209],
  chennai: [13.0827, 80.2707],
  hyderabad: [17.385, 78.4867],
  kolkata: [22.5726, 88.3639],
  pune: [18.5204, 73.8567],
  ahmedabad: [23.0225, 72.5714],
  jaipur: [26.9124, 75.7873],
};

const AGENTS = [
  { name: 'Rahul Verma', vehicle: 'Bike', vehicle_number: 'KA 05 AB 1234', rating: 4.9, phone: '+91 98450 11234', photo: 'https://i.pravatar.cc/120?img=12' },
  { name: 'Anita Desai', vehicle: 'Scooter', vehicle_number: 'KA 03 XZ 8765', rating: 4.8, phone: '+91 99001 55872', photo: 'https://i.pravatar.cc/120?img=45' },
  { name: 'Imran Khan', vehicle: 'Bike', vehicle_number: 'KA 01 MN 4590', rating: 4.7, phone: '+91 90080 33219', photo: 'https://i.pravatar.cc/120?img=33' },
  { name: 'Sneha Rao', vehicle: 'EV Scooter', vehicle_number: 'KA 09 EV 2201', rating: 5.0, phone: '+91 96860 77410', photo: 'https://i.pravatar.cc/120?img=5' },
];

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function haversineKm(a, b) {
  const R = 6371;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLng = ((b[1] - a[1]) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a[0] * Math.PI) / 180) * Math.cos((b[0] * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

function buildDelivery(order) {
  const city = (order.address?.city || 'Bengaluru').toLowerCase().trim();
  const center = CITY_COORDS[city] || CITY_COORDS.bengaluru;
  const h = hashStr(order.id);
  const rnd = (n) => ((h >> n) & 0xff) / 255 - 0.5; // -0.5..0.5

  // Store (origin) and customer (destination) a few km apart around the city.
  const origin = [center[0] + rnd(0) * 0.05, center[1] + rnd(4) * 0.05];
  const destination = [center[0] + rnd(8) * 0.06, center[1] + rnd(12) * 0.06];

  // A gently curved route: two intermediate waypoints with perpendicular jitter.
  const route = [];
  const steps = 4;
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const lat = origin[0] + (destination[0] - origin[0]) * t;
    const lng = origin[1] + (destination[1] - origin[1]) * t;
    const bend = Math.sin(t * Math.PI) * (rnd(i + 2) * 0.01);
    route.push([lat + bend, lng - bend]);
  }

  const distance_km = Math.max(1.5, Math.round(haversineKm(origin, destination) * 10) / 10);
  const base_eta_minutes = Math.max(8, Math.round(distance_km * 4)); // ~15 km/h city speed
  const agent = AGENTS[h % AGENTS.length];

  return {
    order_id: order.id,
    status: order.status,
    agent,
    origin: { lat: origin[0], lng: origin[1], label: `Herbal Hub Store, ${order.address?.city || 'Bengaluru'}` },
    destination: {
      lat: destination[0],
      lng: destination[1],
      label: `${order.address?.address_line1 || 'Delivery address'}, ${order.address?.city || 'Bengaluru'}`,
    },
    route,
    distance_km,
    base_eta_minutes,
    recipient_phone: order.address?.phone || '+91 90000 00000',
    created_at: order.created_at,
  };
}

// ---- Medicine search ----
function searchMedicines(params = {}) {
  let list = db.getMedicines().slice();
  const q = (params.q || '').toString().trim().toLowerCase();
  if (q) {
    list = list.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.description.toLowerCase().includes(q) ||
        m.category.toLowerCase().includes(q) ||
        m.manufacturer.toLowerCase().includes(q)
    );
  }
  if (params.category) list = list.filter((m) => m.category === params.category);
  const eff = (m) => m.discount_price || m.price;
  if (params.min_price) list = list.filter((m) => eff(m) >= Number(params.min_price));
  if (params.max_price) list = list.filter((m) => eff(m) <= Number(params.max_price));
  if (params.available_only) list = list.filter((m) => m.stock > 0);

  switch (params.sort_by) {
    case 'price_low':
      list.sort((a, b) => eff(a) - eff(b));
      break;
    case 'price_high':
      list.sort((a, b) => eff(b) - eff(a));
      break;
    case 'rating':
      list.sort((a, b) => b.average_rating - a.average_rating);
      break;
    case 'newest':
      list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      break;
    default:
      break;
  }

  const page = parseInt(params.page || '1', 10) || 1;
  const pageSize = parseInt(params.page_size || PAGE_SIZE, 10) || PAGE_SIZE;
  const total = list.length;
  const total_pages = Math.max(1, Math.ceil(total / pageSize));
  const items = list.slice((page - 1) * pageSize, page * pageSize);
  return { items, total, total_pages, page };
}

// ---- Route matching ----
function match(pattern, path) {
  const pParts = pattern.split('/').filter(Boolean);
  const uParts = path.split('/').filter(Boolean);
  if (pParts.length !== uParts.length) return null;
  const params = {};
  for (let i = 0; i < pParts.length; i++) {
    if (pParts[i].startsWith(':')) params[pParts[i].slice(1)] = decodeURIComponent(uParts[i]);
    else if (pParts[i] !== uParts[i]) return null;
  }
  return params;
}

// Each route: [method, pattern, handler(ctx)] where ctx = {params, query, body, route}
const routes = [
  // ---------- AUTH ----------
  ['POST', '/api/auth/login', ({ body }) => {
    const user = db.getUsers().find((u) => u.email.toLowerCase() === (body.email || '').toLowerCase());
    if (!user || user.password !== body.password) throw new ApiError(401, 'Invalid email or password');
    if (!user.is_active) throw new ApiError(403, 'Your account has been deactivated');
    return { access_token: `mock.${user.id}`, token: `mock.${user.id}`, token_type: 'bearer', user: publicUser(user) };
  }],
  ['POST', '/api/auth/register', ({ body }) => {
    const users = db.getUsers();
    if (users.some((u) => u.email.toLowerCase() === (body.email || '').toLowerCase())) {
      throw new ApiError(400, 'An account with this email already exists');
    }
    const user = {
      id: uid(),
      name: body.name,
      email: body.email,
      phone: body.phone,
      password: body.password,
      role: 'customer',
      is_active: true,
      profile_image: null,
      address: {},
      created_at: new Date().toISOString(),
    };
    users.push(user);
    db.setUsers(users);
    return { access_token: `mock.${user.id}`, token: `mock.${user.id}`, token_type: 'bearer', user: publicUser(user) };
  }],
  ['GET', '/api/auth/me', () => {
    const u = publicUser(requireAuth());
    return { ...u, user: u };
  }],
  ['PUT', '/api/auth/me', ({ body }) => {
    const user = requireAuth();
    const users = db.getUsers();
    const idx = users.findIndex((u) => u.id === user.id);
    users[idx] = { ...users[idx], ...body, email: users[idx].email, role: users[idx].role, id: users[idx].id };
    db.setUsers(users);
    return { user: publicUser(users[idx]) };
  }],
  ['POST', '/api/auth/upload-profile-image', ({ body }) => {
    const user = requireAuth();
    const { url } = fileToUrl(body);
    const image = url || `https://i.pravatar.cc/150?u=${user.id}`;
    const users = db.getUsers();
    const idx = users.findIndex((u) => u.id === user.id);
    users[idx].profile_image = image;
    db.setUsers(users);
    return { image_url: image, user: publicUser(users[idx]) };
  }],

  // ---------- MEDICINES ----------
  ['GET', '/api/medicines/categories', () => CATEGORIES.map((c) => ({ value: c, label: c }))],
  ['GET', '/api/medicines/featured/list', () => {
    const featured = db.getMedicines().filter((m) => m.is_featured);
    const list = (featured.length ? featured : db.getMedicines().slice().sort((a, b) => b.average_rating - a.average_rating)).slice(0, 8);
    return list;
  }],
  ['GET', '/api/medicines/', ({ query }) => searchMedicines(query)],
  ['POST', '/api/medicines/', ({ body }) => {
    requireAdmin();
    const meds = db.getMedicines();
    const med = {
      id: uid(),
      images: [`https://picsum.photos/seed/${uid()}/600/600`],
      average_rating: 0,
      review_count: 0,
      is_featured: false,
      total_sold: 0,
      created_at: new Date().toISOString(),
      discount_price: null,
      dosage: '',
      benefits: [],
      ingredients: [],
      ...body,
    };
    meds.unshift(med);
    db.setMedicines(meds);
    return med;
  }],
  ['GET', '/api/medicines/:id', ({ params }) => {
    const med = db.getMedicines().find((m) => m.id === params.id);
    if (!med) throw new ApiError(404, 'Medicine not found');
    return med;
  }],
  ['PUT', '/api/medicines/:id', ({ params, body }) => {
    requireAdmin();
    const meds = db.getMedicines();
    const idx = meds.findIndex((m) => m.id === params.id);
    if (idx === -1) throw new ApiError(404, 'Medicine not found');
    meds[idx] = { ...meds[idx], ...body, id: meds[idx].id };
    db.setMedicines(meds);
    return meds[idx];
  }],
  ['DELETE', '/api/medicines/:id', ({ params }) => {
    requireAdmin();
    const meds = db.getMedicines().filter((m) => m.id !== params.id);
    db.setMedicines(meds);
    return { success: true };
  }],
  ['POST', '/api/medicines/:id/images', ({ params, body }) => {
    requireAdmin();
    const meds = db.getMedicines();
    const idx = meds.findIndex((m) => m.id === params.id);
    if (idx === -1) throw new ApiError(404, 'Medicine not found');
    const { url } = fileToUrl(body, 'files');
    if (url) meds[idx].images = [url, ...(meds[idx].images || [])];
    db.setMedicines(meds);
    return meds[idx];
  }],

  // ---------- CART ----------
  ['GET', '/api/cart/', () => {
    const user = requireAuth();
    return cartTotals(getUserCart(user.id));
  }],
  ['POST', '/api/cart/add', ({ body }) => {
    const user = requireAuth();
    const items = getUserCart(user.id);
    const existing = items.find((i) => i.medicine_id === body.medicine_id);
    if (existing) existing.quantity += body.quantity || 1;
    else items.push({ ...body, quantity: body.quantity || 1 });
    setUserCart(user.id, items);
    return { ...cartTotals(items), totals: cartTotals(items) };
  }],
  ['PUT', '/api/cart/update/:medicineId', ({ params, body }) => {
    const user = requireAuth();
    let items = getUserCart(user.id);
    const it = items.find((i) => i.medicine_id === params.medicineId);
    if (it) it.quantity = Math.max(1, body.quantity);
    items = items.filter((i) => i.quantity > 0);
    setUserCart(user.id, items);
    return cartTotals(items);
  }],
  ['DELETE', '/api/cart/remove/:medicineId', ({ params }) => {
    const user = requireAuth();
    const items = getUserCart(user.id).filter((i) => i.medicine_id !== params.medicineId);
    setUserCart(user.id, items);
    return cartTotals(items);
  }],
  ['DELETE', '/api/cart/clear', () => {
    const user = requireAuth();
    setUserCart(user.id, []);
    return cartTotals([]);
  }],

  // ---------- CHECKOUT / ORDERS ----------
  ['POST', '/api/checkout/create-order', ({ body }) => {
    const user = requireAuth();
    const items = (body.items || []).map((i) => ({
      medicine_id: i.medicine_id,
      name: i.name,
      price: i.price,
      quantity: i.quantity,
      image: i.image,
    }));
    if (items.length === 0) throw new ApiError(400, 'Cart is empty');
    const total_amount = items.reduce((s, i) => s + i.price * i.quantity, 0);
    const delivery_charge = total_amount >= 500 ? 0 : 49;
    const order = {
      id: uid(),
      user_id: user.id,
      user_name: user.name,
      items,
      total_amount,
      delivery_charge,
      discount: 0,
      final_amount: total_amount + delivery_charge,
      address: body.address,
      payment_method: body.payment_method,
      payment_status: body.payment_method === 'cod' ? 'pending' : 'completed',
      status: 'placed',
      created_at: new Date().toISOString(),
    };
    const orders = db.getOrders();
    orders.unshift(order);
    db.setOrders(orders);
    setUserCart(user.id, []);
    addNotification(user.id, 'Order placed successfully', `Order #${order.id.slice(0, 8).toUpperCase()} has been placed.`, `/orders/${order.id}`);
    return { order_id: order.id, order };
  }],
  ['POST', '/api/checkout/verify-payment/:orderId', ({ params }) => {
    const user = requireAuth();
    const orders = db.getOrders();
    const o = orders.find((x) => x.id === params.orderId && x.user_id === user.id);
    if (o) o.payment_status = 'completed';
    db.setOrders(orders);
    return { success: true };
  }],
  ['GET', '/api/orders/', ({ query }) => {
    const user = requireAuth();
    let items = db.getOrders().filter((o) => o.user_id === user.id);
    if (query.status) items = items.filter((o) => o.status === query.status);
    return { items, total: items.length };
  }],
  ['GET', '/api/orders/admin/all', ({ query }) => {
    requireAdmin();
    let items = db.getOrders().slice();
    if (query.status) items = items.filter((o) => o.status === query.status);
    return { items, total: items.length };
  }],
  ['PUT', '/api/orders/admin/:id/status', ({ params, body }) => {
    requireAdmin();
    const orders = db.getOrders();
    const o = orders.find((x) => x.id === params.id);
    if (!o) throw new ApiError(404, 'Order not found');
    o.status = body.status;
    db.setOrders(orders);
    addNotification(o.user_id, 'Order status updated', `Your order #${o.id.slice(0, 8).toUpperCase()} is now ${body.status.replace(/_/g, ' ')}.`, `/orders/${o.id}`);
    return o;
  }],
  ['GET', '/api/orders/:id', ({ params }) => {
    const user = requireAuth();
    const o = db.getOrders().find((x) => x.id === params.id);
    if (!o) throw new ApiError(404, 'Order not found');
    if (o.user_id !== user.id && user.role !== 'admin') throw new ApiError(403, 'Not allowed');
    return o;
  }],
  ['GET', '/api/orders/:id/invoice', ({ params }) => {
    requireAuth();
    const o = db.getOrders().find((x) => x.id === params.id);
    if (!o) throw new ApiError(404, 'Order not found');
    return { invoice: o };
  }],
  ['PUT', '/api/orders/:id/cancel', ({ params }) => {
    const user = requireAuth();
    const orders = db.getOrders();
    const o = orders.find((x) => x.id === params.id && x.user_id === user.id);
    if (!o) throw new ApiError(404, 'Order not found');
    o.status = 'cancelled';
    db.setOrders(orders);
    return o;
  }],

  // ---------- DELIVERY ----------
  ['GET', '/api/delivery/track/:orderId', ({ params }) => {
    const o = db.getOrders().find((x) => x.id === params.orderId);
    if (!o) return {};
    return buildDelivery(o);
  }],
  ['GET', '/api/delivery/my-deliveries', () => ({ items: [] })],
  ['PUT', '/api/delivery/:id/update-status', () => ({ success: true })],

  // ---------- NOTIFICATIONS ----------
  ['GET', '/api/notifications/', ({ query }) => {
    const user = currentUser();
    if (!user) return { items: [], unread_count: 0, total: 0 };
    let items = db.getNotifications().filter((n) => n.user_id === user.id);
    const unread_count = items.filter((n) => !n.read).length;
    if (query.unread_only === true || query.unread_only === 'true') items = items.filter((n) => !n.read);
    return { items, unread_count, total: items.length };
  }],
  ['PUT', '/api/notifications/:id/read', ({ params }) => {
    const notifs = db.getNotifications();
    const n = notifs.find((x) => x.id === params.id);
    if (n) n.read = true;
    db.setNotifications(notifs);
    return { success: true };
  }],
  ['PUT', '/api/notifications/read-all', () => {
    const user = requireAuth();
    const notifs = db.getNotifications();
    notifs.forEach((n) => {
      if (n.user_id === user.id) n.read = true;
    });
    db.setNotifications(notifs);
    return { success: true };
  }],

  // ---------- PRESCRIPTIONS ----------
  ['POST', '/api/prescriptions/upload', ({ body }) => {
    const user = requireAuth();
    const { url, name } = fileToUrl(body);
    let notes = '';
    try { notes = body.get('notes') || ''; } catch { /* ignore */ }
    const rx = {
      id: uid(),
      user_id: user.id,
      user_name: user.name,
      file_name: name,
      file_url: url,
      notes,
      status: 'uploaded',
      rejection_reason: null,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 90 * 86400000).toISOString(),
    };
    const list = db.getPrescriptions();
    list.unshift(rx);
    db.setPrescriptions(list);
    return rx;
  }],
  ['GET', '/api/prescriptions/', () => {
    const user = requireAuth();
    const items = db.getPrescriptions().filter((p) => p.user_id === user.id);
    return { items, total: items.length };
  }],
  ['GET', '/api/prescriptions/admin/all', ({ query }) => {
    requireAdmin();
    let items = db.getPrescriptions().slice();
    if (query.status) items = items.filter((p) => p.status === query.status);
    return { items, total: items.length };
  }],
  ['PUT', '/api/prescriptions/admin/:id/verify', ({ params, body }) => {
    requireAdmin();
    const list = db.getPrescriptions();
    const p = list.find((x) => x.id === params.id);
    if (!p) throw new ApiError(404, 'Prescription not found');
    p.status = body.status || 'approved';
    p.rejection_reason = body.rejection_reason || null;
    db.setPrescriptions(list);
    return p;
  }],
  ['GET', '/api/prescriptions/:id', ({ params }) => {
    requireAuth();
    const p = db.getPrescriptions().find((x) => x.id === params.id);
    if (!p) throw new ApiError(404, 'Prescription not found');
    return p;
  }],

  // ---------- REVIEWS ----------
  ['POST', '/api/reviews/', ({ body }) => {
    const user = requireAuth();
    const review = {
      id: uid(),
      medicine_id: body.medicine_id,
      user_id: user.id,
      user_name: user.name,
      rating: body.rating,
      title: body.title || '',
      comment: body.comment || '',
      created_at: new Date().toISOString(),
    };
    const reviews = db.getReviews();
    reviews.unshift(review);
    db.setReviews(reviews);
    // recompute medicine rating
    const meds = db.getMedicines();
    const idx = meds.findIndex((m) => m.id === body.medicine_id);
    if (idx !== -1) {
      const mrevs = reviews.filter((r) => r.medicine_id === body.medicine_id);
      meds[idx].review_count = mrevs.length;
      meds[idx].average_rating = Math.round((mrevs.reduce((s, r) => s + r.rating, 0) / mrevs.length) * 10) / 10;
      db.setMedicines(meds);
    }
    return review;
  }],
  ['GET', '/api/reviews/medicine/:medicineId', ({ params }) => {
    const items = db.getReviews().filter((r) => r.medicine_id === params.medicineId);
    return { items, total: items.length };
  }],
  ['GET', '/api/reviews/my-reviews', () => {
    const user = requireAuth();
    const items = db.getReviews().filter((r) => r.user_id === user.id);
    return { items, total: items.length };
  }],

  // ---------- ADMIN ----------
  ['GET', '/api/admin/dashboard', () => {
    requireAdmin();
    const orders = db.getOrders();
    const users = db.getUsers();
    const meds = db.getMedicines();
    const prescriptions = db.getPrescriptions();
    const today = new Date().toDateString();
    const orders_by_status = {};
    orders.forEach((o) => {
      orders_by_status[o.status] = (orders_by_status[o.status] || 0) + 1;
    });
    return {
      total_users: users.length,
      total_medicines: meds.length,
      total_revenue: orders
        .filter((o) => o.status !== 'cancelled')
        .reduce((s, o) => s + o.final_amount, 0),
      todays_orders: orders.filter((o) => new Date(o.created_at).toDateString() === today).length,
      total_orders: orders.length,
      pending_prescriptions: prescriptions.filter((p) => p.status === 'uploaded' || p.status === 'verifying').length,
      orders_by_status,
      recent_orders: orders.slice(0, 6),
    };
  }],
  ['GET', '/api/admin/users', ({ query }) => {
    requireAdmin();
    let items = db.getUsers().map(publicUser);
    if (query.search) {
      const s = query.search.toLowerCase();
      items = items.filter(
        (u) =>
          u.name.toLowerCase().includes(s) ||
          u.email.toLowerCase().includes(s) ||
          (u.phone || '').toLowerCase().includes(s)
      );
    }
    if (query.role) items = items.filter((u) => u.role === query.role);
    return { items, total: items.length };
  }],
  ['PUT', '/api/admin/users/:id/toggle-active', ({ params }) => {
    requireAdmin();
    const users = db.getUsers();
    const u = users.find((x) => x.id === params.id);
    if (!u) throw new ApiError(404, 'User not found');
    u.is_active = !u.is_active;
    db.setUsers(users);
    return publicUser(u);
  }],

  // ---------- ANALYTICS ----------
  ['GET', '/api/analytics/sales', ({ query }) => {
    requireAdmin();
    const period = query.period || '30d';
    const days = period === '7d' ? 7 : period === '90d' ? 90 : period === '1y' ? 365 : 30;
    const buckets = period === '1y' ? 12 : Math.min(days, 14);
    const orders = db.getOrders().filter((o) => o.status !== 'cancelled');
    const daily_sales = [];
    for (let i = buckets - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * (period === '1y' ? 30 : 1) * 86400000);
      const key = d.toISOString().slice(0, 10);
      const dayOrders = orders.filter(
        (o) => new Date(o.created_at).toISOString().slice(0, 10) === key
      );
      const revenue = dayOrders.reduce((s, o) => s + o.final_amount, 0)
        || Math.round(2000 + Math.random() * 8000);
      daily_sales.push({ _id: key, revenue, orders: dayOrders.length || Math.round(1 + Math.random() * 6) });
    }
    const soldMap = {};
    orders.forEach((o) =>
      o.items.forEach((it) => {
        soldMap[it.name] = soldMap[it.name] || { name: it.name, total_sold: 0, revenue: 0 };
        soldMap[it.name].total_sold += it.quantity;
        soldMap[it.name].revenue += it.price * it.quantity;
      })
    );
    const top_medicines = Object.values(soldMap)
      .sort((a, b) => b.total_sold - a.total_sold)
      .slice(0, 5);
    const catMap = {};
    db.getMedicines().forEach((m) => {
      catMap[m.category] = (catMap[m.category] || 0) + 1;
    });
    const category_distribution = Object.entries(catMap).map(([k, v]) => ({ _id: k, count: v }));
    return { daily_sales, top_medicines, category_distribution };
  }],
  ['GET', '/api/analytics/users', () => {
    requireAdmin();
    const users = db.getUsers();
    const user_growth = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = d.toISOString().slice(0, 7);
      const count = users.filter((u) => u.created_at.slice(0, 7) <= key).length;
      user_growth.push({ _id: key, count });
    }
    const role_distribution = {};
    users.forEach((u) => {
      role_distribution[u.role] = (role_distribution[u.role] || 0) + 1;
    });
    return { user_growth, role_distribution };
  }],
  ['GET', '/api/analytics/export/orders', () => {
    requireAdmin();
    const orders = db.getOrders();
    const header = 'order_id,customer,amount,status,payment,date\n';
    const rows = orders
      .map(
        (o) =>
          `${o.id},${o.user_name},${o.final_amount},${o.status},${o.payment_method},${o.created_at}`
      )
      .join('\n');
    return { data: header + rows };
  }],
];

function findRoute(method, path) {
  for (const [m, pattern, handler] of routes) {
    if (m !== method) continue;
    const params = match(pattern, path);
    if (params) return { handler, params };
  }
  return null;
}

// Simulate small network latency for realism.
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

export async function handleRequest(method, url, { params: query = {}, data: body = {} } = {}) {
  await delay(120 + Math.random() * 200);
  const path = url.split('?')[0];
  const route = findRoute(method.toUpperCase(), path);
  if (!route) {
    throw new ApiError(404, `No mock route for ${method} ${path}`);
  }
  try {
    const result = route.handler({ params: route.params, query, body, route });
    return { data: result, status: 200 };
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(500, err.message || 'Server error');
  }
}
