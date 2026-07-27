import React from 'react';
import { Link, useParams } from 'react-router-dom';
import RealtimeDeliveryTracker from '../../components/RealtimeDeliveryTracker';
export default function SellerDeliveryTracking() {
  const { id } = useParams();
  return <div className="page-wrapper"><section className="section"><div className="container-sm">
    <Link to="/seller/orders" className="btn btn-secondary btn-sm">Back to seller orders</Link>
    <h1 className="section-title mt-6">Order #{id.slice(0,8).toUpperCase()}</h1>
    <RealtimeDeliveryTracker orderId={id}/>
  </div></section></div>;
}
