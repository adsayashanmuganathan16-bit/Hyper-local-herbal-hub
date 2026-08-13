import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { deliveryApi } from '../../api/deliveryApi';
import { adminApi } from '../../api/adminApi';
import Loading from '../../components/Loading';
import { formatDateTime } from '../../utils/helpers';
import DeliveryStaffMap from '../../components/DeliveryStaffMap';
import { serviceAreaApi } from '../../api/serviceAreaApi';
import { Link } from 'react-router-dom';
import { websocketBaseUrl } from '../../utils/apiBase';

const EMPTY = { name: '', email: '', phone: '', password: '', vehicle_type: 'Bike', nic: '', profile_photo: '' };
export default function DeliveryStaff() {
  const [staff, setStaff] = useState([]), [orders, setOrders] = useState([]), [history, setHistory] = useState([]);
  const [areas, setAreas] = useState([]), [areaName, setAreaName] = useState('');
  const [form, setForm] = useState(EMPTY), [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    const [live, allOrders, events, serviceAreas] = await Promise.all([deliveryApi.liveStaff(), adminApi.getAllOrders({ status: 'ready_for_pickup' }), deliveryApi.history(), serviceAreaApi.list()]);
    setStaff(live.data.items || []); setOrders(allOrders.data.items || []); setHistory(events.data.items || []); setAreas(serviceAreas.data.items || []); setLoading(false);
  }, []);
  useEffect(() => { load(); const base = websocketBaseUrl();
    const socket=new WebSocket(`${base}/ws/delivery/admin?token=${encodeURIComponent(localStorage.getItem('herbal_hub_token')||'')}`);
    socket.onmessage=load; const keepalive=setInterval(()=>socket.readyState===WebSocket.OPEN&&socket.send('ping'),25000);
    return () => { clearInterval(keepalive); socket.close(); }; }, [load]);
  const create = async (e) => { e.preventDefault(); try { await deliveryApi.createStaff(form); setForm(EMPTY); toast.success('Delivery staff created'); load(); } catch (x) { toast.error(x.response?.data?.detail || 'Create failed'); } };
  const assign = async (orderId, staffId) => { if (!staffId) return; try { await deliveryApi.assign(orderId, staffId); toast.success('Delivery assigned'); load(); } catch (x) { toast.error(x.response?.data?.detail || 'Assignment failed'); } };
  if (loading) return <Loading />;
  return <div className="page-wrapper"><section className="section"><div className="container">
    <DeliveryStaffMap staff={staff} />
    <div className="admin-card mt-6"><h3>Create Delivery Staff</h3><form onSubmit={create} className="form-grid">
      {['name','email','phone','password','nic','profile_photo'].map(k => <input key={k} className="form-input" required={k !== 'profile_photo'} type={k === 'password' ? 'password' : 'text'} placeholder={k.replace('_',' ')} value={form[k]} onChange={e => setForm({...form,[k]:e.target.value})} />)}
      <select className="form-input" value={form.vehicle_type} onChange={e => setForm({...form,vehicle_type:e.target.value})}><option>Bike</option><option>Three Wheeler</option><option>Van</option></select>
      <button className="btn btn-primary">Create Staff</button></form></div>
    <div className="admin-card mt-6"><h3>Staff</h3><div style={{overflowX:'auto'}}><table className="data-table"><thead><tr><th>Name</th><th>Phone</th><th>Vehicle</th><th>Status</th><th>Active</th><th>Action</th></tr></thead><tbody>{staff.map(s => <tr key={s.id}><td>{s.name}</td><td>{s.phone}</td><td>{s.vehicle_type}</td><td>{s.status}</td><td>{s.is_active ? 'Yes':'No'}</td><td><button className="btn btn-secondary btn-sm" onClick={() => deliveryApi.setActive(s.id,!s.is_active).then(load)}>{s.is_active?'Deactivate':'Activate'}</button> {s.location?.order_id&&<Link className="btn btn-primary btn-sm" to={`/admin/delivery/${s.location.order_id}/tracking`}>View Route</Link>}</td></tr>)}</tbody></table></div></div>
    <div className="admin-card mt-6"><h3>Orders Ready for Pickup</h3>{orders.map(o => <div className="flex items-center gap-3 mb-3" key={o.id}><b>#{o.id.slice(0,8)}</b><select className="form-input" defaultValue="" onChange={e=>assign(o.id,e.target.value)}><option value="">Assign available staff…</option>{staff.filter(s=>s.status==='Available'&&s.is_active).map(s=><option key={s.id} value={s.id}>{s.name} · {s.vehicle_type}</option>)}</select></div>)}{!orders.length&&<p className="text-gray">No orders awaiting assignment.</p>}</div>
    <div className="admin-card mt-6"><h3>Delivery History</h3>{history.slice(0,20).map(h=><p className="text-sm" key={h.id}>{h.order_id?.slice(0,8)} · {h.event} · {formatDateTime(h.created_at)}</p>)}</div>
    <div className="admin-card mt-6"><h3>Service Areas</h3><p className="text-gray text-sm">Add districts without changing source code. New areas become active immediately after creation.</p>
      {areas.map(a=><p key={a.id}><b>{a.name}</b> · {a.is_active?'Active':'Inactive'}</p>)}
      <form className="flex gap-2 mt-3" onSubmit={async e=>{e.preventDefault();await serviceAreaApi.create({name:areaName,accepted_names:[areaName],is_active:true});setAreaName('');toast.success('Service area added');load();}}>
        <input className="form-input" placeholder="District name" value={areaName} onChange={e=>setAreaName(e.target.value)} required/><button className="btn btn-primary">Add Area</button>
      </form></div>
  </div></section></div>;
}
