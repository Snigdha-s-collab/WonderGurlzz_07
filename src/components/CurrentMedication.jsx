import { useState, useMemo, useEffect } from 'react';
import NotificationBell from './NotificationBell';
import {
  fetchRecordsFromSupabase,
  subscribeToMedicalRecords,
  unsubscribeFromMedicalRecords,
} from '../lib/supabaseClient';

function Icon({ name, className = '' }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>;
}

/**
 * Parses duration string (e.g. '3D', '5 days', '7 days', '10 days', '2 weeks') into days if specified.
 * Returns null if no duration was written on the prescription image.
 */
function parseDurationDays(durationStr) {
  if (!durationStr || typeof durationStr !== 'string') return null;
  const clean = durationStr.trim().toUpperCase();

  // Handle shorthand like "3D", "5D", "7D"
  const dOnly = clean.match(/^(\d+)\s*D$/);
  if (dOnly) {
    return parseInt(dOnly[1], 10);
  }

  const match = clean.match(/(\d+)\s*(D|DAY|DAYS|WK|WKS|WEEK|WEEKS|MO|MOS|MONTH|MONTHS)/);
  if (match) {
    const val = parseInt(match[1], 10);
    const unit = match[2];
    if (unit.startsWith('D')) return val;
    if (unit.startsWith('W')) return val * 7;
    if (unit.startsWith('M')) return val * 30;
  }
  return null;
}

/**
 * Formats duration directly from prescription without default assumptions.
 */
function formatMedicationDuration(durationStr) {
  if (!durationStr || !durationStr.trim()) {
    return {
      durationText: 'As Prescribed',
      durationDisplay: 'As Prescribed',
    };
  }

  const durationDays = parseDurationDays(durationStr);
  if (!durationDays) {
    const cleanStr = durationStr.trim();
    return {
      durationText: cleanStr,
      durationDisplay: cleanStr.endsWith('D') ? `${cleanStr.slice(0, -1)} Days` : cleanStr,
    };
  }

  return {
    durationText: `${durationDays} Days`,
    durationDisplay: `${durationDays} ${durationDays === 1 ? 'Day' : 'Days'}`,
  };
}

