import React from 'react';
import { Link } from 'react-router-dom';
import { FiMapPin, FiPhone, FiMail, FiHeart } from 'react-icons/fi';

const LOGO_URL = process.env.PUBLIC_URL + '/logo.png';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">

          {/* Brand */}
          <div className="footer-brand">
            <img src={LOGO_URL} alt="Herbal Hub" className="footer-logo" />

            <p className="footer-tagline">
              Pure Herbs, Local Care, Better Life. Your trusted hyper-local herbal medicine delivery platform.
            </p>

            <div className="footer-contact">
              <div className="footer-contact-item">
                <FiMapPin size={16} />
                <span>123 Herbal Lane, Green City, India</span>
              </div>

              <div className="footer-contact-item">
                <FiPhone size={16} />
                <span>+91 98765 43210</span>
              </div>

              <div className="footer-contact-item">
                <FiMail size={16} />
                <span>care@herbalhub.in</span>
              </div>
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

            <Link to="/about" className="footer-link">
              About Us
            </Link>

            <Link to="/contact" className="footer-link">
              Contact
            </Link>

            <Link to="/faq" className="footer-link">
              FAQ
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

            <form className="newsletter-form">
              <input
                type="email"
                placeholder="Enter your email"
                className="newsletter-input"
              />

              <button type="submit" className="newsletter-btn">
                Subscribe
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
        </div>
      </div>
    </footer>
  );
}