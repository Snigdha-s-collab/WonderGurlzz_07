import { useState, useEffect, useRef, useMemo } from 'react';
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
import CurrentMedication from './components/CurrentMedication';
import { formatTime24To12 } from './services/medbotAgent';
import {
  fetchRecordsFromSupabase,
  insertRecordToSupabase,
  normalizeRecord,
  filterRecordsForUser,
  fetchUserSharingGroups,
  fetchGroupMembers,
  addGroupMember,
  revokeGroupMember,
  subscribeToMedicalRecords,
  unsubscribeFromMedicalRecords,
} from './lib/supabaseClient';
import { API_BASE_URL } from './config/api';

const INITIAL_UPLOADS = [];

const INITIAL_REMINDERS = [];

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
  if (hash === 'current-medication' || hash === 'medication' || hash === 'current-medications') return 'current-medication';
  if (hash === 'medbot') return 'medbot';
  if (hash === 'about-us' || hash === 'about') return 'about-us';
  if (hash === 'access-qr') return 'access-qr';
  return 'landing';
}

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('onepatient_current_user');
      let user = saved ? JSON.parse(saved) : null;
      if (user) {
        // If name is missing or equals permanentId, retrieve what was entered during sign up
        if (!user.name || user.name === user.permanentId) {
          const rawUsers = localStorage.getItem('onepatient_users');
          if (rawUsers) {
            const users = JSON.parse(rawUsers);
            const matched = users.find(
              (u) => u.permanentId && u.permanentId.toLowerCase() === (user.permanentId || '').toLowerCase()
            );
            if (matched?.name && matched.name !== matched.permanentId) {
              user.name = matched.name;
            }
          }
        }
      }
      return user;
    } catch {
      // fallback
    }
    return {
      id: '11111111-1111-4111-a111-111111111111',
      permanentId: 'GLP-9041-K7-VERIFIED',
      name: 'Eleanor Vance',
      email: 'eleanor.vance@onepatient.io',
    };
  });

  const [page, setPage] = useState(getPageFromHash);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [medbotUploadId, setMedbotUploadId] = useState(null);
  const [realtimeToast, setRealtimeToast] = useState('');

  // Master records collection (synced directly from Supabase database)
  const [uploads, setUploads] = useState(() => {
    try {
      const stored = localStorage.getItem('onepatient_user_uploads');
      if (!stored) return [];
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Strip legacy mock/seed records that should no longer appear
        const cleaned = parsed.filter(
          (item) =>
            item.id !== 'upload-init-neuro' &&
            item.id !== 'upload-init-general' &&
            !item.doctorName?.includes('Sudarshan') &&
            !item.doctorName?.includes('Neelkanta') &&
            !item.doctorName?.includes('Rajiv') &&
            !item.title?.includes('Rajiv') &&
            !(item.title === 'General' && !item.doctorName)
        );
        try {
          localStorage.setItem('onepatient_user_uploads', JSON.stringify(cleaned));
        } catch (_) {}
        return cleaned.map((item) => {
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
          if (item.status && item.status.toLowerCase().includes('cryptograph')) {
            item.status = 'Verified Record';
          }
          return item;
        });
      }
      return [];
    } catch (e) {
      console.error(e);
      return [];
    }
  });

  const allRecords = uploads;
  const setAllRecords = setUploads;

  // Sharing groups & active members for the current user
  const [sharingGroups, setSharingGroups] = useState([]);
  const [groupMembers, setGroupMembers] = useState([]);

  // Fetch and refresh sharing groups and member consent when user changes
  const loadUserSharingState = async (user) => {
    if (!user?.id) {
      setSharingGroups([]);
      setGroupMembers([]);
      return;
    }
    try {
      const groups = await fetchUserSharingGroups(user.id);
      setSharingGroups(groups);
      if (groups.length > 0) {
        const members = await fetchGroupMembers(groups[0].id);
        setGroupMembers(members);
      } else {
        setGroupMembers([]);
      }
    } catch (err) {
      console.warn('Error loading sharing state:', err);
    }
  };

  useEffect(() => {
    loadUserSharingState(currentUser);
  }, [currentUser]);

  // Sync with Supabase on mount and establish Realtime subscriptions
  useEffect(() => {
    let isMounted = true;

    async function syncSupabase() {
      try {
        const remoteRecords = await fetchRecordsFromSupabase();
        if (!isMounted) return;

        if (remoteRecords && Array.isArray(remoteRecords)) {
          // Strictly use real records from database (zero hard-coded data)
          setAllRecords(remoteRecords);
          try {
            localStorage.setItem('onepatient_all_records', JSON.stringify(remoteRecords));
            localStorage.setItem('onepatient_user_uploads', JSON.stringify(remoteRecords));
          } catch (e) {
            console.error(e);
          }
        } else {
          setUploads([]);
          try {
            localStorage.removeItem('onepatient_user_uploads');
          } catch (e) {
            console.error(e);
          }
        }
      } catch (err) {
        console.warn('Supabase sync notice:', err);
      }
    }

    syncSupabase();

    // Subscribe to Supabase Realtime for instant cross-device updates
    const channel = subscribeToMedicalRecords(async (payload) => {
      if (payload.eventType === 'INSERT' && payload.new) {
        const newRecord = normalizeRecord(payload.new);
        setAllRecords((prev) => {
          if (prev.some((r) => r.id === newRecord.id)) return prev;
          const updated = [newRecord, ...prev];
          try {
            localStorage.setItem('onepatient_all_records', JSON.stringify(updated));
          } catch (e) {
            console.error(e);
          }
          return updated;
        });

        // Trigger Realtime UI Toast Notification
        setRealtimeToast(`Realtime Sync: New record received ("${newRecord.title || 'Medical Record'}")`);
        setTimeout(() => setRealtimeToast(''), 4500);
      } else if (payload.eventType === 'UPDATE' && payload.new) {
        const updatedRecord = normalizeRecord(payload.new);
        setAllRecords((prev) => {
          const updated = prev.map((r) => (r.id === updatedRecord.id ? updatedRecord : r));
          try {
            localStorage.setItem('onepatient_all_records', JSON.stringify(updated));
          } catch (e) {
            console.error(e);
          }
          return updated;
        });
      } else if (payload.isMembershipChange) {
        if (currentUser) {
          loadUserSharingState(currentUser);
        }
      }
    });

    return () => {
      isMounted = false;
      unsubscribeFromMedicalRecords(channel);
    };
  }, [currentUser]);

  // Global drag-and-drop security: prevent browser from navigating away if a user drops a file anywhere
  useEffect(() => {
    const handleGlobalDrag = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };
    const handleGlobalDrop = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener('dragover', handleGlobalDrag);
    window.addEventListener('dragenter', handleGlobalDrag);
    window.addEventListener('dragleave', handleGlobalDrag);
    window.addEventListener('drop', handleGlobalDrop);
    document.addEventListener('dragover', handleGlobalDrag);
    document.addEventListener('drop', handleGlobalDrop);

    return () => {
      window.removeEventListener('dragover', handleGlobalDrag);
      window.removeEventListener('dragenter', handleGlobalDrag);
      window.removeEventListener('dragleave', handleGlobalDrag);
      window.removeEventListener('drop', handleGlobalDrop);
      document.removeEventListener('dragover', handleGlobalDrag);
      document.removeEventListener('drop', handleGlobalDrop);
    };
  }, []);

  const [reminders, setReminders] = useState(() => {
    try {
      const stored = localStorage.getItem('onepatient_med_reminders');
      if (!stored) return INITIAL_REMINDERS;
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return parsed.filter((r) => r.sourcePrescriptionId !== 'upload-init-neuro');
      }
      return INITIAL_REMINDERS;
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
        Notification.requestPermission().catch(() => { });
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
      const nowMs = now.getTime();

      reminders.forEach((rem) => {
        if (!rem.enabled) return;

        // Check snooze
        const snoozeTime = snoozedUntilRef.current[rem.id];
        const isSnoozeActive = snoozeTime && nowMs < snoozeTime;

        // Skip if already taken today
        if (rem.lastTakenDate === todayKey) return;

        const scheduledTimeMatches = rem.time24 === currentTime24;
        const triggerKey = `${rem.id}_${todayKey}_${currentTime24}`;

          if ((scheduledTimeMatches || isSnoozeActive) && !triggeredMinuteRef.current[triggerKey]) {
            triggeredMinuteRef.current[triggerKey] = true;

              const notif = {
                id: 'notif-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
                reminderId: rem.id,
                medName: rem.medName,
                dosage: rem.dosage,
                instruction: rem.instruction,
                timeLabel: formatTime24To12(rem.time24),
                timestamp: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                createdAt: nowMs,
              };

      setNotifications((prev) => [notif, ...prev.filter((n) => n.reminderId !== rem.id)]);

      if (soundEnabled) {
        playReminderChime();
      }

      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        try {
          new Notification(`Medication Reminder: ${rem.medName}`, {
            body: `${rem.dosage ? rem.dosage + ' • ' : ''}${rem.instruction || 'Time to take your medication'}`,
            icon: '/favicon.ico',
            tag: rem.id,
          });
        } catch {
          // Ignore notification errors in background
        }
      }
    }
  });
}