export default function CurrentMedication({
  setPage,
  uploads = [],
  currentUser,
  onLogout,
  onOpenUploadModal,
  notifications = [],
  reminders = [],
  onMarkTaken,
  onDismissNotification,
  onTriggerTestReminder,
  onOpenMedBot,
  isDoctorPortal = false,
  patientName = 'Eleanor Vance',
  onBackToRecords,
}) {
  const isLegitRecord = (item) =>
    item &&
    item.id !== 'upload-init-neuro' &&
    item.id !== 'upload-init-general' &&
    !item.doctorName?.includes('Sudarshan') &&
    !item.doctorName?.includes('Neelkanta') &&
    !item.doctorName?.includes('Rajiv') &&
    !item.title?.includes('Rajiv') &&
    !(item.title === 'General' && !item.doctorName);

  const [liveUploads, setLiveUploads] = useState(() => (uploads || []).filter(isLegitRecord));

  useEffect(() => {
    if (uploads && uploads.length > 0) {
      setLiveUploads(uploads.filter(isLegitRecord));
    }
  }, [uploads]);

  useEffect(() => {
    let isMounted = true;
    async function refreshFromSupabase() {
      try {
        const fresh = await fetchRecordsFromSupabase();
        if (isMounted && Array.isArray(fresh) && fresh.length > 0) {
          setLiveUploads(fresh.filter(isLegitRecord));
        }
      } catch (err) {
        console.warn('CurrentMedication fetch error:', err);
      }
    }
    refreshFromSupabase();

    // Fast initial refresh and continuous real-time sync with database
    const interval = setInterval(() => {
      if (isMounted) refreshFromSupabase();
    }, 3000);

    const channel = subscribeToMedicalRecords(() => {
      if (isMounted) refreshFromSupabase();
    });

    return () => {
      isMounted = false;
      clearInterval(interval);
      if (channel) {
        unsubscribeFromMedicalRecords(channel);
      }
    };
  }, []);

  // ── Extract All Real Prescribed Medicines Directly From Uploaded Documents ──
  const extractedMedications = useMemo(() => {
    const list = [];

    liveUploads.forEach((rec) => {
      const rx = rec.ocrData?.prescription_data || rec.prescription_data;
      const medicines = rx?.medicines || (Array.isArray(rec.medicines) ? rec.medicines : []);

      if (Array.isArray(medicines) && medicines.length > 0) {
        medicines.forEach((med, idx) => {
          if (!med || !med.name) return;

          const durationInfo = formatMedicationDuration(med.duration);

          list.push({
            id: `${rec.id}-med-${idx}`,
            name: med.name,
            strength: med.strength || '',
            durationDisplay: durationInfo.durationDisplay,
            recordId: rec.id,
            rawDuration: med.duration || '',
          });
        });
      }
    });

    // Deduplicate by (normalized name + strength) to merge re-uploads while keeping all distinct medicines
    const uniqueMap = new Map();
    list.forEach((item) => {
      let cleanName = item.name.toLowerCase().replace(/^(tab\.|cap\.|syp\.|inj\.)\s*/i, '').trim().replace(/[^a-z0-9]/g, '');
      if (cleanName.startsWith('oxpre')) cleanName = 'oxprelol';
      if (cleanName.startsWith('dorzola')) cleanName = 'dorzolamide';

      const key = `${cleanName}_${item.strength.toLowerCase().replace(/\s+/g, '')}`;

      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, item);
      } else {
        const existing = uniqueMap.get(key);
        if (item.rawDuration && !existing.rawDuration) {
          uniqueMap.set(key, item);
        }
      }
    });

    return Array.from(uniqueMap.values());
  }, [liveUploads]);

  return (
    <div className="min-h-screen bg-[#faf8ff] text-[#131b2e] flex flex-col font-['Plus_Jakarta_Sans',sans-serif]">
      {/* ── HEADER NAVBAR ── */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#00241f] px-4 py-3 shadow-md">
        {isDoctorPortal ? (
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full teal-gradient-btn flex items-center justify-center shadow-orb-glow">
                <Icon name="stethoscope" className="text-xl text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-white font-extrabold text-base leading-tight">OnePatient Clinical Portal</span>
                  <span className="bg-teal-900 border border-teal-400/40 text-teal-300 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                    Verified Doctor View
                  </span>
                </div>
                <div className="text-teal-300 text-[11px] font-mono leading-tight mt-0.5">
                  Patient: {patientName} • Current Medication Viewer
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {onBackToRecords && (
                <button
                  onClick={onBackToRecords}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-teal-400 hover:bg-teal-300 text-teal-950 text-xs font-bold transition-all shadow-sm"
                >
                  <Icon name="arrow_back" className="text-sm" />
                  <span>Back to Patient Records</span>
                </button>
              )}
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
        ) : (
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setPage('landing')}
                className="w-10 h-10 rounded-full teal-gradient-btn flex items-center justify-center shadow-orb-glow"
                title="Return Home"
              >
                <span className="text-white font-black text-sm">Dr.</span>
              </button>
              <div className="text-white font-bold text-lg leading-tight">OnePatient</div>
            </div>

            {/* Desktop Nav */}
            <nav className="hidden lg:flex items-center glass-nav-card rounded-full px-6 py-2 gap-6">
              {[
                { id: 'landing', label: 'Home' },
                { id: 'my-uploads', label: 'My Uploads' },
                { id: 'current-medication', label: 'Current Medication' },
                { id: 'access-qr', label: 'Access QR' },
                { id: 'medbot', label: 'Ask MedBot' },
                { id: 'about-us', label: 'About Us' },
              ].map((link) => (
                <button
                  key={link.id}
                  onClick={() => {
                    if (link.id === 'medbot') {
                      onOpenMedBot ? onOpenMedBot() : setPage('medbot');
                    } else {
                      setPage(link.id);
                    }
                  }}
                  className={`text-sm font-medium transition-colors ${
                    link.id === 'current-medication'
                      ? 'text-teal-300 font-bold border-b-2 border-teal-300 pb-0.5'
                      : 'text-white/80 hover:text-teal-300'
                  }`}
                >
                  {link.label}
                </button>
              ))}
            </nav>

            {/* User Section & Notifications */}
            <div className="flex items-center gap-4">
              <NotificationBell
                notifications={notifications}
                reminders={reminders}
                onMarkTaken={onMarkTaken}
                onDismissNotification={onDismissNotification}
                onTriggerTestReminder={onTriggerTestReminder}
                onOpenMedBot={() => (onOpenMedBot ? onOpenMedBot() : setPage('medbot'))}
              />

              <div className="hidden sm:flex flex-col items-center">
                <div className="w-9 h-9 rounded-full teal-gradient-btn flex items-center justify-center text-white shadow-sm border border-white/20">
                  <Icon name="person" className="text-xl" />
                </div>
                <span className="text-[11px] font-semibold text-white/90 max-w-[110px] truncate leading-tight mt-0.5 text-center">
                  {currentUser?.name || 'User'}
                </span>
              </div>

              {onLogout && (
                <button
                  onClick={onLogout}
                  className="p-2 rounded-full text-white/70 hover:text-red-300 hover:bg-white/10 transition-colors"
                  title="Log Out"
                >
                  <Icon name="logout" className="text-2xl" />
                </button>
              )}
            </div>
          </div>
        )}
      </header>

      {/* ── HERO BANNER ── */}
      <section className="bg-gradient-to-br from-[#00241f] via-[#053d34] to-[#011a16] pt-24 pb-7 px-6 text-white border-b border-teal-900/40">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 bg-teal-400/10 border border-teal-400/30 rounded-full px-3 py-0.5 mb-2">
              <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
              <span className="text-teal-200 text-xs font-bold tracking-wide uppercase">
                {isDoctorPortal ? `Patient Prescriptions • ${patientName}` : 'Prescription Registry'}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {isDoctorPortal ? `Current Prescribed Medications of ${patientName}` : 'Current Prescribed Medications'}
            </h1>
            <p className="text-teal-100/70 text-xs sm:text-sm mt-1 max-w-xl">
              Authentic medications extracted directly from uploaded clinical prescriptions.
            </p>
          </div>

          <div className="flex items-center gap-3 self-start sm:self-auto">
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-2.5 px-4 border border-white/15 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-teal-500/20 text-teal-300 flex items-center justify-center">
                <Icon name="medication" className="text-xl" />
              </div>
              <div>
                <div className="text-xl font-black text-white">{extractedMedications.length}</div>
                <div className="text-[10px] text-teal-200 uppercase font-semibold">Total Medicines</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── MAIN CONTENT (CLEAN DOWN-BY-DOWN HORIZONTAL STRIP LIST) ── */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 flex-1 w-full">
        {extractedMedications.length === 0 ? (
          /* Empty State */
          <div className="bg-white rounded-3xl p-10 text-center border border-slate-200 shadow-sm max-w-xl mx-auto my-8">
            <div className="w-16 h-16 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center mx-auto mb-3 border border-teal-100">
              <Icon name="medication" className="text-3xl" />
            </div>
            <h2 className="text-lg font-extrabold text-slate-800 mb-1">
              No Prescriptions Digitized Yet
            </h2>
            <p className="text-xs text-slate-500 mb-5 max-w-sm mx-auto leading-relaxed">
              Upload your doctor prescription to view all your prescribed medications.
            </p>
            <button
              onClick={onOpenUploadModal}
              className="inline-flex items-center gap-2 teal-gradient-btn text-white font-bold px-5 py-2.5 rounded-full text-xs shadow-md hover:scale-105 transition-all"
            >
              <Icon name="upload" className="text-base" />
              Upload Prescription Document
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {extractedMedications.map((med) => (
              <div
                key={med.id}
                className="w-full bg-white rounded-xl px-4 py-2.5 sm:py-3 border border-slate-200/90 shadow-2xs hover:shadow-xs hover:border-teal-400 transition-all flex items-center justify-between gap-3"
              >
                {/* Left: Only the medicine name */}
                <div className="flex items-center gap-2.5 flex-wrap min-w-0">
                  <h3 className="font-extrabold text-sm sm:text-base text-slate-900">
                    {med.name}
                  </h3>
                  {med.strength && (
                    <span className="px-2 py-0.5 rounded-md bg-teal-50 border border-teal-200 text-teal-900 font-bold text-xs">
                      {med.strength}
                    </span>
                  )}
                  <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
                    Active
                  </span>
                </div>

                {/* Right: Duration */}
                <div className="bg-emerald-50/70 px-3 py-1 rounded-lg border border-emerald-200/80 flex items-center gap-2 flex-shrink-0">
                  <span className="text-[10px] uppercase font-bold text-emerald-700 tracking-wider">
                    Duration:
                  </span>
                  <span className="text-xs sm:text-sm font-extrabold text-emerald-950">
                    {med.durationDisplay}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
