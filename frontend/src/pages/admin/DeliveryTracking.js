import React from 'react';
import { Link, useParams } from 'react-router-dom';
import RealtimeDeliveryTracker from '../../components/RealtimeDeliveryTracker';
export default function AdminDeliveryTracking() {
  const { id } = useParams();
  return <div className="page-wrapper"><section className="section"><div className="container-sm">
    <Link to="/admin/delivery-staff" className="btn btn-secondary btn-sm">Back to delivery management</Link>
    <h1 className="section-title mt-6">Delivery #{id.slice(0,8).toUpperCase()}</h1><RealtimeDeliveryTracker orderId={id}/>
  </div></section></div>;
}
