import React from 'react';
import ErrorMessage from './ErrorMessage';

const LOW_CONFIDENCE_MESSAGE = {
  english: 'Unable to identify this plant accurately. Please upload a clearer image.',
  tamil: 'மன்னிக்கவும், இந்த தாவரத்தை துல்லியமாக அடையாளம் காண முடியவில்லை. தயவுசெய்து தெளிவான படத்தை பதிவேற்றவும்.',
};

function BilingualValue({ icon, title, tamilTitle, english, tamil, tone = '' }) {
  return (
    <section className={`plant-result-field ${tone}`}>
      <h3><span aria-hidden="true">{icon}</span> {title} / <span lang="ta">{tamilTitle}</span></h3>
      <p className="plant-value-en">{english || 'Not available'}</p>
      <p className="plant-value-ta" lang="ta">{tamil || 'தகவல் கிடைக்கவில்லை'}</p>
    </section>
  );
}

function SingleValue({ icon, title, tamilTitle, children, tone = '' }) {
  return (
    <section className={`plant-result-field ${tone}`}>
      <h3><span aria-hidden="true">{icon}</span> {title} / <span lang="ta">{tamilTitle}</span></h3>
      <p className="plant-single-value">{children}</p>
    </section>
  );
}

export default function PlantResult({ result, imageUrl }) {
  const confidence = Number.parseFloat(result.confidence) || 0;
  const lowConfidence = confidence < 50;

  return (
    <div className="plant-result-card" aria-live="polite">
      <section className="plant-result-image">
        <h3>🌿 Plant Image / <span lang="ta">தாவரத்தின் படம்</span></h3>
        <img src={imageUrl} alt={result.common_name || 'Identified plant'} />
      </section>

      {lowConfidence && (
        <ErrorMessage
          english={LOW_CONFIDENCE_MESSAGE.english}
          tamil={LOW_CONFIDENCE_MESSAGE.tamil}
          variant="warning"
        />
      )}

      <div className="plant-result-summary">
        <BilingualValue
          icon="🌱"
          title="Plant Name"
          tamilTitle="தாவரத்தின் பெயர்"
          english={result.common_name}
          tamil={result.common_name_tamil}
        />
        <SingleValue
          icon="🔬"
          title="Scientific Name"
          tamilTitle="அறிவியல் பெயர்"
          tone="plant-scientific-field"
        >
          {result.scientific_name}
        </SingleValue>
        <SingleValue
          icon="📊"
          title="Confidence"
          tamilTitle="நம்பகத்தன்மை"
          tone={lowConfidence ? 'plant-confidence-field is-low' : 'plant-confidence-field'}
        >
          {result.confidence}
        </SingleValue>
      </div>

      <div className="identify-confidence" aria-label={`Confidence ${result.confidence}`}>
        <span style={{ width: `${Math.min(100, confidence)}%` }} />
      </div>

      <BilingualValue
        icon="📖"
        title="Description"
        tamilTitle="விளக்கம்"
        english={result.description}
        tamil={result.description_tamil}
      />
      <BilingualValue
        icon="🌿"
        title="Medicinal Uses"
        tamilTitle="மருத்துவப் பயன்பாடுகள்"
        english={result.medicinal_uses}
        tamil={result.medicinal_uses_tamil}
      />
      <BilingualValue
        icon="⚠️"
        title="Precautions"
        tamilTitle="முன்னெச்சரிக்கைகள்"
        english={result.precautions}
        tamil={result.precautions_tamil}
        tone="plant-precautions-field"
      />
    </div>
  );
}
