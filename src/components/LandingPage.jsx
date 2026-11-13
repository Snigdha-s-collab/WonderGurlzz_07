import { useState, useRef } from 'react';
import { navLinks } from '../data/patientData';
import NotificationBell from './NotificationBell';

const HERO_IMG = 'https://lh3.googleusercontent.com/aida-public/AB6AXuAHFpN5618twQEPwL_x11zHAa0yFdXqo05iBTIiE7dqPJhpYPvJL-GFk3B_FNFoYI-nfsej64aB4asNQ4e-88kbcFeTURksCa8JWhQHErEh69bOMU0-TxU6XSL-YybaiEmapm-tK9A97ESBt6TbPz15L7mLl3dEEfOcck0bEsRJTarElFjTKFdHpgL_k5QX5MpxdJXfI1tMJI07gVfki7SQX_cp_U9pSwFe3PGyrb3h';
const CLINICIAN_IMG = 'https://lh3.googleusercontent.com/aida-public/AB6AXuCQp0liPoebipHAS2YNHYhi2kE6fUHb0fB43SfQ-pteJpJ1rEPCqWS1FJ40Y05ev_5Up8nKtCUVAGFsbNbjwbJmVcS1wbFIUHHiHFTH5ORv9cHgjdy-8YhdfI8pk6O2jzPdtFNTpmCYu2oM9xVnsYe8xXSJb7kf9CS9ASLTG35VumFZuTlxFUt8W0L1ktLst4_6_nuNataMnWFKgUeeXSqiqsEfKEvkVARPBYgNy6np';

function Icon({ name, className = '' }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>;
}

