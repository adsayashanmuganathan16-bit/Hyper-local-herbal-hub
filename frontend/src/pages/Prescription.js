import React, { useState, useEffect, useRef } from 'react';
import { FiUpload, FiFile, FiCheck, FiX, FiAlertCircle } from 'react-icons/fi';
import { prescriptionApi } from '../api/prescriptionApi';
import { formatDate, formatStatus, getStatusColor } from '../utils/helpers';
import { toast } from 'react-toastify';
import Loading from '../components/Loading';

export default function Prescription() {
  const [prescriptions, setPrescriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [notes, setNotes] = useState('');
  const fileRef = useRef(null);

  useEffect(() => {
    prescriptionApi.getMyPrescriptions({ page: 1 }).then(({ data }) => setPrescriptions(data.items || []))
      .catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowed.includes(file.type)) return toast.error('Only JPEG, PNG, WebP, PDF allowed');
    if (file.size > 10 * 1024 * 1024) return toast.error('File must be under 10MB');

    try {
      setUploading(true);
      await prescriptionApi.upload(file, notes);
      toast.success('Prescription uploaded successfully!');
      setNotes('');
      const { data } = await prescriptionApi.getMyPrescriptions({ page: 1 });
      setPrescriptions(data.items || []);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="page-wrapper">
      <section className="section" style={{ paddingTop: '40px' }}>
        <div className="container-sm">

          {/* Upload Card */}
          <div className="rx-upload-card" onClick={() => fileRef.current?.click()}>
            <input type="file" ref={fileRef} onChange={handleUpload} accept=".jpg,.jpeg,.png,.webp,.pdf" hidden />
            <FiUpload size={40} className="rx-upload-icon" />
            <h3>{uploading ? 'Uploading...' : 'Upload Prescription'}</h3>
            <p>Click to browse or drag and drop. JPG, PNG, PDF up to 10MB</p>
            <div className="form-group mt-4" style={{ maxWidth: 400, margin: '16px auto 0' }} onClick={(e) => e.stopPropagation()}>
              <input className="form-input" placeholder="Add notes for the pharmacist (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>

          {/* Prescriptions List */}
          {loading ? <Loading /> : prescriptions.length === 0 ? (
            <div className="empty-state" style={{ padding: 40 }}>
              <FiFile size={60} />
              <h3>No Prescriptions</h3>
              <p>Upload your first prescription above</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4 mt-8">
              {prescriptions.map((rx) => (
                <div key={rx.id} className="rx-card">
                  <div className="rx-card-left">
                    <div className="rx-card-icon">
                      {rx.status === 'approved' ? <FiCheck size={20} /> : rx.status === 'rejected' ? <FiX size={20} /> : <FiFile size={20} />}
                    </div>
                    <div>
                      <p className="font-semibold">{rx.file_name}</p>
                      <p className="text-gray text-xs">Uploaded on {formatDate(rx.created_at)} • Expires {formatDate(rx.expires_at)}</p>
                      {rx.rejection_reason && (
                        <p className="rx-rejection"><FiAlertCircle size={12} /> {rx.rejection_reason}</p>
                      )}
                    </div>
                  </div>
                  <span className={`badge ${getStatusColor(rx.status)}`}>{formatStatus(rx.status)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
