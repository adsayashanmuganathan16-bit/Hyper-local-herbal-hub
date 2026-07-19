import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  FiTruck,
  FiHeart,
  FiShield,
  FiFeather,
  FiArrowRight
} from "react-icons/fi";
import SearchBar from '../components/SearchBar';
import MedicineCard from '../components/MedicineCard';
import { medicineApi } from '../api/medicineApi';
import Loading from '../components/Loading';

const LOGO_URL = process.env.PUBLIC_URL + '/logo.png';

const CATEGORIES = [
  { name: 'Ayurvedic', img: 'https://picsum.photos/seed/ayur-cat/300/300.jpg', color: '#2d6a4f' },
  { name: 'Herbal Supplements', img: 'https://picsum.photos/seed/suppl-cat/300/300.jpg', color: '#40916c' },
  { name: 'Herbal Skincare', img: 'https://picsum.photos/seed/skin-cat/300/300.jpg', color: '#52b788' },
  { name: 'Essential Oils', img: 'https://picsum.photos/seed/oil-cat/300/300.jpg', color: '#74c69d' },
  { name: 'Herbal Food & Beverages', img: 'https://picsum.photos/seed/food-cat/300/300.jpg', color: '#95d5b2' },
  { name: 'Herbal Haircare', img: 'https://picsum.photos/seed/hair-cat/300/300.jpg', color: '#b7e4c7' },
];

const FEATURES = [
  { icon: <FiTruck size={28} />, title: 'Fast Local Delivery', desc: 'Get your herbs delivered within 2 hours from nearby stores' },
  { icon: <FiShield size={28} />, title: '100% Authentic', desc: 'Verified herbal products from trusted local manufacturers' },
  { icon: <FiFeather size={28} />, title: 'Pure & Natural', desc: 'No chemicals, no additives — just pure herbal goodness' },
  { icon: <FiHeart size={28} />, title: 'Made with Care', desc: 'Handcrafted by local herbalists with generations of knowledge' },
];

export default function Home() {
  const [featured, setFeatured] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    medicineApi.getFeatured()
      .then(({ data }) => setFeatured(data))
      .catch(() => setFeatured([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="page-wrapper">
      {/* Hero Section */}
      <section className="hero">
        <div className="hero-bg">
          <div className="hero-gradient" />
          <div className="hero-pattern" />
        </div>
        <div className="container hero-content">
          <div className="hero-text">
            <div className="hero-badge">🌿 Hyper-Local Herbal Hub</div>
            <h1 className="hero-title">
              Pure Herbs,<br />
              <span className="hero-title-accent">Local Care,</span><br />
              Better Life
            </h1>
            <p className="hero-subtitle">
              Discover authentic herbal medicines from local practitioners, delivered fresh to your doorstep. Nature's healing, now at your fingers.
            </p>
            <div className="hero-search">
              <SearchBar />
            </div>
            <div className="hero-stats">
              <div className="hero-stat">
                <span className="hero-stat-value">500+</span>
                <span className="hero-stat-label">Products</span>
              </div>
              <div className="hero-stat-divider" />
              <div className="hero-stat">
                <span className="hero-stat-value">50+</span>
                <span className="hero-stat-label">Local Sellers</span>
              </div>
              <div className="hero-stat-divider" />
              <div className="hero-stat">
                <span className="hero-stat-value">10K+</span>
                <span className="hero-stat-label">Happy Customers</span>
              </div>
            </div>
          </div>
          <div className="hero-visual">
            <img src={LOGO_URL} alt="Herbal Hub" className="hero-logo-large" />
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="section">
        <div className="container">
          <div className="grid-4">
            {FEATURES.map((f, i) => (
              <div key={i} className="feature-card" style={{ animationDelay: `${i * 0.1}s` }}>
                <div className="feature-icon">{f.icon}</div>
                <h3 className="feature-title">{f.title}</h3>
                <p className="feature-desc">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="section" style={{ background: 'var(--green-50)' }}>
        <div className="container">
          <div className="flex items-center justify-between mb-8" style={{ flexWrap: 'wrap', gap: 16 }}>
            <div>
              <h2 className="section-title">Browse Categories</h2>
              <p className="section-subtitle">Explore our wide range of herbal wellness categories</p>
            </div>
            <Link to="/shop" className="btn btn-secondary btn-sm">View All <FiArrowRight size={14} /></Link>
          </div>
          <div className="grid-3">
            {CATEGORIES.map((cat) => (
              <Link key={cat.name} to={`/shop?category=${encodeURIComponent(cat.name)}`} className="category-card">
                <div className="category-card-img">
                  <img src={cat.img} alt={cat.name} />
                  <div className="category-card-overlay" style={{ background: `${cat.color}dd` }} />
                </div>
                <span className="category-card-label">{cat.name.replace(/_/g, ' ')}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Products */}
      <section className="section">
        <div className="container">
          <div className="flex items-center justify-between mb-8" style={{ flexWrap: 'wrap', gap: 16 }}>
            <div>
              <h2 className="section-title">Top Rated Products</h2>
              <p className="section-subtitle">Our customers' most loved herbal products</p>
            </div>
            <Link to="/shop?sort_by=rating" className="btn btn-secondary btn-sm">See More <FiArrowRight size={14} /></Link>
          </div>
          {loading ? (
            <Loading />
          ) : featured.length === 0 ? (
            <div className="empty-state">
              <h3>Coming Soon</h3>
              <p>We're curating the best herbal products for you. Stay tuned!</p>
            </div>
          ) : (
            <div className="grid-4">
              {featured.map((med) => (
                <MedicineCard key={med.id} medicine={med} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <div className="container cta-content">
          <img src={LOGO_URL} alt="" className="cta-logo" />
          <h2 className="cta-title">Natural Healing • Local Care • Healthy Life</h2>
          <p className="cta-text">Join thousands who trust Herbal Hub for their daily wellness needs. Upload your prescription and get medicines delivered in under 2 hours.</p>
          <div className="cta-actions">
            <Link to="/register" className="btn btn-white btn-lg">Get Started Free</Link>
            <Link to="/shop" className="btn btn-ghost" style={{ color: 'var(--white)' }}>Browse Products</Link>
          </div>
        </div>
      </section>
    </div>
  );
}