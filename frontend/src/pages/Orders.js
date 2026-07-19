import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiPackage } from 'react-icons/fi';
import { orderApi } from '../api/orderApi';
import OrderCard from '../components/OrderCard';
import Loading from '../components/Loading';

const STATUS_FILTERS = [
  { value: '', label: 'All Orders' },
  { value: 'placed', label: 'Placed' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeStatus, setActiveStatus] = useState('');

  useEffect(() => {
    async function fetch() {
      try {
        const params = {};
        if (activeStatus) params.status = activeStatus;
        const { data } = await orderApi.getMyOrders(params);
        setOrders(data.items || []);
      } catch (err) {
        setOrders([]);
      } finally {
        setLoading(false);
      }
    }
    fetch();
  }, [activeStatus]);

  return (
    <div className="page-wrapper">
      <section className="section" style={{ paddingTop: '40px' }}>
        <div className="container-sm">
          <h1 className="section-title mb-6">My Orders</h1>
          <div className="tab-nav">
            {STATUS_FILTERS.map((f) => (
              <button key={f.value} className={`tab-btn ${activeStatus === f.value ? 'active' : ''}`} onClick={() => setActiveStatus(f.value)}>
                {f.label}
              </button>
            ))}
          </div>
          {loading ? <Loading /> : orders.length === 0 ? (
            <div className="empty-state">
              <FiPackage size={80} />
              <h3>No Orders Found</h3>
              <p>{activeStatus ? `No ${activeStatus} orders` : "You haven't placed any orders yet"}</p>
              <Link to="/shop" className="btn btn-primary btn-sm">Start Shopping</Link>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {orders.map((order) => <OrderCard key={order.id} order={order} />)}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}