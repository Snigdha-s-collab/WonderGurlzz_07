import { useState, useEffect, useRef } from 'react';
import LandingPage from './components/LandingPage';
import PatientDashboard from './components/PatientDashboard';
import AuditTrail from './components/AuditTrail';
import AuthPage from './components/AuthPage';
import MyUploads from './components/MyUploads';
import UploadModal from './components/UploadModal';
import AboutUs from './components/AboutUs';
import AccessQRPage from './components/AccessQRPage';
import DoctorPortalView from './components/DoctorPortalView';
import AskMedBot from './components/AskMedBot';
import { formatTime24To12 } from './services/medbotAgent';
import { fetchRecordsFromSupabase, insertRecordToSupabase } from './lib/supabaseClient';

const INITIAL_UPLOADS = [
  {
    id: 'upload-init-neuro',
    title: 'Prescription of Neurology',
    description: 'Prescription of Neurology — Neurological evaluation and nerve support therapy with Dr. Sudarshan Bhat.',
    category: 'Neurology',
    date: 'Nov 13, 2026',
    time: '05:55 PM',
    timestamp: 'Nov 13, 2026 • 05:55 PM',
    doctorName: 'Dr.Sudarshan Bhat',
    prescriptionText:
      'Dr. A. Sudarshan Bhat, M.D. (Ayu) • Reg. No. 15051\nVishnu Ayurvedalaya & Panchakarma Clinic\nPrescribed Medication:\n1. Neargon LG — 0 - 1 - 0 (30 tabs) — Take 1 tab afternoon after lunch\n2. Neuron — 1 - 0 - 1 (60 tabs) — Take 1 tab morning & 1 tab night with warm water\n3. Neo — 1 - 0 - 1 (60 tabs) — Take 1 tab morning & 1 tab night with warm water\n4. Mahanarayan Taila — External gentle application as directed for nerve/muscular pain',
    files: [
      {
        name: 'WhatsApp Image 2026-11-12 at 5.55.52 PM.jpeg',
        size: '91.4 KB',
        type: 'image/jpeg',
        url: '/uploads/WhatsApp-Image-2026-11-12.jpeg',
        dataUrl: '/uploads/WhatsApp-Image-2026-11-12.jpeg',
      },
    ],
    status: 'Cryptographically Verified',
  },
  {
    id: 'upload-init-general',
    title: 'General Medications',
    description: 'General health consultation and maintenance prescription with Dr. Neelkanta.',
    category: 'General Medicine',
    date: 'Nov 12, 2026',
    time: '01:06 AM',
    timestamp: 'Nov 12, 2026 • 01:06 AM',
    doctorName: 'Dr.Neelkanta',
    prescriptionText:
      'Consultation with Dr. Neelkanta (General Medicine)\n1. General maintenance and metabolic health\n2. Maintain balanced nutrition, adequate hydration, and periodic vitals check',
    files: [
      {
        name: 'WhatsApp Image 2026-11-13 at 1.06.37 AM.jpeg',
        size: '238.5 KB',
        type: 'image/jpeg',
        url: '/uploads/prescription-default.jpeg',
        dataUrl: '/uploads/prescription-default.jpeg',
      },
    ],
    status: 'Cryptographically Verified',
  },
];