export default function LandingPage({
  setPage,
  currentUser,
  onLogout,
  onOpenUploadModal,
  onOpenPrescriptionModal,
  notifications = [],
  reminders = [],
  onMarkTaken,
  onDismissNotification,
  onTriggerTestReminder,
  onOpenMedBot,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const heroRef = useRef(null);

  return (
    <div className="bg-[#faf8ff] text-[#131b2e] h-screen overflow-hidden">
      {/* ── HEADER ── */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#00241f] px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full teal-gradient-btn flex items-center justify-center shadow-orb-glow">
              <span className="text-white font-black text-sm">Dr.</span>
            </div>
            <div>
              <div className="text-white font-bold text-base leading-tight">OnePatient</div>
              <div className="text-teal-300 text-[10px] font-medium leading-tight">Unified Health Ledger</div>
            </div>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden lg:flex items-center glass-nav-card rounded-full px-6 py-2 gap-6">
            {navLinks.map((link) => (
              <button
                key={link}
                onClick={() => {
                  if (link === 'Home') {
                    heroRef.current?.scrollIntoView({ behavior: 'smooth' });
                  } else if (link === 'My Uploads') {
                    setPage('my-uploads');
                  } else if (link === 'Access QR') {
                    setPage('access-qr');
                  } else if (link === 'About Us') {
                    setPage('about-us');
                  } else if (link === 'Ask MedBot') {
                    onOpenMedBot ? onOpenMedBot() : setPage('medbot');
                  }
                }}
                className="text-white/80 hover:text-teal-300 text-sm font-medium transition-colors"
              >
                {link}
              </button>
            ))}
          </nav>

          {/* User Section & Notification in Right Corner */}
          <div className="hidden lg:flex items-center gap-4">
            {/* Notification Bell Icon */}
            <NotificationBell
              notifications={notifications}
              reminders={reminders}
              onMarkTaken={onMarkTaken}
              onDismissNotification={onDismissNotification}
              onTriggerTestReminder={onTriggerTestReminder}
              onOpenMedBot={() => (onOpenMedBot ? onOpenMedBot() : setPage('medbot'))}
            />

            {/* Profile Icon with User's Name Below */}
            <div className="flex flex-col items-center">
              <div className="w-9 h-9 rounded-full teal-gradient-btn flex items-center justify-center text-white shadow-sm border border-white/20">
                <Icon name="person" className="text-xl" />
              </div>
              <span className="text-[11px] font-semibold text-white/90 max-w-[110px] truncate leading-tight mt-0.5 text-center">
                {currentUser?.name || 'User'}
              </span>
            </div>

            {/* Logout Symbol */}
            {onLogout && (
              <button
                onClick={onLogout}
                className="p-2 rounded-full text-white/70 hover:text-red-300 hover:bg-white/10 transition-colors ml-1"
                title="Log Out"
              >
                <Icon name="logout" className="text-2xl" />
              </button>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            className="lg:hidden text-white p-2"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <div className="w-5 h-0.5 bg-white mb-1" />
            <div className="w-5 h-0.5 bg-white mb-1" />
            <div className="w-5 h-0.5 bg-white" />
          </button>
        </div>

        {/* Mobile Menu */}
        {menuOpen && (
          <div className="lg:hidden mt-3 glass-nav-card rounded-2xl p-4 mx-4">
            {navLinks.map((link) => (
              <button
                key={link}
                onClick={() => {
                  if (link === 'Home') {
                    heroRef.current?.scrollIntoView({ behavior: 'smooth' });
                  } else if (link === 'My Uploads') {
                    setPage('my-uploads');
                  } else if (link === 'Access QR') {
                    setPage('access-qr');
                  } else if (link === 'About Us') {
                    setPage('about-us');
                  } else if (link === 'Ask MedBot') {
                    onOpenMedBot ? onOpenMedBot() : setPage('medbot');
                  }
                  setMenuOpen(false);
                }}
                className="block w-full text-left text-white/80 py-2 px-3 rounded-lg hover:bg-white/10 text-sm font-medium"
              >
                {link}
              </button>
            ))}
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/10 px-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full teal-gradient-btn flex items-center justify-center text-white text-sm">
                  <Icon name="person" className="text-base" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-white">{currentUser?.name || 'User'}</span>
                  <span className="text-[10px] text-teal-300 font-mono">{currentUser?.permanentId}</span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onOpenMedBot ? onOpenMedBot() : setPage('medbot');
                  }}
                  className="p-1.5 rounded-full text-white/80 hover:text-teal-300"
                  title="Medication Reminders"
                >
                  <Icon name="notifications" className="text-xl" />
                </button>
                {onLogout && (
                  <button
                    onClick={onLogout}
                    className="p-1.5 rounded-full text-white/70 hover:text-red-300"
                    title="Log Out"
                  >
                    <Icon name="logout" className="text-xl" />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </header>

      {/* ── HERO ── */}
      <section
        ref={heroRef}
        className="hero-teal-gradient relative overflow-hidden pt-20 h-screen max-h-screen flex flex-col justify-center"
      >
        {/* Mesh overlay */}
        <div className="absolute inset-0 mesh-subtle-pattern opacity-100 pointer-events-none" />

        <div className="relative z-10 max-w-7xl mx-auto px-6 py-6 flex flex-col lg:flex-row items-center gap-12 flex-1 justify-center">
          {/* Left text */}
          <div className="flex-1 text-center lg:text-left">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-2 mb-6">
              <span className="w-2 h-2 rounded-full bg-teal-400 pulsing-dot" />
              <span className="text-teal-200 text-xs font-semibold tracking-wide">
                Federated Health Record Ledger 2.0
              </span>
            </div>

            <h1 className="text-4xl lg:text-6xl font-extrabold text-white leading-tight mb-6">
              Your Health Story,{' '}
              <span className="bg-gradient-to-r from-teal-300 to-teal-500 bg-clip-text text-transparent">
                All in One Place.
              </span>
            </h1>

            <p className="text-white/60 text-base lg:text-lg max-w-lg mb-8 leading-relaxed mx-auto lg:mx-0">
              Bring your prescriptions, lab reports, scans, and medical history together in one secure platform. Find important health information easily, understand your medical journey, and keep your records organised whenever you need them.
            </p>

            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3 sm:gap-4">
              {/* Button 1: Upload Prescription */}
              <button
                type="button"
                onClick={onOpenPrescriptionModal}
                className="inline-flex items-center gap-2 teal-gradient-btn text-white font-bold px-5 sm:px-6 py-3.5 rounded-full text-sm shadow-pill-glow hover:scale-105 transition-transform"
              >
                <Icon name="prescriptions" className="text-lg sm:text-xl text-white" />
                <span>Upload Prescription</span>
              </button>

              {/* Button 2: Upload Medical Documents */}
              <button
                type="button"
                onClick={onOpenUploadModal}
                className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold px-5 sm:px-6 py-3.5 rounded-full text-sm transition-all hover:scale-105"
              >
                <Icon name="description" className="text-lg sm:text-xl text-teal-300" />
                <span>Upload Medical Documents</span>
              </button>

              {/* Button 3: View Current Medications */}
              <button
                type="button"
                onClick={() => onNavigate && onNavigate('my-uploads')}
                className="inline-flex items-center gap-2 bg-teal-950/80 hover:bg-teal-900 border border-teal-500/40 text-teal-200 font-bold px-5 sm:px-6 py-3.5 rounded-full text-sm transition-all hover:scale-105"
              >
                <Icon name="medication" className="text-lg sm:text-xl text-teal-400" />
                <span>View Current Medications</span>
              </button>
            </div>
          </div>

          {/* Right image */}
          <div className="flex-1 flex justify-center lg:justify-end">
            <div className="relative">
              <div className="absolute -inset-4 rounded-3xl bg-teal-500/20 blur-2xl" />
              <img
                src={HERO_IMG}
                alt="Medical Team"
                className="relative w-full max-w-sm lg:max-w-lg rounded-3xl object-cover shadow-2xl"
                onError={(e) => {
                  e.target.src = 'https://placehold.co/500x400/0b3b34/5eead4?text=Medical+Team';
                }}
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

