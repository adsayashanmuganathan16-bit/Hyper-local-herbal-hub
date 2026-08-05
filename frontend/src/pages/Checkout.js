import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiCreditCard, FiTruck, FiDollarSign } from 'react-icons/fi';
import { useCart } from '../context/CartContext';
import { orderApi } from '../api/orderApi';
import { formatCurrency } from '../utils/helpers';
import { toast } from 'react-toastify';
import Loading from '../components/Loading';
import { useAuth } from '../context/AuthContext';
import { prescriptionApi } from '../api/prescriptionApi';
import { serviceAreaApi } from '../api/serviceAreaApi';
import PinDropMap from '../components/PinDropMap';
import { formatParcelWeight, parcelWeight, sriLankaPostFee } from '../utils/shipping';

export default function Checkout() {
  const { items, totalItems, totalAmount, hasPrescriptionItems, fetchCart } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: user?.name || '', phone: user?.phone || '', address_line1: user?.address?.address_line1 || '',
    address_line2: user?.address?.address_line2 || '', city: user?.address?.city || '',
    state: user?.address?.state || '', pincode: user?.address?.pincode || '',
    street: '', area: '', landmark: '', delivery_note: '', payment_method: '', prescription_id: '',
  });
  const [approvedPrescriptions, setApprovedPrescriptions] = useState([]);
  const [serviceability, setServiceability] = useState(null);
  const [mapCenter, setMapCenter] = useState(null);
  const [pin, setPin] = useState(null);

  useEffect(() => { serviceAreaApi.active().then(({data}) => setMapCenter({lat:data.center_latitude,lng:data.center_longitude})).catch(()=>{}); }, []);

  useEffect(() => {
    if (!hasPrescriptionItems) return;
    prescriptionApi.getMyPrescriptions({ page: 1, status: 'approved' })
      .then(({ data }) => setApprovedPrescriptions((data.items || []).filter((rx) => rx.status === 'approved')))
      .catch(() => setApprovedPrescriptions([]));
  }, [hasPrescriptionItems]);

  if (items.length === 0) {
    navigate('/cart');
    return null;
  }

  const totalParcelWeight = parcelWeight(items);
  const shippingFee = sriLankaPostFee(totalParcelWeight);
  const finalAmount = totalAmount + (shippingFee || 0);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const selectPin = async (location, geolocationError) => {
    if (!location) { toast.error(geolocationError || 'Could not get your location'); return; }
    setPin(location); setServiceability({ checking: true });
    try { const {data}=await serviceAreaApi.validateLocation(location.lat,location.lng); const address=data.address||{};
      setForm(value=>({...value,address_line1:address.address_line1||'',address_line2:address.area||'',street:address.street||'',area:address.area||'',city:address.city||'',state:address.state||'',pincode:address.pincode||''}));
      setServiceability({ok:true,name:data.service_area_name});
    } catch(error) { const message=error.response?.data?.detail||'Delivery location could not be validated';setServiceability({ok:false,message});toast.error(message); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const required = ['name', 'phone', 'address_line1', 'city', 'state', 'pincode'];
    for (const field of required) {
      if (!form[field]) return toast.error(`Please fill ${field.replace(/_/g, ' ')}`);
    }
    const normalizedPhone = form.phone.replace(/[\s-]/g, '').replace(/^\+94/, '0').replace(/^94/, '0');
    if (!/^0\d{9}$/.test(normalizedPhone)) return toast.error('Enter a valid Sri Lankan phone number');
    if (!/^\d{5}$/.test(form.pincode.trim())) return toast.error('Enter a valid 5-digit Sri Lankan postal code');
    if (hasPrescriptionItems && !form.prescription_id) {
      return toast.error('Please select an approved prescription');
    }
    if (!form.payment_method) return toast.error('Please select a payment method');
    if (!pin || !serviceability?.ok) return toast.error('Select a delivery pin inside the available service area');
    if (shippingFee == null) return toast.error('Sri Lanka Post supports parcels up to 2 kg. Please reduce your cart weight.');

    try {
      setLoading(true);
      const address = {
        name: form.name.trim(), phone: normalizedPhone, address_line1: form.address_line1.trim(),
        address_line2: form.address_line2.trim(), city: form.city.trim(), state: form.state.trim(),
        pincode: form.pincode.trim(),
      };
      const orderData = {
        items: items.map((i) => ({
          medicine_id: i.medicine_id,
          name: i.name,
          price: i.price,
          quantity: i.quantity,
          image: i.image,
        })),
        address,
        customer_address: {...address,street:form.street,area:form.area},
        customer_latitude: pin.lat,
        customer_longitude: pin.lng,
        landmark: form.landmark.trim() || null,
        delivery_note: form.delivery_note.trim() || null,
        payment_method: form.payment_method,
        prescription_id: form.prescription_id || null,
      };
      const { data } = await orderApi.createOrder(orderData);

      if (data.payment_request) {
        toast.info(data.payment_request.provider === 'stripe'
          ? 'Redirecting to secure Stripe Checkout…'
          : 'Redirecting to the payment gateway…');
        window.location.assign(data.payment_request.checkout_url);
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
          <nav className="checkout-progress" aria-label="Checkout progress">
            <span className="complete"><b>1</b><small>Cart</small></span>
            <i />
            <span className="active"><b>2</b><small>Delivery &amp; payment</small></span>
            <i />
            <span><b>3</b><small>Confirmation</small></span>
          </nav>
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
                      <input name="name" className="form-input" value={form.name} onChange={handleChange} placeholder="Full recipient name" autoComplete="name" required minLength="2" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Phone Number *</label>
                      <input name="phone" className="form-input" value={form.phone} onChange={handleChange} placeholder="077 123 4567" autoComplete="tel" inputMode="tel" required />
                    </div>
                  </div>
                  {mapCenter ? <PinDropMap center={mapCenter} position={pin} onSelect={selectPin}/> : <Loading text="Loading delivery map…"/>}
                  {serviceability && <p className={serviceability.ok ? 'text-green' : 'text-danger'}>{serviceability.checking ? 'Checking delivery availability…' : serviceability.ok ? 'Delivery Available' : serviceability.message}</p>}
                  <div className="form-group">
                    <label className="form-label">Address *</label>
                    <input name="address_line1" className="form-input" value={form.address_line1} onChange={handleChange} placeholder="Selected address" required />
                  </div>
                  <div className="grid-3">
                    <div className="form-group"><label className="form-label">Street</label><input name="street" className="form-input" value={form.street} onChange={handleChange}/></div>
                    <div className="form-group"><label className="form-label">Area</label><input name="area" className="form-input" value={form.area} onChange={handleChange}/></div>
                    <div className="form-group">
                      <label className="form-label">City *</label>
                      <input name="city" className="form-input" value={form.city} onChange={handleChange} placeholder="City" autoComplete="address-level2" required />
                    </div>
                    <div className="form-group">
                      <label className="form-label">State *</label>
                      <input name="state" className="form-input" value={form.state} onChange={handleChange} placeholder="Province" autoComplete="address-level1" required />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Pincode *</label>
                      <input name="pincode" className="form-input" value={form.pincode} onChange={handleChange} placeholder="Five-digit postal code" autoComplete="postal-code" inputMode="numeric" pattern="[0-9]{5}" maxLength="5" required />
                    </div>
                  </div>
                  <div className="grid-2"><div className="form-group"><label className="form-label">Landmark</label><input name="landmark" className="form-input" value={form.landmark} onChange={handleChange} placeholder="Nearby landmark"/></div><div className="form-group"><label className="form-label">Delivery Note</label><input name="delivery_note" className="form-input" value={form.delivery_note} onChange={handleChange} placeholder="Gate, floor or contact instructions"/></div></div>
                </div>

                {hasPrescriptionItems && (
                  <div className="checkout-section">
                    <h3 className="checkout-section-title">Approved Prescription</h3>
                    {approvedPrescriptions.length ? (
                      <select name="prescription_id" className="form-input" value={form.prescription_id} onChange={handleChange} required>
                        <option value="">Select a prescription</option>
                        {approvedPrescriptions.map((rx) => <option key={rx.id} value={rx.id}>{rx.file_name}</option>)}
                      </select>
                    ) : (
                      <p className="text-gray">No approved prescription is available. Upload one and wait for admin approval before checkout.</p>
                    )}
                  </div>
                )}

                {/* Payment */}
                <div className="checkout-section">
                  <h3 className="checkout-section-title"><FiCreditCard size={18} /> Payment Method</h3>
                  <div className="payment-options">
                    {[
                      { value: 'cod', label: 'Cash on Delivery', desc: 'Pay when your order arrives' },
                      { value: 'stripe', label: 'Card Payment', desc: 'Secure payment powered by Stripe' },
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
                  <p className="text-gray text-xs mt-2">{form.payment_method === 'cod' ? 'Payment remains pending until the courier delivers the order and collects cash.' : 'You will continue to Stripe Checkout to pay securely.'}</p>
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
                        <span className="text-xs text-gray">Qty: {item.quantity} · {formatParcelWeight(Number(item.weight_grams || 0) * item.quantity)}</span>
                      </div>
                      <span className="text-sm font-semibold">{formatCurrency((item.discount_price || item.price) * item.quantity)}</span>
                    </div>
                  ))}
                  <div className="divider" />
                  <div className="cart-summary-row">
                    <span>Product Total</span><span>{formatCurrency(totalAmount)}</span>
                  </div>
                  <div className="cart-summary-row">
                    <span>Parcel Weight</span>
                    <span>{formatParcelWeight(totalParcelWeight)}</span>
                  </div>
                  <div className="cart-summary-row">
                    <span>Shipping Fee</span>
                    <span>{shippingFee == null ? <span className="text-danger">Over 2 kg</span> : formatCurrency(shippingFee)}</span>
                  </div>
                  <div className="divider" />
                  <div className="cart-summary-row total">
                    <span>Grand Total</span><span>{formatCurrency(finalAmount)}</span>
                  </div>
                  <p className="checkout-postal-note">Sri Lanka Post weight-based shipping</p>
                  <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%', marginTop: 20 }} disabled={loading || shippingFee == null || !serviceability?.ok || (hasPrescriptionItems && !approvedPrescriptions.length)}>
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
