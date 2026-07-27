import React, { useEffect, useState } from 'react';
import { reviewApi } from '../api/reviewApi';
import ReviewStars from '../components/ReviewStars';
import Loading from '../components/Loading';
import { formatDateTime } from '../utils/helpers';

export default function Reviews({ sellerMode = false }) {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const request = sellerMode ? reviewApi.getSellerReviews : reviewApi.getAll;
    request({ page: 1, page_size: 100 })
      .then(({ data }) => setReviews(data.items || []))
      .catch(() => setReviews([]))
      .finally(() => setLoading(false));
  }, [sellerMode]);

  const average = reviews.length
    ? (reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length).toFixed(1)
    : '0.0';

  return (
    <div className="page-wrapper">
      <section className="dashboard-page">
        <div className="container">
          <div className="dashboard-header">
            <div className="dashboard-header-copy">
              <span className="dashboard-eyebrow">{sellerMode ? 'Product feedback' : 'Marketplace feedback'}</span>
              <h1 className="dashboard-title">Customer Reviews</h1>
              <p className="dashboard-subtitle">
                {sellerMode ? 'Ratings and reviews for products supplied by your store.' : 'Customer ratings and reviews across all products.'}
              </p>
            </div>
          </div>

          {loading ? <Loading /> : (
            <>
              <div className="review-summary">
                <div><strong>{reviews.length}</strong><span>Total reviews</span></div>
                <div><strong>{average}</strong><span>Average rating</span></div>
              </div>
              <div className="admin-card review-management-list">
                {reviews.length === 0 ? (
                  <div className="empty-state"><h3>No Reviews Yet</h3><p>Customer reviews will appear here.</p></div>
                ) : reviews.map((review) => (
                  <article className="management-review" key={review.id}>
                    <div className="management-review-top">
                      <div>
                        <h3>{review.medicine_name}</h3>
                        <span>{review.user_name} · {formatDateTime(review.created_at)}</span>
                      </div>
                      <ReviewStars rating={review.rating} size={17} />
                    </div>
                    {review.title && <h4>{review.title}</h4>}
                    <p>{review.comment}</p>
                    <small>Order #{review.order_id?.slice(0, 8).toUpperCase()}</small>
                  </article>
                ))}
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
