// Mock backend: routes API requests to the localStorage-backed db.
// Mimics the shape of the original FastAPI backend responses.
import { db, CATEGORIES, uid } from './db';
import { parcelWeight, sriLankaPostFee } from '../utils/shipping';

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

function requireSeller() {
  const user = requireAuth();
  if (user.role !== 'seller') throw new ApiError(403, 'Seller access required');
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
    return {
      access_token: `mock.${user.id}`,
      token: `mock.${user.id}`,
      refresh_token: `mockrefresh.${user.id}`,
      token_type: 'bearer',
      user: publicUser(user),
    };
  }],
  ['POST', '/api/auth/register', ({ body }) => {
    const users = db.getUsers();
    if (users.some((u) => u.email.toLowerCase() === (body.email || '').toLowerCase())) {
      throw new ApiError(400, 'An account with this email already exists');
    }
    const verification_token = uid();
    const user = {
      id: uid(),
      name: body.name,
      email: body.email,
      phone: body.phone,
      password: body.password,
      role: 'customer',
      is_active: true,
      email_verified: false,
      verification_token,
      profile_image: null,
      address: {},
      created_at: new Date().toISOString(),
    };
    users.push(user);
    db.setUsers(users);
    return {
      access_token: `mock.${user.id}`,
      token: `mock.${user.id}`,
      refresh_token: `mockrefresh.${user.id}`,
      token_type: 'bearer',
      // Demo helper: real backend emails this token; here we return it so the
      // email-verification flow can be exercised without an email server.
      verification_token,
      user: publicUser(user),
    };
  }],
  ['POST', '/api/auth/refresh', ({ body }) => {
    const rt = body.refresh_token || '';
    const userId = rt.startsWith('mockrefresh.') ? rt.slice(12) : null;
    const user = userId && db.getUsers().find((u) => u.id === userId);
    if (!user || !user.is_active) throw new ApiError(401, 'Invalid refresh token');
    return {
      access_token: `mock.${user.id}`,
      refresh_token: `mockrefresh.${user.id}`,
      token_type: 'bearer',
    };
  }],
  ['POST', '/api/auth/forgot-password', ({ body }) => {
    const user = db.getUsers().find((u) => u.email.toLowerCase() === (body.email || '').toLowerCase());
    const generic = { message: 'If an account with that email exists, a reset link has been sent.' };
    if (!user) return generic;
    const reset_token = uid();
    const users = db.getUsers();
    const idx = users.findIndex((u) => u.id === user.id);
    users[idx].reset_token = reset_token;
    db.setUsers(users);
    // Demo helper: return the token so the reset flow works without email.
    return { ...generic, reset_token };
  }],
  ['POST', '/api/auth/reset-password', ({ body }) => {
    const users = db.getUsers();
    const idx = users.findIndex((u) => u.reset_token && u.reset_token === body.token);
    if (idx === -1) throw new ApiError(400, 'Invalid or expired reset token');
    if (!body.new_password || body.new_password.length < 6) {
      throw new ApiError(400, 'Password must be at least 6 characters');
    }
    users[idx].password = body.new_password;
    delete users[idx].reset_token;
    db.setUsers(users);
    return { message: 'Password reset successfully. You can now log in.' };
  }],
  ['POST', '/api/auth/verify-email', ({ body }) => {
    const users = db.getUsers();
    const idx = users.findIndex((u) => u.verification_token && u.verification_token === body.token);
    if (idx === -1) {
      // Idempotent: an already-verified user (token cleared) shouldn't error hard.
      throw new ApiError(400, 'Invalid or expired verification token');
    }
    users[idx].email_verified = true;
    delete users[idx].verification_token;
    db.setUsers(users);
    return { message: 'Email verified successfully' };
  }],
  ['POST', '/api/auth/resend-verification', () => {
    const user = requireAuth();
    if (user.email_verified) return { message: 'Email already verified' };
    const verification_token = uid();
    const users = db.getUsers();
    const idx = users.findIndex((u) => u.id === user.id);
    users[idx].verification_token = verification_token;
    db.setUsers(users);
    return { message: 'Verification email sent', verification_token };
  }],
  ['PUT', '/api/auth/change-password', ({ body }) => {
    const user = requireAuth();
    if (user.password !== body.current_password) throw new ApiError(400, 'Current password is incorrect');
    if (!body.new_password || body.new_password.length < 6) {
      throw new ApiError(400, 'Password must be at least 6 characters');
    }
    if (body.new_password === body.current_password) {
      throw new ApiError(400, 'New password must be different from the current password');
    }
    const users = db.getUsers();
    const idx = users.findIndex((u) => u.id === user.id);
    users[idx].password = body.new_password;
    db.setUsers(users);
    return { message: 'Password changed successfully' };
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
    const user = requireAuth();
    if (!['admin', 'seller'].includes(user.role)) throw new ApiError(403, 'Product management access required');
    const meds = db.getMedicines();
    if (!Number.isInteger(Number(body.weight_grams)) || Number(body.weight_grams) <= 0) {
      throw new ApiError(422, 'Weight must be greater than zero');
    }
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
      seller_id: user.role === 'seller' ? user.id : (body.seller_id || null),
      seller_name: user.role === 'seller' ? (user.business_name || user.name) : (body.seller_name || 'Herbal Hub'),
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
    const user = requireAuth();
    const meds = db.getMedicines();
    const idx = meds.findIndex((m) => m.id === params.id);
    if (idx === -1) throw new ApiError(404, 'Medicine not found');
    if (body.weight_grams !== undefined && (!Number.isInteger(Number(body.weight_grams)) || Number(body.weight_grams) <= 0)) {
      throw new ApiError(422, 'Weight must be greater than zero');
    }
    if (user.role !== 'admin' && meds[idx].seller_id !== user.id) throw new ApiError(403, 'You can only edit your products');
    meds[idx] = { ...meds[idx], ...body, id: meds[idx].id };
    db.setMedicines(meds);
    return meds[idx];
  }],
  ['DELETE', '/api/medicines/:id', ({ params }) => {
    const user = requireAuth();
    const existing = db.getMedicines().find((m) => m.id === params.id);
    if (!existing) throw new ApiError(404, 'Medicine not found');
    if (user.role !== 'admin' && existing.seller_id !== user.id) throw new ApiError(403, 'You can only delete your products');
    const meds = db.getMedicines().filter((m) => m.id !== params.id);
    db.setMedicines(meds);
    return { success: true };
  }],
  ['POST', '/api/medicines/:id/images', ({ params, body }) => {
    const user = requireAuth();
    const meds = db.getMedicines();
    const idx = meds.findIndex((m) => m.id === params.id);
    if (idx === -1) throw new ApiError(404, 'Medicine not found');
    if (user.role !== 'admin' && meds[idx].seller_id !== user.id) throw new ApiError(403, 'You can only edit your products');
    const { url } = fileToUrl(body, 'files');
    if (url) meds[idx].images = [url, ...(meds[idx].images || [])];
    db.setMedicines(meds);
    return meds[idx];
  }],

  // ---------- SELLER ----------
  ['GET', '/api/seller/dashboard', () => {
    const seller = requireSeller();
    const products = db.getMedicines().filter((m) => m.seller_id === seller.id);
    const productIds = new Set(products.map((m) => m.id));
    const orders = db.getOrders().filter((o) => o.items.some((item) => productIds.has(item.medicine_id)));
    const unitsSold = orders.filter((o) => o.status !== 'cancelled').flatMap((o) => o.items)
      .filter((item) => productIds.has(item.medicine_id)).reduce((sum, item) => sum + item.quantity, 0);
    const revenue = orders.filter((o) => o.status !== 'cancelled').flatMap((o) => o.items)
      .filter((item) => productIds.has(item.medicine_id)).reduce((sum, item) => sum + item.price * item.quantity, 0);
    return {
      total_products: products.length,
      low_stock_products: products.filter((m) => m.stock <= 10).length,
      total_orders: orders.length,
      units_sold: unitsSold,
      total_revenue: revenue,
      recent_orders: orders.slice(0, 6),
    };
  }],
  ['GET', '/api/seller/products', ({ query }) => {
    const seller = requireSeller();
    let items = db.getMedicines().filter((m) => m.seller_id === seller.id);
    if (query.q) items = items.filter((m) => m.name.toLowerCase().includes(query.q.toLowerCase()));
    return { items, total: items.length };
  }],
  ['GET', '/api/seller/orders', () => {
    const seller = requireSeller();
    const productIds = new Set(db.getMedicines().filter((m) => m.seller_id === seller.id).map((m) => m.id));
    const items = db.getOrders().filter((o) => o.items.some((item) => productIds.has(item.medicine_id)))
      .map((o) => ({ ...o, items: o.items.filter((item) => productIds.has(item.medicine_id)) }));
    return { items, total: items.length };
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
    const medicine = db.getMedicines().find((item) => item.id === body.medicine_id);
    if (existing) existing.quantity += body.quantity || 1;
    else items.push({ ...body, weight_grams: medicine?.weight_grams || 100, quantity: body.quantity || 1 });
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
    const medicines = db.getMedicines();
    const items = (body.items || []).map((i) => ({
      medicine_id: i.medicine_id,
      name: i.name,
      price: i.price,
      quantity: i.quantity,
      image: i.image,
      weight_grams: medicines.find((medicine) => medicine.id === i.medicine_id)?.weight_grams || 100,
    }));
    if (items.length === 0) throw new ApiError(400, 'Cart is empty');
    const total_amount = items.reduce((s, i) => s + i.price * i.quantity, 0);
    const parcel_weight = parcelWeight(items);
    const shipping_fee = sriLankaPostFee(parcel_weight);
    if (shipping_fee == null) throw new ApiError(422, 'Sri Lanka Post shipping supports parcels up to 2 kg');
    const order = {
      id: uid(),
      user_id: user.id,
      user_name: user.name,
      items,
      total_amount,
      delivery_charge: shipping_fee,
      shipping_fee,
      parcel_weight,
      discount: 0,
      final_amount: total_amount + shipping_fee,
      address: body.address,
      payment_method: body.payment_method,
      payment_status: body.payment_method === 'cod' ? 'pending' : 'completed',
      status: 'placed',
      courier_service: null,
      tracking_number: null,
      shipping_date: null,
      delivery_status: 'pending',
      last_status_updated: new Date().toISOString(),
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
  ['GET', '/api/orders/:id/postal-tracking', ({ params }) => {
    const user = requireAuth();
    const order = db.getOrders().find((item) => item.id === params.id);
    if (!order) throw new ApiError(404, 'Order not found');
    if (user.role === 'customer' && order.user_id !== user.id) throw new ApiError(403, 'Tracking access denied');
    return order;
  }],
  ['PUT', '/api/orders/:id/delivery-status', ({ params, body }) => {
    const user = requireAuth();
    if (!['seller', 'admin'].includes(user.role)) throw new ApiError(403, 'Seller or admin access required');
    const orders = db.getOrders();
    const order = orders.find((item) => item.id === params.id);
    if (!order) throw new ApiError(404, 'Order not found');
    const transitions = { pending: 'accepted', accepted: 'packed', shipped: 'in_transit', in_transit: 'delivered' };
    const current = order.delivery_status || 'pending';
    if (transitions[current] !== body.status) throw new ApiError(409, `Cannot change delivery status from ${current} to ${body.status}`);
    order.delivery_status = body.status;
    order.status = { accepted: 'confirmed', packed: 'packed', in_transit: 'out_for_delivery', delivered: 'delivered' }[body.status];
    order.last_status_updated = new Date().toISOString();
    db.setOrders(orders);
    return order;
  }],
  ['PUT', '/api/orders/:id/shipping', ({ params, body }) => {
    const user = requireAuth();
    if (!['seller', 'admin'].includes(user.role)) throw new ApiError(403, 'Seller or admin access required');
    const orders = db.getOrders();
    const order = orders.find((item) => item.id === params.id);
    if (!order) throw new ApiError(404, 'Order not found');
    if (!['packed', 'shipped', 'in_transit', 'delivered'].includes(order.delivery_status)) throw new ApiError(409, 'Order must be packed before shipping');
    if (orders.some((item) => item.id !== order.id && item.tracking_number === body.tracking_number.toUpperCase())) {
      throw new ApiError(409, 'This tracking number is already assigned to another order');
    }
    Object.assign(order, body, {
      tracking_number: body.tracking_number.toUpperCase(),
      delivery_status: order.delivery_status === 'packed' ? 'shipped' : order.delivery_status,
      status: order.delivery_status === 'packed' ? 'shipped' : order.status,
      last_status_updated: new Date().toISOString(),
    });
    db.setOrders(orders);
    return order;
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
  ['DELETE', '/api/notifications/:id', ({ params }) => {
    const user = requireAuth();
    const notifications = db.getNotifications();
    const owned = notifications.some((item) => item.id === params.id && item.user_id === user.id);
    if (!owned) throw new ApiError(404, 'Notification not found');
    db.setNotifications(notifications.filter((item) => item.id !== params.id));
    return { message: 'Notification deleted' };
  }],
  ['DELETE', '/api/notifications/', () => {
    const user = requireAuth();
    const notifications = db.getNotifications();
    const deletedCount = notifications.filter((item) => item.user_id === user.id).length;
    db.setNotifications(notifications.filter((item) => item.user_id !== user.id));
    return { message: 'Notifications cleared', deleted_count: deletedCount };
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
    if (user.role !== 'customer') throw new ApiError(403, 'Customer access required');
    const order = db.getOrders().find((item) => item.id === body.order_id && item.user_id === user.id);
    if (!order) throw new ApiError(404, 'Order not found');
    if (order.status !== 'delivered') throw new ApiError(400, 'Can only review delivered orders');
    if (!order.items.some((item) => item.medicine_id === body.medicine_id)) {
      throw new ApiError(400, 'This medicine is not part of the order');
    }
    const reviews = db.getReviews();
    if (reviews.some((item) => item.user_id === user.id
      && item.order_id === body.order_id && item.medicine_id === body.medicine_id)) {
      throw new ApiError(400, 'You already reviewed this item for this order');
    }
    const review = {
      id: uid(),
      medicine_id: body.medicine_id,
      order_id: body.order_id,
      user_id: user.id,
      user_name: user.name,
      rating: body.rating,
      title: body.title || '',
      comment: body.comment || '',
      created_at: new Date().toISOString(),
    };
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
  ['GET', '/api/reviews/admin/all', () => {
    requireAdmin();
    const medicines = db.getMedicines();
    const items = db.getReviews().map((review) => ({
      ...review,
      medicine_name: medicines.find((medicine) => medicine.id === review.medicine_id)?.name || 'Unknown product',
    }));
    return { items, total: items.length };
  }],
  ['GET', '/api/reviews/seller/all', () => {
    const seller = requireSeller();
    const medicines = db.getMedicines();
    const productIds = new Set(medicines.filter((medicine) => medicine.seller_id === seller.id).map((medicine) => medicine.id));
    const items = db.getReviews().filter((review) => productIds.has(review.medicine_id)).map((review) => ({
      ...review,
      medicine_name: medicines.find((medicine) => medicine.id === review.medicine_id)?.name || 'Unknown product',
    }));
    return { items, total: items.length };
  }],

  // ---------- NEWSLETTER ----------
  ['POST', '/api/newsletter/subscribe', ({ body }) => {
    const email = String(body.email || '').trim().toLowerCase();
    if (!email || !email.includes('@')) throw new ApiError(422, 'Enter a valid email address');
    const subscribers = db.getSubscribers();
    if (subscribers.some((subscriber) => subscriber.email === email)) {
      return { message: 'This email is already subscribed', subscribed: false };
    }
    subscribers.unshift({
      id: uid(),
      email,
      status: 'active',
      source: 'website_footer',
      subscribed_at: new Date().toISOString(),
    });
    db.setSubscribers(subscribers);
    return { message: 'Thank you for subscribing!', subscribed: true };
  }],
  ['GET', '/api/newsletter/admin/subscribers', ({ query }) => {
    requireAdmin();
    let items = db.getSubscribers().filter((subscriber) => subscriber.status === 'active');
    if (query.q) items = items.filter((subscriber) => subscriber.email.includes(query.q.toLowerCase()));
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
