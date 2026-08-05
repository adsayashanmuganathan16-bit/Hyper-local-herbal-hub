import React, { useRef, useState } from 'react';
import {
  FiCamera,
  FiCheckCircle,
  FiImage,
  FiRefreshCw,
  FiUploadCloud,
} from 'react-icons/fi';

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png'];

export default function PlantUpload({ previewUrl, onSelect, onReset, onValidationError }) {
  const galleryInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const validate = (selected) => {
    if (!selected) return;

    if (!ALLOWED_IMAGE_TYPES.includes(selected.type)) {
      onValidationError('Please select a JPEG or PNG image.');
      return;
    }
    if (selected.size > MAX_IMAGE_SIZE) {
      onValidationError('The image must be 10 MB or smaller.');
      return;
    }
    onSelect(selected);
  };
  const handleSelection = (event) => {
    const selected = event.target.files?.[0];
    event.target.value = '';
    validate(selected);
  };

  return (
    <>
      {!previewUrl ? (
        <div
          className={`identify-dropzone ${dragging ? 'is-dragging' : ''}`}
          onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => { event.preventDefault(); setDragging(false); validate(event.dataTransfer.files?.[0]); }}
        >
          <div className="identify-dropzone-icon"><FiUploadCloud /></div>
          <h3>Drop a plant photo here</h3>
          <p>or choose how to add your photo</p>
          <p>JPEG or PNG, up to 10 MB</p>
          <div className="identify-source-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => galleryInputRef.current?.click()}
            >
              <FiImage /> Upload from gallery
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => cameraInputRef.current?.click()}
            >
              <FiCamera /> Take a photo
            </button>
          </div>
        </div>
      ) : (
        <div className="identify-preview">
          <img src={previewUrl} alt="Selected plant preview" />
          <div className="identify-preview-overlay">
            <span><FiCheckCircle /> Photo ready</span>
            <button type="button" onClick={onReset}><FiRefreshCw /> Change photo</button>
          </div>
        </div>
      )}

      <input
        ref={galleryInputRef}
        className="identify-file-input"
        type="file"
        accept="image/jpeg,image/png"
        onChange={handleSelection}
      />
      <input
        ref={cameraInputRef}
        className="identify-file-input"
        type="file"
        accept="image/jpeg,image/png"
        capture="environment"
        onChange={handleSelection}
      />
    </>
  );
}
