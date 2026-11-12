import { useState, useRef, useEffect } from 'react';
import { formatTime24To12 } from '../services/medbotAgent';

function Icon({ name, className = '' }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>;
}

export default function NotificationBell({
  notifications = [],
  reminders = [],
  onMarkTaken,
  onDismissNotification,
  onOpenMedBot,
  onTriggerTestReminder,
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  const unreadCount = notifications.length;
  const activeReminders = reminders.filter((r) => r.enabled);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="relative p-2 rounded-full text-white/80 hover:text-teal-300 hover:bg-white/10 transition-colors"
        title="Medication Reminders & Alerts"
      >
        <Icon name="notifications" className="text-2xl" />
        {(unreadCount > 0 || activeReminders.length > 0) && (
          <span
            className={`absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold flex items-center justify-center ${
              unreadCount > 0
                ? 'bg-amber-400 text-teal-950 animate-pulse'
                : 'bg-teal-400 text-teal-950'
            }`}
          >
            {unreadCount > 0 ? unreadCount : activeReminders.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white text-[#131b2e] rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-50">
          <div className="bg-[#0b3b34] text-white px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon name="alarm" className="text-teal-300 text-lg" />
              <div>
                <h4 className="text-xs font-bold leading-tight">Medication Reminder Alerts</h4>
                <p className="text-[10px] text-teal-200/80">
                  {activeReminders.length} active daily reminder{activeReminders.length === 1 ? '' : 's'}
                </p>
              </div>
            </div>
            {onTriggerTestReminder && (
              <button
                onClick={() => onTriggerTestReminder()}
                className="text-[10px] font-bold bg-teal-400/20 hover:bg-teal-400/30 text-teal-200 px-2.5 py-1 rounded-full border border-teal-400/30 transition-colors"
              >
                Test Alert
              </button>
            )}
          </div>

          <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
            {notifications.length > 0 && (
              <div className="p-3 bg-amber-50/70 space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 block">
                  Due Now ({notifications.length})
                </span>
                {notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className="bg-white rounded-xl p-2.5 border border-amber-200 shadow-sm flex items-start justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-extrabold text-slate-900 truncate">
                        {notif.medName} {notif.dosage}
                      </p>
                      <p className="text-[11px] text-slate-600">{notif.instruction}</p>
                      <span className="text-[10px] text-amber-700 font-semibold">
                        Scheduled: {notif.timeLabel}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1 flex-shrink-0">
                      <button
                        onClick={() => onMarkTaken(notif.reminderId, notif.id)}
                        className="px-2.5 py-1 rounded-full bg-teal-600 hover:bg-teal-700 text-white text-[10px] font-bold"
                      >
                        Taken
                      </button>
                      <button
                        onClick={() => onDismissNotification(notif.id)}
                        className="px-2 py-0.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-semibold"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="p-3 space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Scheduled Medications
              </span>
              {activeReminders.length === 0 ? (
                <p className="text-xs text-slate-500 py-2">
                  No active medication reminders. Open Ask MedBot to auto-generate reminders from your prescription.
                </p>
              ) : (
                activeReminders.map((rem) => (
                  <div
                    key={rem.id}
                    className="flex items-center justify-between bg-slate-50 rounded-xl px-3 py-2 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-slate-800 truncate">
                        {rem.medName} {rem.dosage}
                      </p>
                      <p className="text-[10px] text-slate-500 truncate">{rem.instruction}</p>
                    </div>
                    <span className="ml-2 px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 font-bold text-[10px] flex-shrink-0">
                      {formatTime24To12(rem.time24)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {onOpenMedBot && (
            <div className="p-2.5 bg-slate-50 border-t border-slate-100">
              <button
                onClick={() => {
                  setOpen(false);
                  onOpenMedBot();
                }}
                className="w-full py-2 rounded-xl teal-gradient-btn text-white text-xs font-bold flex items-center justify-center gap-1.5 hover:opacity-95 transition-opacity"
              >
                <Icon name="smart_toy" className="text-base" />
                <span>Open Ask MedBot & Reminder Tool</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

