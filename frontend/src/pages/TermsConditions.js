import React from 'react';

const TERMS = [
  {
    title: 'Platform usage rules',
    content: 'The platform must be used only for lawful marketplace activities. Users must not misuse platform features, interfere with services, submit false information, or attempt unauthorized access.',
  },
  {
    title: 'Customer responsibilities',
    content: 'Customers must provide accurate contact and delivery information, review product details before ordering, make payments when due, and be available to receive deliveries at the agreed location.',
  },
  {
    title: 'Seller responsibilities',
    content: 'Sellers must offer lawful herbal products, maintain appropriate product quality, fulfil accepted orders promptly, communicate stock changes, and comply with applicable marketplace and consumer requirements.',
  },
  {
    title: 'Product information accuracy',
    content: 'Sellers are responsible for keeping product names, descriptions, ingredients, prices, stock status, and usage guidance accurate. Product information is educational and must not replace advice from a qualified healthcare professional.',
  },
  {
    title: 'Order and payment terms',
    content: 'An order is confirmed after successful checkout and any required payment authorization. Prices and applicable delivery charges are displayed before confirmation. Supported payment providers process online payments securely.',
  },
  {
    title: 'Delivery conditions',
    content: 'Local delivery is available only within supported service areas. Estimated delivery times may change due to seller preparation, customer availability, weather, traffic, or other circumstances outside the platform’s reasonable control.',
  },
  {
    title: 'Cancellation and refund rules',
    content: 'Cancellation requests should be made before an order is prepared or dispatched. Refund eligibility depends on order status, product condition, payment-provider rules, and whether an item is damaged, incorrect, or unavailable.',
  },
  {
    title: 'Account security responsibility',
    content: 'Users are responsible for keeping their login credentials confidential and for activity performed through their accounts. Suspected unauthorized access should be reported to customer support promptly.',
  },
];

export default function TermsConditions() {
  return (
    <div className="support-page">
      <header className="support-hero">
        <div className="container support-hero-inner">
          <span className="support-eyebrow">Marketplace agreement</span>
          <h1>Terms &amp; Conditions</h1>
          <p>
            These terms provide a clear and fair framework for customers, sellers, and
            other users of the Hyper-Local Herbal Hub marketplace.
          </p>
        </div>
      </header>

      <main className="container policy-content">
        <div className="policy-intro">
          <p>
            By creating an account or using this platform, you agree to use its services
            responsibly and follow the conditions set out below.
          </p>
          <span>Effective: July 2026</span>
        </div>

        <div className="terms-grid">
          {TERMS.map((term, index) => (
            <section className="term-card" key={term.title}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <h2>{term.title}</h2>
              <p>{term.content}</p>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
