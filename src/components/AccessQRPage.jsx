import { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { saveQRTokenToSupabase } from '../lib/supabaseClient';

function Icon({ name, className = '' }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>;
}

export default function AccessQRPage({ setPage, currentUser, onLogout }) {
  const [qrGenerated, setQrGenerated] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [tokenInfo, setTokenInfo] = useState(null);
  const [scanUrl, setScanUrl] = useState('');
  const [timeLeft, setTimeLeft] = useState(120); // 2 minutes countdown
  const [copiedLink, setCopiedLink] = useState(false);

  // Generate a genuinely unique token and verifiable URL every single time
  const generateNewToken = async () => {
    // Cryptographically secure random UUID + high precision timestamp
    const uniqueToken = 'tk_' + (crypto?.randomUUID ? crypto.randomUUID().replace(/-/g, '') : Math.random().toString(36).substring(2) + Date.now().toString(36));
    const expiresAt = Date.now() + 120 * 1000; // 2 minutes from now

    // Patient identification metadata linked strictly in local session / registry
    const patientName = currentUser?.name || 'Eleanor Vance';
    const patientId = currentUser?.permanentId || 'GLP-9041-K7-VERIFIED';

    // Store in active tokens registry so doctor portal can validate it
    try {
      const activeTokens = JSON.parse(localStorage.getItem('onepatient_active_tokens') || '{}');
      activeTokens[uniqueToken] = {
        token: uniqueToken,
        patientName,
        patientId,
        expiresAt,
        used: false,
        created: Date.now(),
      };
      localStorage.setItem('onepatient_active_tokens', JSON.stringify(activeTokens));
      // Asynchronously store token to Supabase db
      saveQRTokenToSupabase(activeTokens[uniqueToken]);
    } catch (e) {
      console.error(e);
    }

    // Direct doctor portal scan URL with the real token parameter
    const origin = window.location.origin;
    const path = window.location.pathname;
    const fullScanUrl = `${origin}${path}#doctor-portal?token=${encodeURIComponent(uniqueToken)}&patient=${encodeURIComponent(patientName)}`;

    try {
      // Generate actual scannable QR code linking to the doctor portal
      const dataUrl = await QRCode.toDataURL(fullScanUrl, {
        width: 340,
        margin: 2,
        color: {
          dark: '#00241f',
          light: '#ffffff',
        },
      });

      setQrDataUrl(dataUrl);
      setScanUrl(fullScanUrl);
      setTokenInfo({
        token: uniqueToken,
        expiresAt,
      });
      setTimeLeft(120);
      setQrGenerated(true);
    } catch (err) {
      console.error('Error rendering QR code:', err);
    }
  };

  // Timer countdown
  useEffect(() => {
    if (!qrGenerated) return;

    if (timeLeft <= 0) {
      // Auto-refresh when expired so a new unique QR appears
      generateNewToken();
      return;
    }

    const interval = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [qrGenerated, timeLeft]);

  const formatTimer = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleCopyLink = () => {
    if (scanUrl) {
      navigator.clipboard?.writeText(scanUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  return (
    <div className="bg-[#faf8ff] text-[#131b2e] min-h-screen flex flex-col">
      {/* ── HEADER ── */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#00241f] px-4 py-3 shadow-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setPage('landing')}
              className="w-10 h-10 rounded-full teal-gradient-btn flex items-center justify-center shadow-orb-glow"
              title="Return Home"
            >
              <span className="text-white font-black text-sm">Dr.</span>
            </button>
            <div>
              <div className="text-white font-bold text-base leading-tight">OnePatient</div>
              <div className="text-teal-300 text-[10px] font-medium leading-tight">Temporary QR Access</div>
            </div>
          </div>

          {/* Nav pills */}
          <nav className="hidden md:flex items-center glass-nav-card rounded-full px-6 py-2 gap-6">
            {['Home', 'My Uploads', 'Access QR', 'Ask MedBot', 'About Us'].map((link) => (
              <button
                key={link}
                onClick={() => {
                  if (link === 'Home') setPage('landing');
                  else if (link === 'My Uploads') setPage('my-uploads');
                  else if (link === 'Access QR') setPage('access-qr');
                  else if (link === 'About Us') setPage('about-us');
                  else if (link === 'Ask MedBot') {
                    setPage('medbot');
                  }
                }}
                className={`text-sm font-medium transition-colors ${
                  link === 'Access QR' ? 'text-teal-300 font-bold' : 'text-white/80 hover:text-teal-300'
                }`}
              >
                {link}
              </button>
            ))}
          </nav>

          {/* User Section */}
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 rounded-full teal-gradient-btn flex items-center justify-center text-white text-sm">
                <Icon name="person" className="text-lg" />
              </div>
              <span className="text-[10px] font-semibold text-white/90 max-w-[80px] truncate">
                {currentUser?.name || 'User'}
              </span>
            </div>

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
      </header>

      {/* ── MAIN CONTENT ── */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 pt-20 pb-10">
        {!qrGenerated ? (
          /* STATE 1: Initial state with Center Button */
          <div className="max-w-md w-full bg-white rounded-3xl p-8 sm:p-10 shadow-card-glass border border-slate-100 text-center space-y-6">
            <div className="w-20 h-20 rounded-full bg-teal-50 text-teal-800 flex items-center justify-center mx-auto shadow-inner">
              <Icon name="qr_code_scanner" className="text-4xl text-teal-700" />
            </div>

            <div>
              <h1 className="text-2xl font-extrabold text-[#00241f] tracking-tight">
                In-Person QR Access
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-2 leading-relaxed">
                Show your dynamic QR code to your doctor. Presenting this code grants temporary, secure access to your health records without SMS or OTP friction.
              </p>
            </div>

            {/* Security assurance */}
            <div className="bg-slate-50 rounded-2xl p-4 text-left space-y-2 border border-slate-100 text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <Icon name="lock" className="text-teal-600 text-base flex-shrink-0" />
                <span>Zero medical data stored in the QR code</span>
              </div>
              <div className="flex items-center gap-2">
                <Icon name="auto_mode" className="text-teal-600 text-base flex-shrink-0" />
                <span>Generates a completely unique single-use token every time</span>
              </div>
              <div className="flex items-center gap-2">
                <Icon name="timer" className="text-teal-600 text-base flex-shrink-0" />
                <span>Auto-refreshes every 2 minutes</span>
              </div>
            </div>

            {/* Center Button */}
            <button
              onClick={generateNewToken}
              className="w-full teal-gradient-btn text-white font-extrabold py-4 px-6 rounded-2xl text-base shadow-pill-glow hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              <Icon name="qr_code_2" className="text-2xl" />
              <span>Generate a QR</span>
            </button>
          </div>
        ) : (
          /* STATE 2: Displaying Dynamic, Real Scannable QR */
          <div className="max-w-md w-full bg-white rounded-3xl p-6 sm:p-8 shadow-card-glass border border-slate-100 text-center space-y-5 animate-fadeIn">
            
            {/* Top Timer status */}
            <div className="flex items-center justify-between">
              <span className="px-3 py-1 rounded-full bg-teal-50 text-teal-800 text-[11px] font-bold border border-teal-200">
                Single-Use Token
              </span>
              <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-amber-600">
                <Icon name="timer" className="text-sm animate-pulse" />
                <span>Refreshes in {formatTimer(timeLeft)}</span>
              </div>
            </div>

            {/* Real Scannable QR Code */}
            <div className="relative mx-auto p-4 bg-white rounded-2xl border-2 border-teal-100 shadow-md inline-block">
              {qrDataUrl && (
                <img
                  src={qrDataUrl}
                  alt="Live Doctor Scan QR"
                  className="w-64 h-64 mx-auto object-contain"
                />
              )}
            </div>

            {/* Instructions */}
            <div>
              <h2 className="text-lg font-bold text-[#00241f]">
                Present this to your Doctor
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Any smartphone or doctor portal camera can scan this QR code directly to enter the Doctor Review page.
              </p>
            </div>

            {/* Unique Token Hex Badge */}
            <div className="bg-slate-50 rounded-xl px-3 py-2 border border-slate-200/80 text-left space-y-1">
              <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                <span>Unique Session Token</span>
                <span className="text-teal-700 font-mono">2 Min Expiry</span>
              </div>
              <p className="font-mono text-xs text-slate-800 truncate select-all">
                {tokenInfo?.token}
              </p>
            </div>

            {/* Direct Doctor Link Simulator */}
            <div className="pt-1 flex flex-col sm:flex-row gap-2">
              <button
                onClick={() => {
                  window.location.hash = `doctor-portal?token=${tokenInfo?.token}&patient=${encodeURIComponent(currentUser?.name || 'Eleanor Vance')}`;
                }}
                className="flex-1 teal-gradient-btn text-white font-bold py-2.5 px-3 rounded-xl text-xs shadow-pill-glow flex items-center justify-center gap-1.5 hover:opacity-90"
              >
                <Icon name="medical_services" className="text-base" />
                <span>Open Doctor View (Simulate Scan)</span>
              </button>

              <button
                onClick={handleCopyLink}
                className="py-2.5 px-3 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-xs flex items-center justify-center gap-1"
                title="Copy the scan URL to test on your phone or another tab"
              >
                <Icon name={copiedLink ? 'done' : 'link'} className="text-base" />
                <span>{copiedLink ? 'Copied Link!' : 'Copy Scan URL'}</span>
              </button>
            </div>

            {/* Re-generate fresh new QR button */}
            <div className="pt-2 flex items-center justify-between text-xs border-t border-slate-100">
              <button
                onClick={generateNewToken}
                className="text-teal-700 font-bold hover:underline flex items-center gap-1"
              >
                <Icon name="refresh" className="text-sm" />
                <span>Generate Another QR</span>
              </button>
              <button
                onClick={() => setQrGenerated(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                Back to start
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
