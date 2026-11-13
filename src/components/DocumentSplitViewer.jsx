import { useState, useEffect } from 'react';
import { updateRecordOCRInSupabase, getSignedDocumentUrl } from '../lib/supabaseClient';
import { API_BASE_URL } from '../config/api';

function Icon({ name, className = '' }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>;
}

export default function DocumentSplitViewer({ record, onClose, onRecordUpdated }) {
  const [activeTab, setActiveTab] = useState('structured'); // 'structured', 'raw', 'json'
  const [zoomLevel, setZoomLevel] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);

  // Live on-demand OCR state
  const [currentOcr, setCurrentOcr] = useState(record?.ocrData || null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationSuccess, setVerificationSuccess] = useState(false);

  // Sync state when a different record is selected
  useEffect(() => {
    setCurrentOcr(record?.ocrData || null);
    setAnalysisError('');
    setSelectedFileIndex(0);
  }, [record?.id]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const filesList = Array.isArray(record?.files) ? record.files : [];
  const currentFile = filesList[selectedFileIndex] || filesList[0] || null;

  const [signedUrl, setSignedUrl] = useState('');
  const [isResolvingUrl, setIsResolvingUrl] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function resolveUrl() {
      if (!currentFile) {
        setSignedUrl('');
        return;
      }
      const rawPath = currentFile.storagePath || currentFile.storage_path;
      if (rawPath && !currentFile.dataUrl && !currentFile.url) {
        setIsResolvingUrl(true);
        const resolved = await getSignedDocumentUrl(rawPath, 300);
        if (isMounted) {
          setSignedUrl(resolved || '');
          setIsResolvingUrl(false);
        }
      } else {
        setSignedUrl(currentFile.dataUrl || currentFile.url || '');
      }
    }
    resolveUrl();
    return () => {
      isMounted = false;
    };
  }, [currentFile]);

  if (!record) return null;

  // Resolve actual image URL from user-uploaded file (Signed URL, Base64 dataUrl, or remote url)
  const imageSource = signedUrl || currentFile?.dataUrl || currentFile?.url || '';

  const isImageFile =
    imageSource &&
    (imageSource.startsWith('data:image/') ||
      imageSource.endsWith('.jpeg') ||
      imageSource.endsWith('.jpg') ||
      imageSource.endsWith('.png') ||
      imageSource.endsWith('.webp') ||
      currentFile?.name?.match(/\.(jpg|jpeg|png|webp|gif)$/i));

  // Trigger on-demand OCR analysis with Qwen2.5-VL
  const handleRunOcr = async () => {
    if (!imageSource) {
      setAnalysisError('No valid image data available to analyze.');
      return;
    }

    setIsAnalyzing(true);
    setAnalysisError('');

    try {
      let base64Payload = imageSource;
      // If imageSource is a URL or file path, fetch and convert to Base64 data URL
      if (!base64Payload.startsWith('data:image/')) {
        const fetched = await fetch(imageSource);
        const blob = await fetched.blob();
        base64Payload = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      }

      const response = await fetch(`${API_BASE_URL}/api/ocr/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_base64: base64Payload,
          document_hint: record.category || record.title,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Server returned error status ${response.status}`);
      }

      const result = await response.json();
      setCurrentOcr(result);

      // Save OCR response directly to Supabase medical_records.ocr_data JSONB field
      if (record?.id) {
        await updateRecordOCRInSupabase(record.id, result);
      }
      if (onRecordUpdated) {
        onRecordUpdated({
          ...record,
          ocrData: result,
        });
      }
    } catch (err) {
      console.error('OCR Extraction error:', err);
      setAnalysisError(err.message || 'Could not connect to Qwen2.5-VL backend. Ensure backend is running.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Automatically trigger extraction on open if record has no OCR data yet or if it was an error
  useEffect(() => {
    const hasError =
      record?.ocrData?.summary?.includes('could not be completed') ||
      record?.ocrData?.summary?.includes('validation error') ||
      record?.ocrData?.summary?.includes('Error in Qwen') ||
      currentOcr?.summary?.includes('could not be completed') ||
      currentOcr?.summary?.includes('validation error');

    if (record && (!record.ocrData || hasError) && !isAnalyzing && imageSource) {
      handleRunOcr();
    }
  }, [record?.id, imageSource]);

  const handleVerifyTranscription = async () => {
    if (!currentOcr) return;

    setIsVerifying(true);
    const verifiedOcr = {
      ...currentOcr,
      is_verified_by_user: true,
      needs_human_verification: false,
      verified_at: new Date().toISOString(),
    };

    setCurrentOcr(verifiedOcr);

    // Save verified OCR response into Supabase medical_records.ocr_data JSONB field
    if (record?.id) {
      await updateRecordOCRInSupabase(record.id, verifiedOcr);
    }

    if (onRecordUpdated) {
      onRecordUpdated({
        ...record,
        ocrData: verifiedOcr,
      });
    }

    setIsVerifying(false);
    setVerificationSuccess(true);
    setTimeout(() => setVerificationSuccess(false), 4000);
  };

  const handleCopyTranscription = () => {
    const textToCopy = currentOcr?.raw_transcription || '';
    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCopyJson = () => {
    const jsonStr = JSON.stringify(currentOcr || record?.ocrData || {}, null, 2);
    if (jsonStr) {
      navigator.clipboard.writeText(jsonStr);
      setCopiedJson(true);
      setTimeout(() => setCopiedJson(false), 2000);
    }
  };

  const renderValue = (val, fallback = 'Not mentioned') => {
    if (val === null || val === undefined || (typeof val === 'string' && val.trim() === '')) {
      return <span className="text-slate-400 italic text-xs">{fallback}</span>;
    }
    return <span className="font-semibold text-slate-800">{val}</span>;
  };

  const docType = currentOcr?.document_type || 'other';
  const rx = currentOcr?.prescription_data;
  const rep = currentOcr?.report_data;
  const ds = currentOcr?.discharge_summary_data;
  const unreadable = currentOcr?.unreadable_items || [];
  const isPrescription =
    docType === 'prescription' ||
    (rx && rx.medicines && rx.medicines.length > 0) ||
    (record?.category &&
      (record.category.toLowerCase().includes('prescript') ||
        record.category.toLowerCase().includes('medicin')));

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex flex-col animate-fadeIn">
      {/* ── TOP HEADER BAR ── */}
      <header className="bg-[#00241f] border-b border-teal-800/80 px-4 py-3 flex items-center justify-between text-white flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl teal-gradient-btn flex items-center justify-center shadow-orb-glow">
            <Icon name="splitscreen" className="text-lg text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm sm:text-base leading-tight">
                {record.title || record.description || 'Medical Record'}
              </span>
              <span className="bg-teal-900/80 border border-teal-400/50 text-teal-300 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                {record.category || 'General'}
              </span>
              {currentOcr?.document_type && (
                <span className="bg-teal-700/60 border border-teal-300/40 text-teal-200 text-[10px] font-mono px-2 py-0.5 rounded-full uppercase hidden sm:inline">
                  AI: {currentOcr.document_type.replace('_', ' ')}
                </span>
              )}
            </div>
            <div className="text-teal-300 text-xs font-mono flex items-center gap-3 mt-0.5">
              <span>Doctor: {record.doctorName || 'Not specified'}</span>
              <span className="text-teal-500">•</span>
              <span>{record.date || record.timestamp}</span>
              {currentFile && (
                <>
                  <span className="text-teal-500 hidden sm:inline">•</span>
                  <span className="hidden sm:inline text-slate-300">{currentFile.name}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
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
        {/* ════════ LEFT SCREEN: ORIGINAL UPLOADED CLINICAL IMAGE ════════ */}
        <section className="bg-slate-900 flex flex-col border-b lg:border-b-0 lg:border-r border-slate-800 overflow-hidden">
          {/* Subheader with File & Zoom Controls */}
          <div className="bg-slate-950/80 px-4 py-2.5 border-b border-slate-800 flex items-center justify-between text-xs text-slate-300 flex-shrink-0">
            <div className="flex items-center gap-2 truncate pr-2">
              <Icon name="image" className="text-teal-400 text-base flex-shrink-0" />
              <span className="font-bold text-slate-200 truncate">
                Original Uploaded Document
              </span>
              {currentFile?.size && (
                <span className="text-[10px] bg-teal-950 border border-teal-700/50 text-teal-300 px-2 py-0.5 rounded font-mono flex-shrink-0">
                  {currentFile.size}
                </span>
              )}
            </div>

            {/* View / Zoom Controls */}
            {isImageFile && (
              <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-0.5 flex-shrink-0">
                <button
                  onClick={() => setZoomLevel((z) => Math.max(50, z - 15))}
                  className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded"
                  title="Zoom Out"
                >
                  <Icon name="zoom_out" className="text-sm" />
                </button>
                <span className="text-[10px] font-mono px-1 text-slate-300">{zoomLevel}%</span>
                <button
                  onClick={() => setZoomLevel((z) => Math.min(220, z + 15))}
                  className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded"
                  title="Zoom In"
                >
                  <Icon name="zoom_in" className="text-sm" />
                </button>
                <button
                  onClick={() => setRotation((r) => (r + 90) % 360)}
                  className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded"
                  title="Rotate 90°"
                >
                  <Icon name="rotate_right" className="text-sm" />
                </button>
                <button
                  onClick={() => {
                    setZoomLevel(100);
                    setRotation(0);
                  }}
                  className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded text-[10px] font-bold px-1.5"
                  title="Reset View"
                >
                  Reset
                </button>
              </div>
            )}
          </div>

          {/* Multiple File Selector Tabs (if more than 1 file) */}
          {filesList.length > 1 && (
            <div className="bg-slate-950 px-4 py-1.5 border-b border-slate-800 flex items-center gap-2 overflow-x-auto text-xs">
              <span className="text-slate-500 text-[10px] uppercase font-bold">Files ({filesList.length}):</span>
              {filesList.map((f, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedFileIndex(i)}
                  className={`px-2.5 py-1 rounded text-xs truncate max-w-[160px] ${
                    selectedFileIndex === i
                      ? 'bg-teal-700 text-white font-bold'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  {f.name}
                </button>
              ))}
            </div>
          )}

          {/* ── IMAGE CANVAS DISPLAYING USER-UPLOADED ARTIFACT ── */}
          <div className="flex-1 overflow-auto p-4 sm:p-6 flex items-center justify-center bg-radial from-slate-900 to-black select-none">
            {isImageFile ? (
              <div
                style={{
                  transform: `scale(${zoomLevel / 100}) rotate(${rotation}deg)`,
                  transformOrigin: 'center center',
                }}
                className="transition-transform duration-150 max-w-full max-h-full flex items-center justify-center"
              >
                <img
                  src={imageSource}
                  alt={currentFile?.name || 'Uploaded Clinical Document'}
                  className="max-h-[75vh] w-auto max-w-full object-contain rounded-xl shadow-2xl border border-slate-700/80 ring-1 ring-white/10"
                />
              </div>
            ) : currentFile ? (
              <div className="bg-slate-800 text-slate-200 p-8 rounded-2xl border border-slate-700 text-center max-w-md">
                <Icon name="description" className="text-5xl text-teal-400 mx-auto mb-3" />
                <h4 className="font-bold text-base">{currentFile.name}</h4>
                <p className="text-xs text-slate-400 mt-1 mb-4">
                  User Uploaded File ({currentFile.size})
                </p>
                {imageSource && (
                  <a
                    href={imageSource}
                    target="_blank"
                    rel="noreferrer"
                    className="teal-gradient-btn text-white text-xs font-bold px-4 py-2 rounded-full inline-flex items-center gap-1.5"
                  >
                    <Icon name="open_in_new" className="text-sm" />
                    <span>Open Attached Document</span>
                  </a>
                )}
              </div>
            ) : (
              <div className="text-center p-8 text-slate-500">
                <Icon name="image_not_supported" className="text-5xl mb-2 text-slate-600" />
                <p className="text-xs">No attached image evidence found for this record</p>
              </div>
            )}
          </div>

          {/* Left Footer Info */}
          {currentFile && (
            <div className="bg-slate-950/90 px-4 py-2 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between flex-shrink-0">
              <span className="truncate pr-2">
                Source Document: <strong className="text-slate-200">{currentFile.name}</strong>
              </span>
              {imageSource && (
                <a
                  href={imageSource}
                  target="_blank"
                  rel="noreferrer"
                  className="text-teal-400 hover:text-teal-300 font-semibold flex items-center gap-1 flex-shrink-0"
                >
                  <span>Open Full Image</span>
                  <Icon name="launch" className="text-xs" />
                </a>
              )}
            </div>
          )}
        </section>

        {/* ════════ RIGHT SCREEN: AI QWEN2.5-VL-7B-INSTRUCT EXTRACTION ════════ */}
        <section className="bg-white flex flex-col overflow-hidden">
          {/* Subheader & Model Badges */}
          <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-teal-700 text-white flex items-center justify-center shadow-sm">
                <Icon name="neurology" className="text-xl" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-sm text-[#00241f]">
                    Qwen2.5-VL Clinical OCR
                  </h3>
                </div>
                <p className="text-[11px] text-slate-500 font-mono">
                  Type: <strong className="text-teal-900 uppercase">{docType.replace('_', ' ')}</strong> • Model: {currentOcr?.model_name || 'qwen/qwen2.5-vl-72b-instruct'}
                </p>
              </div>
            </div>

            {/* Performance status indicator */}
            <div className="flex items-center gap-2 bg-white px-3 py-1 rounded-full border border-slate-200 text-[11px] text-slate-600">
              <span className={`w-2 h-2 rounded-full ${isAnalyzing ? 'bg-amber-500 animate-pulse' : 'bg-teal-500'}`} />
              <span>{isAnalyzing ? 'Extracting...' : currentOcr ? 'Digitized' : 'Ready'}</span>
            </div>
          </div>

          {/* Tab Navigation: Structured Clinical Data | Clinical JSON Format | Raw Digitized Text */}
          <div className="flex items-center border-b border-slate-200 bg-white px-5 pt-2 flex-shrink-0 gap-2 overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab('structured')}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold rounded-t-lg transition-all ${
                activeTab === 'structured'
                  ? 'border-b-2 border-teal-700 text-teal-900 bg-teal-50/60'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Icon name="fact_check" className="text-base text-teal-700" />
              <span>Structured Clinical Data</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('json')}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold rounded-t-lg transition-all ${
                activeTab === 'json'
                  ? 'border-b-2 border-teal-700 text-teal-900 bg-teal-50/60'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Icon name="data_object" className="text-base text-teal-700" />
              <span>Verified Clinical JSON</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('raw')}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold rounded-t-lg transition-all ${
                activeTab === 'raw'
                  ? 'border-b-2 border-teal-700 text-teal-900 bg-teal-50/60'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Icon name="article" className="text-base text-teal-700" />
              <span>Digitized Raw Text</span>
            </button>
          </div>

          {/* Loading / Error States */}
          {isAnalyzing && (
            <div className="p-8 text-center bg-teal-50/40 border-b border-teal-100 flex flex-col items-center justify-center">
              <div className="w-10 h-10 border-3 border-teal-600 border-t-transparent rounded-full animate-spin mb-3" />
              <h4 className="font-bold text-sm text-teal-950">Analyzing Medical Document...</h4>
              <p className="text-xs text-slate-500 mt-1">
                Processing complete image with Qwen2.5-VL-7B-Instruct vision transformer.
              </p>
            </div>
          )}

          {analysisError && !currentOcr && (
            <div className="m-4 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-900 flex items-start justify-between gap-2.5">
              <div className="flex items-start gap-2.5">
                <Icon name="error" className="text-rose-600 text-base flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="block font-bold">Analysis Notice:</strong>
                  <span>{analysisError}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAnalysisError('')}
                className="text-rose-400 hover:text-rose-600"
              >
                <Icon name="close" className="text-sm" />
              </button>
            </div>
          )}

          {/* Tab Contents */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 bg-[#faf8ff]">
            {/* ── TAB 1: DYNAMIC STRUCTURED VIEW ── */}
            {activeTab === 'structured' && (
              <div className="space-y-5">
                {/* Document Summary Card */}
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700 block mb-1">
                    Clinical Document Summary
                  </span>
                  <p className="text-xs sm:text-sm text-slate-800 leading-relaxed font-medium">
                    {currentOcr?.summary || record.description || record.title || 'Medical document recorded.'}
                  </p>
                </div>

                {/* ── PRESCRIPTION VIEW ── */}
                {(docType === 'prescription' || isPrescription) && (
                  <div className="space-y-4">
                    {/* Doctor & Patient Metadata */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white rounded-2xl p-4 border border-slate-200 shadow-sm text-xs">
                      <div>
                        <span className="text-slate-400 text-[10px] uppercase font-bold block">Attending Physician:</span>
                        {renderValue(rx?.doctor_name || record.doctorName)}
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px] uppercase font-bold block">Clinic / Hospital:</span>
                        {renderValue(rx?.clinic_or_hospital)}
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px] uppercase font-bold block">Consultation Date:</span>
                        {renderValue(rx?.date_of_consultation || record.date)}
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px] uppercase font-bold block">Patient Identified:</span>
                        <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                          {renderValue(rx?.patient_name)}
                          {rx?.patient_age_or_gender && (
                            <span className="text-xs text-teal-800 font-mono bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                              Age: {rx.patient_age_or_gender}
                            </span>
                          )}
                          <span className="text-xs text-teal-800 font-mono bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                            Weight: {rx?.patient_weight || 'Not specified'}
                          </span>
                        </div>
                      </div>
                      {rx?.diagnosis_or_symptoms && rx.diagnosis_or_symptoms.length > 0 && (
                        <div className="sm:col-span-2 pt-2 border-t border-slate-100">
                          <span className="text-slate-400 text-[10px] uppercase font-bold block mb-1">Symptoms / Diagnosis:</span>
                          <div className="flex flex-wrap gap-1.5">
                            {rx.diagnosis_or_symptoms.map((diag, i) => (
                              <span key={i} className="px-2 py-0.5 rounded-md bg-teal-50 border border-teal-200 text-teal-900 font-medium text-xs">
                                {diag}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Prescribed Medications Table (Requirement 5) */}
                    <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                          <Icon name="medication" className="text-teal-600 text-base" />
                          <span>Prescribed Medications ({rx?.medicines?.length || 0})</span>
                        </h4>
                        <span className="text-[10px] text-slate-400 font-mono">Structured Rx</span>
                      </div>

                      {rx?.medicines && rx.medicines.length > 0 ? (
                        <div className="space-y-2">
                          {rx.medicines.map((med, idx) => (
                            <div
                              key={idx}
                              className="p-3.5 rounded-xl border bg-slate-50/80 border-slate-200 hover:border-teal-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-all"
                            >
                              <div className="flex items-center gap-3">
                                <span className="w-6 h-6 rounded-lg bg-teal-100 text-teal-900 font-bold text-xs flex items-center justify-center flex-shrink-0">
                                  {idx + 1}
                                </span>
                                <div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-extrabold text-sm text-slate-900">
                                      {med.name}
                                    </span>
                                    {med.strength && (
                                      <span className="px-2 py-0.5 rounded-md bg-teal-50 border border-teal-200 text-teal-900 font-semibold text-xs">
                                        {med.strength}
                                      </span>
                                    )}
                                  </div>
                                  {med.timing_instructions && (
                                    <p className="text-[11px] text-slate-500 mt-0.5">{med.timing_instructions}</p>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 self-start sm:self-auto text-xs flex-wrap">
                                {med.dosage && (
                                  <span className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 font-medium text-slate-700 shadow-2xs">
                                    {med.dosage}
                                  </span>
                                )}
                                {med.frequency && (
                                  <span className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 font-bold text-emerald-800 shadow-2xs">
                                    {med.frequency}
                                  </span>
                                )}
                                {med.duration && (
                                  <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 text-[11px]">
                                    {med.duration}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500 italic p-3 bg-slate-50 rounded-xl">
                          No distinct medications identified on this prescription.
                        </p>
                      )}

                      {/* Instructions, Precautions & Notes */}
                      {rx?.general_advice_or_lifestyle && rx.general_advice_or_lifestyle.length > 0 && (
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                          <span className="text-[10px] uppercase font-bold text-slate-500 block">
                            Instructions, Precautions & Doctor Notes:
                          </span>
                          <ul className="space-y-1">
                            {rx.general_advice_or_lifestyle.map((item, i) => (
                              <li key={i} className="text-xs text-slate-700 flex items-start gap-1.5">
                                <span className="text-teal-600 font-bold">•</span>
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {rx?.follow_up_advice && (
                        <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl text-xs text-teal-900 flex items-center gap-2">
                          <Icon name="event" className="text-teal-700 text-base flex-shrink-0" />
                          <span><strong>Follow-up:</strong> {rx.follow_up_advice}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ── MEDICAL & LABORATORY REPORT VIEW ── */}
                {(docType === 'medical_report' || docType === 'laboratory_test') && (
                  <div className="space-y-4">
                    {/* Investigation Header */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white rounded-2xl p-4 border border-slate-200 shadow-sm text-xs">
                      <div>
                        <span className="text-slate-400 text-[10px] uppercase font-bold block">Test / Investigation:</span>
                        {renderValue(rep?.test_or_study_name || record.title)}
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px] uppercase font-bold block">Diagnostic Center / Lab:</span>
                        {renderValue(rep?.laboratory_or_imaging_center)}
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px] uppercase font-bold block">Report Date:</span>
                        {renderValue(rep?.report_date || record.date)}
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px] uppercase font-bold block">Referring Doctor:</span>
                        {renderValue(rep?.referring_physician || record.doctorName)}
                      </div>
                    </div>

                    {/* Numerical Measurements / Lab Values Table (Requirement 5) */}
                    {rep?.measurements && rep.measurements.length > 0 && (
                      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-3">
                        <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                          <Icon name="science" className="text-teal-600 text-base" />
                          <span>Test Measurements & Lab Values ({rep.measurements.length})</span>
                        </h4>

                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="border-b border-slate-200 text-slate-400 text-[10px] uppercase">
                                <th className="py-2 px-2 font-bold">Parameter</th>
                                <th className="py-2 px-2 font-bold">Observed Value</th>
                                <th className="py-2 px-2 font-bold">Unit</th>
                                <th className="py-2 px-2 font-bold">Reference Interval</th>
                                <th className="py-2 px-2 font-bold">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {rep.measurements.map((m, idx) => (
                                <tr key={idx} className="hover:bg-slate-50/80">
                                  <td className="py-2.5 px-2 font-bold text-slate-900">{m.parameter}</td>
                                  <td className="py-2.5 px-2 font-mono font-bold text-slate-900">
                                    {m.value}
                                    {m.is_uncertain && (
                                      <span className="ml-1 text-[10px] text-amber-600" title="Uncertain reading">
                                        ⚠
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-2 text-slate-500 font-mono">{m.unit || 'N/A'}</td>
                                  <td className="py-2.5 px-2 text-slate-500 font-mono">{m.reference_range || 'Not specified'}</td>
                                  <td className="py-2.5 px-2">
                                    <span
                                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                        m.status === 'High' || m.status === 'Abnormal'
                                          ? 'bg-rose-100 text-rose-800'
                                          : m.status === 'Low'
                                          ? 'bg-amber-100 text-amber-800'
                                          : m.status === 'Normal'
                                          ? 'bg-emerald-100 text-emerald-800'
                                          : 'bg-slate-100 text-slate-600'
                                      }`}
                                    >
                                      {m.status || 'Reported'}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Key Findings */}
                    {rep?.key_findings && rep.key_findings.length > 0 && (
                      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-2">
                        <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                          <Icon name="fact_check" className="text-teal-600 text-base" />
                          <span>Clinical Observations & Findings</span>
                        </h4>
                        <ul className="space-y-1.5">
                          {rep.key_findings.map((finding, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-xs text-slate-700">
                              <span className="w-1.5 h-1.5 rounded-full bg-teal-600 mt-1.5 flex-shrink-0" />
                              <span>{finding}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Conclusions / Impressions */}
                    {rep?.conclusions_or_impression && rep.conclusions_or_impression.length > 0 && (
                      <div className="p-3.5 bg-teal-50 border border-teal-200 rounded-xl space-y-1">
                        <span className="text-[10px] font-bold text-teal-800 uppercase tracking-wider block">
                          Diagnostic Impressions / Conclusions:
                        </span>
                        {rep.conclusions_or_impression.map((conc, idx) => (
                          <p key={idx} className="text-xs text-teal-950 font-medium">
                            • {conc}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ── RADIOLOGY & IMAGING VIEW ── */}
                {docType === 'radiology_imaging' && (
                  <div className="space-y-4">
                    <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-3">
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                        <Icon name="radiology" className="text-teal-600 text-base" />
                        <span>Radiology & Imaging Report Details</span>
                      </h4>
                      <div>
                        <span className="text-slate-400 text-[10px] uppercase font-bold block">Study Name:</span>
                        {renderValue(rep?.test_or_study_name || record.title)}
                      </div>
                      {rep?.key_findings && rep.key_findings.length > 0 && (
                        <div>
                          <span className="text-slate-400 text-[10px] uppercase font-bold block mb-1">Imaging Findings:</span>
                          <ul className="space-y-1 text-xs text-slate-700">
                            {rep.key_findings.map((f, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-teal-600 mt-1.5 flex-shrink-0" />
                                <span>{f}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {rep?.conclusions_or_impression && rep.conclusions_or_impression.length > 0 && (
                        <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl">
                          <span className="text-[10px] font-bold text-teal-800 uppercase tracking-wider block mb-1">
                            Radiologist Impression:
                          </span>
                          {rep.conclusions_or_impression.map((c, i) => (
                            <p key={i} className="text-xs text-teal-950 font-medium">
                              • {c}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ── DISCHARGE SUMMARY VIEW ── */}
                {docType === 'discharge_summary' && (
                  <div className="space-y-4">
                    <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-3 text-xs">
                      <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                        <Icon name="hotel" className="text-teal-600 text-base" />
                        <span>Hospital Discharge Summary</span>
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <span className="text-slate-400 text-[10px] uppercase font-bold block">Hospital / Institute:</span>
                          {renderValue(ds?.hospital_name)}
                        </div>
                        <div>
                          <span className="text-slate-400 text-[10px] uppercase font-bold block">Attending Consultant:</span>
                          {renderValue(ds?.attending_physician)}
                        </div>
                        <div>
                          <span className="text-slate-400 text-[10px] uppercase font-bold block">Admission Date:</span>
                          {renderValue(ds?.admission_date)}
                        </div>
                        <div>
                          <span className="text-slate-400 text-[10px] uppercase font-bold block">Discharge Date:</span>
                          {renderValue(ds?.discharge_date)}
                        </div>
                      </div>

                      {ds?.final_diagnoses && ds.final_diagnoses.length > 0 && (
                        <div>
                          <span className="text-slate-400 text-[10px] uppercase font-bold block mb-1">Final Confirmed Diagnoses:</span>
                          <div className="flex flex-wrap gap-1.5">
                            {ds.final_diagnoses.map((d, i) => (
                              <span key={i} className="px-2 py-0.5 rounded bg-teal-50 border border-teal-200 text-teal-900 font-medium text-xs">
                                {d}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {ds?.procedures_or_surgeries && ds.procedures_or_surgeries.length > 0 && (
                        <div>
                          <span className="text-slate-400 text-[10px] uppercase font-bold block mb-1">Procedures Performed:</span>
                          <ul className="space-y-1">
                            {ds.procedures_or_surgeries.map((p, i) => (
                              <li key={i} className="text-xs text-slate-700">• {p}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {ds?.discharge_medications && ds.discharge_medications.length > 0 && (
                        <div className="pt-2 border-t border-slate-100">
                          <span className="text-slate-400 text-[10px] uppercase font-bold block mb-2">Discharge Medications:</span>
                          <div className="space-y-2">
                            {ds.discharge_medications.map((m, i) => (
                              <div key={i} className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-xs flex justify-between">
                                <span className="font-bold text-slate-900">{m.name} {m.strength}</span>
                                <span className="text-slate-600">{m.dosage} • {m.frequency}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}


                {/* No extraction prompt if OCR is still null */}
                {!currentOcr && !isAnalyzing && (
                  <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 shadow-sm space-y-3">
                    <Icon name="psychology" className="text-4xl text-teal-600 mx-auto" />
                    <h4 className="font-bold text-slate-800 text-sm">Document Ready for Qwen2.5-VL Extraction</h4>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                      Click below to extract medicine names, dosages, or laboratory findings using the hosted Qwen2.5-VL-7B-Instruct model.
                    </p>
                    <button
                      onClick={handleRunOcr}
                      className="teal-gradient-btn text-white text-xs font-bold px-6 py-2.5 rounded-full shadow-pill-glow"
                    >
                      Extract Document Data Now
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ── TAB 2: VERIFIED CLINICAL JSON FORMAT ── */}
            {activeTab === 'json' && (
              <div className="space-y-4">
                <div className="bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-800 text-xs">
                  <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2.5 flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-teal-500/20 text-teal-400 flex items-center justify-center">
                        <Icon name="data_object" className="text-base" />
                      </div>
                      <div>
                        <span className="font-extrabold text-slate-100 text-xs sm:text-sm block">
                          Verified Clinical Entity JSON Format
                        </span>
                        <span className="text-[10px] text-teal-400 font-mono">
                          Direct output of image text converted into structured clinical JSON
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleCopyJson}
                      className="px-3.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors shadow-sm"
                      title="Copy complete JSON payload"
                    >
                      <Icon name={copiedJson ? 'check' : 'content_copy'} className="text-xs" />
                      <span>{copiedJson ? 'Copied!' : 'Copy JSON'}</span>
                    </button>
                  </div>
                  <pre className="font-mono text-teal-300 text-[11px] sm:text-xs overflow-x-auto p-4 bg-slate-950 rounded-xl max-h-[64vh] leading-relaxed whitespace-pre-wrap border border-slate-800/80">
                    {JSON.stringify(currentOcr || record.ocrData || {}, null, 2)}
                  </pre>
                </div>
              </div>
            )}

            {/* ── TAB 3: DIGITIZED RAW TEXT ── */}
            {activeTab === 'raw' && (
              <div className="space-y-4">
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 text-xs">
                  <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2.5 flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-200">
                        <Icon name="article" className="text-base" />
                      </div>
                      <div>
                        <span className="font-extrabold text-slate-900 text-xs sm:text-sm block">
                          Verbatim Digitized Text from Image
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          Exact handwriting and print transcribed by model
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleCopyTranscription}
                      className="px-3.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition-colors"
                      title="Copy transcription text"
                    >
                      <Icon name={copied ? 'check' : 'content_copy'} className="text-xs" />
                      <span>{copied ? 'Copied!' : 'Copy Text'}</span>
                    </button>
                  </div>
                  <pre className="font-mono text-slate-800 text-xs sm:text-[13px] overflow-x-auto p-4 bg-slate-50 border border-slate-200 rounded-xl max-h-[64vh] leading-relaxed whitespace-pre-wrap">
                    {currentOcr?.raw_transcription || 'No digitized transcription available for this record.'}
                  </pre>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Action Footer */}
          <div className="bg-white border-t border-slate-200 p-4 px-6 flex items-center justify-between flex-shrink-0">
            <span className="text-[11px] text-slate-500 font-medium">
              OnePatient Verified Clinical OCR Pipeline • Non-Diagnostic
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
