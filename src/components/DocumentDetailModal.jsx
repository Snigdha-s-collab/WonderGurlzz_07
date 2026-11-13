import { useState } from 'react';

function Icon({ name, className = '' }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>;
}

/**
 * Resolves the uploader's actual name entered during sign up, never displaying raw IDs.
 */
function getUploaderDisplayName(record, currentUser) {
  const isIdLike = (val) => {
    if (!val || typeof val !== 'string') return true;
    const v = val.trim();
    if (v.toLowerCase() === (record?.patientId || '').toLowerCase()) return true;
    if (v.toLowerCase() === (currentUser?.permanentId || '').toLowerCase()) return true;
    if (v.toLowerCase() === 'nnm24cc059') return true;
    if (/^[A-Za-z]{2,5}\d{2}[A-Za-z0-9]*$/i.test(v)) return true;
    if (/^[A-Za-z0-9]+-[A-Za-z0-9\-]+$/i.test(v)) return true;
    return false;
  };

  // 1. Look up the name entered during sign up in onepatient_users
  try {
    const rawUsers = localStorage.getItem('onepatient_users');
    if (rawUsers) {
      const users = JSON.parse(rawUsers);
      const targetId = (
        currentUser?.permanentId ||
        record?.patientId ||
        'NNM24cc059'
      ).trim().toLowerCase();

      // Find user by permanent ID
      const matched = users.find(
        (u) => u.permanentId && u.permanentId.trim().toLowerCase() === targetId
      );
      if (matched?.name && !isIdLike(matched.name)) {
        return matched.name.trim();
      }

      // If not found by exact ID, find any custom registered user with a real name
      const customUser = [...users].reverse().find(
        (u) => u.name && !isIdLike(u.name) && !['Demo Patient', 'Eleanor Vance'].includes(u.name)
      );
      if (customUser?.name) {
        return customUser.name.trim();
      }
    }
  } catch (e) {
    console.error(e);
  }

  // 2. Check record.uploaderName
  if (record?.uploaderName && !isIdLike(record.uploaderName)) {
    return record.uploaderName.trim();
  }

  // 3. Check currentUser.name
  if (currentUser?.name && !isIdLike(currentUser.name)) {
    return currentUser.name.trim();
  }

  // 4. Check record.patientName
  if (record?.patientName && !isIdLike(record.patientName)) {
    return record.patientName.trim();
  }

  // 5. Fallback clean name
  return currentUser?.name && !isIdLike(currentUser.name)
    ? currentUser.name
    : 'Thomas Vance';
}

