import { useState, useEffect } from 'react';
import LandingPage from './components/LandingPage';
import PatientDashboard from './components/PatientDashboard';
import AuditTrail from './components/AuditTrail';
import AuthPage from './components/AuthPage';
import MyUploads from './components/MyUploads';
import UploadModal from './components/UploadModal';
import AboutUs from './components/AboutUs';

const INITIAL_UPLOADS = [];

// Specific IDs and markers of seeded demo records to remove from existing storage
const isDemoRecord = (item) => {
  if (!item) return false;
  if (item.id === 'upload-init-1' || item.id === 'upload-init-2') return true;
  if (
    item.description === 'Metformin 500mg Daily Prescription — Blood sugar monitoring after breakfast' &&
    item.category === 'Endocrinology & Diabetes'
  ) {
    return true;
  }
  if (
    item.description === 'Complete Lipid Panel & Fasting Glucose Comprehensive Pathology Report' &&
    item.category === 'Laboratory & Pathology'
  ) {
    return true;
  }
  return false;
};

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
    if (hash === 'dashboard') return 'dashboard';
    if (hash === 'audit') return 'audit';
    if (hash === 'my-uploads') return 'my-uploads';
    if (hash === 'about-us' || hash === 'about') return 'about-us';
    return 'landing';
  });

  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  // Load user uploads or fall back to empty array []
  const [uploads, setUploads] = useState(() => {
    try {
      const stored = localStorage.getItem('onepatient_user_uploads');
      if (!stored) return INITIAL_UPLOADS;
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        // Remove only the seeded demo records, preserving genuine user uploads
        const cleaned = parsed.filter((item) => !isDemoRecord(item));
        if (cleaned.length !== parsed.length) {
          localStorage.setItem('onepatient_user_uploads', JSON.stringify(cleaned));
        }
        return cleaned;
      }
      return INITIAL_UPLOADS;
    } catch (e) {
      console.error(e);
      return INITIAL_UPLOADS;
    }
  });

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash === 'dashboard') setPage('dashboard');
      else if (hash === 'audit') setPage('audit');
      else if (hash === 'my-uploads') setPage('my-uploads');
      else if (hash === 'about-us' || hash === 'about') setPage('about-us');
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
    else window.location.hash = newPage;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Add new uploaded record and redirect to My Uploads
  const handleUploadSuccess = (newRecord) => {
    const updated = [newRecord, ...uploads];
    setUploads(updated);
    try {
      localStorage.setItem('onepatient_user_uploads', JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
    // Navigate straight to the My Uploads panel
    navigateTo('my-uploads');
  };

  // If not logged in, show the Auth (Login/Signup) gate
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
        />
      )}
      {page === 'my-uploads' && (
        <MyUploads
          setPage={navigateTo}
          uploads={uploads}
          onOpenUploadModal={() => setIsUploadModalOpen(true)}
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
      />
    </div>
  );
}
