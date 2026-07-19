import React, { useState } from 'react';
import { FiUser, FiMail, FiPhone, FiMapPin, FiCamera, FiSave } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../api/authApi';
import { toast } from 'react-toastify';

const LOGO_URL = process.env.PUBLIC_URL + '/logo.png';

export default function Profile() {
  const { user, updateUser } = useAuth();
  const [form, setForm] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    address_line1: user?.address?.address_line1 || '',
    city: user?.address?.city || '',
    state: user?.address?.state || '',
    pincode: user?.address?.pincode || '',
  });
  const [saving, setSaving] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      const { data } = await authApi.updateProfile({ ...form, address: { address_line1: form.address_line1, city: form.city, state: form.state, pincode: form.pincode } });
      updateUser(data.user);
      toast.success('Profile updated');
    } catch (err) {
      toast.error('Update failed');
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { data } = await authApi.uploadProfileImage(file);
      updateUser({ ...user, profile_image: data.image_url });
      toast.success('Profile image updated');
    } catch (err) {
      toast.error('Image upload failed');
    }
  };

  return (
    <div className="page-wrapper">
      <section className="section" style={{ paddingTop: '40px' }}>
        <div className="container-sm">
          <h1 className="section-title mb-6">My Profile</h1>

          <div className="profile-card">
            <div className="profile-avatar-section">
              <div className="profile-avatar-large" onClick={() => document.getElementById('profile-img-input')?.click()}>
                {user?.profile_image ? (
                  <img src={user.profile_image} alt="" className="avatar-img" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                ) : (
                  <span style={{ fontSize: 48, fontWeight: 700, color: 'var(--green-800)' }}>{user?.name?.[0]?.toUpperCase()}</span>
                )}
                <div className="profile-avatar-overlay"><FiCamera size={20} /></div>
              </div>
              <input id="profile-img-input" type="file" accept="image/*" hidden onChange={handleImageUpload} />
              <h2 className="font-display" style={{ fontSize: 22, color: 'var(--green-900)' }}>{user?.name}</h2>
              <p className="text-gray text-sm">{user?.email}</p>
              <span className="badge badge-green mt-2" style={{ textTransform: 'capitalize' }}>{user?.role?.replace('_', ' ')}</span>
            </div>

            <form onSubmit={handleSave} className="profile-form">
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label"><FiUser size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} /> Full Name</label>
                  <input name="name" className="form-input" value={form.name} onChange={handleChange} />
                </div>
                <div className="form-group">
                  <label className="form-label"><FiPhone size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} /> Phone</label>
                  <input name="phone" className="form-input" value={form.phone} onChange={handleChange} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label"><FiMail size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} /> Email (cannot change)</label>
                <input className="form-input" value={user?.email || ''} disabled style={{ opacity: 0.6 }} />
              </div>
              <div className="form-group">
                <label className="form-label"><FiMapPin size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} /> Address</label>
                <input name="address_line1" className="form-input" placeholder="House/Flat, Street" value={form.address_line1} onChange={handleChange} />
              </div>
              <div className="grid-3">
                <div className="form-group">
                  <label className="form-label">City</label>
                  <input name="city" className="form-input" value={form.city} onChange={handleChange} />
                </div>
                <div className="form-group">
                  <label className="form-label">State</label>
                  <input name="state" className="form-input" value={form.state} onChange={handleChange} />
                </div>
                <div className="form-group">
                  <label className="form-label">Pincode</label>
                  <input name="pincode" className="form-input" value={form.pincode} onChange={handleChange} />
                </div>
              </div>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                <FiSave size={16} /> {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
}