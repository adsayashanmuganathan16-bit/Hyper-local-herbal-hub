import React, { useEffect, useRef, useState } from 'react';
import { FiHeart, FiTrash2 } from 'react-icons/fi';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import MedicineCard from '../components/MedicineCard';
import Loading from '../components/Loading';
import { wishlistApi } from '../api/wishlistApi';
import { replaceWishlist, wishlistIds } from '../utils/wishlist';
import './Wishlist.css';

export default function Wishlist() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const loadSequence = useRef(0);

  const load = async () => {
    const sequence = ++loadSequence.current;
    try {
      const { data } = await wishlistApi.get();
      if (sequence !== loadSequence.current) return;
      const products = data.items || [];
      setItems(products);
      replaceWishlist(products.map((item) => item.id), false);
    } catch (error) {
      if (sequence !== loadSequence.current) return;
      toast.error(error.response?.data?.detail || 'Unable to load your wishlist');
    } finally {
      if (sequence === loadSequence.current) setLoading(false);
    }
  };

  useEffect(() => {
    const initialize = async () => {
      await Promise.all(wishlistIds().map((id) => wishlistApi.add(id).catch(() => null)));
      await load();
    };
    initialize();
  }, []);
  useEffect(() => {
    const refresh = () => load();
    window.addEventListener('herbal:wishlist-synced', refresh);
    return () => window.removeEventListener('herbal:wishlist-synced', refresh);
  }, []);

  const clear = async () => {
    try {
      await wishlistApi.clear();
      replaceWishlist([]);
      setItems([]);
      toast.success('Wishlist cleared');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Unable to clear wishlist');
    }
  };

  if (loading) return <Loading />;
  return <div className="page-wrapper"><section className="dashboard-page wishlist-page"><div className="container">
    {!!items.length && <div className="customer-page-actions"><button className="btn btn-secondary" onClick={clear}><FiTrash2 /> Clear Wishlist</button></div>}
    {items.length ? <div className="wishlist-grid">{items.map((item) => <MedicineCard key={item.id} medicine={item} />)}</div> : <div className="empty-state"><FiHeart size={38} /><h2>Your wishlist is empty</h2><p>Tap the heart on a product to save it here.</p><Link className="btn btn-primary" to="/shop">Browse products</Link></div>}
  </div></section></div>;
}
