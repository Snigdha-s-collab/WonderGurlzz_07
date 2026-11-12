import { useState, useEffect, useRef } from 'react';
import LandingPage from './components/LandingPage';
import PatientDashboard from './components/PatientDashboard';
import AuditTrail from './components/AuditTrail';
import AuthPage from './components/AuthPage';
import MyUploads from './components/MyUploads';
import UploadModal from './components/UploadModal';
import AskMedBot from './components/AskMedBot';
import { formatTime24To12 } from './services/medbotAgent';

const INITIAL_UPLOADS = [
  {
    id: 'upload-init-1',
    description: 'Metformin 500mg Daily Prescription — Blood sugar monitoring after breakfast',
    category: 'Endocrinology & Diabetes',
    date: 'Nov 10, 2026',
    time: '10:30 AM',
    timestamp: 'Nov 10, 2026 • 10:30 AM',
    prescriptionText:
      'Prescribed by Dr. Rajiv Mehta\n1. Metformin 500mg — Take 1 tablet once daily after warm breakfast for 90 days (08:00 AM)\n2. Atorvastatin 20mg — Take 1 tablet once daily at bedtime with water (10:00 PM)',
    files: [
      { name: 'Metformin_Prescription_DrMehta.pdf', size: '142.5 KB', type: 'application/pdf' },
    ],
    status: 'Cryptographically Verified',
  },
  {
    id: 'upload-init-2',
    description: 'Complete Lipid Panel & Fasting Glucose Comprehensive Pathology Report',
    category: 'Laboratory & Pathology',
    date: 'Nov 06, 2026',
    time: '04:15 PM',
    timestamp: 'Nov 06, 2026 • 04:15 PM',
    prescriptionText:
      'Pathology Report — Fasting Glucose & Complete Lipid Panel (SRL Diagnostics). Review results with Dr. Sarah Jenkins.',
    files: [
      { name: 'Lipid_Panel_Nov2026.pdf', size: '318.2 KB', type: 'application/pdf' },
      { name: 'Blood_Glucose_Graph.png', size: '89.4 KB', type: 'image/png' },
    ],
    status: 'Cryptographically Verified',
  },
];

const INITIAL_REMINDERS = [
  {
    id: 'rem-init-1',
    medName: 'Metformin',
    dosage: '500mg',
    time24: '08:00',
    instruction: 'Take 1 tablet after warm breakfast',
    enabled: true,
    sourcePrescriptionId: 'upload-init-1',
    lastTakenDate: null,
  },
  {
    id: 'rem-init-2',
    medName: 'Atorvastatin',
    dosage: '20mg',
    time24: '22:00',
    instruction: 'Take 1 pill at bedtime with water',
    enabled: true,
    sourcePrescriptionId: 'upload-init-1',
    lastTakenDate: null,
  },
];

function playReminderChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(660, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch {
    // Ignore audio context autoplay restrictions
  }
}

