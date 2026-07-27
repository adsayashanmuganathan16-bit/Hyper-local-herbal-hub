import React, { useState } from 'react';
import { FiStar } from 'react-icons/fi';
import { toast } from 'react-toastify';
import { reviewApi } from '../api/reviewApi';

export default function ReviewForm({ orderId, item, onSubmitted, onCancel }) {
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    if (!rating) return toast.info('Choose a star rating');
    if (comment.trim().length < 5) return toast.info('Write at least 5 characters');
    setSubmitting(true);
    try {
      const { data } = await reviewApi.create({
        medicine_id: item.medicine_id,
        order_id: orderId,
        rating,
        title: title.trim() || null,
        comment: comment.trim(),
      });
      toast.success('Thank you for your review');
      onSubmitted({ ...data, medicine_id: item.medicine_id, order_id: orderId, rating, title, comment });
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Could not submit review');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="order-review-form" onSubmit={submit}>
      <div className="order-review-heading">
        <div>
          <strong>Review {item.name}</strong>
          <p>Your feedback helps other customers.</p>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button>
      </div>
      <div className="review-star-input" aria-label="Choose a rating">
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            type="button"
            key={value}
            aria-label={`${value} star${value > 1 ? 's' : ''}`}
            onMouseEnter={() => setHovered(value)}
            onMouseLeave={() => setHovered(0)}
            onFocus={() => setHovered(value)}
            onBlur={() => setHovered(0)}
            onClick={() => setRating(value)}
          >
            <FiStar className={value <= (hovered || rating) ? 'active' : ''} size={25} />
          </button>
        ))}
        <span>{rating ? `${rating}/5` : 'Select rating'}</span>
      </div>
      <input
        className="form-input"
        value={title}
        maxLength={100}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Review title (optional)"
      />
      <textarea
        className="form-input"
        value={comment}
        minLength={5}
        maxLength={1000}
        required
        rows={3}
        onChange={(event) => setComment(event.target.value)}
        placeholder="Share your experience with this product"
      />
      <button className="btn btn-primary btn-sm" disabled={submitting}>
        {submitting ? 'Submitting…' : 'Submit Review'}
      </button>
    </form>
  );
}
