import { useState, useEffect } from 'react';
import LandingPage from './components/LandingPage';
import PatientDashboard from './components/PatientDashboard';
import AuditTrail from './components/AuditTrail';
import AuthPage from './components/AuthPage';
import MyUploads from './components/MyUploads';
import UploadModal from './components/UploadModal';

const INITIAL_UPLOADS = [
  {
    id: 'upload-init-1',
    description: 'Metformin 500mg Daily Prescription — Blood sugar monitoring after breakfast',
    category: 'Endocrinology & Diabetes',
    date: 'Nov 10, 2026',
    time: '10:30 AM',
    timestamp: 'Nov 10, 2026 • 10:30 AM',
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
    files: [
      { name: 'Lipid_Panel_Nov2026.pdf', size: '318.2 KB', type: 'application/pdf' },
      { name: 'Blood_Glucose_Graph.png', size: '89.4 KB', type: 'image/png' },
    ],
    status: 'Cryptographically Verified',
  },
];

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
    return 'landing';
  });

  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  // Load user uploads or fall back to sample records
  const [uploads, setUploads] = useState(() => {
    try {
      const stored = localStorage.getItem('onepatient_user_uploads');
      return stored ? JSON.parse(stored) : INITIAL_UPLOADS;
    } catch (e) {
      return INITIAL_UPLOADS;
    }
  });

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash === 'dashboard') setPage('dashboard');
      else if (hash === 'audit') setPage('audit');
      else if (hash === 'my-uploads') setPage('my-uploads');
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

      {/* Upload Modal Popup */}
      <UploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onUploadSuccess={handleUploadSuccess}
      />
    </div>
  );
}
