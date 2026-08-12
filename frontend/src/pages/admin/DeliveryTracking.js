import React from 'react';
import { Link, useParams } from 'react-router-dom';
import RealtimeDeliveryTracker from '../../components/RealtimeDeliveryTracker';
export default function AdminDeliveryTracking() {
  const { id } = useParams();
  return <div className="page-wrapper"><section className="section"><div className="container-sm">
    <Link to="/admin/delivery-staff" className="btn btn-secondary btn-sm">Back to delivery management</Link>
    <p className="dashboard-status mt-6">Order #{id.slice(0,8).toUpperCase()}</p><RealtimeDeliveryTracker orderId={id}/>
  </div></section></div>;
}
