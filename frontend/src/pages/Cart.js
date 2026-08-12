import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiShoppingBag, FiTrash2, FiArrowRight } from 'react-icons/fi';
import { useCart } from '../context/CartContext';
import { formatCurrency } from '../utils/helpers';
import CartItem from '../components/CartItem';

export default function Cart() {
  const { items, totalItems, totalAmount, updateQuantity, removeFromCart, clearCart, hasPrescriptionItems } = useCart();
  const navigate = useNavigate();

  const deliveryCharge = totalAmount >= 500 ? 0 : 49;
  const finalAmount = totalAmount + deliveryCharge;
  const sellerGroups = Object.values(items.reduce((groups,item)=>{const key=item.seller_id||'unknown';if(!groups[key])groups[key]={name:item.seller_name||'Seller',items:[],subtotal:0};groups[key].items.push(item);groups[key].subtotal+=(item.discount_price||item.price)*item.quantity;return groups;},{}));

  if (items.length === 0) {
    return (
      <div className="page-wrapper">
        <div className="container" style={{ paddingTop: 80, paddingBottom: 80 }}>
          <div className="empty-state">
            <FiShoppingBag size={80} />
            <h3>Your Cart is Empty</h3>
            <p>Looks like you haven't added any herbal products yet</p>
            <Link to="/shop" className="btn btn-primary">Browse Products</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-wrapper">
      <section className="section" style={{ paddingTop: '40px' }}>
        <div className="container">
          <div className="flex items-center justify-between mb-6">
            <strong className="customer-item-count">{totalItems} item{totalItems === 1 ? '' : 's'}</strong>
            <button className="btn-ghost text-sm" style={{ color: 'var(--red-500)' }} onClick={clearCart}>
              <FiTrash2 size={14} /> Clear Cart
            </button>
          </div>

          <div className="cart-layout">
            <div className="cart-items-col">
              {hasPrescriptionItems && (
                <div className="cart-rx-warning">
                  <span>⚠️ Some items in your cart require a prescription. Please <Link to="/prescriptions">upload it</Link> before checkout.</span>
                </div>
              )}
              {sellerGroups.map(group=><div className="admin-card mb-4" key={group.name}><h3>{group.name}</h3>
                {group.items.map(item=><CartItem key={item.medicine_id} item={item} onUpdateQty={updateQuantity} onRemove={removeFromCart}/>)}
                <div className="cart-summary-row"><b>Seller subtotal</b><b>{formatCurrency(group.subtotal)}</b></div></div>)}
            </div>

            <div className="cart-summary-col">
              <div className="cart-summary">
                <h3 className="cart-summary-title">Order Summary</h3>
                <div className="cart-summary-row">
                  <span>Subtotal ({totalItems} items)</span>
                  <span>{formatCurrency(totalAmount)}</span>
                </div>
                <div className="cart-summary-row">
                  <span>Delivery</span>
                  <span>{deliveryCharge === 0 ? <span className="text-green font-semibold">FREE</span> : formatCurrency(deliveryCharge)}</span>
                </div>
                {deliveryCharge > 0 && (
                  <p className="cart-free-hint">Add {formatCurrency(500 - totalAmount)} more for free delivery</p>
                )}
                <div className="divider" />
                <div className="cart-summary-row total">
                  <span>Total</span>
                  <span>{formatCurrency(finalAmount)}</span>
                </div>
                <button className="btn btn-primary btn-lg" style={{ width: '100%', marginTop: 20 }} onClick={() => navigate('/checkout')}>
                  Proceed to Checkout <FiArrowRight size={16} />
                </button>
                <Link to="/shop" className="btn btn-ghost btn-sm" style={{ width: '100%', marginTop: 8, textAlign: 'center' }}>
                  Continue Shopping
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
