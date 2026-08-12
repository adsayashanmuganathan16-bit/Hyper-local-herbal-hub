import React, { useCallback, useEffect, useState } from 'react';
import { FiCheckCircle, FiCornerUpLeft, FiMail, FiRefreshCw, FiSearch } from 'react-icons/fi';
import { toast } from 'react-toastify';
import { supportApi } from '../../api/supportApi';
import Loading from '../../components/Loading';
import { formatDateTime } from '../../utils/helpers';

export default function SupportInbox() {
  const [messages, setMessages] = useState([]);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const [reply, setReply] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const loadMessages = useCallback(() => {
    setLoading(true);
    supportApi.getMessages({
      status: filter,
      page: 1,
      page_size: 100,
      ...(query.trim() ? { q: query.trim() } : {}),
    })
      .then(({ data }) => {
        setMessages(data.items || []);
        setSelected((current) => {
          if (!current) return null;
          return (data.items || []).find((item) => item.id === current.id) || null;
        });
      })
      .catch(() => toast.error('Could not load support messages.'))
      .finally(() => setLoading(false));
  }, [filter, query]);

  useEffect(() => {
    const timer = setTimeout(loadMessages, 250);
    return () => clearTimeout(timer);
  }, [loadMessages]);

  const sendReply = async (event) => {
    event.preventDefault();
    if (!selected || !reply.trim()) return;
    setSending(true);
    try {
      const { data } = await supportApi.reply(selected.id, reply.trim());
      toast[data.email_sent ? 'success' : 'info'](
        data.email_sent
          ? 'Reply emailed and message resolved.'
          : 'Reply saved and resolved. Configure SMTP to deliver replies by email.'
      );
      setReply('');
      await loadMessages();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Could not save the reply.');
    } finally {
      setSending(false);
    }
  };

  const reopen = async () => {
    try {
      await supportApi.updateStatus(selected.id, 'open');
      toast.success('Message reopened.');
      await loadMessages();
    } catch {
      toast.error('Could not reopen the message.');
    }
  };

  const openCount = messages.filter((message) => message.status === 'open').length;

  return (
    <div className="page-wrapper">
      <section className="dashboard-page support-inbox-page">
        <div className="container">
          <div className="support-inbox-summary support-inbox-summary-standalone">
            <strong>{openCount}</strong><span>open</span>
          </div>

          <div className="support-toolbar">
            <div className="support-filter-tabs">
              {['all', 'open', 'resolved'].map((value) => (
                <button
                  key={value}
                  className={filter === value ? 'active' : ''}
                  onClick={() => setFilter(value)}
                >
                  {value}
                </button>
              ))}
            </div>
            <label className="support-admin-search">
              <FiSearch />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search messages"
              />
            </label>
          </div>

          <div className="support-inbox-layout">
            <div className="support-message-list">
              {loading ? <Loading /> : messages.map((message) => (
                <button
                  key={message.id}
                  className={`support-message-preview ${selected?.id === message.id ? 'active' : ''}`}
                  onClick={() => { setSelected(message); setReply(''); }}
                >
                  <span className={`support-status-dot ${message.status}`} />
                  <div>
                    <div className="support-preview-top">
                      <strong>{message.name}</strong>
                      <time>{formatDateTime(message.created_at)}</time>
                    </div>
                    <span className="support-sender-meta">
                      {message.sender_role || 'guest'} · {message.email}
                    </span>
                    <p>{message.message}</p>
                  </div>
                </button>
              ))}
              {!loading && !messages.length && (
                <div className="support-empty">
                  <FiMail size={28} />
                  <h3>No support messages</h3>
                  <p>Messages matching this view will appear here.</p>
                </div>
              )}
            </div>

            <div className="support-conversation">
              {!selected ? (
                <div className="support-empty support-empty-conversation">
                  <FiCornerUpLeft size={30} />
                  <h3>Select a message</h3>
                  <p>Choose a conversation from the inbox to read and reply.</p>
                </div>
              ) : (
                <>
                  <div className="support-conversation-header">
                    <div>
                      <span className={`badge ${selected.status === 'open' ? 'badge-yellow' : 'badge-green'}`}>
                        {selected.status}
                      </span>
                      <h2>{selected.name}</h2>
                      <a href={`mailto:${selected.email}`}>{selected.email}</a>
                    </div>
                    {selected.status === 'resolved' && (
                      <button className="btn btn-secondary btn-sm" onClick={reopen}>
                        <FiRefreshCw /> Reopen
                      </button>
                    )}
                  </div>

                  <div className="support-thread">
                    <article className="support-thread-message sender">
                      <span>{selected.sender_role || 'guest'} message</span>
                      <p>{selected.message}</p>
                      <time>{formatDateTime(selected.created_at)}</time>
                    </article>
                    {(selected.replies || []).map((item, index) => (
                      <article className="support-thread-message admin" key={`${item.created_at}-${index}`}>
                        <span>Reply by {item.replied_by_name || 'Administrator'}</span>
                        <p>{item.message}</p>
                        <time>
                          {formatDateTime(item.created_at)} · {item.email_sent ? 'Email delivered' : 'Email not sent'}
                        </time>
                      </article>
                    ))}
                  </div>

                  <form className="support-reply-form" onSubmit={sendReply}>
                    <label htmlFor="support-reply">Reply to {selected.name}</label>
                    <textarea
                      id="support-reply"
                      value={reply}
                      onChange={(event) => setReply(event.target.value)}
                      placeholder="Write a professional support response..."
                      rows="5"
                      required
                    />
                    <div>
                      <small>The reply is stored and sent to {selected.email} when SMTP is configured.</small>
                      <button className="btn btn-primary" disabled={sending}>
                        {sending ? 'Sending…' : 'Send reply & resolve'} <FiCheckCircle />
                      </button>
                    </div>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
