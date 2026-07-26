import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { FiShoppingCart, FiAlertCircle } from 'react-icons/fi';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, getDiscountPercent, truncateText } from '../utils/helpers';
import { toast } from 'react-toastify';
import ReviewStars from './ReviewStars';

const PLACEHOLDER_IMG = 'https://picsum.photos/seed/herb-placeholder/400/400.jpg';

export default function MedicineCard({ medicine }) {
  const { addToCart } = useCart();
  const { isAuthenticated, isCustomer } = useAuth();
  const [adding, setAdding] = useState(false);

  const image = medicine.images?.[0] || PLACEHOLDER_IMG;
  const hasDiscount = medicine.discount_price && medicine.discount_price < medicine.price;
  const discountPercent = getDiscountPercent(medicine.price, medicine.discount_price);
  const outOfStock = medicine.stock <= 0;

  const handleAdd = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isAuthenticated) {
      toast.info('Please login to add items to cart');
      return;
    }
    if (!isCustomer) { toast.info('Only customer accounts can add products to a cart'); return; }
    if (outOfStock) return;
    setAdding(true);
    await addToCart(medicine);
    setAdding(false);
  };

  return (
    <Link to={`/medicine/${medicine.id}`} className="med-card">
      <div className="med-card-img-wrap">
        <img src={image} alt={medicine.name} className="med-card-img" loading="lazy" />
        {hasDiscount && <span className="med-card-discount">-{discountPercent}%</span>}
        {medicine.requires_prescription && (
          <span className="med-card-rx">
            <FiAlertCircle size={12} /> Rx
          </span>
        )}
        {outOfStock && <div className="med-card-oots">Out of Stock</div>}
      </div>
      <div className="med-card-body">
        <span className="med-card-category">{medicine.category?.replace(/_/g, ' ')}</span>
        <h3 className="med-card-name">{medicine.name}</h3>
        {medicine.seller?.name && <p className="text-xs text-green">Sold by {medicine.seller.name}</p>}
        <p className="med-card-desc">{truncateText(medicine.description, 60)}</p>
        <div className="med-card-rating">
          <ReviewStars rating={medicine.average_rating} size={14} />
          <span className="med-card-review-count">({medicine.review_count || 0})</span>
        </div>
        <div className="med-card-bottom">
          <div className="med-card-price">
            {hasDiscount ? (
              <>
                <span className="med-card-price-now">{formatCurrency(medicine.discount_price)}</span>
                <span className="med-card-price-was">{formatCurrency(medicine.price)}</span>
              </>
            ) : (
              <span className="med-card-price-now">{formatCurrency(medicine.price)}</span>
            )}
          </div>
          <button
            className={`med-card-add ${outOfStock ? 'disabled' : ''}`}
            onClick={handleAdd}
            disabled={outOfStock || adding}
            aria-label={adding ? `Adding ${medicine.name}` : `Add ${medicine.name} to cart`}
          >
            <FiShoppingCart size={16} />
          </button>
        </div>
      </div>
    </Link>
  );
}
