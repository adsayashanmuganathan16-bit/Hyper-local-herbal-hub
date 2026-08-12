// Lightweight localStorage-backed "database" for the Herbal Hub demo.
// This lets the entire frontend run without a real backend server.

const KEYS = {
  medicines: 'herbal_hub_medicines',
  users: 'herbal_hub_users',
  carts: 'herbal_hub_carts',
  orders: 'herbal_hub_orders',
  reviews: 'herbal_hub_reviews',
  prescriptions: 'herbal_hub_prescriptions',
  notifications: 'herbal_hub_notifications',
  subscribers: 'herbal_hub_subscribers',
  seedVersion: 'herbal_hub_seed_version',
};

const SEED_VERSION = '8';

export const CATEGORIES = [
  'Ayurvedic',
  'Unani',
  'Siddha',
  'Homeopathic',
  'Herbal Supplements',
  'Herbal Skincare',
  'Herbal Haircare',
  'Herbal Food & Beverages',
  'Essential Oils',
  'Herbal First Aid',
];

export const uid = () =>
  (Date.now().toString(36) + Math.random().toString(36).slice(2, 10)).padEnd(16, '0');

const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString();

const img = (seed) => `https://picsum.photos/seed/${seed}/600/600`;

function seedMedicines() {
  const raw = [
    {
      name: 'Ashwagandha Root Extract',
      category: 'Ayurvedic',
      description:
        'Pure Ashwagandha (Withania somnifera) root extract to help reduce stress, boost energy and support healthy sleep. Traditionally used in Ayurveda as a rejuvenating tonic.',
      price: 599, discount_price: 449, stock: 120, manufacturer: 'Himalaya Herbals',
      requires_prescription: false, dosage: '1 capsule twice daily after meals',
      benefits: ['Reduces stress & anxiety', 'Boosts stamina', 'Improves sleep quality'],
      ingredients: ['Ashwagandha Root', 'Black Pepper Extract'],
      average_rating: 4.7, review_count: 214, is_featured: true, days: 6,
    },
    {
      name: 'Organic Turmeric Curcumin',
      category: 'Herbal Supplements',
      description:
        'High-potency turmeric with 95% curcuminoids and black pepper for maximum absorption. A powerful natural anti-inflammatory and antioxidant.',
      price: 499, discount_price: 399, stock: 80, manufacturer: 'Organic India',
      requires_prescription: false, dosage: '1 tablet daily with water',
      benefits: ['Joint support', 'Anti-inflammatory', 'Immunity booster'],
      ingredients: ['Turmeric Extract', 'Piperine', 'Ginger'],
      average_rating: 4.8, review_count: 331, is_featured: true, days: 9,
    },
    {
      name: 'Tulsi Green Tea',
      category: 'Herbal Food & Beverages',
      description:
        'Refreshing blend of holy basil (Tulsi) and green tea leaves. A soothing daily brew that supports immunity and calms the mind.',
      price: 299, discount_price: null, stock: 200, manufacturer: 'Organic India',
      requires_prescription: false, dosage: 'Steep 1 bag in hot water for 3-5 minutes',
      benefits: ['Rich in antioxidants', 'Calms the mind', 'Aids digestion'],
      ingredients: ['Tulsi Leaves', 'Green Tea', 'Lemongrass'],
      average_rating: 4.5, review_count: 142, is_featured: true, days: 15,
    },
    {
      name: 'Neem & Aloe Face Wash',
      category: 'Herbal Skincare',
      description:
        'Gentle purifying face wash with neem and aloe vera to fight acne, control oil and leave skin clean and fresh without dryness.',
      price: 249, discount_price: 199, stock: 150, manufacturer: 'Biotique',
      requires_prescription: false, dosage: 'Use twice daily on damp skin',
      benefits: ['Fights acne', 'Controls excess oil', 'Soothes skin'],
      ingredients: ['Neem Extract', 'Aloe Vera', 'Tea Tree Oil'],
      average_rating: 4.3, review_count: 98, is_featured: false, days: 20,
    },
    {
      name: 'Bhringraj Hair Oil',
      category: 'Herbal Haircare',
      description:
        'Traditional Bhringraj and Amla infused hair oil that nourishes the scalp, reduces hair fall and promotes thick, healthy hair growth.',
      price: 349, discount_price: 279, stock: 90, manufacturer: 'Kama Ayurveda',
      requires_prescription: false, dosage: 'Massage into scalp 2-3 times a week',
      benefits: ['Reduces hair fall', 'Promotes growth', 'Prevents premature greying'],
      ingredients: ['Bhringraj', 'Amla', 'Coconut Oil', 'Brahmi'],
      average_rating: 4.6, review_count: 176, is_featured: true, days: 4,
    },
    {
      name: 'Lavender Essential Oil',
      category: 'Essential Oils',
      description:
        '100% pure steam-distilled lavender essential oil. Perfect for aromatherapy, relaxation and restful sleep. Great for diffusers.',
      price: 449, discount_price: 349, stock: 60, manufacturer: 'Soulflower',
      requires_prescription: false, dosage: 'Add 3-4 drops to a diffuser',
      benefits: ['Promotes relaxation', 'Improves sleep', 'Soothing aroma'],
      ingredients: ['Pure Lavender Oil'],
      average_rating: 4.7, review_count: 121, is_featured: false, days: 11,
    },
    {
      name: 'Triphala Digestive Tablets',
      category: 'Ayurvedic',
      description:
        'Classic Ayurvedic blend of three fruits (Amla, Bibhitaki, Haritaki) that gently supports digestion, detox and regularity.',
      price: 279, discount_price: null, stock: 130, manufacturer: 'Dabur',
      requires_prescription: false, dosage: '2 tablets at bedtime with warm water',
      benefits: ['Supports digestion', 'Natural detox', 'Improves gut health'],
      ingredients: ['Amla', 'Bibhitaki', 'Haritaki'],
      average_rating: 4.4, review_count: 87, is_featured: false, days: 25,
    },
    {
      name: 'Herbal Immunity Booster Syrup',
      category: 'Herbal First Aid',
      description:
        'A doctor-formulated herbal syrup with Giloy, Tulsi and Ginger to strengthen the immune system during seasonal changes.',
      price: 399, discount_price: 329, stock: 45, manufacturer: 'Zandu',
      requires_prescription: true, dosage: '10ml twice daily (consult physician)',
      benefits: ['Strengthens immunity', 'Fights seasonal infections', 'Natural formula'],
      ingredients: ['Giloy', 'Tulsi', 'Ginger', 'Honey'],
      average_rating: 4.5, review_count: 64, is_featured: false, days: 3,
    },
    {
      name: 'Brahmi Memory Capsules',
      category: 'Ayurvedic',
      description:
        'Brahmi (Bacopa monnieri) capsules to support memory, focus and mental clarity. A trusted Ayurvedic nootropic herb.',
      price: 549, discount_price: 469, stock: 70, manufacturer: 'Patanjali',
      requires_prescription: false, dosage: '1 capsule twice daily',
      benefits: ['Improves memory', 'Enhances focus', 'Reduces mental fatigue'],
      ingredients: ['Brahmi Extract', 'Gotu Kola'],
      average_rating: 4.2, review_count: 53, is_featured: false, days: 30,
    },
    {
      name: 'Cold-Pressed Coconut Oil',
      category: 'Herbal Food & Beverages',
      description:
        'Virgin cold-pressed coconut oil for cooking, skin and hair. Unrefined, chemical-free and rich in healthy fatty acids.',
      price: 349, discount_price: 299, stock: 110, manufacturer: 'Coco Soul',
      requires_prescription: false, dosage: 'Use for cooking or topical application',
      benefits: ['Multipurpose', 'Rich in MCTs', 'Chemical-free'],
      ingredients: ['Virgin Coconut Oil'],
      average_rating: 4.6, review_count: 149, is_featured: false, days: 18,
    },
    {
      name: 'Aloe Vera Gel',
      category: 'Herbal Skincare',
      description:
        'Pure aloe vera gel that hydrates, soothes sunburn and calms irritated skin. Lightweight and non-sticky for daily use.',
      price: 199, discount_price: 159, stock: 175, manufacturer: 'WOW Skin Science',
      requires_prescription: false, dosage: 'Apply a thin layer as needed',
      benefits: ['Deep hydration', 'Soothes sunburn', 'Non-sticky'],
      ingredients: ['Aloe Vera', 'Vitamin E'],
      average_rating: 4.4, review_count: 205, is_featured: true, days: 7,
    },
    {
      name: 'Amla Juice',
      category: 'Herbal Food & Beverages',
      description:
        'Cold-pressed Indian gooseberry (Amla) juice, a natural source of Vitamin C to boost immunity, skin health and digestion.',
      price: 259, discount_price: null, stock: 95, manufacturer: 'Kapiva',
      requires_prescription: false, dosage: '30ml with water on an empty stomach',
      benefits: ['High in Vitamin C', 'Boosts immunity', 'Improves skin & hair'],
      ingredients: ['Amla Extract'],
      average_rating: 4.1, review_count: 41, is_featured: false, days: 22,
    },
    {
      name: 'Eucalyptus Essential Oil',
      category: 'Essential Oils',
      description:
        'Invigorating eucalyptus oil for steam inhalation and aromatherapy. Helps clear congestion and refresh the senses.',
      price: 329, discount_price: 269, stock: 55, manufacturer: 'Soulflower',
      requires_prescription: false, dosage: 'Add 2-3 drops to steam or diffuser',
      benefits: ['Clears congestion', 'Refreshing aroma', 'Aids breathing'],
      ingredients: ['Pure Eucalyptus Oil'],
      average_rating: 4.5, review_count: 73, is_featured: false, days: 13,
    },
    {
      name: 'Shatavari Women\u2019s Wellness',
      category: 'Ayurvedic',
      description:
        'Shatavari root supplement traditionally used to support hormonal balance, vitality and overall wellness in women.',
      price: 629, discount_price: 529, stock: 40, manufacturer: 'Himalaya Herbals',
      requires_prescription: false, dosage: '1 capsule twice daily',
      benefits: ['Hormonal balance', 'Boosts vitality', 'Supports lactation'],
      ingredients: ['Shatavari Root'],
      average_rating: 4.3, review_count: 58, is_featured: false, days: 5,
    },
    {
      name: 'Herbal Pain Relief Balm',
      category: 'Herbal First Aid',
      description:
        'Fast-acting ayurvedic balm with wintergreen, menthol and eucalyptus to relieve muscle aches, joint pain and headaches.',
      price: 149, discount_price: 119, stock: 220, manufacturer: 'Zandu',
      requires_prescription: false, dosage: 'Apply gently to the affected area',
      benefits: ['Relieves muscle pain', 'Soothes joints', 'Quick relief'],
      ingredients: ['Wintergreen Oil', 'Menthol', 'Eucalyptus'],
      average_rating: 4.6, review_count: 188, is_featured: false, days: 8,
    },
    {
      name: 'Moringa Superfood Powder',
      category: 'Herbal Supplements',
      description:
        'Nutrient-dense moringa leaf powder packed with vitamins, minerals and antioxidants. Add to smoothies, juices or water.',
      price: 379, discount_price: 319, stock: 85, manufacturer: 'True Elements',
      requires_prescription: false, dosage: '1 teaspoon daily in water or smoothie',
      benefits: ['Rich in nutrients', 'Boosts energy', 'Supports immunity'],
      ingredients: ['Moringa Leaf Powder'],
      average_rating: 4.4, review_count: 96, is_featured: false, days: 16,
    },
    {
      name: 'Rose Water Facial Toner',
      category: 'Herbal Skincare',
      description:
        'Pure steam-distilled rose water toner that hydrates, tightens pores and gives skin a natural glow.',
      price: 229, discount_price: 189, stock: 140, manufacturer: 'Kama Ayurveda',
      requires_prescription: false, dosage: 'Spray on face after cleansing',
      benefits: ['Tones skin', 'Hydrates', 'Natural glow'],
      ingredients: ['Rose Water', 'Glycerin'],
      average_rating: 4.5, review_count: 112, is_featured: false, days: 12,
    },
    {
      name: 'Giloy Immunity Tablets',
      category: 'Herbal First Aid',
      description:
        'Giloy (Guduchi) tablets to support natural immunity, fight fever and detoxify the body. A cornerstone of Ayurvedic first aid.',
      price: 269, discount_price: 219, stock: 100, manufacturer: 'Patanjali',
      requires_prescription: true, dosage: '2 tablets daily after meals (consult physician)',
      benefits: ['Boosts immunity', 'Fights fever', 'Detoxifies'],
      ingredients: ['Giloy Stem Extract'],
      average_rating: 4.2, review_count: 47, is_featured: false, days: 2,
    },
    {
      name: 'Argan Hair Serum',
      category: 'Herbal Haircare',
      description:
        'Lightweight argan oil serum that tames frizz, adds shine and protects hair from heat and pollution.',
      price: 459, discount_price: 379, stock: 65, manufacturer: 'WOW Skin Science',
      requires_prescription: false, dosage: 'Apply a few drops to damp hair',
      benefits: ['Tames frizz', 'Adds shine', 'Heat protection'],
      ingredients: ['Argan Oil', 'Vitamin E', 'Jojoba Oil'],
      average_rating: 4.3, review_count: 69, is_featured: false, days: 19,
    },
    {
      name: 'Peppermint Essential Oil',
      category: 'Essential Oils',
      description:
        'Cooling peppermint essential oil ideal for headaches, focus and refreshing aromatherapy blends.',
      price: 299, discount_price: null, stock: 75, manufacturer: 'Soulflower',
      requires_prescription: false, dosage: 'Dilute before topical use; 2-3 drops in diffuser',
      benefits: ['Relieves headaches', 'Improves focus', 'Cooling effect'],
      ingredients: ['Pure Peppermint Oil'],
      average_rating: 4.6, review_count: 84, is_featured: false, days: 14,
    },
    {
      name: 'Chyawanprash Immunity Jam',
      category: 'Ayurvedic',
      description:
        'Time-honoured Ayurvedic health tonic made from Amla and 40+ herbs to build strength, stamina and immunity for the whole family.',
      price: 399, discount_price: 349, stock: 105, manufacturer: 'Dabur',
      requires_prescription: false, dosage: '1-2 teaspoons daily, preferably with milk',
      benefits: ['Builds immunity', 'Boosts strength', 'For all ages'],
      ingredients: ['Amla', 'Ashwagandha', 'Ghee', 'Honey', '40+ Herbs'],
      average_rating: 4.7, review_count: 260, is_featured: true, days: 10,
    },
    {
      name: 'Herbal Sleep & Calm Capsules',
      category: 'Herbal Supplements',
      description:
        'A calming blend of Ashwagandha, Jatamansi and Chamomile to promote relaxation and deep, restful sleep naturally.',
      price: 549, discount_price: 459, stock: 50, manufacturer: 'Kapiva',
      requires_prescription: false, dosage: '1 capsule 30 minutes before bed',
      benefits: ['Promotes deep sleep', 'Reduces anxiety', 'Non-habit forming'],
      ingredients: ['Ashwagandha', 'Jatamansi', 'Chamomile'],
      average_rating: 4.4, review_count: 77, is_featured: false, days: 1,
    },
  ];

  return raw.map((m, i) => {
    const slug = m.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    return {
      id: uid(),
      name: m.name,
      description: m.description,
      category: m.category,
      price: m.price,
      discount_price: m.discount_price,
      stock: m.stock,
      weight_grams: 75 + (i % 6) * 25,
      manufacturer: m.manufacturer,
      requires_prescription: m.requires_prescription,
      dosage: m.dosage,
      benefits: m.benefits,
      ingredients: m.ingredients,
      images: [img(`${slug}-a`), img(`${slug}-b`), img(`${slug}-c`)],
      average_rating: m.average_rating,
      review_count: m.review_count,
      is_featured: m.is_featured,
      total_sold: Math.round((m.review_count || 10) * 1.5),
      created_at: daysAgo(m.days ?? i + 1),
    };
  });
}

