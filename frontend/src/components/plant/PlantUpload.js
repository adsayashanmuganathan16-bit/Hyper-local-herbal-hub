import React, { useRef } from 'react';
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

  const handleSelection = (event) => {
    const selected = event.target.files?.[0];
    event.target.value = '';
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

  return (
    <>
      {!previewUrl ? (
        <div className="identify-dropzone">
          <div className="identify-dropzone-icon"><FiUploadCloud /></div>
          <h3>Choose how to add your photo</h3>
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