checkReminders();
const interval = setInterval(checkReminders, 15000);
return () => clearInterval(interval);
  }, [reminders, soundEnabled]);

// URL Hash Sync for routing
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
  const handleSaveUpload = async (newRecord, shouldRedirect = false) => {
    const updated = [newRecord, ...uploads];
    setUploads(updated);
    try {
      await insertRecordToSupabase(newRecord);

      // Trigger asynchronous RAG Ingestion in the backend
      fetch(`${API_BASE_URL}/api/records/${newRecord.id}/ingest`, {
        method: 'POST',
      }).catch((err) => console.warn('RAG auto-ingest notice:', err.message));
    } catch (e) {
      console.error(e);
    }

    // Navigate to My Uploads if explicitly requested
    if (shouldRedirect) {
      navigateTo('my-uploads');
    }
  };

  const handleUpdateRecord = (updated) => {
    setUploads((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
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

    // Dedicated doctor portal view route for scanned QR access (accessible directly without patient auth)
    if (page.startsWith('doctor-portal')) {
      return <DoctorPortalView uploads={uploads} setPage={navigateTo} onUpdateRecord={handleUpdateRecord} />;
    }

    // Patient Authentication gate
    if (!currentUser) {
      return <AuthPage onAuthSuccess={handleAuthSuccess} onLoginSuccess={handleAuthSuccess} />;
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
        {page === 'current-medication' && (
          <CurrentMedication
            setPage={navigateTo}
            uploads={uploads}
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
          onUploadSuccess={(record) => handleSaveUpload(record, false)}
          currentUser={currentUser}
          sharingGroups={sharingGroups}
        />
      </div>
    );
  }
