import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FiArrowRight,
  FiCamera,
  FiCheck,
  FiMapPin,
  FiShoppingBag,
  FiTruck,
} from 'react-icons/fi';
import { BadgeCheck, Droplets, Flower2, HeartPulse, Leaf, Store } from 'lucide-react';
import SearchBar from '../components/SearchBar';
import { useAuth } from '../context/AuthContext';
import { medicineApi } from '../api/medicineApi';
import MedicineCard from '../components/MedicineCard';

const HERO_ART = process.env.PUBLIC_URL + '/assets/herbal-hero.png';

const STATS = [
  { icon: '🌿', value: '20+', label: 'Herbal Products' },
  { icon: '🏪', value: '8+', label: 'Local Sellers' },
  { icon: '✦', value: 'AI', label: 'Plant Identification' },
];

const FEATURES = [
  {
    icon: FiMapPin,
    number: '01',
    title: 'Nearby Herbal Sellers',
    description: 'Find trusted herbal sellers near your location using location-based search.',
  },
  {
    icon: FiShoppingBag,
    number: '02',
    title: 'Secure Online Ordering',
    description: 'Order herbal products safely using secure checkout and order tracking.',
  },
  {
    icon: FiCamera,
    number: '03',
    title: 'AI Plant Identification',
    description: 'Upload a plant image and identify medicinal plants with AI-powered recognition.',
  },
  {
    icon: FiTruck,
    number: '04',
    title: 'Fast Local Delivery',
    description: 'Receive herbal products quickly from nearby sellers within your service area.',
  },
];
const CATEGORIES = [
  { name: 'Ayurvedic', description: 'Ancient formulations for everyday balance', icon: Leaf, number: '01' },
  { name: 'Herbal Supplements', description: 'Plant-powered daily wellness support', icon: HeartPulse, number: '02' },
  { name: 'Herbal Skincare', description: 'Gentle care rooted in botanical wisdom', icon: Flower2, number: '03' },
  { name: 'Essential Oils', description: 'Pure aromatic rituals for body and mind', icon: Droplets, number: '04' },
];
function Stat({ icon, value, label }) {
  return (
    <div className="home-stat">
      <span className="home-stat-icon" aria-hidden="true">{icon}</span>
      <span className="home-stat-copy">
        <strong>{value}</strong>
        <span>{label}</span>
      </span>
    </div>
  );
}

function FeatureCard({ icon: Icon, number, title, description }) {
  return (
    <article className="home-feature-card">
      <div className="home-feature-card-top">
        <span className="home-feature-icon"><Icon size={23} /></span>
        <span className="home-feature-number">{number}</span>
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      <span className="home-feature-line" aria-hidden="true" />
    </article>
  );
}

