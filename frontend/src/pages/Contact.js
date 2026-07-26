import React, { useState } from 'react';
import { FiMail, FiMapPin, FiPhone, FiSend } from 'react-icons/fi';
import { toast } from 'react-toastify';
import { supportApi } from '../api/supportApi';
import { useAuth } from '../context/AuthContext';

const INITIAL_FORM = { name: '', email: '', message: '' };

export default function Contact() {
  const { user } = useAuth();
  const [form, setForm] = useState(() => ({
    ...INITIAL_FORM,
    name: user?.name || '',
    email: user?.email || '',
  }));
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      const { data } = await supportApi.sendMessage(form);
      toast.success(data.message);
      setForm({
        ...INITIAL_FORM,
        name: user?.name || '',
        email: user?.email || '',
      });
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Could not send your message. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="support-page">
      <header className="support-hero">
        <div className="container support-hero-inner">
          <span className="support-eyebrow">Customer support</span>
          <h1>Contact Us</h1>
          <p>
            Hyper-Local Herbal Hub connects customers with trusted local herbal sellers.
            We are here to help with your account, orders, deliveries, and marketplace questions.
          </p>
        </div>
      </header>

      <main className="container support-content contact-layout">
        <section className="contact-details">
          <span className="support-eyebrow">Get in touch</span>
          <h2>How can we help?</h2>
          <p className="contact-intro">
            Contact our support team using the details below or send us a message through
            the form. We aim to provide clear and timely assistance.
          </p>

          <div className="contact-methods">
            <div className="contact-method">
              <span className="contact-method-icon"><FiMapPin /></span>
              <div>
                <h3>Our location</h3>
                <p>Kilinochchi District, Sri Lanka</p>
              </div>
            </div>
            <a className="contact-method" href="mailto:adsayashanmuganathan16@gmail.com">
              <span className="contact-method-icon"><FiMail /></span>
              <div>
                <h3>Email support</h3>
                <p>adsayashanmuganathan16@gmail.com</p>
              </div>
            </a>
            <a className="contact-method" href="tel:+94761132154">
              <span className="contact-method-icon"><FiPhone /></span>
              <div>
                <h3>Phone contact</h3>
                <p>+94 76 113 2154</p>
              </div>
            </a>
          </div>
        </section>

        <section className="contact-form-card">
          <div className="contact-form-heading">
            <span>Send a message</span>
            <h2>We would love to hear from you.</h2>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="contact-name">Name</label>
              <input
                id="contact-name"
                name="name"
                className="form-input"
                value={form.name}
                onChange={handleChange}
                placeholder="Your full name"
                autoComplete="name"
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="contact-email">Email</label>
              <input
                id="contact-email"
                name="email"
                type="email"
                className="form-input"
                value={form.email}
                onChange={handleChange}
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="contact-message">Message</label>
              <textarea
                id="contact-message"
                name="message"
                className="form-input contact-textarea"
                value={form.message}
                onChange={handleChange}
                placeholder="Tell us how we can help..."
                rows="6"
                required
              />
            </div>
            <button type="submit" className="btn btn-primary contact-submit" disabled={submitting}>
              {submitting ? 'Sending…' : 'Submit message'} {!submitting && <FiSend />}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}
