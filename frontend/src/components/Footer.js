import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { FiMapPin, FiPhone, FiMail, FiHeart } from 'react-icons/fi';
import { toast } from 'react-toastify';
import { newsletterApi } from '../api/newsletterApi';

const LOGO_URL = process.env.PUBLIC_URL + '/logo.png';

export default function Footer() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubscribe = async (event) => {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) return toast.error('Please enter your email address');

    setSubmitting(true);
    try {
      const { data } = await newsletterApi.subscribe(normalizedEmail);
      if (data.subscribed) toast.success(data.message);
      else toast.info(data.message);
      setEmail('');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Could not subscribe. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">

          {/* Brand */}
          <div className="footer-brand">
            <Link to="/" className="footer-logo-link" aria-label="Herbal Hub home">
              <img src={LOGO_URL} alt="Herbal Hub logo" className="footer-logo" />
              <span>Herbal Hub</span>
            </Link>

            <p className="footer-tagline">
              Pure Herbs, Local Care, Better Life. Your trusted hyper-local herbal medicine delivery platform.
            </p>

            <p className="footer-owner">Project owner · <strong>Adsaya Shanmuganathan</strong></p>

            <div className="footer-contact">
              <div className="footer-contact-item">
                <FiMapPin size={16} />
                <span>Uruththirapuram, Kilinochchi, Sri Lanka</span>
              </div>

              <a className="footer-contact-item" href="tel:+94761132154">
                <FiPhone size={16} />
                <span>+94 76 113 2154</span>
              </a>

              <a className="footer-contact-item" href="mailto:herbalhub468@gmail.com">
                <FiMail size={16} />
                <span>herbalhub468@gmail.com</span>
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div className="footer-col">
            <h4 className="footer-col-title">Quick Links</h4>

            <Link to="/shop" className="footer-link">
              Shop All
            </Link>

            <Link
              to="/shop?category=Ayurvedic"
              className="footer-link"
            >
              Ayurvedic
            </Link>

            <Link
              to="/shop?category=Herbal Supplements"
              className="footer-link"
            >
              Supplements
            </Link>

            <Link
              to="/shop?category=Herbal Skincare"
              className="footer-link"
            >
              Skincare
            </Link>

            <Link
              to="/shop?category=Essential Oils"
              className="footer-link"
            >
              Essential Oils
            </Link>
          </div>

          {/* Customer Support */}
          <div className="footer-col">
            <h4 className="footer-col-title">Customer Support</h4>

            <Link to="/contact" className="footer-link">
              Contact Us
            </Link>

            <Link to="/faq" className="footer-link">
              Frequently Asked Questions
            </Link>

            <Link to="/privacy" className="footer-link">
              Privacy Policy
            </Link>

            <Link to="/terms" className="footer-link">
              Terms & Conditions
            </Link>
          </div>

          {/* Newsletter */}
          <div className="footer-col">
            <h4 className="footer-col-title">Stay Connected</h4>

            <p>Subscribe for herbal tips and exclusive offers.</p>

            <form className="newsletter-form" onSubmit={handleSubscribe}>
              <input
                type="email"
                placeholder="Email address"
                className="newsletter-input"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                aria-label="Email address for newsletter"
                required
              />

              <button type="submit" className="newsletter-btn" disabled={submitting}>
                {submitting ? 'Subscribing…' : 'Subscribe'}
              </button>
            </form>
          </div>

        </div>

        <div className="footer-bottom">
          <p>
            © {new Date().getFullYear()} Herbal Hub. Made with{' '}
            <FiHeart
              style={{
                color: 'red',
                display: 'inline',
                verticalAlign: 'middle',
              }}
            />{' '}
            for healthy living.
          </p>
          <p className="footer-developer">
            Designed &amp; developed by <strong>Adsaya Shanmuganatan</strong>
          </p>
        </div>
      </div>
    </footer>
  );
}
