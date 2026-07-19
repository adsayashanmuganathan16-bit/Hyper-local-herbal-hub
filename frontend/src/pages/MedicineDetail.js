import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { FiShoppingCart, FiHeart, FiShare2, FiAlertCircle, FiCheck, FiMinus, FiPlus } from 'react-icons/fi';
import { medicineApi } from '../api/medicineApi';
import { reviewApi } from '../api/reviewApi';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, formatDate, getDiscountPercent } from '../utils/helpers';
import ReviewStars from '../components/ReviewStars';
import MedicineCard from '../components/MedicineCard';
import Loading from '../components/Loading';
import { toast } from 'react-toastify';

const PLACEHOLDER_IMG = 'https://picsum.photos/seed/herb-detail/600/600.jpg';

export default function MedicineDetail() {
  const { id } = useParams();
  const { addToCart } = useCart();
  const { isAuthenticated } = useAuth();
  const [medicine, setMedicine] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [related, setRelated] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedImg, setSelectedImg] = useState(0);
  const [qty, setQty] = useState(1);

  useEffect(() => {
    async function fetch() {
      try {
        const { data: med } = await medicineApi.getById(id);
        setMedicine(med);
        setSelectedImg(0);

        const { data: revData } = await reviewApi.getByMedicine(id, { page: 1 });
        setReviews(revData.items || []);

        const { data: relData } = await medicineApi.search({ category: med.category, page: 1, page_size: 4 });
        setRelated((relData.items || []).filter((m) => m.id !== id));
      } catch (err) {
        toast.error('Failed to load product');
      } finally {
        setLoading(false);
      }
    }
    fetch();
  }, [id]);

  const handleAddToCart = () => {
    if (!isAuthenticated) return toast.info('Please login to add to cart');
    for (let i = 0; i < qty; i++) addToCart(medicine);
  };

  if (loading) return <Loading />;
  if (!medicine) return <div className="empty-state"><h3>Product Not Found</h3></div>;

  const images = medicine.images?.length > 0 ? medicine.images : [PLACEHOLDER_IMG];
  const hasDiscount = medicine.discount_price && medicine.discount_price < medicine.price;
  const discountPercent = getDiscountPercent(medicine.price, medicine.discount_price);
  const outOfStock = medicine.stock <= 0;

  return (
    <div className="page-wrapper">
      <section className="section" style={{ paddingTop: '40px' }}>
        <div className="container">
          {/* Breadcrumb */}
          <div className="breadcrumb">
            <Link to="/">Home</Link> <span>/</span>
            <Link to="/shop">Shop</Link> <span>/</span>
            <Link to={`/shop?category=${encodeURIComponent(medicine.category)}`}>{medicine.category?.replace(/_/g, ' ')}</Link> <span>/</span>
            <span className="breadcrumb-current">{medicine.name}</span>
          </div>

          {/* Product Detail */}
          <div className="detail-grid">
            {/* Images */}
            <div className="detail-images">
              <div className="detail-main-img">
                <img src={images[selectedImg]} alt={medicine.name} />
                {hasDiscount && <span className="detail-discount-badge">-{discountPercent}% OFF</span>}
              </div>
              {images.length > 1 && (
                <div className="detail-thumbs">
                  {images.map((img, i) => (
                    <button key={i} className={`detail-thumb ${i === selectedImg ? 'active' : ''}`} onClick={() => setSelectedImg(i)}>
                      <img src={img} alt="" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Info */}
            <div className="detail-info">
              <span className="detail-category">{medicine.category?.replace(/_/g, ' ')}</span>
              <h1 className="detail-name">{medicine.name}</h1>
              <div className="detail-rating-row">
                <ReviewStars rating={medicine.average_rating} size={18} />
                <span className="text-sm text-gray">{medicine.average_rating} ({medicine.review_count} reviews)</span>
              </div>

              <div className="detail-price-row">
                {hasDiscount ? (
                  <>
                    <span className="detail-price-now">{formatCurrency(medicine.discount_price)}</span>
                    <span className="detail-price-was">{formatCurrency(medicine.price)}</span>
                    <span className="detail-save">Save {formatCurrency(medicine.price - medicine.discount_price)}</span>
                  </>
                ) : (
                  <span className="detail-price-now">{formatCurrency(medicine.price)}</span>
                )}
              </div>

              {medicine.requires_prescription && (
                <div className="detail-rx-notice">
                  <FiAlertCircle size={18} />
                  <span>This product requires a valid prescription. <Link to="/prescriptions">Upload prescription</Link></span>
                </div>
              )}

              <p className="detail-desc">{medicine.description}</p>

              {medicine.benefits?.length > 0 && (
                <div className="detail-section">
                  <h3>Benefits</h3>
                  <ul className="detail-list">
                    {medicine.benefits.map((b, i) => <li key={i}><FiCheck size={14} /> {b}</li>)}
                  </ul>
                </div>
              )}

              {medicine.ingredients?.length > 0 && (
                <div className="detail-section">
                  <h3>Key Ingredients</h3>
                  <div className="detail-tags">
                    {medicine.ingredients.map((ing, i) => <span key={i} className="detail-tag">{ing}</span>)}
                  </div>
                </div>
              )}

              <div className="detail-meta">
                <div className="detail-meta-item">
                  <span className="detail-meta-label">Manufacturer</span>
                  <span className="detail-meta-value">{medicine.manufacturer}</span>
                </div>
                {medicine.dosage && (
                  <div className="detail-meta-item">
                    <span className="detail-meta-label">Dosage</span>
                    <span className="detail-meta-value">{medicine.dosage}</span>
                  </div>
                )}
                <div className="detail-meta-item">
                  <span className="detail-meta-label">Availability</span>
                  <span className={`detail-meta-value ${outOfStock ? 'text-red' : 'text-green'}`}>
                    {outOfStock ? 'Out of Stock' : `In Stock (${medicine.stock} left)`}
                  </span>
                </div>
              </div>

              {/* Add to Cart */}
              <div className="detail-actions">
                <div className="qty-control" style={{ transform: 'none' }}>
                  <button className="qty-btn" onClick={() => setQty(Math.max(1, qty - 1))}><FiMinus size={14} /></button>
                  <span className="qty-value">{qty}</span>
                  <button className="qty-btn" onClick={() => setQty(qty + 1)}><FiPlus size={14} /></button>
                </div>
                <button className="btn btn-primary btn-lg" onClick={handleAddToCart} disabled={outOfStock}>
                  <FiShoppingCart size={18} /> {outOfStock ? 'Out of Stock' : 'Add to Cart'}
                </button>
              </div>
            </div>
          </div>

          {/* Reviews Section */}
          <div className="detail-reviews mt-8">
            <h2 className="section-title" style={{ fontSize: 28 }}>Customer Reviews</h2>
            {reviews.length === 0 ? (
              <div className="empty-state" style={{ padding: 40 }}>
                <h3>No Reviews Yet</h3>
                <p>Be the first to review this product</p>
              </div>
            ) : (
              <div className="reviews-list">
                {reviews.map((r) => (
                  <div key={r.id} className="review-card">
                    <div className="review-header">
                      <span className="font-semibold">{r.user_name}</span>
                      <ReviewStars rating={r.rating} size={14} />
                      <span className="text-gray text-xs">{formatDate(r.created_at)}</span>
                    </div>
                    {r.title && <h4 className="review-title">{r.title}</h4>}
                    <p className="review-comment">{r.comment}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Related Products */}
          {related.length > 0 && (
            <div className="mt-8">
              <h2 className="section-title" style={{ fontSize: 28, marginBottom: 24 }}>Related Products</h2>
              <div className="grid-4">
                {related.map((med) => <MedicineCard key={med.id} medicine={med} />)}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