function seedUsers() {
  return [
    {
      id: uid(),
      name: 'Admin',
      email: 'herbalhub@gmail.com',
      phone: '+91 90000 00001',
      password: 'Admin@2006',
      role: 'admin',
      is_active: true,
      email_verified: true,
      profile_image: null,
      address: {},
      created_at: daysAgo(120),
    },
    {
      id: 'seller-demo',
      name: 'Green Roots Naturals',
      email: 'seller@herbalhub.in',
      phone: '+91 90000 00005',
      password: 'seller123',
      role: 'seller',
      business_name: 'Green Roots Naturals',
      is_active: true,
      email_verified: true,
      profile_image: null,
      address: { city: 'Bengaluru', state: 'Karnataka' },
      created_at: daysAgo(75),
    },
    {
      id: uid(),
      name: 'Demo Customer',
      email: 'demo@herbalhub.in',
      phone: '+91 90000 00002',
      password: 'demo123',
      role: 'customer',
      is_active: true,
      email_verified: true,
      profile_image: null,
      address: {},
      created_at: daysAgo(40),
    },
    {
      id: uid(),
      name: 'Priya Sharma',
      email: 'priya@example.com',
      phone: '+91 90000 00003',
      password: 'priya123',
      role: 'customer',
      is_active: true,
      email_verified: false,
      profile_image: null,
      address: {},
      created_at: daysAgo(28),
    },
    {
      id: uid(),
      name: 'Rahul Verma',
      email: 'rahul@example.com',
      phone: '+91 90000 00004',
      password: 'rahul123',
      role: 'customer',
      is_active: false,
      email_verified: false,
      profile_image: null,
      address: {},
      created_at: daysAgo(15),
    },
  ];
}

