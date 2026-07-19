import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { cartApi } from '../api/cartApi';
import { useAuth } from './AuthContext';
import { toast } from 'react-toastify';

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [items, setItems] = useState([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchCart = useCallback(async () => {
    if (!isAuthenticated) {
      setItems([]);
      setTotalItems(0);
      setTotalAmount(0);
      return;
    }
    try {
      setLoading(true);
      const { data } = await cartApi.getCart();
      setItems(data.items || []);
      setTotalItems(data.total_items || 0);
      setTotalAmount(data.total_amount || 0);
    } catch (err) {
      console.error('Cart fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  const addToCart = async (medicine) => {
    try {
      const { data } = await cartApi.addToCart({
        medicine_id: medicine.id || medicine._id,
        name: medicine.name,
        price: medicine.price,
        discount_price: medicine.discount_price,
        quantity: 1,
        image: medicine.images?.[0],
        requires_prescription: medicine.requires_prescription,
      });
      setItems(data.totals ? [...items] : items); // triggers re-fetch on next cycle
      await fetchCart();
      toast.success(`${medicine.name} added to cart`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to add to cart');
    }
  };

  const updateQuantity = async (medicineId, quantity) => {
    try {
      await cartApi.updateItem(medicineId, { quantity });
      await fetchCart();
    } catch (err) {
      toast.error('Failed to update cart');
    }
  };

  const removeFromCart = async (medicineId) => {
    try {
      await cartApi.removeItem(medicineId);
      await fetchCart();
      toast.success('Item removed from cart');
    } catch (err) {
      toast.error('Failed to remove item');
    }
  };

  const clearCart = async () => {
    try {
      await cartApi.clearCart();
      setItems([]);
      setTotalItems(0);
      setTotalAmount(0);
    } catch (err) {
      toast.error('Failed to clear cart');
    }
  };

  const hasPrescriptionItems = items.some((i) => i.requires_prescription);

  return (
    <CartContext.Provider value={{ items, totalItems, totalAmount, loading, addToCart, updateQuantity, removeFromCart, clearCart, hasPrescriptionItems, fetchCart }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}