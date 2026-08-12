import React, { useEffect, useState } from 'react';
import { FiUser, FiMail, FiPhone, FiMapPin, FiCamera, FiSave, FiLock, FiCreditCard } from 'react-icons/fi';
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
  const [uploadingImage, setUploadingImage] = useState(false);
  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [changingPw, setChangingPw] = useState(false);
  const [bankForm, setBankForm] = useState({ bank_name: '', branch: '', account_holder_name: '', account_number: '' });
  const [savingBank, setSavingBank] = useState(false);
  const supportsBankProfile = ['customer', 'admin'].includes(user?.role);

  useEffect(() => {
    if (!supportsBankProfile) return;
    authApi.getBankAccount().then(({ data }) => data.bank_account && setBankForm(data.bank_account)).catch(() => {});
  }, [supportsBankProfile]);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const handlePwChange = (e) => setPwForm({ ...pwForm, [e.target.name]: e.target.value });

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!pwForm.current_password || !pwForm.new_password) return toast.error('Please fill all password fields');
    if (pwForm.new_password.length < 6) return toast.error('New password must be at least 6 characters');
    if (pwForm.new_password !== pwForm.confirm_password) return toast.error('New passwords do not match');
    try {
      setChangingPw(true);
      await authApi.changePassword(pwForm.current_password, pwForm.new_password);
      toast.success('Password changed successfully');
      setPwForm({ current_password: '', new_password: '', confirm_password: '' });
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Password change failed');
    } finally {
      setChangingPw(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      const { data } = await authApi.updateProfile({ ...form, address: { address_line1: form.address_line1, city: form.city, state: form.state, pincode: form.pincode } });
      updateUser(data.user);
      toast.success('Profile updated');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const supportedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!supportedTypes.includes(file.type)) {
      toast.error('Please choose a JPEG, PNG, or WebP image');
      e.target.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Profile images must be 5 MB or smaller');
      e.target.value = '';
      return;
    }
    try {
      setUploadingImage(true);
      const { data } = await authApi.uploadProfileImage(file);
      updateUser(data.user || { ...user, profile_image: data.image_url });
      toast.success('Profile image updated');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Image upload failed');
    } finally {
      setUploadingImage(false);
      e.target.value = '';
    }
  };

  const handleBankSave = async (event) => {
    event.preventDefault();
    if (bankForm.account_number.includes('*')) return toast.error('Enter the full account number when updating bank details');
    try {
      setSavingBank(true);
      const { data } = await authApi.updateBankAccount(bankForm);
      setBankForm(data.bank_account);
      toast.success(data.message);
    } catch (error) { toast.error(error.response?.data?.detail || 'Unable to save bank account'); }
    finally { setSavingBank(false); }
  };

  return (
    <div className="page-wrapper">
      <section className="section" style={{ paddingTop: '40px' }}>
        <div className="container-sm">
          <div className="profile-card">
            <div className="profile-avatar-section">
              <div
                className="profile-avatar-large"
                onClick={() => !uploadingImage && document.getElementById('profile-img-input')?.click()}
                aria-busy={uploadingImage}
              >
                {user?.profile_image ? (
                  <img src={user.profile_image} alt="" className="avatar-img" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                ) : (
                  <span style={{ fontSize: 48, fontWeight: 700, color: 'var(--green-800)' }}>{user?.name?.[0]?.toUpperCase()}</span>
                )}
                <div className="profile-avatar-overlay">
                  {uploadingImage ? 'Uploading…' : <FiCamera size={20} />}
                </div>
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

          {supportsBankProfile && <div className="profile-card mt-6">
            <h2 className="font-display mb-2" style={{ fontSize: 20, color: 'var(--green-900)', padding: '24px 32px 0' }}><FiCreditCard size={17} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 8 }} />Bank Account</h2>
            <p className="text-gray text-sm" style={{ padding: '0 32px' }}>Your account number is encrypted and available only to authorized administrators and relevant sellers.</p>
            <form onSubmit={handleBankSave} className="profile-form"><div className="grid-2">
              {[['bank_name', 'Bank Name'], ['branch', 'Branch'], ['account_holder_name', 'Account Holder Name'], ['account_number', 'Account Number']].map(([key, label]) => <div className="form-group" key={key}><label className="form-label">{label}</label><input className="form-input" required minLength={key === 'account_number' ? 6 : 2} value={bankForm[key]} autoComplete="off" onFocus={() => key === 'account_number' && bankForm[key].includes('*') && setBankForm({ ...bankForm, [key]: '' })} onChange={(event) => setBankForm({ ...bankForm, [key]: event.target.value })}/></div>)}
            </div><button className="btn btn-primary" disabled={savingBank}><FiSave size={16}/> {savingBank ? 'Saving…' : 'Save Bank Account'}</button></form>
          </div>}

          <div className="profile-card mt-6">
            <h2 className="font-display mb-4" style={{ fontSize: 20, color: 'var(--green-900)' }}>
              <FiLock size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 8 }} />
              Change Password
            </h2>
            <form onSubmit={handleChangePassword} className="profile-form">
              <div className="form-group">
                <label className="form-label">Current Password</label>
                <input type="password" name="current_password" className="form-input" placeholder="Current password" value={pwForm.current_password} onChange={handlePwChange} />
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">New Password</label>
                  <input type="password" name="new_password" className="form-input" placeholder="Min 6 characters" value={pwForm.new_password} onChange={handlePwChange} />
                </div>
                <div className="form-group">
                  <label className="form-label">Confirm New Password</label>
                  <input type="password" name="confirm_password" className="form-input" placeholder="Re-enter new password" value={pwForm.confirm_password} onChange={handlePwChange} />
                </div>
              </div>
              <button type="submit" className="btn btn-primary" disabled={changingPw}>
                <FiLock size={16} /> {changingPw ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
}
