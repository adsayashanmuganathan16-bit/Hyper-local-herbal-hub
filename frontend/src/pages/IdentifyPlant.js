import React, { useEffect, useState } from 'react';
import { FiImage, FiSearch } from 'react-icons/fi';
import ErrorMessage from '../components/plant/ErrorMessage';
import LoadingSpinner from '../components/plant/LoadingSpinner';
import PlantResult from '../components/plant/PlantResult';
import PlantUpload from '../components/plant/PlantUpload';
import { plantApi } from '../api/plantApi';

const IDENTIFICATION_FAILURE = {
  english: 'Unable to identify this plant accurately. Please upload a clearer image.',
  tamil: 'மன்னிக்கவும், இந்த தாவரத்தை துல்லியமாக அடையாளம் காண முடியவில்லை. தயவுசெய்து தெளிவான படத்தை பதிவேற்றவும்.',
};

export default function IdentifyPlant() {
  const [image, setImage] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Release each temporary preview URL as soon as it is no longer needed.
  useEffect(() => {
    if (!image) {
      setPreviewUrl('');
      return undefined;
    }
    const objectUrl = URL.createObjectURL(image);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [image]);

  const selectImage = (selected) => {
    setImage(selected);
    setResult(null);
    setError(null);
  };

  const identifyPlant = async () => {
    if (!image || loading) return;

    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const { data } = await plantApi.identify(image);
      setResult(data);
    } catch {
      // Keep provider details private and give users one actionable message.
      setError(IDENTIFICATION_FAILURE);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setImage(null);
    setResult(null);
    setError(null);
  };

  return (
    <div className="identify-page page-wrapper">
      <section className="identify-hero">
        <div className="container identify-hero-inner">
          <span className="identify-eyebrow"><FiSearch /> Plant identification</span>
          <h1>Discover the plant infront of you</h1>
          <p>
            Upload a clear photo of a leaf, flower, fruit, or bark and receive
            an AI-powered identification in seconds.
          </p>
        </div>
      </section>

      <section className="container identify-workspace">
        <div className="identify-panel">
          <div className="identify-panel-heading">
            <span>01</span>
            <div>
              <h2>Add a plant photo</h2>
              <p>For the best result, use natural light and keep one plant in focus.</p>
            </div>
          </div>

          <PlantUpload
            previewUrl={previewUrl}
            onSelect={selectImage}
            onReset={reset}
            onValidationError={(message) => setError({ english: message, tamil: '' })}
          />

          <ErrorMessage english={error?.english} tamil={error?.tamil} />

          <button
            type="button"
            className="btn btn-primary btn-lg identify-submit"
            onClick={identifyPlant}
            disabled={!image || loading}
          >
            {loading ? <LoadingSpinner /> : <><FiSearch /> Identify Plant</>}
          </button>
        </div>

        <aside className={`identify-result ${result ? 'identify-result--ready' : ''}`}>
          <div className="identify-panel-heading">
            <span>02</span>
            <div>
              <h2>Identification result</h2>
              <p>Your most likely match will appear here.</p>
            </div>
          </div>

          {result ? (
            <PlantResult result={result} imageUrl={previewUrl} />
          ) : (
            <div className="identify-result-empty">
              <FiImage />
              <h3>No result yet</h3>
              <p>Add a plant photo and select “Identify Plant” to begin.</p>
            </div>
          )}
        </aside>
      </section>
    </div>
  );
}
