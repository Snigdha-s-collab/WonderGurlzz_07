import { useState } from 'react';
import { patientData, medications, consents } from '../data/patientData';

function Icon({ name, className = '' }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>;
}

export default function PatientDashboard({ setPage, onOpenUploadModal }) {
  const [activeTab, setActiveTab] = useState('my-health');
  const [medList, setMedList] = useState(medications);
  const [consentList, setConsentList] = useState(consents);
  const [breakGlass, setBreakGlass] = useState(true);
  const [copied, setCopied] = useState(false);
  const [completedMeds, setCompletedMeds] = useState({});

  const handleCopyId = () => {
    navigator.clipboard?.writeText(patientData.patientId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleDose = (id) => {
    setCompletedMeds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleRevoke = (id) => {
    setConsentList((prev) => prev.filter((c) => c.id !== id));
  };

  return (
    <div className="min-h-screen bg-slate-200 flex items-center justify-center p-0 sm:p-4">
      {/* Mobile container frame */}
      <div className="w-full sm:w-[410px] sm:max-w-md bg-[#faf8ff] sm:rounded-3xl shadow-2xl relative overflow-hidden flex flex-col min-h-screen sm:min-h-[880px] border sm:border-slate-300">
        
        {/* ── TOP HEADER ── */}
        <header className="sticky top-0 z-40 bg-[#0b3b34] text-white px-4 py-3 shadow-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setPage('landing')} 
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                title="Back to Landing Page"
              >
                <Icon name="arrow_back" className="text-sm text-teal-200" />
              </button>
              <div className="w-8 h-8 rounded-full bg-teal-400 text-teal-950 font-black flex items-center justify-center text-xs shadow-sm">
                Dr.
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-teal-300 text-xs font-bold tracking-tight">OnePatient</span>
                  <span className="bg-black/30 text-teal-300 text-[10px] font-mono px-1.5 py-0.2 rounded-full border border-teal-500/30">
                    {patientData.badgeId}
                  </span>
                </div>
                <div className="text-white font-extrabold text-sm leading-none mt-0.5">My Health</div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button 
                onClick={() => alert('Emergency SOS triggered! Notifying emergency services and ICE contact Thomas Vance (+1 555-019-2834).')}
                className="bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold px-2.5 py-1.5 rounded-full flex items-center gap-1 shadow-sm active:scale-95 transition-transform"
              >
                <Icon name="e911_emergency" className="text-base" />
                <span>SOS</span>
              </button>
              <div className="w-8 h-8 rounded-full bg-teal-900 border border-teal-500/30 flex items-center justify-center">
                <Icon name="person" className="text-teal-200 text-base" />
              </div>
            </div>
          </div>
        </header>

        {/* ── MAIN SCROLLABLE CONTENT ── */}
        <main className="flex-1 overflow-y-auto px-4 py-4 pb-28 space-y-5 text-[#131b2e]">
          
          {/* Greeting / Status row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative w-12 h-12 rounded-full overflow-hidden shadow-sm border border-teal-500/20">
                <img
                  src={patientData.photo}
                  alt={patientData.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.target.src = 'https://placehold.co/100x100/0b3b34/5eead4?text=EV';
                  }}
                />
                <span className="absolute bottom-0 right-0 w-3 h-3 bg-teal-400 rounded-full border-2 border-white"></span>
              </div>
              <div>
                <div className="flex items-center gap-1">
                  <span className="font-extrabold text-base text-[#131b2e]">Hello, {patientData.greeting}</span>
                  <Icon name="verified" className="text-teal-600 text-base" />
                </div>
                <p className="text-xs text-slate-500">Sync status: Fully encrypted & active</p>
              </div>
            </div>
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-teal-50 border border-teal-200 text-teal-800 text-xs font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse"></span>
              <span>Live Sync</span>
            </div>
          </div>

          {/* ── 1. GLOBAL HEALTH ID CARD ── */}
          <div className="rounded-3xl bg-gradient-to-br from-[#0b3b34] via-[#072d27] to-[#041a16] text-white p-5 shadow-xl relative overflow-hidden border border-teal-800">
            {/* Ambient background blur */}
            <div className="absolute -top-12 -right-12 w-36 h-36 bg-teal-400/20 blur-2xl rounded-full pointer-events-none" />
            <div className="absolute -bottom-8 -left-8 w-28 h-28 bg-teal-500/15 blur-xl rounded-full pointer-events-none" />

            {/* Top row */}
            <div className="flex items-start justify-between relative z-10 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-teal-300">
                  <Icon name="medical_services" className="text-base" />
                </div>
                <div>
                  <h3 className="text-[11px] font-bold text-teal-300 uppercase tracking-wider">Universal Health Pass</h3>
                  <p className="text-[10px] text-teal-100/70">Global Patient Record Network</p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-teal-400/20 text-teal-300 text-[10px] font-bold flex items-center gap-1 border border-teal-400/30">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-300 animate-pulse" /> Valid
              </span>
            </div>

            {/* Middle Identity & Scannable QR code */}
            <div className="flex items-center justify-between gap-3 relative z-10 mb-4">
              <div className="min-w-0">
                <span className="text-[10px] text-teal-200/70 uppercase tracking-wider block">Cardholder</span>
                <h2 className="text-xl font-extrabold text-white truncate">{patientData.name}</h2>
                <div className="flex items-center gap-2 text-xs text-teal-200/90 mt-1">
                  <span>DOB: {patientData.dob}</span>
                  <span>•</span>
                  <span className="font-bold text-teal-300">Type {patientData.bloodType}</span>
                </div>
              </div>

              {/* Scannable QR badge */}
              <div className="bg-white p-2 rounded-2xl shadow-md flex flex-col items-center flex-shrink-0">
                <svg className="w-14 h-14 text-[#00241f]" fill="currentColor" viewBox="0 0 100 100">
                  <rect x="0" y="0" width="28" height="28" rx="4" />
                  <rect x="4" y="4" width="20" height="20" fill="white" />
                  <rect x="8" y="8" width="12" height="12" rx="2" />
                  <rect x="72" y="0" width="28" height="28" rx="4" />
                  <rect x="76" y="4" width="20" height="20" fill="white" />
                  <rect x="80" y="8" width="12" height="12" rx="2" />
                  <rect x="0" y="72" width="28" height="28" rx="4" />
                  <rect x="4" y="76" width="20" height="20" fill="white" />
                  <rect x="8" y="80" width="12" height="12" rx="2" />
                  <rect x="36" y="8" width="8" height="8" rx="1" />
                  <rect x="52" y="16" width="8" height="8" rx="1" />
                  <rect x="36" y="36" width="12" height="12" rx="2" />
                  <rect x="56" y="36" width="10" height="10" rx="1" />
                  <rect x="76" y="48" width="8" height="8" rx="1" />
                  <rect x="36" y="60" width="10" height="8" rx="1" />
                  <rect x="52" y="72" width="14" height="8" rx="1" />
                  <rect x="72" y="76" width="10" height="12" rx="2" />
                  <rect x="88" y="64" width="8" height="8" rx="1" />
                </svg>
                <span className="text-[8px] font-black tracking-widest text-[#006b5f] mt-0.5">SCAN ER</span>
              </div>
            </div>

            {/* Monospace patient ID pill */}
            <div className="bg-black/40 rounded-xl px-3 py-2 flex items-center justify-between relative z-10 mb-4 border border-teal-500/20">
              <span className="font-mono text-xs text-teal-300 font-semibold tracking-wider">
                {patientData.patientId}
              </span>
              <button
                onClick={handleCopyId}
                className="text-teal-200 hover:text-white flex items-center gap-1 text-[11px] font-medium"
              >
                <Icon name={copied ? 'done' : 'content_copy'} className="text-sm" />
                <span>{copied ? 'Copied!' : 'Copy'}</span>
              </button>
            </div>

            {/* Action buttons inside card */}
            <div className="grid grid-cols-2 gap-2 relative z-10 mb-3">
              <button 
                onClick={() => alert(`Share Link for ${patientData.name}:\nhttps://onepatient.health/pass/${patientData.patientId}`)}
                className="py-2 px-3 rounded-full bg-teal-500 hover:bg-teal-400 text-teal-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-transform"
              >
                <Icon name="share" className="text-sm" />
                <span>Share QR</span>
              </button>
              <button 
                onClick={() => alert('Downloading official OnePatient Universal Health Card (PDF format)...')}
                className="py-2 px-3 rounded-full bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-transform"
              >
                <Icon name="download" className="text-sm" />
                <span>Card PDF</span>
              </button>
            </div>

            {/* Emergency ICE contact banner */}
            <a
              href={`tel:${patientData.emergencyContact.phone.replace(/[^0-9+]/g, '')}`}
              className="block rounded-2xl bg-red-950/60 border border-red-700/50 p-2.5 text-white hover:bg-red-900/60 transition-colors"
            >
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Icon name="phone_in_talk" className="text-red-400 text-sm" />
                  <span className="font-semibold text-[11px]">ICE: {patientData.emergencyContact.name} ({patientData.emergencyContact.relation})</span>
                </div>
                <span className="font-bold underline text-[11px] text-red-200">{patientData.emergencyContact.phone}</span>
              </div>
            </a>
          </div>

          {/* ── 2. CIRCULAR STAT BADGES STRIP ── */}
          <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-100">
            <div className="text-center mb-2">
              <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Federated Health Ledger</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="flex flex-col items-center text-center p-2 rounded-2xl bg-slate-50">
                <div className="w-12 h-12 rounded-full bg-teal-100 text-teal-900 flex items-center justify-center font-black text-lg mb-1">
                  14
                </div>
                <span className="text-xs font-bold text-slate-800 leading-tight">Records</span>
                <span className="text-[10px] text-slate-400">3 Hospitals</span>
              </div>
              <div className="flex flex-col items-center text-center p-2 rounded-2xl bg-slate-50">
                <div className="w-12 h-12 rounded-full bg-teal-100 text-teal-900 flex items-center justify-center font-black text-lg mb-1">
                  100%
                </div>
                <span className="text-xs font-bold text-slate-800 leading-tight">Verified</span>
                <span className="text-[10px] text-teal-600 font-medium">Crypto Sync</span>
              </div>
              <div className="flex flex-col items-center text-center p-2 rounded-2xl bg-slate-50">
                <div className="w-12 h-12 rounded-full bg-teal-100 text-teal-900 flex items-center justify-center font-black text-lg mb-1">
                  {consentList.length}
                </div>
                <span className="text-xs font-bold text-slate-800 leading-tight">Consents</span>
                <span className="text-[10px] text-slate-400">Doctors & ER</span>
              </div>
            </div>
          </div>

          {/* ── 3. QUICK ACTIONS ── */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => (onOpenUploadModal ? onOpenUploadModal() : setPage('my-uploads'))}
              className="py-3 px-3 rounded-2xl bg-[#0b3b34] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-transform"
            >
              <Icon name="photo_camera" className="text-teal-300 text-base" />
              <span>+ Upload Records</span>
            </button>
            <button
              onClick={() => setPage('medbot')}
              className="py-3 px-3 rounded-2xl bg-teal-100 text-teal-900 font-bold text-xs flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-transform"
            >
              <Icon name="smart_toy" className="text-teal-700 text-base" />
              <span>Ask MedBot</span>
            </button>
          </div>

          {/* ── 4. MEDICATION REGIMEN ── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Icon name="pill" className="text-teal-600 text-lg" />
                <h3 className="font-extrabold text-sm text-[#131b2e]">Medication Regimen</h3>
              </div>
              <span className="text-[11px] text-slate-500 font-medium">
                Today: {medList.filter((m) => !completedMeds[m.id]).length} Remaining
              </span>
            </div>

            {medList.map((med) => {
              const isChecked = !!completedMeds[med.id];
              return (
                <div
                  key={med.id}
                  className={`bg-white rounded-2xl p-4 shadow-sm border border-slate-100 transition-all ${
                    isChecked ? 'opacity-50 scale-[0.98]' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-teal-50 flex items-center justify-center text-teal-700">
                        <Icon name={med.icon} className="text-xl" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-extrabold text-sm text-slate-900">
                            {med.name} {med.dosage}
                          </h4>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            med.id === 'med-1' ? 'bg-teal-100 text-teal-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {med.dueIn}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {med.id === 'med-1' ? 'Take 1 tablet with warm breakfast' : 'Take 1 pill at bedtime with water'}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => toggleDose(med.id)}
                      className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors flex-shrink-0 ${
                        isChecked
                          ? 'bg-teal-600 text-white'
                          : 'bg-slate-100 hover:bg-teal-100 text-slate-500 hover:text-teal-700'
                      }`}
                      title="Mark as taken"
                    >
                      <Icon name={isChecked ? 'check_circle' : 'check'} className="text-lg" />
                    </button>
                  </div>

                  {med.progress && (
                    <div className="mt-3 pt-2.5 border-t border-slate-100">
                      <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                        <span>Treatment Progression</span>
                        <span className="font-bold text-slate-800">Day {med.dayOf} of {med.totalDays}</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <div className="h-full bg-teal-500 rounded-full" style={{ width: `${med.progress}%` }}></div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* ── 5. ACTIVE ACCESS CONSENTS ── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Icon name="security" className="text-teal-600 text-lg" />
                <h3 className="font-extrabold text-sm text-[#131b2e]">Active Access Consents</h3>
              </div>
              <button 
                onClick={() => setPage('audit')}
                className="text-[11px] text-teal-700 font-bold hover:underline"
              >
                View Audit Trail →
              </button>
            </div>

            {consentList.length === 0 ? (
              <div className="bg-white rounded-2xl p-4 text-center text-xs text-slate-500 border border-slate-100">
                No active consents. All doctor access is currently revoked.
              </div>
            ) : (
              consentList.map((c) => (
                <div key={c.id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-100 flex-shrink-0">
                        <img
                          src={c.photo}
                          alt={c.doctorName}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.target.src = 'https://placehold.co/80x80/0b3b34/ffffff?text=Dr';
                          }}
                        />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-slate-900 leading-tight">{c.doctorName}</h4>
                        <p className="text-xs text-slate-500">{c.specialty}</p>
                      </div>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      c.expires.includes('4d') ? 'bg-amber-100 text-amber-800' : 'bg-teal-100 text-teal-800'
                    }`}>
                      {c.expires}
                    </span>
                  </div>

                  <div className="flex items-center justify-between bg-slate-50 px-3 py-2 rounded-xl text-xs">
                    <div className="flex items-center gap-1.5 text-slate-600 font-medium">
                      <Icon name="folder_shared" className="text-teal-600 text-sm" />
                      <span>{c.scope}</span>
                    </div>
                    <button
                      onClick={() => handleRevoke(c.id)}
                      className="text-red-600 hover:text-white bg-red-50 hover:bg-red-600 px-3 py-1 rounded-full font-bold text-[11px] transition-colors"
                    >
                      Revoke
                    </button>
                  </div>
                </div>
              ))
            )}

            {/* Break-Glass protocol toggle */}
            <div className="rounded-2xl bg-gradient-to-r from-[#0b3b34] to-[#135d52] p-4 text-white flex items-center justify-between gap-3 shadow-md">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-teal-300 flex-shrink-0">
                  <Icon name="health_and_safety" className="text-lg" />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-white leading-tight">ER Break-Glass Protocol</h4>
                  <p className="text-[10px] text-teal-200/80 leading-tight mt-0.5">
                    Monitored 24/7 with instant SMS audit alert
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                <input
                  type="checkbox"
                  checked={breakGlass}
                  onChange={(e) => setBreakGlass(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-400"></div>
              </label>
            </div>
          </div>
        </main>

        {/* ── BOTTOM APP NAVIGATION TABS ── */}
        <nav className="fixed sm:absolute bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 py-2 px-3 shadow-lg">
          <div className="flex justify-around items-center">
            <button
              onClick={() => setPage('landing')}
              className="flex flex-col items-center gap-1 text-slate-500 hover:text-teal-700 transition-colors"
            >
              <Icon name="home" className="text-xl" />
              <span className="text-[10px] font-semibold">Home</span>
            </button>

            <button
              onClick={() => setActiveTab('my-health')}
              className={`flex flex-col items-center gap-1 transition-colors ${
                activeTab === 'my-health' ? 'text-teal-700 font-bold' : 'text-slate-500'
              }`}
            >
              <Icon name="vital_signs" className="text-xl" />
              <span className="text-[10px] font-semibold">My Health</span>
            </button>

            {/* Middle Upload circle */}
            <button
              onClick={() => (onOpenUploadModal ? onOpenUploadModal() : setPage('my-uploads'))}
              className="w-12 h-12 -mt-5 rounded-full bg-teal-500 hover:bg-teal-400 text-teal-950 flex items-center justify-center shadow-lg active:scale-95 transition-transform"
            >
              <Icon name="add" className="text-2xl" />
            </button>

            <button
              onClick={() => setPage('medbot')}
              className="flex flex-col items-center gap-1 text-slate-500 hover:text-teal-700 transition-colors"
            >
              <Icon name="smart_toy" className="text-xl" />
              <span className="text-[10px] font-semibold">Ask MedBot</span>
            </button>

            <button
              onClick={() => setPage('audit')}
              className={`flex flex-col items-center gap-1 transition-colors ${
                activeTab === 'audit' ? 'text-teal-700 font-bold' : 'text-slate-500'
              }`}
            >
              <Icon name="verified_user" className="text-xl" />
              <span className="text-[10px] font-semibold">Audit</span>
            </button>
          </div>
        </nav>
      </div>
    </div>
  );
}

