import { useState, useEffect } from 'react';
import DocumentSplitViewer from './DocumentSplitViewer';
import { fetchRecordsFromSupabase } from '../lib/supabaseClient';

function Icon({ name, className = '' }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>;
}

const PROBLEM_CATEGORIES = [
  'All',
  'General Medicine',
  'Cardiology',
  'Endocrinology & Diabetes',
  'Radiology & Imaging',
  'Laboratory & Pathology',
  'Orthopedics',
  'Oncology',
  'Neurology',
  'Pediatrics',
  'Prescriptions & Pharmacy',
  'Emergency & Surgery',
  'Other',
];

export default function DoctorPortalView({ setPage, uploads = [], onUpdateRecord }) {
  // Extract token and patient name from hash query
  const getHashParams = () => {
    const hash = window.location.hash || '';
    const queryIdx = hash.indexOf('?');
    if (queryIdx === -1) return {};
    const queryStr = hash.substring(queryIdx + 1);
    const params = new URLSearchParams(queryStr);
    return {
      token: params.get('token') || '',
      patient: params.get('patient') || 'Eleanor Vance',
    };
  };

  const { token, patient } = getHashParams();

  const isLegitRecord = (item) =>
    item.id !== 'upload-init-neuro' &&
    item.id !== 'upload-init-general' &&
    !item.doctorName?.includes('Sudarshan') &&
    !item.doctorName?.includes('Neelkanta') &&
    !item.doctorName?.includes('Rajiv') &&
    !item.title?.includes('Rajiv') &&
    !(item.title === 'General' && !item.doctorName);

  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedRecordForViewer, setSelectedRecordForViewer] = useState(null);
  const [portalRecords, setPortalRecords] = useState(() => (uploads || []).filter(isLegitRecord));

  useEffect(() => {
    if (uploads && uploads.length > 0) {
      setPortalRecords(uploads.filter(isLegitRecord));
    }
  }, [uploads]);

  useEffect(() => {
    fetchRecordsFromSupabase().then((remote) => {
      if (remote && remote.length > 0) {
        setPortalRecords(remote.filter(isLegitRecord));
      }
    });
  }, []);

  const filteredRecords = portalRecords.filter((item) => {
    return selectedCategory === 'All' || item.category === selectedCategory;
  });

  return (
    <div className="bg-[#faf8ff] text-[#131b2e] min-h-screen flex flex-col">
      {/* ── DOCTOR PORTAL SECURE HEADER ── */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#00241f] text-white px-4 py-3 shadow-md border-b border-teal-800">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full teal-gradient-btn flex items-center justify-center shadow-orb-glow">
              <Icon name="stethoscope" className="text-xl text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-white font-extrabold text-base leading-tight">Hola Clinical Portal</span>
                <span className="bg-teal-900 border border-teal-400/40 text-teal-300 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                  Verified Doctor View
                </span>
              </div>
              <div className="text-teal-300 text-[11px] font-mono leading-tight mt-0.5">
                Session Token: {token ? token.substring(0, 16) + '...' : 'Live QR Scan'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-900/60 border border-teal-500/30 text-teal-300 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
              <span>In-Person Consent Active</span>
            </div>
            <button
              onClick={() => {
                window.location.hash = '';
                setPage('landing');
              }}
              className="bg-white/10 hover:bg-white/20 text-white text-xs font-bold px-3 py-1.5 rounded-full transition-colors flex items-center gap-1"
            >
              <Icon name="logout" className="text-sm" />
              <span>Exit Portal</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── MAIN CONTENT ── */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 pt-24 pb-16">
        
        {/* Patient Identity Banner */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-100 mb-8">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-teal-50 text-teal-900 flex items-center justify-center font-black text-2xl shadow-inner border border-teal-100 flex-shrink-0">
              <Icon name="person" className="text-3xl text-teal-700" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] uppercase tracking-wider font-bold text-teal-700">Patient Profile</span>
                <span className="px-2 py-0.5 rounded-full bg-teal-50 border border-teal-200 text-teal-800 text-[10px] font-semibold flex items-center gap-1">
                  <Icon name="verified" className="text-xs text-teal-600" /> Authorized
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-[#00241f] tracking-tight mt-0.5">
                Welcome to {patient}'s profile
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Authorized via physical In-Person QR Scan. Temporary 2-hour scoped clinical read access.
              </p>
            </div>
          </div>
        </div>

        {/* ── CATEGORY DROPDOWN SELECTOR (NO SEPARATE SEARCH OR SUBMIT BUTTON) ── */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 mb-8 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-extrabold text-[#00241f] flex items-center gap-2">
              <Icon name="filter_alt" className="text-teal-700 text-xl" />
              <span>Filter Patient Records by Category</span>
            </h2>
            <span className="text-xs text-slate-400">
              {filteredRecords.length} record{filteredRecords.length !== 1 ? 's' : ''} available
            </span>
          </div>

          {/* Full-width clean Category Dropdown without Submit button */}
          <div className="relative w-full">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 text-sm text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all appearance-none cursor-pointer shadow-sm"
            >
              {PROBLEM_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat === 'All' ? 'All Categories (View Everything)' : cat}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-slate-500">
              <Icon name="arrow_drop_down" className="text-2xl" />
            </div>
          </div>
        </div>

        {/* ── MATCHING MEDICAL RECORDS ── */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-extrabold text-base text-[#00241f]">
              {selectedCategory === 'All' ? 'All Uploaded Medical Records' : `${selectedCategory} Records`}
            </h3>
          </div>

          {filteredRecords.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-100 shadow-sm">
              <div className="w-16 h-16 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                <Icon name="search_off" className="text-3xl" />
              </div>
              <h4 className="text-base font-bold text-slate-800">No records found</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                No matching uploaded reports or prescriptions found for the selected category or search keywords.
              </p>
              <button
                onClick={() => {
                  setSelectedCategory('All');
                }}
                className="mt-4 text-xs font-bold text-teal-700 hover:underline"
              >
                Clear all filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredRecords.map((item) => (
                <div
                  key={item.id}
                  className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:border-teal-300 hover:shadow-card-glass transition-all flex flex-col justify-between"
                >
                  <div>
                    {/* Category & Date badge */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="px-2.5 py-1 rounded-full bg-teal-50 border border-teal-200 text-teal-800 font-bold text-[10px] uppercase">
                        {item.category}
                      </span>
                      <span className="text-[11px] text-slate-400 font-mono">
                        {item.date || item.timestamp}
                      </span>
                    </div>

                    {/* Record Title / Heading */}
                    <h4 className="font-extrabold text-sm text-slate-900 mb-1 leading-snug">
                      {item.title || item.description}
                    </h4>

                    {/* Prescribing Doctor */}
                    {item.doctorName && (
                      <div className="flex items-center gap-1.5 text-xs text-teal-800 font-semibold mb-2">
                        <Icon name="stethoscope" className="text-sm text-teal-600" />
                        <span>{item.doctorName}</span>
                      </div>
                    )}

                    {/* Files Attached */}
                    {item.files && item.files.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-slate-100 space-y-1.5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          Attached Evidence ({item.files.length})
                        </span>
                        {item.files.map((file, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between bg-slate-50 rounded-xl px-2.5 py-1.5 text-xs text-slate-700"
                          >
                            <div className="flex items-center gap-2 truncate">
                              <Icon name="description" className="text-teal-600 text-sm flex-shrink-0" />
                              <span className="truncate font-medium">{file.name}</span>
                            </div>
                            {file.size && (
                              <span className="text-[10px] text-slate-400 flex-shrink-0 ml-1">
                                {file.size}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Footer status */}
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-teal-700">
                      <Icon name="verified" className="text-xs text-teal-500" />
                      <span>Immutable Provenance</span>
                    </span>
                    <button
                      onClick={() => setSelectedRecordForViewer(item)}
                      className="text-xs font-bold text-teal-800 hover:text-teal-600 hover:underline flex items-center gap-1"
                    >
                      <span>Open Document & AI OCR</span>
                      <Icon name="arrow_forward" className="text-sm" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* ── SPLIT SCREEN DOCUMENT & TRANSFORMER-BASED OCR VIEWER ── */}
      {selectedRecordForViewer && (
        <DocumentSplitViewer
          record={selectedRecordForViewer}
          onClose={() => setSelectedRecordForViewer(null)}
          onRecordUpdated={(updated) => {
            setSelectedRecordForViewer(updated);
            setPortalRecords((prev) =>
              prev.map((r) => (r.id === updated.id ? updated : r))
            );
            if (onUpdateRecord) onUpdateRecord(updated);
          }}
        />
      )}
    </div>
  );
}

