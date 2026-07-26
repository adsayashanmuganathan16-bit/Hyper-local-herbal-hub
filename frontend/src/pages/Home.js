import React from 'react';
import { Link } from 'react-router-dom';
import {
  FiArrowRight,
  FiCamera,
  FiCheck,
  FiMapPin,
  FiShoppingBag,
  FiTruck,
} from 'react-icons/fi';
import SearchBar from '../components/SearchBar';
import { useAuth } from '../context/AuthContext';

const HERO_ART = process.env.PUBLIC_URL + '/assets/herbal-hero.png';

const STATS = [
  { icon: '🌿', value: '100+', label: 'Herbal Products' },
  { icon: '🏪', value: '25+', label: 'Local Sellers' },
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
    </div>
  );
}
