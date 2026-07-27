import React, { useEffect, useState } from 'react';
import { FiEdit2, FiPackage, FiTruck } from 'react-icons/fi';
import { toast } from 'react-toastify';
import { orderApi } from '../api/orderApi';
import { formatDateTime } from '../utils/helpers';

const NEXT_ACTION = {
  pending: ['accepted', 'Accept Order'],
  accepted: ['packed', 'Mark Packed'],
  shipped: ['in_transit', 'Mark In Transit'],
  in_transit: ['delivered', 'Mark Delivered'],
};

function localDateTime(value) {
  if (!value) return new Date().toISOString().slice(0, 16);
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export default function PostalShippingControls({ order, onUpdated }) {
  const status = order.delivery_status || 'pending';
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    courier_service: order.courier_service || 'Sri Lanka Post',
    tracking_number: order.tracking_number || '',
    shipping_date: localDateTime(order.shipping_date),
  });

  useEffect(() => {
    setForm({
      courier_service: order.courier_service || 'Sri Lanka Post',
      tracking_number: order.tracking_number || '',
      shipping_date: localDateTime(order.shipping_date),
    });
  }, [order.courier_service, order.tracking_number, order.shipping_date]);

  const advance = async () => {
    const action = NEXT_ACTION[status];
    if (!action) return;
    setBusy(true);
    try {
      await orderApi.updateDeliveryStatus(order.id, action[0]);
      toast.success(`Order updated: ${action[1]}`);
      onUpdated?.();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Status update failed');
    } finally {
      setBusy(false);
    }
  };

  const saveShipping = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      await orderApi.updateShipping(order.id, {
        ...form,
        shipping_date: new Date(form.shipping_date).toISOString(),
      });
      toast.success(status === 'packed' ? 'Parcel shipped via Sri Lanka Post' : 'Shipping details updated');
      setEditing(false);
      onUpdated?.();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Could not save shipping details');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="postal-controls">
      <div className="postal-controls-summary">
        <span className={`badge postal-status-${status}`}>{status.replace('_', ' ')}</span>
        {order.tracking_number && (
          <small>{order.courier_service || 'Sri Lanka Post'} · {order.tracking_number}</small>
        )}
        {order.shipping_date && <small>Shipped {formatDateTime(order.shipping_date)}</small>}
      </div>

      <div className="postal-control-actions">
        {NEXT_ACTION[status] && (
          <button className="btn btn-primary btn-sm" onClick={advance} disabled={busy}>
            {status === 'in_transit' ? <FiTruck /> : <FiPackage />} {NEXT_ACTION[status][1]}
          </button>
        )}
        {status === 'packed' && (
          <button className="btn btn-primary btn-sm" onClick={() => setEditing(true)}>
            <FiTruck /> Add Tracking &amp; Ship
          </button>
        )}
        {['shipped', 'in_transit', 'delivered'].includes(status) && (
          <button className="btn btn-secondary btn-sm" onClick={() => setEditing(true)}>
            <FiEdit2 /> Edit Tracking
          </button>
        )}
      </div>

      {editing && (
        <form className="postal-shipping-form" onSubmit={saveShipping}>
          <label>
            Courier Service
            <input
              className="form-input"
              value={form.courier_service}
              onChange={(event) => setForm({ ...form, courier_service: event.target.value })}
              required
            />
          </label>
          <label>
            Tracking Number
            <input
              className="form-input"
              value={form.tracking_number}
              onChange={(event) => setForm({ ...form, tracking_number: event.target.value })}
              placeholder="Sri Lanka Post tracking number"
              required
            />
          </label>
          <label>
            Shipping Date
            <input
              type="datetime-local"
              className="form-input"
              value={form.shipping_date}
              onChange={(event) => setForm({ ...form, shipping_date: event.target.value })}
              required
            />
          </label>
          <div>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditing(false)}>Cancel</button>
            <button className="btn btn-primary btn-sm" disabled={busy}>{busy ? 'Saving…' : 'Save Shipping'}</button>
          </div>
        </form>
      )}
    </div>
  );
}
