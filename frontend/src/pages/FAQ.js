import React, { useState } from 'react';
import { ChevronDown, CircleHelp, CreditCard, PackageCheck, Search, ShieldCheck, Truck } from 'lucide-react';
import { Link } from 'react-router-dom';

const FAQS = [
  ['How do I know sellers are trustworthy?', 'Seller accounts are reviewed before they can trade. Product ownership and fulfilment are tracked through the platform.'],
  ['How are online payments protected?', 'Card payments use Stripe Checkout. Herbal Hub never stores your complete card details, and payment status is confirmed securely by signed webhooks.'],
  ['Where do you currently deliver?', 'Availability is validated from your delivery pin during checkout. The initial service area is Kilinochchi District and can be expanded by administrators.'],
  ['Can I track my order?', 'Yes. Open My Orders to view seller preparation, courier details, tracking numbers, delivery progress, and live location when available.'],
  ['Can I cancel an order?', 'Eligible orders can be cancelled before fulfilment advances. Paid or dispatched orders may require support and payment-provider review.'],
  ['Do prescription products require approval?', 'Yes. Upload your prescription and wait for administrator approval before checking out with a prescription-only product.'],
  ['How can I become a seller?', 'Choose Become a Seller, submit your business and payment details, and wait for marketplace approval.'],
];

export default function FAQ() {
  const [query,setQuery]=useState('');
  const [open,setOpen]=useState(0);
  const filtered=FAQS.filter(([title,answer])=>`${title} ${answer}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="support-page premium-info-page">
    <header className="support-hero"><div className="container support-hero-inner"><span className="support-eyebrow">Help centre</span><h1>Answers for healthier shopping.</h1><p>Find quick guidance about products, payments, delivery, prescriptions, and seller accounts.</p><label className="faq-search"><Search /><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search frequently asked questions" aria-label="Search frequently asked questions"/></label></div></header>
    <main className="container premium-info-content">
      <div className="faq-topics"><span><PackageCheck/>Orders</span><span><CreditCard/>Payments</span><span><Truck/>Delivery</span><span><ShieldCheck/>Trust</span></div>
      <section className="faq-list">{filtered.map(([title,answer],index)=><article className={open===index?'open':''} key={title}><button onClick={()=>setOpen(open===index?-1:index)} aria-expanded={open===index}><span><CircleHelp/>{title}</span><ChevronDown/></button>{open===index&&<p>{answer}</p>}</article>)}</section>
      {!filtered.length&&<div className="empty-state"><CircleHelp/><h3>No matching answers</h3><p>Try another search or contact our support team.</p></div>}
      <div className="faq-contact"><div><h2>Still need a hand?</h2><p>Our local support team is ready to help.</p></div><Link to="/contact" className="btn btn-primary">Contact support</Link></div>
    </main>
  </div>;
}
