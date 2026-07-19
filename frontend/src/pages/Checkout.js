import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiCreditCard, FiTruck, FiDollarSign } from 'react-icons/fi';
import { useCart } from '../context/CartContext';
import { orderApi } from '../api/orderApi';
import { formatCurrency } from '../utils/helpers';
import { toast } from 'react-toastify';
import Loading from '../components/Loading';

export default function Checkout() {
  const { items, totalItems, totalAmount, hasPrescriptionItems, fetchCart } = useCart();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: '', phone: '', address_line1: '', address_line2: '', city: '', state: '', pincode: '',
    payment_method: 'cod',
  });

  if (items.length === 0) {
    navigate('/cart');
    return null;
  }

  const deliveryCharge = totalAmount >= 500 ? 0 : 49;
  const finalAmount = totalAmount + deliveryCharge;

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    const required = ['name', 'phone', 'address_line1', 'city', 'state', 'pincode'];
    for (const field of required) {
      if (!form[field]) return toast.error(`Please fill ${field.replace(/_/g, ' ')}`);
    }

    try {
      setLoading(true);
      const orderData = {
        items: items.map((i) => ({
          medicine_id: i.medicine_id,
          name: i.name,
          price: i.price,
          quantity: i.quantity,
          image: i.image,
        })),
        address: { ...form },
        payment_method: form.payment_method,
      };
      const { data } = await orderApi.createOrder(orderData);

      if (data.payment_client_secret) {
        // Redirect to payment page or handle Stripe
        toast.success('Please complete the payment');
        // In production, redirect to Stripe checkout
      } else {
        toast.success('Order placed successfully!');
        await fetchCart();
        navigate(`/orders/${data.order_id}`);
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Order failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-wrapper">
      <section className="section" style={{ paddingTop: '40px' }}>
        <div className="container">
          <h1 className="section-title mb-6">Checkout</h1>

          <form onSubmit={handleSubmit}>
            <div className="checkout-layout">
              <div className="checkout-form-col">
                {/* Address */}
                <div className="checkout-section">
                  <h3 className="checkout-section-title"><FiTruck size={18} /> Delivery Address</h3>
                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">Full Name *</label>
                      <input name="name" className="form-input" value={form.name} onChange={handleChange} placeholder="John Doe" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Phone Number *</label>
                      <input name="phone" className="form-input" value={form.phone} onChange={handleChange} placeholder="+91 98765 43210" />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Address Line 1 *</label>
                    <input name="address_line1" className="form-input" value={form.address_line1} onChange={handleChange} placeholder="House/Flat No., Street" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Address Line 2</label>
                    <input name="address_line2" className="form-input" value={form.address_line2} onChange={handleChange} placeholder="Landmark, Area" />
                  </div>
                  <div className="grid-3">
                    <div className="form-group">
                      <label className="form-label">City *</label>
                      <input name="city" className="form-input" value={form.city} onChange={handleChange} placeholder="City" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">State *</label>
                      <input name="state" className="form-input" value={form.state} onChange={handleChange} placeholder="State" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Pincode *</label>
                      <input name="pincode" className="form-input" value={form.pincode} onChange={handleChange} placeholder="560001" />
                    </div>
                  </div>
                </div>

                {/* Payment */}
                <div className="checkout-section">
                  <h3 className="checkout-section-title"><FiCreditCard size={18} /> Payment Method</h3>
                  <div className="payment-options">
                    {[
                      { value: 'cod', label: 'Cash on Delivery', desc: 'Pay when your order arrives' },
                      { value: 'card', label: 'Credit/Debit Card', desc: 'Secure payment via Stripe' },
                      { value: 'upi', label: 'UPI Payment', desc: 'GPay, PhonePe, Paytm' },
                    ].map((opt) => (
                      <label key={opt.value} className={`payment-option ${form.payment_method === opt.value ? 'selected' : ''}`}>
                        <input type="radio" name="payment_method" value={opt.value} checked={form.payment_method === opt.value} onChange={handleChange} />
                        <div>
                          <span className="font-semibold">{opt.label}</span>
                          <span className="text-gray text-xs">{opt.desc}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* Order Summary Sidebar */}
              <div className="checkout-summary-col">
                <div className="cart-summary">
                  <h3 className="cart-summary-title">Order Summary</h3>
                  {items.map((item) => (
                    <div key={item.medicine_id} className="checkout-item">
                      <div className="checkout-item-info">
                        <span className="text-sm font-medium">{item.name}</span>
                        <span className="text-xs text-gray">Qty: {item.quantity}</span>
                      </div>
                      <span className="text-sm font-semibold">{formatCurrency((item.discount_price || item.price) * item.quantity)}</span>
                    </div>
                  ))}
                  <div className="divider" />
                  <div className="cart-summary-row">
                    <span>Subtotal</span><span>{formatCurrency(totalAmount)}</span>
                  </div>
                  <div className="cart-summary-row">
                    <span>Delivery</span>
                    <span>{deliveryCharge === 0 ? <span className="text-green font-semibold">FREE</span> : formatCurrency(deliveryCharge)}</span>
                  </div>
                  <div className="divider" />
                  <div className="cart-summary-row total">
                    <span>Total</span><span>{formatCurrency(finalAmount)}</span>
                  </div>
                  <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%', marginTop: 20 }} disabled={loading}>
                    {loading ? <Loading text="Placing Order..." /> : `Place Order • ${formatCurrency(finalAmount)}`}
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}
