import { useState, useEffect } from 'react';
import LandingPage from './components/LandingPage';
import PatientDashboard from './components/PatientDashboard';
import AuditTrail from './components/AuditTrail';
import AuthPage from './components/AuthPage';
import MyUploads from './components/MyUploads';
import UploadModal from './components/UploadModal';
import AboutUs from './components/AboutUs';

import AccessQRPage from './components/AccessQRPage';
import DoctorPortalView from './components/DoctorPortalView';
import { fetchRecordsFromSupabase, insertRecordToSupabase } from './lib/supabaseClient';

const INITIAL_UPLOADS = [];

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('onepatient_current_user');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });

  const [page, setPage] = useState(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash.startsWith('doctor-portal')) return 'doctor-portal';
    if (hash === 'dashboard') return 'dashboard';
    if (hash === 'audit') return 'audit';
    if (hash === 'my-uploads') return 'my-uploads';
    if (hash === 'about-us' || hash === 'about') return 'about-us';
    if (hash === 'access-qr') return 'access-qr';
    return 'landing';
  });

  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  // Load user uploads and ensure Neurology Prescription is available
  const [uploads, setUploads] = useState(() => {
    try {
      const stored = localStorage.getItem('onepatient_user_uploads');
      if (!stored) return INITIAL_UPLOADS;
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        const enriched = parsed.map((item) => {
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
        return enriched;
      }
      return INITIAL_UPLOADS;
    } catch (e) {
      console.error(e);
      return INITIAL_UPLOADS;
    }
  });

  // Query Supabase to sync remote database records on launch or when patient logs in
  useEffect(() => {
    let isMounted = true;
    async function syncData() {
      try {
        const patientId = currentUser?.permanentId || null;
        const remoteRecords = await fetchRecordsFromSupabase(patientId);
        if (!isMounted) return;

        if (remoteRecords && remoteRecords.length > 0) {
          setUploads(remoteRecords);
          try {
            localStorage.setItem('onepatient_user_uploads', JSON.stringify(remoteRecords));
          } catch (e) {
            console.error(e);
          }
        } else {
          // If remote DB is empty, check if user uploaded records locally to sync to Supabase
          const stored = localStorage.getItem('onepatient_user_uploads');
          if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed) && parsed.length > 0) {
              for (const r of parsed) {
                await insertRecordToSupabase({
                  ...r,
                  patientId: r.patientId || currentUser?.permanentId || 'NNM24cc059',
                });
              }
              const reFetched = await fetchRecordsFromSupabase(patientId);
              if (reFetched && reFetched.length > 0 && isMounted) {
                setUploads(reFetched);
              }
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
  }, [currentUser]);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash.startsWith('doctor-portal')) setPage('doctor-portal');
      else if (hash === 'dashboard') setPage('dashboard');
      else if (hash === 'audit') setPage('audit');
      else if (hash === 'my-uploads') setPage('my-uploads');
      else if (hash === 'about-us' || hash === 'about') setPage('about-us');
      else if (hash === 'access-qr') setPage('access-qr');
      else setPage('landing');
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

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
    else if (!newPage.startsWith('doctor-portal')) window.location.hash = newPage;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Update single record in state and localStorage (e.g. after human verification)
  const handleUpdateRecord = (updatedRecord) => {
    setUploads((prev) =>
      prev.map((r) => (r.id === updatedRecord.id ? updatedRecord : r))
    );
    try {
      const stored = localStorage.getItem('onepatient_user_uploads');
      if (stored) {
        const parsed = JSON.parse(stored);
        const updated = parsed.map((r) => (r.id === updatedRecord.id ? updatedRecord : r));
        localStorage.setItem('onepatient_user_uploads', JSON.stringify(updated));
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Add new uploaded record, persist locally and push to Supabase
  const handleUploadSuccess = (newRecord) => {
    // Explicitly scope record to authenticated patient (Requirement 3)
    const patientId = currentUser?.permanentId || 'NNM24cc059';
    const recordWithPatient = {
      ...newRecord,
      patientId: newRecord.patientId || patientId,
    };
    const updated = [recordWithPatient, ...uploads];
    setUploads(updated);
    try {
      localStorage.setItem('onepatient_user_uploads', JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
    // Asynchronously insert to Supabase database table with ocr_data JSONB
    insertRecordToSupabase(recordWithPatient);

    // Navigate straight to the My Uploads panel
    navigateTo('my-uploads');
  };

  // 1. Doctor Portal View (Accessed directly via scanned QR code URL)
  if (page === 'doctor-portal') {
    return <DoctorPortalView setPage={navigateTo} uploads={uploads} onUpdateRecord={handleUpdateRecord} />;
  }

  // 2. Patient Authentication gate
  if (!currentUser) {
    return <AuthPage onLoginSuccess={handleLoginSuccess} />;
  }

  // 3. Authenticated Patient Experience
  return (
    <div className="font-sans antialiased text-slate-800">
      {page === 'landing' && (
        <LandingPage
          setPage={navigateTo}
          currentUser={currentUser}
          onLogout={handleLogout}
          onOpenUploadModal={() => setIsUploadModalOpen(true)}
        />
      )}
      {page === 'my-uploads' && (
        <MyUploads
          setPage={navigateTo}
          uploads={uploads}
          onOpenUploadModal={() => setIsUploadModalOpen(true)}
          currentUser={currentUser}
          onLogout={handleLogout}
          onUpdateRecord={handleUpdateRecord}
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
        />
      )}
      {page === 'audit' && (
        <AuditTrail
          setPage={navigateTo}
          currentUser={currentUser}
          onLogout={handleLogout}
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

      {/* Upload Modal Popup */}
      <UploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onUploadSuccess={handleUploadSuccess}
        currentUser={currentUser}
      />
    </div>
  );
}
