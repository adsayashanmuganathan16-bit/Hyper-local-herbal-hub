import React, { useState, useEffect } from 'react';
import { FiPlus, FiEdit2, FiTrash2, FiSearch } from 'react-icons/fi';
import { medicineApi } from '../../api/medicineApi';
import { formatCurrency, formatStatus, truncateText } from '../../utils/helpers';
import { toast } from 'react-toastify';
import Loading from '../../components/Loading';

export default function ManageMedicines() {
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', category: 'Ayurvedic', price: '', discount_price: '', stock: '', manufacturer: '', requires_prescription: false, dosage: '', benefits: '', ingredients: '' });

  const fetchMedicines = async () => {
    try {
      const { data } = await medicineApi.search({ q: search, page: 1, page_size: 50 });
      setMedicines(data.items || []);
    } catch { setMedicines([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchMedicines(); }, [search]);

  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm({ ...form, [name]: type === 'checkbox' ? checked : value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      ...form,
      price: parseFloat(form.price),
      discount_price: form.discount_price ? parseFloat(form.discount_price) : null,
      stock: parseInt(form.stock),
      benefits: form.benefits ? form.benefits.split(',').map((s) => s.trim()) : [],
      ingredients: form.ingredients ? form.ingredients.split(',').map((s) => s.trim()) : [],
    };
    try {
      if (editId) {
        await medicineApi.update(editId, payload);
        toast.success('Product updated');
      } else {
        await medicineApi.create(payload);
        toast.success('Product created');
      }
      setShowModal(false);
      setEditId(null);
      resetForm();
      fetchMedicines();
    } catch (err) {
      toast.error(err.response?.data?.detail?.[0]?.msg || 'Operation failed');
    }
  };

  const handleEdit = (med) => {
    setForm({
      name: med.name, description: med.description, category: med.category,
      price: med.price, discount_price: med.discount_price || '', stock: med.stock,
      manufacturer: med.manufacturer, requires_prescription: med.requires_prescription,
      dosage: med.dosage || '', benefits: med.benefits?.join(', ') || '', ingredients: med.ingredients?.join(', ') || '',
    });
    setEditId(med.id);
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this product?')) return;
    try {
      await medicineApi.delete(id);
      toast.success('Product deleted');
      fetchMedicines();
    } catch { toast.error('Delete failed'); }
  };

  const resetForm = () => setForm({ name: '', description: '', category: 'Ayurvedic', price: '', discount_price: '', stock: '', manufacturer: '', requires_prescription: false, dosage: '', benefits: '', ingredients: '' });

  return (
    <div className="page-wrapper">
      <section className="section" style={{ paddingTop: '32px' }}>
        <div className="container">
          <div className="flex items-center justify-between mb-6">
            <h1 className="section-title" style={{ marginBottom: 0 }}>Manage Medicines</h1>
            <button className="btn btn-primary btn-sm" onClick={() => { resetForm(); setEditId(null); setShowModal(true); }}>
              <FiPlus size={14} /> Add Product
            </button>
          </div>

          <div style={{ maxWidth: 360, marginBottom: 24 }}>
            <div className="input-icon-wrap">
              <FiSearch size={16} className="input-icon" />
              <input className="form-input has-icon" placeholder="Search products..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>

          {loading ? <Loading /> : (
            <div className="admin-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr><th>Product</th><th>Category</th><th>Price</th><th>Stock</th><th>Rating</th><th>Actions</th></tr>
                  </thead>
                  <tbody>
                    {medicines.map((med) => (
                      <tr key={med.id}>
                        <td>
                          <div className="flex items-center gap-3">
                            <img src={med.images?.[0] || 'https://picsum.photos/seed/thumb/40/40.jpg'} alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover' }} />
                            <div>
                              <span className="font-medium text-sm">{truncateText(med.name, 30)}</span>
                              {med.requires_prescription && <span className="badge badge-yellow" style={{ marginLeft: 6, fontSize: 10 }}>Rx</span>}
                            </div>
                          </div>
                        </td>
                        <td className="text-sm">{med.category?.replace(/_/g, ' ')}</td>
                        <td className="font-semibold text-sm">{formatCurrency(med.discount_price || med.price)}</td>
                        <td><span className={`badge ${med.stock > 0 ? 'badge-green' : 'badge-red'}`}>{med.stock}</span></td>
                        <td className="text-sm">{med.average_rating} ⭐</td>
                        <td>
                          <div className="flex gap-2">
                            <button className="btn-ghost" style={{ color: 'var(--green-700)' }} onClick={() => handleEdit(med)}><FiEdit2 size={15} /></button>
                            <button className="btn-ghost" style={{ color: 'var(--red-500)' }} onClick={() => handleDelete(med.id)}><FiTrash2 size={15} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Modal */}
          {showModal && (
            <div className="modal-overlay" onClick={() => setShowModal(false)}>
              <div className="modal-content" style={{ maxWidth: 600 }} onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <h2>{editId ? 'Edit Product' : 'Add New Product'}</h2>
                  <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
                </div>
                <div className="modal-body">
                  <form onSubmit={handleSubmit}>
                    <div className="grid-2">
                      <div className="form-group"><label className="form-label">Name *</label><input name="name" className="form-input" value={form.name} onChange={handleFormChange} required /></div>
                      <div className="form-group"><label className="form-label">Category *</label>
                        <select name="category" className="form-input form-select" value={form.category} onChange={handleFormChange}>
                          {['Ayurvedic','Unani','Siddha','Homeopathic','Herbal Supplements','Herbal Skincare','Herbal Haircare','Herbal Food & Beverages','Essential Oils','Herbal First Aid'].map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="form-group"><label className="form-label">Description *</label><textarea name="description" className="form-input" rows={3} value={form.description} onChange={handleFormChange} required /></div>
                    <div className="grid-3">
                      <div className="form-group"><label className="form-label">Price *</label><input type="number" name="price" className="form-input" value={form.price} onChange={handleFormChange} step="0.01" required /></div>
                      <div className="form-group"><label className="form-label">Discount Price</label><input type="number" name="discount_price" className="form-input" value={form.discount_price} onChange={handleFormChange} step="0.01" /></div>
                      <div className="form-group"><label className="form-label">Stock *</label><input type="number" name="stock" className="form-input" value={form.stock} onChange={handleFormChange} required /></div>
                    </div>
                    <div className="grid-2">
                      <div className="form-group"><label className="form-label">Manufacturer *</label><input name="manufacturer" className="form-input" value={form.manufacturer} onChange={handleFormChange} required /></div>
                      <div className="form-group"><label className="form-label">Dosage</label><input name="dosage" className="form-input" value={form.dosage} onChange={handleFormChange} /></div>
                    </div>
                    <div className="form-group"><label className="form-label">Ingredients (comma separated)</label><input name="ingredients" className="form-input" value={form.ingredients} onChange={handleFormChange} placeholder="Turmeric, Ashwagandha, Ginger" /></div>
                    <div className="form-group"><label className="form-label">Benefits (comma separated)</label><input name="benefits" className="form-input" value={form.benefits} onChange={handleFormChange} placeholder="Boosts immunity, Reduces stress" /></div>
                    <label className="checkbox-wrap" style={{ marginBottom: 20 }}>
                      <input type="checkbox" name="requires_prescription" checked={form.requires_prescription} onChange={handleFormChange} />
                      Requires Prescription
                    </label>
                    <div className="flex gap-3" style={{ justifyContent: 'flex-end' }}>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowModal(false)}>Cancel</button>
                      <button type="submit" className="btn btn-primary btn-sm">{editId ? 'Update' : 'Create'}</button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}