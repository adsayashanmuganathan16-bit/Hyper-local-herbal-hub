import React, { useEffect, useState } from 'react';
import { FiCreditCard, FiLock, FiShield } from 'react-icons/fi';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { orderApi } from '../api/orderApi';
import { formatCurrency } from '../utils/helpers';
import Loading from '../components/Loading';
import './DemoPayment.css';

export default function DemoPayment() {
  const [params] = useSearchParams();
  const orderId = params.get('order_id');
  const navigate = useNavigate();
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [form, setForm] = useState({ card_holder_name: '', card_number: '', expiry_month: '', expiry_year: '', cvv: '' });

  useEffect(() => {
    if (!orderId) {
      toast.error('Missing demo payment order');
      navigate('/orders', { replace: true });
      return;
    }
    orderApi.getMockPayment(orderId)
      .then(({ data }) => {
        setDetails(data);
        if (data.payment_status === 'PAID') navigate(`/orders/${orderId}`, { replace: true });
      })
      .catch((error) => {
        toast.error(error.response?.data?.detail || 'Unable to load demo payment');
        navigate('/orders', { replace: true });
      })
      .finally(() => setLoading(false));
  }, [navigate, orderId]);

  const change = (event) => {
    let value = event.target.value;
    if (event.target.name === 'card_number') {
      value = value.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();
    } else if (['expiry_month', 'expiry_year', 'cvv'].includes(event.target.name)) {
      value = value.replace(/\D/g, '');
    }
    setForm((current) => ({ ...current, [event.target.name]: value }));
  };

  const submit = async (event) => {
    event.preventDefault();
    try {
      setPaying(true);
      await orderApi.payMock(orderId, {
        ...form,
        card_number: form.card_number.replace(/\s/g, ''),
        expiry_month: Number(form.expiry_month),
        expiry_year: Number(form.expiry_year),
      });
      toast.success('Demo payment successful!');
      navigate(`/orders/${orderId}?payment=success`, { replace: true });
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Demo payment failed.');
    } finally {
      setPaying(false);
    }
  };

  const cancel = async () => {
    try {
      setPaying(true);
      await orderApi.cancelOrder(orderId);
      toast.info('Demo payment cancelled.');
      navigate(`/orders/${orderId}`, { replace: true });
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Unable to cancel payment');
    } finally {
      setPaying(false);
    }
  };

  if (loading || !details) return <Loading text="Loading demo gateway..." />;

  return (
    <div className="demo-gateway-page">
      <div className="demo-gateway-shell">
        <div className="demo-banner"><FiShield /> Demo Payment Gateway - No real money will be charged.</div>
        <div className="demo-gateway-header">
          <div><span className="demo-kicker">Secure checkout</span><h1>{details.merchant_name}</h1></div>
          <FiLock size={24} />
        </div>
        <div className="demo-order-summary">
          <div><span>Order ID</span><strong>#{details.order_id}</strong></div>
          <div className="demo-amount"><span>Amount due</span><strong>{formatCurrency(details.amount)}</strong></div>
        </div>
        <form className="demo-card-form" onSubmit={submit} autoComplete="off">
          <label>Card Holder Name<input name="card_holder_name" value={form.card_holder_name} onChange={change} placeholder="Name on card" minLength="2" required /></label>
          <label>Card Number<div className="demo-card-input"><FiCreditCard /><input name="card_number" value={form.card_number} onChange={change} placeholder="4111 1111 1111 1111" inputMode="numeric" required /></div></label>
          <div className="demo-card-row">
            <label>Expiry Month<input name="expiry_month" value={form.expiry_month} onChange={change} placeholder="MM" inputMode="numeric" maxLength="2" required /></label>
            <label>Expiry Year<input name="expiry_year" value={form.expiry_year} onChange={change} placeholder="YYYY" inputMode="numeric" maxLength="4" required /></label>
            <label>CVV<input name="cvv" value={form.cvv} onChange={change} placeholder="123" inputMode="numeric" maxLength="4" type="password" required /></label>
          </div>
          <div className="demo-actions">
            <button type="button" className="btn btn-outline" onClick={cancel} disabled={paying}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={paying}>{paying ? 'Processing...' : `Pay ${formatCurrency(details.amount)}`}</button>
          </div>
        </form>
        <p className="demo-security"><FiLock /> Demo validation only. Card details are never stored.</p>
      </div>
    </div>
  );
}