function seedReviews(medicines, users) {
  const customer = users.find((u) => u.role === 'customer');
  const samples = [
    { rating: 5, title: 'Excellent quality!', comment: 'Genuine product and fast delivery. Highly recommend.' },
    { rating: 4, title: 'Works well', comment: 'Noticed a difference within two weeks. Good value.' },
    { rating: 5, title: 'Will buy again', comment: 'Authentic and well packaged. Very happy with it.' },
  ];
  const reviews = [];
  medicines.slice(0, 8).forEach((med) => {
    samples.slice(0, 2).forEach((s, i) => {
      reviews.push({
        id: uid(),
        medicine_id: med.id,
        user_id: customer.id,
        user_name: i % 2 === 0 ? 'Priya S.' : 'Rahul V.',
        rating: s.rating,
        title: s.title,
        comment: s.comment,
        created_at: daysAgo(i * 3 + 2),
      });
    });
  });
  return reviews;
}

function seedOrders(medicines, users) {
  const customer = users.find((u) => u.email === 'demo@herbalhub.in');
  const priya = users.find((u) => u.email === 'priya@example.com');
  const pick = (i) => medicines[i];
  const line = (m, qty) => ({
    medicine_id: m.id,
    name: m.name,
    price: m.discount_price || m.price,
    quantity: qty,
    image: m.images[0],
    weight_grams: m.weight_grams,
  });
  const makeOrder = (user, lines, status, paymentMethod, paymentStatus, days) => {
    const total = lines.reduce((s, l) => s + l.price * l.quantity, 0);
    const parcel_weight = lines.reduce((sum, item) => sum + item.weight_grams * item.quantity, 0);
    const delivery_charge = parcel_weight <= 250 ? 180 : parcel_weight <= 500 ? 250 : parcel_weight <= 1000 ? 350 : 500;
    return {
      id: uid(),
      user_id: user.id,
      user_name: user.name,
      items: lines,
      total_amount: total,
      delivery_charge,
      shipping_fee: delivery_charge,
      parcel_weight,
      discount: 0,
      final_amount: total + delivery_charge,
      address: {
        name: user.name,
        phone: user.phone,
        address_line1: '42 Wellness Street',
        address_line2: 'Near Green Park',
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560001',
      },
      payment_method: paymentMethod,
      payment_status: paymentStatus,
      status,
      courier_service: ['delivered', 'out_for_delivery'].includes(status) ? 'Sri Lanka Post' : null,
      tracking_number: ['delivered', 'out_for_delivery'].includes(status) ? `SLPOST${uid().slice(0, 8).toUpperCase()}` : null,
      shipping_date: ['delivered', 'out_for_delivery'].includes(status) ? daysAgo(Math.max(0, days - 1)) : null,
      delivery_status: status === 'delivered' ? 'delivered' : status === 'out_for_delivery' ? 'in_transit' : status === 'confirmed' ? 'accepted' : 'pending',
      last_status_updated: daysAgo(Math.max(0, days - 1)),
      created_at: daysAgo(days),
    };
  };
  return [
    makeOrder(customer, [line(pick(0), 2), line(pick(2), 1)], 'delivered', 'cod', 'completed', 12),
    makeOrder(customer, [line(pick(4), 1), line(pick(10), 2)], 'out_for_delivery', 'upi', 'completed', 1),
    makeOrder(customer, [line(pick(1), 1)], 'placed', 'card', 'completed', 1),
    makeOrder(priya, [line(pick(20), 1), line(pick(5), 1)], 'confirmed', 'cod', 'pending', 2),
    makeOrder(priya, [line(pick(14), 3)], 'out_for_delivery', 'upi', 'completed', 1),
  ];
}

