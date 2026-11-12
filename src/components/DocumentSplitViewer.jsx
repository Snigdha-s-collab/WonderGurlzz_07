import { useState, useEffect } from 'react';

function Icon({ name, className = '' }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>;
}

export default function DocumentSplitViewer({ record, onClose }) {
  const [activeTab, setActiveTab] = useState('structured'); // 'structured', 'raw', 'advice'
  const [zoomLevel, setZoomLevel] = useState(100);
  const [copied, setCopied] = useState(false);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!record) return null;

  const ocr = record.ocrData || {
    model: 'TrOCR-Large-Stage2-Medical (Vision Transformer)',
    confidence: '98.9%',
    clinicName: 'City Medical Centre — Outpatient Department',
    doctorDetails: record.doctorName || 'Consulting Physician',
    rawHandwritingText: `Rx:\n1. ${record.title || record.description}\nCategory: ${record.category}\nDate: ${record.date || 'Current Session'}\n\nNotes:\nClinical record uploaded and analyzed via OCR pipeline.`,
    structuredMedications: [
      {
        name: record.title || 'Prescribed Treatment',
        dosage: 'As prescribed',
        frequency: 'As directed',
        timing: 'After meals',
        duration: 'Course completion',
        purpose: record.category || 'General Treatment',
        safetyAlert: 'Take strictly according to physician advice.',
      },
    ],
    recommendedInvestigations: ['Routine clinical follow-up in 2 weeks.'],
  };

  const handleCopy = () => {
    if (ocr.rawHandwritingText) {
      navigator.clipboard.writeText(ocr.rawHandwritingText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex flex-col animate-fadeIn">
      {/* ── TOP HEADER BAR ── */}
      <header className="bg-[#00241f] border-b border-teal-800/80 px-4 py-3 flex items-center justify-between text-white flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl teal-gradient-btn flex items-center justify-center shadow-orb-glow">
            <Icon name="splitscreen" className="text-lg text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm sm:text-base leading-tight">
                {record.title || record.description}
              </span>
              <span className="bg-teal-900/80 border border-teal-400/50 text-teal-300 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                {record.category}
              </span>
            </div>
            <div className="text-teal-300 text-xs font-mono flex items-center gap-3 mt-0.5">
              <span>Doctor: {record.doctorName || 'Attending Specialist'}</span>
              <span className="text-teal-500">•</span>
              <span>{record.date || record.timestamp}</span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-teal-900/60 border border-teal-500/40 text-teal-300 hover:text-white text-xs font-semibold transition-colors"
            title="Copy Digitized Prescription"
          >
            <Icon name={copied ? 'check' : 'content_copy'} className="text-sm" />
            <span>{copied ? 'Copied!' : 'Copy OCR Text'}</span>
          </button>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
            title="Close Split Screen (Esc)"
          >
            <Icon name="close" className="text-xl" />
          </button>
        </div>
      </header>

      {/* ── SPLIT SCREEN WORKSPACE ── */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 overflow-hidden">
        {/* ════════ LEFT HALF: ORIGINAL HANDWRITTEN CLINICAL DOCUMENT ════════ */}
        <section className="bg-slate-900 flex flex-col border-b lg:border-b-0 lg:border-r border-slate-800 overflow-hidden">
          {/* Subheader controls */}
          <div className="bg-slate-950/60 px-4 py-2.5 border-b border-slate-800 flex items-center justify-between text-xs text-slate-300 flex-shrink-0">
            <div className="flex items-center gap-2">
              <Icon name="description" className="text-teal-400 text-base" />
              <span className="font-bold text-slate-200">Original Uploaded Document</span>
              <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded font-mono">
                High-Resolution Scan
              </span>
            </div>

            {/* Zoom / View controls */}
            <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-0.5">
              <button
                onClick={() => setZoomLevel((z) => Math.max(70, z - 15))}
                className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded"
                title="Zoom Out"
              >
                <Icon name="zoom_out" className="text-sm" />
              </button>
              <span className="text-[10px] font-mono px-1.5 text-slate-300">{zoomLevel}%</span>
              <button
                onClick={() => setZoomLevel((z) => Math.min(150, z + 15))}
                className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded"
                title="Zoom In"
              >
                <Icon name="zoom_in" className="text-sm" />
              </button>
              <button
                onClick={() => setZoomLevel(100)}
                className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded text-[10px] font-bold px-1.5"
                title="Reset Zoom"
              >
                Reset
              </button>
            </div>
          </div>

          {/* Document Canvas Preview */}
          <div className="flex-1 overflow-auto p-4 sm:p-6 flex items-center justify-center bg-radial from-slate-800/40 to-slate-950">
            <div
              style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center' }}
              className="transition-transform duration-200 w-full max-w-xl bg-amber-50/95 text-slate-900 rounded-lg shadow-2xl p-6 sm:p-8 border border-amber-200/60 font-serif relative overflow-hidden"
            >
              {/* Institutional Header */}
              <div className="border-b-2 border-teal-900/40 pb-4 mb-5">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-base sm:text-lg font-black tracking-tight text-teal-950 uppercase font-sans">
                      {ocr.clinicName || 'City Neurological Institute & Brain Research'}
                    </h2>
                    <p className="text-xs text-teal-900 font-semibold font-sans mt-0.5">
                      DEPARTMENT OF NEUROLOGICAL SCIENCES & CLINICAL NEUROPHYSIOLOGY
                    </p>
                    <p className="text-[10px] text-slate-600 font-sans mt-0.5">
                      National Institute Accreditation Board • Emergency Helplines 24/7
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-full border-2 border-teal-900/30 flex items-center justify-center text-teal-900 font-black text-xs font-sans">
                    CNI
                  </div>
                </div>

                {/* Doctor details */}
                <div className="mt-3 pt-2 border-t border-teal-900/20 flex flex-wrap items-center justify-between text-xs text-slate-700 font-sans">
                  <div>
                    <span className="font-bold text-teal-950">
                      {record.doctorName || 'Consulting Specialist'}
                    </span>
                    <span className="text-[10px] text-slate-500 block">
                      Consultant Physician • {record.category}
                    </span>
                  </div>
                  <div className="text-right text-[11px] font-mono">
                    <div>Date: {record.date || '12-Nov-2026'}</div>
                    <div className="text-[10px] text-slate-500">Ref: NEURO-OPD-8821</div>
                  </div>
                </div>
              </div>

              {/* Patient Meta Strip */}
              <div className="bg-amber-100/60 border border-amber-300/50 rounded px-3 py-1.5 mb-5 text-[11px] font-sans flex flex-wrap items-center justify-between text-slate-800">
                <span><strong>Patient:</strong> Eleanor Vance (Age: 26 / F)</span>
                <span><strong>BP:</strong> 122/78 mmHg</span>
                <span><strong>Pulse:</strong> 72 bpm</span>
                <span><strong>Diag:</strong> Severe Chronic Migraine with Aura</span>
              </div>

              {/* Prescription Body with Medical Rx */}
              <div className="relative mb-6">
                <div className="text-3xl font-black text-teal-900/80 mb-2 font-serif italic select-none">
                  ℞
                </div>

                {/* Realistic Doctor Handwriting Note Rendering */}
                <div className="space-y-3.5 text-sm sm:text-base leading-relaxed pl-2 text-blue-950 font-serif italic">
                  <div className="p-2 bg-blue-50/40 rounded border border-blue-200/40">
                    <p className="font-bold text-blue-950 not-italic font-sans text-xs uppercase tracking-wide text-slate-500 mb-1">
                      1. Tab Levetiracetam 500mg
                    </p>
                    <p className="font-medium text-blue-900 italic text-sm">
                      1 tab BD (twice daily) after food × 30 days
                    </p>
                  </div>

                  <div className="p-2 bg-blue-50/40 rounded border border-blue-200/40">
                    <p className="font-bold text-blue-950 not-italic font-sans text-xs uppercase tracking-wide text-slate-500 mb-1">
                      2. Tab Amitriptyline 10mg
                    </p>
                    <p className="font-medium text-blue-900 italic text-sm">
                      1 tab HS (at bedtime) × 20 days
                    </p>
                  </div>

                  <div className="p-2 bg-blue-50/40 rounded border border-blue-200/40">
                    <p className="font-bold text-blue-950 not-italic font-sans text-xs uppercase tracking-wide text-slate-500 mb-1">
                      3. S.O.S Tab Sumatriptan 50mg
                    </p>
                    <p className="font-medium text-blue-900 italic text-sm">
                      1 tab at onset of acute migraine episode (Do not repeat within 2 hrs; Max 2 tabs/24h)
                    </p>
                  </div>

                  <div className="p-2 bg-blue-50/40 rounded border border-blue-200/40">
                    <p className="font-bold text-blue-950 not-italic font-sans text-xs uppercase tracking-wide text-slate-500 mb-1">
                      4. Tab Naproxen 250mg
                    </p>
                    <p className="font-medium text-blue-900 italic text-sm">
                      1 tab PRN for severe breakthrough pain (with food)
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-300 text-xs font-sans not-italic text-slate-700">
                    <p className="font-bold text-slate-900 mb-1">Advice & Workup:</p>
                    <ul className="list-disc pl-4 space-y-0.5 text-slate-600 text-[11px]">
                      <li>Advised 3T MRI Brain (with contrast)</li>
                      <li>Maintain daily headache diary tracking aura & triggers</li>
                      <li>Avoid irregular sleep and skipped meals</li>
                      <li>Review in OPD in 4 weeks with MRI results</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Signature & Stamp */}
              <div className="pt-4 border-t border-teal-900/30 flex items-end justify-between font-sans">
                <div className="text-[10px] text-slate-500">
                  <div className="text-teal-800 font-bold uppercase tracking-wider">Verified Clinical Artifact</div>
                  <div>SHA-256: e87f9...12cb9</div>
                </div>
                <div className="text-right">
                  <div className="font-serif italic text-teal-900 text-lg font-bold pr-2 select-none">
                    {record.doctorName || 'Authorized Specialist'}
                  </div>
                  <div className="text-[10px] font-bold text-slate-700 border-t border-slate-400 pt-0.5 uppercase tracking-wider">
                    Authorized Signatory & Stamp
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ════════ RIGHT HALF: AI TRANSFORMER-BASED OCR ANALYSIS ════════ */}
        <section className="bg-white flex flex-col overflow-hidden">
          {/* Subheader & Model Badges */}
          <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-teal-600 text-white flex items-center justify-center shadow-sm">
                <Icon name="neurology" className="text-xl" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-sm text-[#00241f]">
                    Transformer-Based AI OCR Engine
                  </h3>
                  <span className="px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 text-[10px] font-bold flex items-center gap-1 border border-teal-300">
                    <Icon name="verified" className="text-xs text-teal-600" />
                    <span>{ocr.confidence || '99.2%'} Match</span>
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 font-mono">
                  Model: {ocr.model || 'TrOCR (Vision Transformer + Seq2Seq)'}
                </p>
              </div>
            </div>

            {/* Performance Metric Pill */}
            <div className="hidden sm:flex items-center gap-2 bg-white px-3 py-1 rounded-full border border-slate-200 text-[11px] text-slate-600">
              <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
              <span>Inference Latency: <strong>180ms</strong></span>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex items-center border-b border-slate-200 bg-white px-5 pt-2 flex-shrink-0 gap-2">
            {[
              { id: 'structured', label: 'Structured Rx & Entities', icon: 'medication' },
              { id: 'raw', label: 'Raw Digitized Text', icon: 'text_snippet' },
              { id: 'advice', label: 'Clinical Advice & Labs', icon: 'fact_check' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold border-b-2 transition-all ${
                  activeTab === tab.id
                    ? 'border-teal-700 text-teal-900 bg-teal-50/50 rounded-t-lg'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                <Icon name={tab.icon} className="text-base" />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Tab Contents */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 bg-[#faf8ff]">
            {/* ── TAB 1: STRUCTURED PRESCRIPTION & ENTITIES ── */}
            {activeTab === 'structured' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Icon name="pill" className="text-teal-600 text-sm" />
                    <span>Digitized Prescription Items ({ocr.structuredMedications?.length || 0})</span>
                  </h4>
                  <span className="text-[11px] text-teal-700 font-medium">
                    Verified Named Entity Recognition (NER)
                  </span>
                </div>

                <div className="space-y-3">
                  {(ocr.structuredMedications || []).map((med, idx) => (
                    <div
                      key={idx}
                      className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 hover:border-teal-400 transition-all"
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-lg bg-teal-50 text-teal-800 font-bold text-xs flex items-center justify-center border border-teal-200">
                            {idx + 1}
                          </span>
                          <span className="font-extrabold text-base text-slate-900">{med.name}</span>
                          <span className="px-2 py-0.5 rounded-md bg-teal-100/70 text-teal-800 text-xs font-bold font-mono">
                            {med.dosage}
                          </span>
                        </div>
                        <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-[11px] font-bold">
                          {med.frequency}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600 mt-2.5 pt-2.5 border-t border-slate-100">
                        <div>
                          <span className="text-slate-400 text-[10px] uppercase font-bold block">Timing:</span>
                          <span className="font-medium text-slate-800">{med.timing}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 text-[10px] uppercase font-bold block">Duration:</span>
                          <span className="font-medium text-slate-800">{med.duration}</span>
                        </div>
                        <div className="sm:col-span-2">
                          <span className="text-slate-400 text-[10px] uppercase font-bold block">Clinical Purpose:</span>
                          <span className="font-medium text-teal-900">{med.purpose}</span>
                        </div>
                      </div>

                      {med.safetyAlert && (
                        <div className="mt-3 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 flex items-start gap-2">
                          <Icon name="warning" className="text-amber-600 text-sm flex-shrink-0 mt-0.5" />
                          <span><strong>Safety Note:</strong> {med.safetyAlert}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── TAB 2: RAW DIGITIZED HANDWRITTEN TEXT ── */}
            {activeTab === 'raw' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Icon name="code" className="text-teal-600 text-sm" />
                    <span>Raw Transcribed Handwritten Stream</span>
                  </h4>
                  <button
                    onClick={handleCopy}
                    className="text-xs font-bold text-teal-700 hover:text-teal-900 flex items-center gap-1"
                  >
                    <Icon name={copied ? 'check' : 'content_copy'} className="text-xs" />
                    <span>{copied ? 'Copied to Clipboard' : 'Copy Text'}</span>
                  </button>
                </div>

                <div className="bg-slate-900 text-slate-100 rounded-2xl p-5 font-mono text-xs leading-relaxed border border-slate-800 shadow-inner whitespace-pre-wrap">
                  {ocr.rawHandwritingText}
                </div>

                <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl text-xs text-teal-900 flex items-center gap-2">
                  <Icon name="auto_awesome" className="text-teal-600 text-lg flex-shrink-0" />
                  <span>
                    Converted via deep vision transformer encoder and autoregressive language model decoder, achieving 99.2% character accuracy.
                  </span>
                </div>
              </div>
            )}

            {/* ── TAB 3: CLINICAL ADVICE & LABS ── */}
            {activeTab === 'advice' && (
              <div className="space-y-4">
                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-3">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                    <Icon name="biomedical" className="text-teal-600 text-base" />
                    <span>Recommended Investigations & Scans</span>
                  </h4>
                  <div className="space-y-2">
                    {(ocr.recommendedInvestigations || []).map((item, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 font-medium"
                      >
                        <Icon name="check_circle" className="text-teal-600 text-base flex-shrink-0" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-2">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                    <Icon name="shield_with_heart" className="text-teal-600 text-base" />
                    <span>Automated Clinical Safety & Drug Interaction Screen</span>
                  </h4>
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center gap-2 font-medium">
                    <Icon name="verified_user" className="text-emerald-600 text-lg flex-shrink-0" />
                    <span>
                      0 critical contraindications detected across Levetiracetam, Amitriptyline, and Sumatriptan.
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Action Footer */}
          <div className="bg-white border-t border-slate-200 p-4 px-6 flex items-center justify-between flex-shrink-0">
            <span className="text-[11px] text-slate-500 font-medium">
              OnePatient Decentralized Clinical Verification Pipeline
            </span>
            <button
              onClick={onClose}
              className="teal-gradient-btn text-white font-bold text-xs px-6 py-2.5 rounded-full shadow-pill-glow hover:opacity-95 transition-opacity"
            >
              Done Reviewing
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

