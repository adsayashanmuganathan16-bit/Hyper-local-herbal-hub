import React, { useEffect, useState } from 'react';
import { FiMail, FiSearch } from 'react-icons/fi';
import { newsletterApi } from '../../api/newsletterApi';
import { formatDateTime } from '../../utils/helpers';
import Loading from '../../components/Loading';

export default function NewsletterSubscribers() {
  const [subscribers, setSubscribers] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(true);
      newsletterApi.getSubscribers({ page: 1, page_size: 100, ...(query.trim() ? { q: query.trim() } : {}) })
        .then(({ data }) => setSubscribers(data.items || []))
        .catch(() => setSubscribers([]))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div className="page-wrapper">
      <section className="dashboard-page">
        <div className="container">
          <div className="dashboard-header">
            <div className="dashboard-header-copy">
              <span className="dashboard-eyebrow">Newsletter audience</span>
              <h1 className="dashboard-title">Email Subscribers</h1>
              <p className="dashboard-subtitle">People who subscribed through the Herbal Hub website footer.</p>
            </div>
          </div>

          <div className="admin-card">
            <div className="subscriber-toolbar">
              <div>
                <strong>{subscribers.length}</strong>
                <span> active subscriber{subscribers.length === 1 ? '' : 's'}</span>
              </div>
              <label className="subscriber-search">
                <FiSearch size={16} />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search email" />
              </label>
            </div>
            {loading ? <Loading /> : (
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table">
                  <thead><tr><th>Email address</th><th>Source</th><th>Subscribed</th><th>Status</th></tr></thead>
                  <tbody>
                    {subscribers.map((subscriber) => (
                      <tr key={subscriber.id}>
                        <td className="font-semibold"><FiMail size={14} style={{ display: 'inline', marginRight: 8 }} />{subscriber.email}</td>
                        <td>Website footer</td>
                        <td className="text-gray text-sm">{formatDateTime(subscriber.subscribed_at)}</td>
                        <td><span className="badge badge-green">Active</span></td>
                      </tr>
                    ))}
                    {!subscribers.length && (
                      <tr><td colSpan={4} className="text-center text-gray" style={{ padding: 40 }}>No subscribers found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