function seedNotifications(users, orders) {
  const customer = users.find((u) => u.email === 'demo@herbalhub.in');
  const custOrders = orders.filter((o) => o.user_id === customer.id);
  const notifs = [
    {
      id: uid(),
      user_id: customer.id,
      title: 'Welcome to Herbal Hub!',
      message: 'Explore pure herbal products delivered to your door.',
      link: '/shop',
      read: false,
      created_at: daysAgo(2),
    },
  ];
  if (custOrders[1]) {
    notifs.push({
      id: uid(),
      user_id: customer.id,
      title: 'Your order has shipped',
      message: `Order #${custOrders[1].id.slice(0, 8).toUpperCase()} is on its way.`,
      link: `/orders/${custOrders[1].id}`,
      read: false,
      created_at: daysAgo(1),
    });
  }
  return notifs;
}

function seedPrescriptions(users) {
  const customer = users.find((u) => u.email === 'demo@herbalhub.in');
  return [
    {
      id: uid(),
      user_id: customer.id,
      user_name: customer.name,
      file_name: 'prescription-dr-mehta.pdf',
      file_url: null,
      notes: 'For immunity syrup refill',
      status: 'approved',
      rejection_reason: null,
      created_at: daysAgo(10),
      expires_at: daysAgo(-80),
    },
    {
      id: uid(),
      user_id: customer.id,
      user_name: customer.name,
      file_name: 'prescription-scan.jpg',
      file_url: null,
      notes: '',
      status: 'uploaded',
      rejection_reason: null,
      created_at: daysAgo(1),
      expires_at: daysAgo(-89),
    },
  ];
}

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function save(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

// Seed on first run (or when the seed version changes).
function ensureSeeded() {
  if (load(KEYS.seedVersion, null) === SEED_VERSION && localStorage.getItem(KEYS.medicines)) {
    const users = load(KEYS.users, []);
    const migratedUsers = users.map((user) => user.role === 'admin' ? {
      ...user,
      email: 'herbalhub@gmail.com',
      password: 'Admin@2006',
      is_active: true,
      email_verified: true,
    } : user);
    save(KEYS.users, migratedUsers);
    return;
  }
  const users = seedUsers();
  save(KEYS.medicines, []);
  save(KEYS.users, users);
  save(KEYS.reviews, []);
  save(KEYS.carts, {});
  save(KEYS.orders, []);
  save(KEYS.prescriptions, []);
  save(KEYS.notifications, []);
  save(KEYS.subscribers, []);
  save(KEYS.seedVersion, SEED_VERSION);
}

ensureSeeded();

export const db = {
  KEYS,
  getMedicines: () => load(KEYS.medicines, []),
  setMedicines: (v) => save(KEYS.medicines, v),
  getUsers: () => load(KEYS.users, []),
  setUsers: (v) => save(KEYS.users, v),
  getCarts: () => load(KEYS.carts, {}),
  setCarts: (v) => save(KEYS.carts, v),
  getOrders: () => load(KEYS.orders, []),
  setOrders: (v) => save(KEYS.orders, v),
  getReviews: () => load(KEYS.reviews, []),
  setReviews: (v) => save(KEYS.reviews, v),
  getPrescriptions: () => load(KEYS.prescriptions, []),
  setPrescriptions: (v) => save(KEYS.prescriptions, v),
  getNotifications: () => load(KEYS.notifications, []),
  setNotifications: (v) => save(KEYS.notifications, v),
  getSubscribers: () => load(KEYS.subscribers, []),
  setSubscribers: (v) => save(KEYS.subscribers, v),
  reset: () => {
    Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
    ensureSeeded();
  },
};