export default function Home() {
  const { user } = useAuth();
  const [featured, setFeatured] = useState([]);
  useEffect(() => {
    medicineApi.search({ page: 1, page_size: 4, sort_by: 'rating', available_only: true })
      .then(({ data }) => setFeatured(data.items || [])).catch(() => {});
  }, []);

  return (
    <div className="home-page">
      <section className="home-hero">
        <div className="home-ambient home-ambient-left" />
        <div className="home-ambient home-ambient-right" />

        <div className="container home-hero-grid">
          <div className="home-hero-copy">
            {user?.role === 'customer' && (
              <p className="home-welcome">Welcome back, {user.name}</p>
            )}

            <div className="home-eyebrow">
              <span>🌿</span>
              Rooted in Sri Lankan wellness
            </div>

            <h1>Hyper-Local Herbal Hub</h1>
            <h2>Connecting Customers with <em>Trusted Local Herbal Sellers</em></h2>
            <p className="home-hero-description">
              The Hyper-Local Herbal Hub is a location-based herbal marketplace that connects
              customers with nearby herbal sellers. Browse trusted products, identify medicinal
              plants using AI, order securely, and enjoy fast local delivery.
            </p>

            <div className="home-hero-search">
              <SearchBar placeholder="Search herbal products or nearby sellers..." />
            </div>

            <div className="home-stats" aria-label="Marketplace statistics">
              {STATS.map((stat) => <Stat key={stat.label} {...stat} />)}
            </div>
          </div>

          <div className="home-hero-visual" aria-label="Herbal marketplace illustration">
            <div className="home-visual-card">
              <div className="home-ring home-ring-one" />
              <div className="home-ring home-ring-two" />
              <div className="home-ring home-ring-three" />
              <span className="home-visual-kicker">Nature, closer to you</span>
              <img src={HERO_ART} alt="Mortar and pestle surrounded by medicinal leaves" />
              <span className="home-visual-seal">100%<small>LOCAL</small></span>
            </div>
            <div className="home-floating-badge">
              <span><FiCheck size={16} /></span>
              <div>
                <small>DISCOVER NEARBY</small>
                <strong>Hyper-Local Marketplace</strong>
              </div>
            </div>
            <span className="home-floating-leaf home-leaf-one">✦</span>
            <span className="home-floating-leaf home-leaf-two">🌿</span>
          </div>
        </div>
      </section>

      <section className="home-features">
        <div className="container">
          <div className="home-features-heading">
            <div>
              <span className="home-section-label">Why choose Herbal Hub</span>
              <h2>Wellness rooted in <em>your community.</em></h2>
            </div>
            <Link to="/shop" className="home-explore-link">
              Explore the marketplace <FiArrowRight />
            </Link>
          </div>

          <div className="home-features-grid">
            {FEATURES.map((feature) => <FeatureCard key={feature.number} {...feature} />)}
          </div>
        </div>
      </section>

      <section className="home-market-section home-category-section">
        <div className="container">
          <div className="premium-section-heading home-category-heading">
            <div><span>Shop by ritual</span><h2>Wellness for every part of your day.</h2></div>
            <p>Thoughtfully organized collections make traditional herbal care easy to explore.</p>
          </div>
          <div className="home-category-grid">
            {CATEGORIES.map(({ name, description, icon: Icon, number }) => (
              <Link className="home-category-premium" key={name} to={`/shop?category=${encodeURIComponent(name)}`}>
                <div className="home-category-card-top">
                  <span className="home-category-icon"><Icon size={28} strokeWidth={1.8} /></span>
                  <span className="home-category-number">{number}</span>
                </div>
                <div className="home-category-copy">
                  <h3>{name}</h3>
                  <p>{description}</p>
                </div>
                <span className="home-category-link">Explore collection <i><FiArrowRight /></i></span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {!!featured.length && <section className={`home-market-section home-featured-section product-count-${Math.min(featured.length, 4)}`}>
        <div className={`container home-featured-layout product-count-${Math.min(featured.length, 4)}`}>
          <div className="premium-section-heading home-featured-heading"><div><span>Community favourites</span><h2>Featured herbal essentials.</h2></div><Link to="/shop">Shop all products <FiArrowRight/></Link></div>
          <div className="home-featured-products">{featured.map(product=><MedicineCard medicine={product} key={product.id}/>)}</div>
        </div>
      </section>}

      <section className="home-market-section home-seller-showcase">
        <div className="container">
          <div className="premium-section-heading light"><div><span>Trusted local expertise</span><h2>Meet the people behind your wellness.</h2></div></div>
          <div className="home-trust-grid">
            <article><span><Store/></span><div><small>APPROVED SELLERS</small><strong>Local businesses, verified</strong><p>Every active seller has a reviewed marketplace profile.</p></div></article>
            <article><span><BadgeCheck/></span><div><small>TRANSPARENT PRODUCTS</small><strong>Know what you are buying</strong><p>Ingredients, benefits, using methods, and seller details in one place.</p></div></article>
            <article><span><Leaf/></span><div><small>COMMUNITY FIRST</small><strong>Spend locally, grow locally</strong><p>Your orders support herbal enterprises in your service area.</p></div></article>
          </div>
        </div>
      </section>

    </div>
  );
}