function getPageFromHash() {
  const hash = window.location.hash.replace('#', '');
  if (hash === 'dashboard') return 'dashboard';
  if (hash === 'audit') return 'audit';
  if (hash === 'my-uploads') return 'my-uploads';
  if (hash === 'medbot') return 'medbot';
  return 'landing';
}

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('onepatient_current_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [page, setPage] = useState(getPageFromHash);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [medbotUploadId, setMedbotUploadId] = useState(null);

  const [uploads, setUploads] = useState(() => {
    try {
      const stored = localStorage.getItem('onepatient_user_uploads');
      return stored ? JSON.parse(stored) : INITIAL_UPLOADS;
    } catch {
      return INITIAL_UPLOADS;
    }
  });

  const [reminders, setReminders] = useState(() => {
    try {
      const stored = localStorage.getItem('onepatient_med_reminders');
      return stored ? JSON.parse(stored) : INITIAL_REMINDERS;
    } catch {
      return INITIAL_REMINDERS;
    }
  });

  const [soundEnabled, setSoundEnabled] = useState(() => {
    try {
      const stored = localStorage.getItem('onepatient_reminder_sound');
      return stored ? JSON.parse(stored) : true;
    } catch {
      return true;
    }
  });

  const [notifications, setNotifications] = useState([]);
  const triggeredMinuteRef = useRef({});
  const snoozedUntilRef = useRef({});

  useEffect(() => {
    const handleHashChange = () => setPage(getPageFromHash());
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('onepatient_med_reminders', JSON.stringify(reminders));
    } catch (e) {
      console.error(e);
    }
  }, [reminders]);

  useEffect(() => {
    try {
      localStorage.setItem('onepatient_reminder_sound', JSON.stringify(soundEnabled));
    } catch (e) {
      console.error(e);
    }
  }, [soundEnabled]);

  const fireReminderNotification = (rem) => {
    const timeLabel = formatTime24To12(rem.time24);
    const notifItem = {
      id: `notif-${rem.id}-${Date.now()}`,
      reminderId: rem.id,
      medName: rem.medName,
      dosage: rem.dosage,
      instruction: rem.instruction,
      timeLabel,
    };

    setNotifications((prev) => [notifItem, ...prev.filter((n) => n.reminderId !== rem.id)]);

    if (soundEnabled) {
      playReminderChime();
    }

    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try {
        new Notification(`Medication Reminder: ${rem.medName} ${rem.dosage || ''}`.trim(), {
          body: `${rem.instruction} (${timeLabel})`,
        });
      } catch (e) {
        console.warn('Browser notification failed:', e);
      }
    }
  };

  // Background medication reminder scheduler
  useEffect(() => {
    if (!currentUser) return;

    const checkDueReminders = () => {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      const currentHHMM = `${hh}:${mm}`;
      const todayKey = now.toISOString().split('T')[0];
      const nowMs = now.getTime();

      for (const rem of reminders) {
        if (!rem.enabled) continue;
        if (rem.lastTakenDate === todayKey) continue;

        const snoozeTarget = snoozedUntilRef.current[rem.id];
        if (snoozeTarget && nowMs >= snoozeTarget) {
          delete snoozedUntilRef.current[rem.id];
          fireReminderNotification(rem);
          continue;
        }

        const minuteStamp = `${todayKey}_${currentHHMM}`;
        if (rem.time24 === currentHHMM && triggeredMinuteRef.current[rem.id] !== minuteStamp) {
          triggeredMinuteRef.current[rem.id] = minuteStamp;
          fireReminderNotification(rem);
        }
      }
    };

    checkDueReminders();
    const timer = setInterval(checkDueReminders, 15000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, reminders, soundEnabled]);

  const handleLoginSuccess = (user) => {
    setCurrentUser(user);
    try {
      localStorage.setItem('onepatient_current_user', JSON.stringify(user));
    } catch (e) {
      console.error(e);
    }
    setPage('landing');
    window.location.hash = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLogout = () => {
    setCurrentUser(null);
    try {
      localStorage.removeItem('onepatient_current_user');
    } catch (e) {
      console.error(e);
    }
    window.location.hash = '';
  };

  const navigateTo = (newPage) => {
    setPage(newPage);
    if (newPage === 'landing') window.location.hash = '';
    else window.location.hash = newPage;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenMedBot = (uploadId = null) => {
    if (uploadId) setMedbotUploadId(uploadId);
    navigateTo('medbot');
  };

  const handleSaveUpload = (newRecord, shouldRedirect = true) => {
    const updated = [newRecord, ...uploads];
    setUploads(updated);
    try {
      localStorage.setItem('onepatient_user_uploads', JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
    if (shouldRedirect) {
      navigateTo('my-uploads');
    }
  };

  const handleAddReminder = (remData) => {
    const newRem = {
      id: 'rem-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      medName: remData.medName,
      dosage: remData.dosage || '',
      time24: remData.time24 || '08:00',
      instruction: remData.instruction || 'Follow prescription instructions',
      enabled: true,
      sourcePrescriptionId: remData.sourcePrescriptionId || 'manual',
      lastTakenDate: null,
    };
    setReminders((prev) => [newRem, ...prev]);
  };

  const handleAddMultipleReminders = (list) => {
    setReminders((prev) => {
      const existingKeys = new Set(
        prev.map((r) => `${r.medName.toLowerCase()}__${r.time24}`)
      );
      const additions = [];
      for (const item of list) {
        const key = `${(item.medName || '').toLowerCase()}__${item.time24 || '08:00'}`;
        if (!existingKeys.has(key)) {
          existingKeys.add(key);
          additions.push({
            id: 'rem-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
            medName: item.medName,
            dosage: item.dosage || '',
            time24: item.time24 || '08:00',
            instruction: item.instruction || 'As directed on prescription',
            enabled: true,
            sourcePrescriptionId: item.sourcePrescriptionId || 'analysis',
            lastTakenDate: null,
          });
        }
      }
      return [...additions, ...prev];
    });
  };

  const handleToggleReminder = (id) => {
    setReminders((prev) =>
      prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r))
    );
  };

  const handleDeleteReminder = (id) => {
    setReminders((prev) => prev.filter((r) => r.id !== id));
    setNotifications((prev) => prev.filter((n) => n.reminderId !== id));
  };

  const handleMarkTaken = (reminderId, notificationId = null) => {
    const todayKey = new Date().toISOString().split('T')[0];
    setReminders((prev) =>
      prev.map((r) =>
        r.id === reminderId
          ? { ...r, lastTakenDate: r.lastTakenDate === todayKey ? null : todayKey }
          : r
      )
    );
    if (notificationId) {
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
    } else {
      setNotifications((prev) => prev.filter((n) => n.reminderId !== reminderId));
    }
  };

  const handleSnoozeNotification = (notif) => {
    snoozedUntilRef.current[notif.reminderId] = Date.now() + 10 * 60 * 1000;
    setNotifications((prev) => prev.filter((n) => n.id !== notif.id));
  };

  const handleDismissNotification = (notifId) => {
    setNotifications((prev) => prev.filter((n) => n.id !== notifId));
  };

  const handleTriggerTestReminder = () => {
    const target = reminders.find((r) => r.enabled) || {
      id: 'test-rem',
      medName: 'Metformin',
      dosage: '500mg',
      time24: new Date().toTimeString().slice(0, 5),
      instruction: 'Scheduled test medication reminder alert',
    };
    fireReminderNotification(target);
  };

  if (!currentUser) {
    return <AuthPage onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="font-sans antialiased text-slate-800">
      {page === 'landing' && (
        <LandingPage
          setPage={navigateTo}
          currentUser={currentUser}
          onLogout={handleLogout}
          onOpenUploadModal={() => setIsUploadModalOpen(true)}
          notifications={notifications}
          reminders={reminders}
          onMarkTaken={handleMarkTaken}
          onDismissNotification={handleDismissNotification}
          onTriggerTestReminder={handleTriggerTestReminder}
          onOpenMedBot={() => handleOpenMedBot()}
        />
      )}
      {page === 'my-uploads' && (
        <MyUploads
          setPage={navigateTo}
          uploads={uploads}
          onOpenUploadModal={() => setIsUploadModalOpen(true)}
          currentUser={currentUser}
          onLogout={handleLogout}
          notifications={notifications}
          reminders={reminders}
          onMarkTaken={handleMarkTaken}
          onDismissNotification={handleDismissNotification}
          onTriggerTestReminder={handleTriggerTestReminder}
          onOpenMedBot={handleOpenMedBot}
        />
      )}
      {page === 'medbot' && (
        <AskMedBot
          setPage={navigateTo}
          currentUser={currentUser}
          onLogout={handleLogout}
          uploads={uploads}
          initialSelectedUploadId={medbotUploadId}
          onSavePrescriptionUpload={(record) => handleSaveUpload(record, false)}
          reminders={reminders}
          onAddReminder={handleAddReminder}
          onAddMultipleReminders={handleAddMultipleReminders}
          onToggleReminder={handleToggleReminder}
          onDeleteReminder={handleDeleteReminder}
          onMarkTaken={handleMarkTaken}
          notifications={notifications}
          onDismissNotification={handleDismissNotification}
          onTriggerTestReminder={handleTriggerTestReminder}
          soundEnabled={soundEnabled}
          onToggleSound={() => setSoundEnabled((v) => !v)}
        />
      )}
      {page === 'dashboard' && (
        <PatientDashboard
          setPage={navigateTo}
          currentUser={currentUser}
          onLogout={handleLogout}
          onOpenUploadModal={() => setIsUploadModalOpen(true)}
        />
      )}
      {page === 'audit' && (
        <AuditTrail
          setPage={navigateTo}
          currentUser={currentUser}
          onLogout={handleLogout}
          onOpenUploadModal={() => setIsUploadModalOpen(true)}
        />
      )}

      {/* Floating Medication Reminder Toast Banner */}
      {notifications.length > 0 && (
        <div className="fixed bottom-4 right-4 z-[60] max-w-sm w-[calc(100%-2rem)] space-y-2">
          {notifications.slice(0, 2).map((notif) => (
            <div
              key={notif.id}
              className="bg-[#0b3b34] text-white rounded-2xl p-4 shadow-2xl border border-teal-400/40 flex flex-col gap-2.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-teal-400 text-teal-950 flex items-center justify-center flex-shrink-0 animate-pulse">
                    <span className="material-symbols-outlined text-xl">alarm</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-teal-300 block">
                      Medication Reminder • {notif.timeLabel}
                    </span>
                    <h4 className="text-sm font-extrabold text-white">
                      {notif.medName} {notif.dosage}
                    </h4>
                  </div>
                </div>
                <button
                  onClick={() => handleDismissNotification(notif.id)}
                  className="text-white/60 hover:text-white p-0.5"
                  title="Dismiss"
                >
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>
              </div>
              <p className="text-xs text-teal-100/90">{notif.instruction}</p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleMarkTaken(notif.reminderId, notif.id)}
                  className="flex-1 py-1.5 px-3 rounded-full bg-teal-400 hover:bg-teal-300 text-teal-950 text-xs font-extrabold transition-colors"
                >
                  Mark Taken
                </button>
                <button
                  onClick={() => handleSnoozeNotification(notif)}
                  className="py-1.5 px-3 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-colors"
                >
                  Snooze 10m
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Modal Popup */}
      <UploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onUploadSuccess={(record) => handleSaveUpload(record, true)}
      />
    </div>
  );
}
