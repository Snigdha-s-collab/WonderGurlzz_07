function Icon({ name, className = '' }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>;
}

export default function MyUploads({ setPage, currentUser, onLogout }) {
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
              <div className="text-teal-300 text-[10px] font-medium leading-tight">My Uploads</div>
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
                }}
                className={`text-sm font-medium transition-colors ${
                  link === 'My Uploads' ? 'text-teal-300 font-bold' : 'text-white/80 hover:text-teal-300'
                }`}
              >
                {link}
              </button>
            ))}
          </nav>

          {/* User Section */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col items-center">
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

      {/* ── CLEAN EMPTY WORKSPACE FOR YOUR TEAMMATE ── */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 pt-28 pb-16 flex flex-col items-center justify-center">
        {/* Placeholder workspace area */}
      </main>
    </div>
  );
}
