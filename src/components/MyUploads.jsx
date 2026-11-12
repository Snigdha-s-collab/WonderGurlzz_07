import { useState } from 'react';

function Icon({ name, className = '' }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>;
}

export default function MyUploads({ setPage, uploads = [], onOpenUploadModal, currentUser, onLogout }) {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');

  const categories = ['All', ...new Set(uploads.map((u) => u.category))];

  const filteredUploads = uploads.filter((item) => {
    const matchesCat = selectedCategory === 'All' || item.category === selectedCategory;
    const matchesSearch =
      item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.files && item.files.some((f) => f.name.toLowerCase().includes(searchTerm.toLowerCase())));
    return matchesCat && matchesSearch;
  });

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
              <div className="text-teal-300 text-[10px] font-medium leading-tight">My Uploads Repository</div>
            </div>
          </div>

          {/* Nav pills */}
          <nav className="hidden md:flex items-center glass-nav-card rounded-full px-6 py-2 gap-6">
            {['Home', 'My Uploads', 'Access QR', 'Ask MedBot', 'About Us'].map((link) => (
              <button
                key={link}
                onClick={() => {
                  if (link === 'Home') setPage('landing');
                  else if (link === 'Access QR') setPage('dashboard');
                }}
                className={`text-sm font-medium transition-colors ${
                  link === 'My Uploads' ? 'text-teal-300 font-bold' : 'text-white/80 hover:text-teal-300'
                }`}
              >
                {link}
              </button>
            ))}
          </nav>

          {/* User profile & actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={onOpenUploadModal}
              className="teal-gradient-btn text-white font-bold text-xs px-4 py-2 rounded-full shadow-pill-glow flex items-center gap-1.5 hover:opacity-90 active:scale-95 transition-all"
            >
              <Icon name="add" className="text-base" />
              <span>Upload New</span>
            </button>

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

      {/* ── MAIN CONTENT ── */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 pt-24 pb-16">
        
        {/* Top Title Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-50 border border-teal-200 text-teal-800 text-xs font-semibold mb-2">
              <Icon name="folder_special" className="text-sm text-teal-600" />
              <span>Decentralized Health Records</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#00241f] tracking-tight">
              My Uploaded Records & Prescriptions
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              All documents, medical problems, and medication histories are saved and indexed here.
            </p>
          </div>

          <button
            onClick={onOpenUploadModal}
            className="self-start sm:self-auto teal-gradient-btn text-white font-bold text-sm px-6 py-3 rounded-full shadow-pill-glow flex items-center gap-2 hover:scale-105 active:scale-95 transition-transform"
          >
            <Icon name="cloud_upload" className="text-xl" />
            <span>+ Upload Record</span>
          </button>
        </div>

        {/* Filter & Search Bar */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-col md:flex-row gap-4 items-center justify-between mb-6">
          {/* Search Input */}
          <div className="relative w-full md:w-80">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
              <Icon name="search" className="text-lg" />
            </span>
            <input
              type="text"
              placeholder="Search by description or category..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white"
            />
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 scrollbar-none">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
                  selectedCategory === cat
                    ? 'bg-[#0b3b34] text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Uploads Grid / List */}
        {filteredUploads.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/80 shadow-sm">
            <div className="w-16 h-16 rounded-full bg-teal-50 text-teal-700 flex items-center justify-center mx-auto mb-4">
              <Icon name="inventory_2" className="text-3xl" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1">No uploads found</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mb-6">
              {searchTerm || selectedCategory !== 'All'
                ? 'Try adjusting your search query or category filter.'
                : 'You have not uploaded any medical records yet. Press the upload button to add your first prescription or report.'}
            </p>
            <button
              onClick={onOpenUploadModal}
              className="teal-gradient-btn text-white font-bold text-xs px-6 py-2.5 rounded-full shadow-pill-glow inline-flex items-center gap-1.5"
            >
              <Icon name="upload" className="text-base" />
              <span>Upload Document Now</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredUploads.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:border-teal-300 hover:shadow-card-glass transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Category Pill & Date */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="px-2.5 py-1 rounded-full bg-teal-50 border border-teal-200 text-teal-800 font-bold text-[10px] tracking-wide uppercase">
                      {item.category}
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {item.date || item.timestamp}
                    </span>
                  </div>

                  {/* Description / Title */}
                  <h3 className="font-bold text-sm text-slate-900 mb-1.5 leading-snug">
                    {item.title || item.description}
                  </h3>

                  {/* Doctor Name (if present) */}
                  {item.doctorName && (
                    <div className="flex items-center gap-1.5 text-xs text-teal-800 font-semibold mb-2">
                      <Icon name="person" className="text-sm text-teal-600" />
                      <span>{item.doctorName}</span>
                    </div>
                  )}

                  {/* Attached Files List */}
                  {item.files && item.files.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-100 space-y-1.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Files ({item.files.length})
                      </span>
                      {item.files.map((file, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between bg-slate-50 rounded-xl px-2.5 py-1.5 text-xs text-slate-700"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <Icon name="attach_file" className="text-teal-600 text-sm flex-shrink-0" />
                            <span className="truncate font-medium">{file.name}</span>
                          </div>
                          {file.size && (
                            <span className="text-[10px] text-slate-400 flex-shrink-0 ml-1">
                              {file.size}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Footer status & Actions */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-teal-700">
                    <Icon name="verified" className="text-xs text-teal-500" />
                    <span>{item.status || 'Verified Record'}</span>
                  </span>
                  <button
                    onClick={() => alert(`Opening record: "${item.description}"`)}
                    className="text-xs font-bold text-teal-800 hover:text-teal-600 hover:underline"
                  >
                    View Details →
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