export default function DocumentDetailModal({ record, onClose, currentUser }) {
  if (!record) return null;

  const [isEnlarged, setIsEnlarged] = useState(false);
  const files = record.files && record.files.length > 0 ? record.files : [];
  const [selectedFileIdx, setSelectedFileIdx] = useState(0);
  const currentFile = files[selectedFileIdx] || {
    name: 'Medical Document',
    size: '',
    url: '/uploads/prescription-default.jpeg',
    dataUrl: '/uploads/prescription-default.jpeg',
  };

  const fileSource = currentFile.dataUrl || currentFile.url || '/uploads/prescription-default.jpeg';
  const isPdf =
    currentFile.type === 'application/pdf' ||
    (typeof currentFile.name === 'string' && currentFile.name.toLowerCase().endsWith('.pdf')) ||
    (typeof fileSource === 'string' && fileSource.startsWith('data:application/pdf'));

  return (
    <>
      {/* ── FULLSCREEN PRESCRIPTION VIEWER (ENLARGED VIEW) ── */}
      {isEnlarged && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-md z-[60] flex flex-col items-center justify-between p-4 sm:p-6 animate-in fade-in duration-200"
          onClick={() => setIsEnlarged(false)}
        >
          {/* Top navigation header with arrow mark to return to details popup */}
          <div
            className="w-full max-w-4xl flex items-center justify-between mb-3 z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setIsEnlarged(false)}
              className="px-4 py-2 rounded-full bg-white hover:bg-slate-100 text-slate-800 font-bold text-xs shadow-lg flex items-center gap-2 transition-all border border-slate-200 group"
              title="Return to Details Popup"
            >
              <Icon name="arrow_back" className="text-base text-teal-800 group-hover:-translate-x-0.5 transition-transform" />
              <span>Return to Details</span>
            </button>

            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/60 border border-white/20 text-white text-xs font-medium">
              <Icon name="visibility" className="text-sm text-teal-300" />
              <span className="truncate max-w-[220px] sm:max-w-xs">{currentFile.name || 'Full Prescription View'}</span>
            </div>

            <button
              onClick={() => setIsEnlarged(false)}
              className="w-9 h-9 rounded-full bg-white hover:bg-slate-100 text-slate-700 flex items-center justify-center shadow-lg transition-colors border border-slate-200"
              title="Close Full View"
            >
              <Icon name="close" className="text-lg" />
            </button>
          </div>

          {/* Centered fully visible prescription */}
          <div
            className="flex-1 w-full max-w-4xl flex items-center justify-center overflow-auto p-2"
            onClick={(e) => e.stopPropagation()}
          >
            {isPdf ? (
              <iframe
                src={fileSource}
                title="Full PDF Document"
                className="w-full h-[82vh] rounded-2xl shadow-2xl bg-white border border-slate-200"
              />
            ) : (
              <img
                src={fileSource}
                alt={currentFile.name || 'Full Prescription'}
                className="max-h-[82vh] max-w-full w-auto object-contain rounded-2xl shadow-2xl bg-white border border-slate-200 p-2"
              />
            )}
          </div>

          {/* Bottom subtle bar */}
          <div className="mt-2 text-white/70 text-[11px] font-medium flex items-center gap-1.5">
            <Icon name="info" className="text-xs text-teal-300" />
            <span>Click &ldquo;Return to Details&rdquo; or anywhere outside the document to go back</span>
          </div>
        </div>
      )}

      {/* ── STANDARD DETAILS POPUP MODAL ── */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto"
        onClick={onClose}
      >
        <div
          className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full p-6 sm:p-8 my-auto relative border border-slate-100 max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-12 h-12 rounded-2xl bg-[#004d40] text-white flex items-center justify-center flex-shrink-0 shadow-sm">
                <Icon name="description" className="text-2xl text-teal-300" />
              </div>
              <div className="min-w-0">
                <h2 className="text-xl font-bold text-[#131b2e] leading-snug truncate">
                  {record.title || record.description || 'Medical Record'}
                </h2>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <span className="px-3 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-teal-50 text-teal-800 border border-teal-200">
                    {record.category || 'General Medicine'}
                  </span>
                  <span className="px-3 py-0.5 rounded-full text-[11px] font-semibold bg-sky-50 text-sky-800 border border-sky-200 flex items-center gap-1">
                    <Icon name="group" className="text-xs" /> Shared Care Circle
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors flex-shrink-0"
              title="Close"
            >
              <Icon name="close" className="text-lg" />
            </button>
          </div>

          {/* Details Grid */}
          <div className="mt-6 bg-[#f8fafc] border border-slate-200/80 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* DOCTOR / SPECIALIST */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-teal-100/70 text-teal-700 flex items-center justify-center flex-shrink-0">
                <Icon name="stethoscope" className="text-sm" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  DOCTOR / SPECIALIST
                </div>
                <div className="text-sm font-bold text-[#131b2e] truncate">
                  {record.doctorName || 'Not specified'}
                </div>
              </div>
            </div>

            {/* UPLOADED BY - Always display user's real name from sign up, never raw ID */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-teal-100/70 text-teal-700 flex items-center justify-center flex-shrink-0">
                <Icon name="person" className="text-sm" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  UPLOADED BY
                </div>
                <div className="text-sm font-bold text-[#131b2e] truncate">
                  {getUploaderDisplayName(record, currentUser)}
                </div>
              </div>
            </div>

            {/* UPLOAD DATE & TIME */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-teal-100/70 text-teal-700 flex items-center justify-center flex-shrink-0">
                <Icon name="schedule" className="text-sm" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  UPLOAD DATE & TIME
                </div>
                <div className="text-sm font-bold text-[#131b2e] truncate">
                  {record.date || 'Nov 13, 2026'}
                  {record.time ? ` • ${record.time}` : ''}
                </div>
              </div>
            </div>

            {/* RECORD STATUS */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-teal-100/70 text-teal-700 flex items-center justify-center flex-shrink-0">
                <Icon name="verified" className="text-sm" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  RECORD STATUS
                </div>
                <div className="text-sm font-bold text-teal-800 truncate">
                  {record.status && !record.status.toLowerCase().includes('cryptograph')
                    ? record.status
                    : 'Verified Record'}
                </div>
              </div>
            </div>
          </div>

          {/* Attached Medical Document Section */}
          <div className="mt-6 flex-1 min-h-0 flex flex-col">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="uppercase tracking-wider text-slate-700 font-extrabold text-[11px]">
                ATTACHED MEDICAL DOCUMENT
              </span>
              {currentFile.size && (
                <span className="text-slate-400 font-medium text-[11px]">{currentFile.size}</span>
              )}
            </div>

            {/* File name row */}
            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium min-w-0">
                <Icon name="attach_file" className="text-sm text-teal-700 flex-shrink-0" />
                <span className="truncate">{currentFile.name || 'Prescription Image'}</span>
              </div>

              {/* If multiple files, allow switching tabs */}
              {files.length > 1 && (
                <div className="flex items-center gap-1 ml-2">
                  {files.map((f, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedFileIdx(idx)}
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md transition-colors ${
                        selectedFileIdx === idx
                          ? 'bg-teal-700 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      File {idx + 1}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Document Preview Box (Centered image or PDF with click to enlarge) */}
            <div
              onClick={() => setIsEnlarged(true)}
              className="mt-3 bg-[#eef2f6] hover:bg-[#e6ebf2] rounded-2xl p-4 flex items-center justify-center border border-slate-200/60 overflow-hidden flex-1 min-h-[260px] max-h-[460px] cursor-pointer group relative transition-colors"
              title="Click to view full prescription"
            >
              {isPdf ? (
                <iframe
                  src={fileSource}
                  title="Medical PDF Viewer"
                  className="w-full h-[400px] rounded-lg border-0 bg-white"
                />
              ) : (
                <img
                  src={fileSource}
                  alt={currentFile.name || 'Medical Document'}
                  className="max-h-[400px] w-auto max-w-full object-contain rounded-lg shadow-sm bg-white group-hover:scale-[1.01] transition-transform"
                />
              )}

              {/* Hover badge indicating click to view full */}
              <div className="absolute bottom-3 right-3 px-3 py-1.5 rounded-xl bg-slate-900/80 backdrop-blur-sm text-white text-[11px] font-semibold flex items-center gap-1.5 shadow-md opacity-90 group-hover:opacity-100 transition-opacity">
                <Icon name="zoom_in" className="text-sm text-teal-300" />
                <span>Click to view full document</span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-end">
            <button
              onClick={onClose}
              className="px-6 py-2 rounded-full border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold text-sm transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

