import React from 'react';
import { FiTrash2, FiMinus, FiPlus, FiAlertCircle } from 'react-icons/fi';
import { formatCurrency } from '../utils/helpers';
import { productImageUrl, useProductImageFallback } from '../utils/productImage';

export default function CartItem({ item, onUpdateQty, onRemove }) {
  const price = item.discount_price || item.price;

  return (
    <div className="cart-item">
      <img src={productImageUrl(item)} alt={item.name} className="cart-item-img" onError={useProductImageFallback} />
      <div className="cart-item-info">
        <h4 className="cart-item-name">{item.name}</h4>
        {item.requires_prescription && (
          <span className="cart-item-rx"><FiAlertCircle size={12} /> Prescription Required</span>
        )}
        <div className="cart-item-price">
          {item.discount_price ? (
            <>
              <span className="price-now">{formatCurrency(item.discount_price)}</span>
              <span className="price-was">{formatCurrency(item.price)}</span>
            </>
          ) : (
            <span className="price-now">{formatCurrency(item.price)}</span>
          )}
        </div>
      </div>
      <div className="cart-item-actions">
        <div className="qty-control">
          <button className="qty-btn" onClick={() => onUpdateQty(item.medicine_id, item.quantity - 1)} disabled={item.quantity <= 1}>
            <FiMinus size={14} />
          </button>
          <span className="qty-value">{item.quantity}</span>
          <button className="qty-btn" onClick={() => onUpdateQty(item.medicine_id, item.quantity + 1)}>
            <FiPlus size={14} />
          </button>
        </div>
        <div className="cart-item-total">{formatCurrency(price * item.quantity)}</div>
        <button className="cart-item-remove" onClick={() => onRemove(item.medicine_id)}>
          <FiTrash2 size={16} />
        </button>
      </div>
    </div>
  );
}