const INITIAL_REMINDERS = [
  {
    id: 'rem-init-1',
    medName: 'Neuron',
    dosage: '1 tablet',
    time24: '08:30',
    instruction: 'Take 1 tablet after breakfast with warm water (Dr. Sudarshan Bhat)',
    enabled: true,
    sourcePrescriptionId: 'upload-init-neuro',
    lastTakenDate: null,
  },
  {
    id: 'rem-init-2',
    medName: 'Neargon LG',
    dosage: '1 tablet',
    time24: '13:30',
    instruction: 'Take 1 tablet after lunch with water (Dr. Sudarshan Bhat)',
    enabled: true,
    sourcePrescriptionId: 'upload-init-neuro',
    lastTakenDate: null,
  },
  {
    id: 'rem-init-3',
    medName: 'Neo',
    dosage: '1 tablet',
    time24: '21:30',
    instruction: 'Take 1 tablet after dinner with warm water (Dr. Sudarshan Bhat)',
    enabled: true,
    sourcePrescriptionId: 'upload-init-neuro',
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
  if (hash.startsWith('doctor-portal')) return 'doctor-portal';
  if (hash === 'dashboard') return 'dashboard';
  if (hash === 'audit') return 'audit';
  if (hash === 'my-uploads') return 'my-uploads';
  if (hash === 'medbot') return 'medbot';
  if (hash === 'about-us' || hash === 'about') return 'about-us';
  if (hash === 'access-qr') return 'access-qr';
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

  // Load user uploads and enrich with image URLs
  const [uploads, setUploads] = useState(() => {
    try {
      const stored = localStorage.getItem('onepatient_user_uploads');
      if (!stored) return INITIAL_UPLOADS;
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((item) => {
          if (item.files && item.files.length > 0) {
            item.files = item.files.map((f) => {
              if (!f.dataUrl && !f.url) {
                return {
                  ...f,
                  dataUrl: '/uploads/prescription-default.jpeg',
                  url: '/uploads/prescription-default.jpeg',
                };
              }
              return f;
            });
          }
          return item;
        });
      }
      return INITIAL_UPLOADS;
    } catch (e) {
      console.error(e);
      return INITIAL_UPLOADS;
    }
  });

  // Query Supabase to sync remote database records on launch
  useEffect(() => {
    let isMounted = true;
    async function syncData() {
      try {
        const remoteRecords = await fetchRecordsFromSupabase();
        if (!isMounted) return;

        if (remoteRecords && remoteRecords.length > 0) {
          setUploads(remoteRecords);
          try {
            localStorage.setItem('onepatient_user_uploads', JSON.stringify(remoteRecords));
          } catch (e) {
            console.error(e);
          }
        } else {
          // If remote DB is empty, sync initial records to Supabase
          const stored = localStorage.getItem('onepatient_user_uploads');
          const recordsToSync = stored ? JSON.parse(stored) : INITIAL_UPLOADS;
          if (Array.isArray(recordsToSync) && recordsToSync.length > 0) {
            for (const r of recordsToSync) {
              await insertRecordToSupabase(r);
            }
            const reFetched = await fetchRecordsFromSupabase();
            if (reFetched && reFetched.length > 0 && isMounted) {
              setUploads(reFetched);
            }
          }
        }
      } catch (err) {
        console.error('Supabase sync error:', err);
      }
    }
    syncData();
    return () => {
      isMounted = false;
    };
  }, []);

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

  // Persist user and reminders
  useEffect(() => {
    try {
      if (currentUser) {
        localStorage.setItem('onepatient_current_user', JSON.stringify(currentUser));
      } else {
        localStorage.removeItem('onepatient_current_user');
      }
    } catch (e) {
      console.error(e);
    }
  }, [currentUser]);

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

  // Request browser notification permission gently if user has active reminders
  useEffect(() => {
    if (reminders.length > 0 && typeof Notification !== 'undefined') {
      if (Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {});
      }
    }
  }, [reminders.length]);

  // Real-time medication reminder scheduler
  useEffect(() => {
    function checkReminders() {
      const now = new Date();
      const currentH = String(now.getHours()).padStart(2, '0');
      const currentM = String(now.getMinutes()).padStart(2, '0');
      const currentTime24 = `${currentH}:${currentM}`;
      const todayKey = now.toISOString().split('T')[0];
      const nowTs = now.getTime();

      reminders.forEach((rem) => {
        if (!rem.enabled) return;

        const alreadyTakenToday = rem.lastTakenDate === todayKey;
        if (alreadyTakenToday) return;

        const triggerKey = `${rem.id}_${todayKey}_${currentTime24}`;
        const isScheduledTime = rem.time24 === currentTime24;
        const isSnoozedDue =
          snoozedUntilRef.current[rem.id] && snoozedUntilRef.current[rem.id] <= nowTs;

        if ((isScheduledTime && !triggeredMinuteRef.current[triggerKey]) || isSnoozedDue) {
          triggeredMinuteRef.current[triggerKey] = true;
          if (isSnoozedDue) {
            delete snoozedUntilRef.current[rem.id];
          }

          const notifId = 'notif-' + Date.now() + '-' + rem.id;
          const newNotif = {
            id: notifId,
            reminderId: rem.id,
            medName: rem.medName,
            dosage: rem.dosage,
            instruction: rem.instruction,
            timeLabel: formatTime24To12(rem.time24),
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            createdAt: nowTs,
          };

          setNotifications((prev) => [newNotif, ...prev.filter((n) => n.reminderId !== rem.id)]);

          if (soundEnabled) {
            playReminderChime();
          }

          if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            try {
              new Notification(`Medication Reminder: ${rem.medName}`, {
                body: `${rem.medName} ${rem.dosage} — ${rem.instruction}. Time to take your scheduled dose.`,
                icon: '/vite.svg',
                tag: rem.id,
              });
            } catch (err) {
              console.warn('System notification failed:', err);
            }
          }
        }
      });
    }

    checkReminders();
    const interval = setInterval(checkReminders, 15000);
    return () => clearInterval(interval);
  }, [reminders, soundEnabled]);

  // Synchronize URL hash with page state
  useEffect(() => {
    const handleHashChange = () => {
      setPage(getPageFromHash());
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleAuthSuccess = (userData) => {
    setCurrentUser(userData);
    navigateTo('my-uploads');
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
    else if (!newPage.startsWith('doctor-portal')) window.location.hash = newPage;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenMedBot = (uploadId = null) => {
    if (uploadId) setMedbotUploadId(uploadId);
    navigateTo('medbot');
  };

  // Add new uploaded record, persist locally and push to Supabase
  const handleSaveUpload = async (newRecord, shouldRedirect = true) => {
    const updated = [newRecord, ...uploads];
    setUploads(updated);
    try {
      localStorage.setItem('onepatient_user_uploads', JSON.stringify(updated));
      await insertRecordToSupabase(newRecord);
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
    }
  };

  const handleDismissNotification = (notifId) => {
    setNotifications((prev) => prev.filter((n) => n.id !== notifId));
  };

  const handleSnoozeNotification = (notif, minutes = 10) => {
    snoozedUntilRef.current[notif.reminderId] = Date.now() + minutes * 60 * 1000;
    setNotifications((prev) => prev.filter((n) => n.id !== notif.id));
  };

  const handleTriggerTestReminder = () => {
    const testRem = reminders[0] || {
      id: 'test-rem',
      medName: 'Metformin 500mg',
      dosage: '1 tablet',
      instruction: 'Take after meal with warm water (Test Dose Alert)',
      time24: '08:00',
    };
    const notif = {
      id: 'test-notif-' + Date.now(),
      reminderId: testRem.id,
      medName: testRem.medName,
      dosage: testRem.dosage || '500mg',
      instruction: testRem.instruction || 'Take after meal with water',
      timeLabel: formatTime24To12(testRem.time24 || '08:00'),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      createdAt: Date.now(),
    };
    setNotifications((prev) => [notif, ...prev]);
    if (soundEnabled) {
      playReminderChime();
    }
  };

  // Dedicated doctor portal view route for scanned QR access
  if (page.startsWith('doctor-portal')) {
    return <DoctorPortalView uploads={uploads} setPage={navigateTo} />;
  }

  return (
    <div className="font-['Plus_Jakarta_Sans',sans-serif] min-h-screen bg-[#faf8ff] text-[#131b2e] antialiased">
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
          onOpenMedBot={handleOpenMedBot}
        />
      )}
      {page === 'auth' && (
        <AuthPage
          setPage={navigateTo}
          onAuthSuccess={handleAuthSuccess}
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
      {page === 'access-qr' && (
        <AccessQRPage
          setPage={navigateTo}
          currentUser={currentUser}
          onLogout={handleLogout}
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
      {page === 'about-us' && (
        <AboutUs
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
