import { useState } from 'react';
import { auditLogs, patientData } from '../data/patientData';

function Icon({ name, className = '' }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>;
}

export default function AuditTrail({ setPage }) {
  const [filter, setFilter] = useState('all');

  const filteredLogs = auditLogs.filter((log) => {
    if (filter === 'all') return true;
    return log.type === filter;
  });

  return (
    <div className="min-h-screen bg-slate-200 flex items-center justify-center p-0 sm:p-4">
      {/* Mobile container frame */}
      <div className="w-full sm:w-[410px] sm:max-w-md bg-[#faf8ff] sm:rounded-3xl shadow-2xl relative overflow-hidden flex flex-col min-h-screen sm:min-h-[880px] border sm:border-slate-300">
        
        {/* ── TOP HEADER ── */}
        <header className="sticky top-0 z-40 bg-[#0b3b34] text-white px-4 py-3 shadow-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage('dashboard')}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                title="Back to Dashboard"
              >
                <Icon name="arrow_back" className="text-sm text-teal-200" />
              </button>
              <div>
                <span className="text-teal-300 text-[10px] font-bold tracking-tight uppercase">Immutable Ledger</span>
                <h1 className="text-white font-extrabold text-sm leading-none mt-0.5">Access Audit Trail</h1>
              </div>
            </div>
            <div className="px-2.5 py-1 rounded-full bg-teal-400/20 text-teal-300 text-[10px] font-bold border border-teal-400/30">
              HIPAA Logged
            </div>
          </div>
        </header>

        {/* ── MAIN CONTENT ── */}
        <main className="flex-1 overflow-y-auto px-4 py-4 pb-28 space-y-4 text-[#131b2e]">
          
          {/* Summary Card */}
          <div className="rounded-2xl bg-white p-4 shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400">Ledger Subject</span>
                <h3 className="font-extrabold text-sm text-slate-900">{patientData.name}</h3>
                <span className="font-mono text-[10px] text-teal-700">{patientData.patientId}</span>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-teal-50 flex items-center justify-center text-teal-700">
                <Icon name="verified_user" className="text-2xl" />
              </div>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Every read, upload, and consent modification event is cryptographically signed and stored in this immutable tamper-evident log.
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {[
              { id: 'all', label: 'All Events' },
              { id: 'access', label: 'Doctor Views' },
              { id: 'upload', label: 'Uploads' },
              { id: 'consent', label: 'Consents' },
              { id: 'emergency', label: 'Break-Glass' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
                  filter === f.id
                    ? 'bg-[#0b3b34] text-white shadow-sm'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Log Item List */}
          <div className="space-y-3">
            {filteredLogs.map((log) => (
              <div
                key={log.id}
                className="bg-white rounded-2xl p-3.5 shadow-sm border border-slate-100 space-y-2 hover:border-teal-200 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-8 h-8 rounded-xl ${log.bgColor} flex items-center justify-center ${log.iconColor} flex-shrink-0`}>
                      <Icon name={log.icon} className="text-base" />
                    </div>
                    <div>
                      <h4 className="font-bold text-xs text-slate-900 leading-tight">{log.actor}</h4>
                      <p className="text-[10px] text-slate-500">{log.specialty} • {log.facility}</p>
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${log.statusColor}`}>
                    {log.status}
                  </span>
                </div>

                <div className="bg-slate-50 rounded-xl p-2.5 text-xs text-slate-700 font-medium">
                  {log.action}
                </div>

                <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                  <span className="font-mono">{log.timestamp}</span>
                  <span className="flex items-center gap-1 text-teal-700 font-semibold">
                    <Icon name="verified" className="text-xs" /> Verified Block
                  </span>
                </div>
              </div>
            ))}
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
              onClick={() => setPage('dashboard')}
              className="flex flex-col items-center gap-1 text-slate-500 hover:text-teal-700 transition-colors"
            >
              <Icon name="vital_signs" className="text-xl" />
              <span className="text-[10px] font-semibold">My Health</span>
            </button>

            <button
              onClick={() => alert('Quick Record Scanner launched.')}
              className="w-12 h-12 -mt-5 rounded-full bg-teal-500 hover:bg-teal-400 text-teal-950 flex items-center justify-center shadow-lg active:scale-95 transition-transform"
            >
              <Icon name="add" className="text-2xl" />
            </button>

            <button
              onClick={() => alert('OnePatient AI Clinical Assistant is ready.')}
              className="flex flex-col items-center gap-1 text-slate-500 hover:text-teal-700 transition-colors"
            >
              <Icon name="smart_toy" className="text-xl" />
              <span className="text-[10px] font-semibold">AI Doctor</span>
            </button>

            <button
              onClick={() => setPage('audit')}
              className="flex flex-col items-center gap-1 text-teal-700 font-bold"
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

