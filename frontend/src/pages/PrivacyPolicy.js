import React from 'react';
import { FiCreditCard, FiDatabase, FiLock, FiSettings } from 'react-icons/fi';

const SECTIONS = [
  {
    icon: FiDatabase,
    title: 'Information we collect',
    text: 'We collect only the information needed to provide and support our herbal marketplace services.',
    items: ['User name', 'Email', 'Phone number', 'Delivery address', 'Order information'],
  },
  {
    icon: FiSettings,
    title: 'How we use information',
    text: 'The information collected through Hyper-Local Herbal Hub is used to:',
    items: [
      'Process customer orders',
      'Manage customer and seller accounts',
      'Improve platform services',
      'Provide order and delivery updates',
    ],
  },
  {
    icon: FiLock,
    title: 'Data protection',
    text: 'User information is securely stored and protected using appropriate technical and organizational safeguards.',
    items: [
      'Personal information is not shared with third parties without permission, except where required to provide an agreed service or comply with the law.',
      'Access to personal information is limited to authorized platform operations.',
    ],
  },
  {
    icon: FiCreditCard,
    title: 'Payment information',
    text: 'Payment details are handled securely through supported payment providers. Hyper-Local Herbal Hub does not intentionally store complete card or banking credentials on the platform.',
  },
];

export default function PrivacyPolicy() {
  return (
    <div className="support-page">
      <header className="support-hero">
        <div className="container support-hero-inner">
          <span className="support-eyebrow">Your information matters</span>
          <h1>Privacy Policy</h1>
        </div>
      </header>

      <main className="container policy-content">
        <div className="policy-sections">
          {SECTIONS.map(({ icon: Icon, title, text, items }, index) => (
            <section className="policy-section" key={title}>
              <div className="policy-section-icon"><Icon /></div>
              <div>
                <span className="policy-number">{String(index + 1).padStart(2, '0')}</span>
                <h2>{title}</h2>
                <p>{text}</p>
                {items && (
                  <ul>
                    {items.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                )}
              </div>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
