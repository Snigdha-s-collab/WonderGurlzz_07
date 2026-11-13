import { useState, useRef, useEffect } from 'react';
import NotificationBell from './NotificationBell';
import { getSignedDocumentUrl } from '../lib/supabaseClient';

function Icon({ name, className = '' }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>;
}

// 12 Medical categories with patient-friendly explanations in brackets + All Categories
const MEDICAL_CATEGORIES = [
  {
    name: 'All Categories',
    explanation: 'All medical records and uploaded documents',
    icon: 'grid_view',
  },
  {
    name: 'General Medicine',
    explanation: 'Common illnesses and general health check-ups',
    icon: 'medical_services',
  },
  {
    name: 'Cardiology',
    explanation: 'Heart and blood circulation',
    icon: 'monitor_heart',
  },
  {
    name: 'Endocrinology & Diabetes',
    explanation: 'Hormones, thyroid and blood sugar',
    icon: 'bloodtype',
  },
  {
    name: 'Radiology & Imaging',
    explanation: 'X-rays, MRI, CT scans and ultrasound',
    icon: 'radiology',
  },
  {
    name: 'Laboratory & Pathology',
    explanation: 'Blood tests, urine tests and other lab reports',
    icon: 'science',
  },
  {
    name: 'Orthopedics',
    explanation: 'Bones, joints, muscles and fractures',
    icon: 'accessibility_new',
  },
  {
    name: 'Oncology',
    explanation: 'Cancer diagnosis and treatment records',
    icon: 'medical_information',
  },
  {
    name: 'Neurology',
    explanation: 'Brain, nerves and nervous system',
    icon: 'psychology',
  },
  {
    name: 'Pediatrics',
    explanation: 'Healthcare for babies and children',
    icon: 'child_care',
  },
  {
    name: 'Prescriptions & Pharmacy',
    explanation: 'Medicines, prescriptions and dosage instructions',
    icon: 'medication',
  },
  {
    name: 'Emergency & Surgery',
    explanation: 'Emergency treatment and surgical records',
    icon: 'emergency',
  },
  {
    name: 'Other',
    explanation: 'Medical records that do not fit the above categories',
    icon: 'category',
  },
];

export default function MyUploads({
  setPage,
  uploads = [],
  onOpenUploadModal,
  currentUser,
  onLogout,
  notifications = [],
  reminders = [],
  onMarkTaken,
  onDismissNotification,
  onTriggerTestReminder,
  onOpenMedBot,
  sharingGroups = [],
  groupMembers = [],
  onRevokeMember,
  onAddMember,
}) {
  const [selectedCategory, setSelectedCategory] = useState('All Categories');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [categorySearch, setCategorySearch] = useState('');
  const [selectedRecordForDetails, setSelectedRecordForDetails] = useState(null);

  const dropdownRef = useRef(null);
  const categorySearchInputRef = useRef(null);

  // Focus search input when dropdown opens, reset search when closed
  useEffect(() => {
    if (isDropdownOpen) {
      const timer = setTimeout(() => {
        categorySearchInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    } else {
      setCategorySearch('');
    }
  }, [isDropdownOpen]);

  // Close dropdown when user clicks outside or presses Escape
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    }
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Filter categories for the live search/autocomplete inside dropdown
  const trimmedCatSearch = categorySearch.trim().toLowerCase();

  const filteredCategories = (() => {
    if (!trimmedCatSearch) return MEDICAL_CATEGORIES;

    // 1. Primary match: category name starts with query, or individual words start with query
    const wordMatches = MEDICAL_CATEGORIES.filter((cat) => {
      const nameLower = cat.name.toLowerCase();
      if (nameLower.startsWith(trimmedCatSearch)) return true;
      if (cat.name === 'All Categories') {
        return trimmedCatSearch === 'category' || trimmedCatSearch === 'categories';
      }
      const words = nameLower.split(/[\s&/]+/);
      return words.some((w) => w.startsWith(trimmedCatSearch));
    });

    if (wordMatches.length > 0) {
      return wordMatches;
    }

    // 2. Fallback match: substring in category name
    return MEDICAL_CATEGORIES.filter((cat) =>
      cat.name.toLowerCase().includes(trimmedCatSearch)
    );
  })();

  // Retrieve object for the currently active category
  const currentCategoryObj =
    MEDICAL_CATEGORIES.find(
      (c) => c.name.toLowerCase() === selectedCategory.toLowerCase()
    ) ||
    (selectedCategory === 'All'
      ? MEDICAL_CATEGORIES[0]
      : {
        name: selectedCategory,
        explanation: 'Filtered medical category',
        icon: 'folder_open',
      });

  // Filter records based on selected category
  const filteredUploads = uploads.filter((item) => {
    const isAll = selectedCategory === 'All Categories' || selectedCategory === 'All';
    return (
      isAll ||
      (item.category && item.category.trim().toLowerCase() === selectedCategory.trim().toLowerCase())
    );
  });

  // STRICT NEWEST-FIRST SORTING: sorts by High-Precision ISO 8601 created_at timestamp
  const sortedUploads = [...filteredUploads].sort((a, b) => {
    const timeA = new Date(a.createdAt || a.date || 0).getTime();
    const timeB = new Date(b.createdAt || b.date || 0).getTime();
    return timeB - timeA;
  });

  return (
    <div className="bg-[#faf8ff] text-[#131b2e] min-h-screen flex flex-col">
      {/* ── HEADER ── */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-[#00241f] px-4 py-3 shadow-md">
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
                  else if (link === 'My Uploads') setPage('my-uploads');
                  else if (link === 'Access QR') setPage('access-qr');
                  else if (link === 'About Us') setPage('about-us');
                  else if (link === 'Ask MedBot') {
                    onOpenMedBot ? onOpenMedBot() : setPage('medbot');
                  }
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
            <NotificationBell
              notifications={notifications}
              reminders={reminders}
              onMarkTaken={onMarkTaken}
              onDismissNotification={onDismissNotification}
              onTriggerTestReminder={onTriggerTestReminder}
              onOpenMedBot={() => (onOpenMedBot ? onOpenMedBot() : setPage('medbot'))}
            />
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
              <span className="text-[10px] font-semibold text-white/90 max-w-[90px] truncate">
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

        {/* ── CATEGORY SELECTION SECTION (FIRST ELEMENT) ── */}
        <section
          aria-label="Medical Category Selection"
          className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-100 mb-6 relative z-30"
        >
          {/* 1. Category Dropdown – First Element */}
          <div className="relative w-full" ref={dropdownRef}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold text-teal-800 uppercase tracking-wider flex items-center gap-1.5">
                <Icon name="tune" className="text-sm text-teal-600" />
                <span>Select Medical Category</span>
              </span>
              <span className="text-[10px] text-slate-400 font-medium hidden sm:inline">
                Filter health records by clinical specialty
              </span>
            </div>

            {/* Dropdown Button */}
            <button
              type="button"
              onClick={() => setIsDropdownOpen((prev) => !prev)}
              aria-haspopup="listbox"
              aria-expanded={isDropdownOpen}
              aria-label={`Select Medical Category: ${currentCategoryObj.name}`}
              className={`w-full bg-slate-50 hover:bg-slate-100/90 border rounded-xl px-4 py-3 flex items-center justify-between text-left transition-all focus:outline-none focus:ring-2 focus:ring-teal-500 ${
                isDropdownOpen ? 'border-teal-500 ring-2 ring-teal-500/20 bg-white' : 'border-slate-200 hover:border-teal-300'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0 pr-2">
                <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-100 text-teal-700 flex items-center justify-center flex-shrink-0">
                  <Icon name={currentCategoryObj.icon} className="text-xl" />
                </div>
                <div className="min-w-0">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-teal-700 leading-tight">
                    Select Medical Category
                  </span>
                  <span className="block text-sm font-extrabold text-slate-900 truncate">
                    {currentCategoryObj.name}
                    {currentCategoryObj.name !== 'All Categories' && (
                      <span className="ml-2 font-normal text-xs text-slate-500 hidden sm:inline">
                        ({currentCategoryObj.explanation})
                      </span>
                    )}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0 ml-2 text-slate-400">
                <Icon
                  name="arrow_drop_down"
                  className={`text-2xl transition-transform duration-200 ${
                    isDropdownOpen ? 'rotate-180 text-teal-600' : ''
                  }`}
                />
              </div>
            </button>

            {/* Dropdown Menu with Live Search */}
            {isDropdownOpen && (
              <div
                role="listbox"
                aria-label="Medical record categories"
                className="absolute left-0 right-0 sm:right-auto sm:w-[540px] md:w-[620px] max-w-[calc(100vw-2rem)] top-full mt-2 bg-white rounded-2xl shadow-2xl border border-slate-200 py-3 px-3 z-50 animate-fadeIn flex flex-col"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Search Input inside Dropdown */}
                <div className="relative mb-2.5">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-teal-600 pointer-events-none flex items-center">
                    <Icon name="search" className="text-base" />
                  </span>
                  <input
                    ref={categorySearchInputRef}
                    type="text"
                    placeholder="Search category (e.g. Cardiology, Neurology...)"
                    value={categorySearch}
                    onChange={(e) => setCategorySearch(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        setIsDropdownOpen(false);
                      }
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-9 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all"
                  />
                  {categorySearch && (
                    <button
                      type="button"
                      onClick={() => setCategorySearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-200/60 transition-colors"
                      title="Clear category search"
                    >
                      <Icon name="close" className="text-sm" />
                    </button>
                  )}
                </div>

                {/* Header / Count info */}
                <div className="px-2 py-1 mb-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 flex items-center justify-between">
                  <span>Available Categories ({filteredCategories.length})</span>
                  {categorySearch ? (
                    <span className="text-[10px] font-normal text-teal-700 truncate max-w-[200px]">
                      Matches for "{categorySearch}"
                    </span>
                  ) : (
                    <span className="text-[10px] font-normal text-teal-700">Click to filter</span>
                  )}
                </div>

                {/* Categories List */}
                <div className="space-y-1 max-h-64 sm:max-h-72 overflow-y-auto overscroll-contain pr-0.5">
                  {filteredCategories.length === 0 ? (
                    <div className="py-7 px-4 text-center">
                      <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-2">
                        <Icon name="search_off" className="text-xl" />
                      </div>
                      <p className="text-xs font-semibold text-slate-700">
                        No matching medical categories found.
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Try searching for another term or clear the filter.
                      </p>
                      <button
                        type="button"
                        onClick={() => setCategorySearch('')}
                        className="mt-2 text-xs font-bold text-teal-700 hover:text-teal-900 underline"
                      >
                        Clear search
                      </button>
                    </div>
                  ) : (
                    filteredCategories.map((cat) => {
                      const isSelected =
                        selectedCategory === cat.name ||
                        (cat.name === 'All Categories' && selectedCategory === 'All');
                      return (
                        <button
                          key={cat.name}
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          onClick={() => {
                            setSelectedCategory(cat.name);
                            setIsDropdownOpen(false);
                            setCategorySearch('');
                          }}
                          className={`w-full text-left px-3 py-2.5 rounded-xl transition-all flex items-center justify-between gap-3 group ${
                            isSelected
                              ? 'bg-teal-50 border border-teal-200 text-teal-950 font-bold shadow-xs'
                              : 'hover:bg-slate-50 text-slate-700 border border-transparent'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                                isSelected
                                  ? 'bg-teal-600 text-white'
                                  : 'bg-slate-100 text-teal-700 group-hover:bg-teal-100'
                              }`}
                            >
                              <Icon name={cat.icon} className="text-lg" />
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs sm:text-sm font-semibold truncate leading-snug">
                                <span className={isSelected ? 'text-teal-950 font-bold' : 'text-slate-800'}>
                                  {cat.name}
                                </span>{' '}
                                <span
                                  className={`text-[11px] sm:text-xs font-normal ${
                                    isSelected ? 'text-teal-700' : 'text-slate-400'
                                  }`}
                                >
                                  ({cat.explanation})
                                </span>
                              </div>
                            </div>
                          </div>
                          {isSelected && (
                            <div className="flex items-center text-teal-600 flex-shrink-0 ml-2">
                              <Icon name="check" className="text-lg font-bold" />
                            </div>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Active Filter Status Bar */}
          <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <span className="font-medium">Active filter:</span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-teal-50 border border-teal-200 text-teal-800 font-semibold text-[11px]">
                <Icon name={currentCategoryObj.icon} className="text-xs text-teal-600" />
                <span>{currentCategoryObj.name}</span>
              </span>
              <span className="text-slate-400">•</span>
              <span>
                {filteredUploads.length} {filteredUploads.length === 1 ? 'document' : 'documents'} found
              </span>
            </div>
            {selectedCategory !== 'All Categories' && selectedCategory !== 'All' && (
              <button
                onClick={() => setSelectedCategory('All Categories')}
                className="text-xs font-bold text-teal-700 hover:text-teal-900 hover:underline flex items-center gap-1"
              >
                <Icon name="restart_alt" className="text-sm" />
                <span>Reset to All Categories</span>
              </button>
            )}
          </div>
        </section>

        {/* ── UPLOADS GRID / LIST (NEWEST-FIRST SORTED) ── */}
        {sortedUploads.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/80 shadow-sm">
            <div className="w-16 h-16 rounded-full bg-teal-50 text-teal-700 flex items-center justify-center mx-auto mb-4">
              <Icon name="inventory_2" className="text-3xl" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1">No uploads found</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mb-6">
              {selectedCategory !== 'All Categories' && selectedCategory !== 'All'
                ? `No records found in "${selectedCategory}". Try selecting another category or view all categories.`
                : 'You have not uploaded any medical records yet. Press the upload button to add your first prescription or report.'}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              {selectedCategory !== 'All Categories' && selectedCategory !== 'All' && (
                <button
                  onClick={() => setSelectedCategory('All Categories')}
                  className="px-5 py-2.5 rounded-full border border-teal-600 text-teal-800 hover:bg-teal-50 font-bold text-xs transition-colors"
                >
                  Show All Categories
                </button>
              )}
              <button
                onClick={onOpenUploadModal}
                className="teal-gradient-btn text-white font-bold text-xs px-6 py-2.5 rounded-full shadow-pill-glow inline-flex items-center gap-1.5"
              >
                <Icon name="upload" className="text-base" />
                <span>Upload Document Now</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {sortedUploads.map((item, index) => (
              <div
                key={item.id}
                className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:border-teal-300 hover:shadow-card-glass transition-all flex flex-col justify-between group"
              >
                <div>
                  {/* Category Pill, Sharing Badge & Upload Timestamp */}
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <span className="px-2.5 py-1 rounded-full bg-teal-50 border border-teal-200 text-teal-800 font-bold text-[10px] tracking-wide uppercase">
                      {item.category}
                    </span>

                    {/* Sharing Badge */}
                    {item.isShared ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-teal-100 text-teal-900 border border-teal-300 font-bold text-[10px]">
                        <Icon name="diversity_1" className="text-xs text-teal-700" />
                        <span>Shared Care Circle</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 font-semibold text-[10px]">
                        <Icon name="lock" className="text-xs text-slate-500" />
                        <span>Private</span>
                      </span>
                    )}
                  </div>

                  {/* Title / Description */}
                  <h3 className="font-bold text-sm text-slate-900 mb-1 leading-snug group-hover:text-teal-900 transition-colors">
                    {item.title || item.description}
                  </h3>

                  {/* Doctor Name & Uploader Info */}
                  <div className="space-y-1 mb-2.5">
                    {item.doctorName && (
                      <div className="flex items-center gap-1.5 text-xs text-teal-800 font-medium">
                        <Icon name="stethoscope" className="text-sm text-teal-600" />
                        <span>{item.doctorName}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                      <Icon name="person" className="text-xs text-slate-400" />
                      <span>Uploaded by: <strong className="text-slate-700">{item.uploadedByName || 'Patient'}</strong></span>
                    </div>
                  </div>

                  {/* High Precision Upload Timestamp */}
                  <div className="flex items-center gap-1 text-[11px] font-mono text-slate-400 mb-3 bg-slate-50 px-2 py-1 rounded-lg">
                    <Icon name="schedule" className="text-xs text-teal-600" />
                    <span>{item.date || item.timestamp}</span>
                    {index === 0 && (
                      <span className="ml-auto text-[9px] font-bold bg-teal-500 text-white px-1.5 py-0.2 rounded-full uppercase">
                        Newest
                      </span>
                    )}
                  </div>

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
                          {file.storagePath && (
                            <span className="text-[9px] font-bold text-teal-700 bg-teal-100/80 px-1.5 py-0.5 rounded-full flex-shrink-0 ml-1">
                              Private Storage
                            </span>
                          )}
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
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-teal-700">
                    <Icon name="verified" className="text-xs text-teal-500" />
                    <span>{item.status || 'Verified Record'}</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => (onOpenMedBot ? onOpenMedBot(item.id) : setPage('medbot'))}
                      className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 flex items-center gap-1 transition-colors"
                      title="Ask MedBot regarding this prescription"
                    >
                      <Icon name="smart_toy" className="text-xs" />
                      <span>Ask MedBot</span>
                    </button>
                    <button
                      onClick={() => setSelectedRecordForDetails(item)}
                      className="text-xs font-bold text-teal-800 hover:text-teal-600 hover:underline flex items-center gap-1"
                    >
                      <span>View Details →</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* ── PATIENT RECORD DETAILS MODAL (SINGLE VIEW, NO SPLIT SCREEN) ── */}
      {selectedRecordForDetails && (
        <PatientRecordDetailsModal
          record={selectedRecordForDetails}
          onClose={() => setSelectedRecordForDetails(null)}
        />
      )}
    </div>
  );
}

/**
 * Clean Single-Screen Patient Record Details Modal.
 * Exclusively presents document metadata and preview for patients in My Uploads
 * without the doctor-specific split screen or AI TrOCR pipeline.
 */
function PatientRecordDetailsModal({ record, onClose }) {
  const [resolvedImageUrl, setResolvedImageUrl] = useState('');

  useEffect(() => {
    let isMounted = true;
    async function resolveFileUrl() {
      if (!record || !record.files || record.files.length === 0) return;
      const file = record.files[0];
      if (file.dataUrl || file.url) {
        setResolvedImageUrl(file.dataUrl || file.url);
      } else if (file.storagePath) {
        const signed = await getSignedDocumentUrl(file.storagePath, 3600);
        if (isMounted && signed) {
          setResolvedImageUrl(signed);
        }
      }
    }
    resolveFileUrl();
    return () => {
      isMounted = false;
    };
  }, [record]);

  // Close on Escape key
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  if (!record) return null;

  const isImage = (fileName = '', url = '') => {
    if (!url && !fileName) return false;
    if (typeof url === 'string' && url.startsWith('data:image')) return true;
    return /\.(jpg|jpeg|png|webp|gif|svg)($|\?)/i.test(fileName || url);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-teal-50/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-600 text-white flex items-center justify-center shadow-sm flex-shrink-0">
              <Icon name="description" className="text-xl" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 leading-snug">
                {record.title || record.description || 'Medical Record Details'}
              </h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 font-bold text-[10px] uppercase">
                  {record.category}
                </span>
                {record.isShared ? (
                  <span className="px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200 text-[10px] font-semibold flex items-center gap-1">
                    <Icon name="diversity_1" className="text-xs" />
                    Shared Care Circle
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-semibold flex items-center gap-1">
                    <Icon name="lock" className="text-xs" />
                    Private
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center border border-slate-200 transition-colors"
            aria-label="Close"
          >
            <Icon name="close" className="text-lg" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50/90 p-4 rounded-2xl border border-slate-100 text-xs">
            {record.doctorName && (
              <div className="flex items-center gap-2 text-slate-700">
                <div className="w-7 h-7 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center flex-shrink-0">
                  <Icon name="stethoscope" className="text-sm" />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Doctor / Specialist</span>
                  <span className="font-semibold text-slate-900">{record.doctorName}</span>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 text-slate-700">
              <div className="w-7 h-7 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center flex-shrink-0">
                <Icon name="person" className="text-sm" />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block uppercase font-bold">Uploaded By</span>
                <span className="font-semibold text-slate-900">{record.uploadedByName || 'Patient'}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-slate-700">
              <div className="w-7 h-7 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center flex-shrink-0">
                <Icon name="schedule" className="text-sm" />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block uppercase font-bold">Upload Date & Time</span>
                <span className="font-mono text-slate-800">{record.date || record.timestamp}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-slate-700">
              <div className="w-7 h-7 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center flex-shrink-0">
                <Icon name="verified" className="text-sm" />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block uppercase font-bold">Integrity Status</span>
                <span className="font-semibold text-teal-800">{record.status || 'Verified Record'}</span>
              </div>
            </div>
          </div>

          {/* Description if present and differs from title */}
          {record.description && record.description !== record.title && (
            <div className="bg-white p-3.5 rounded-xl border border-slate-200">
              <span className="text-[10px] text-slate-400 block uppercase font-bold mb-1">Clinical Notes & Summary</span>
              <p className="text-xs text-slate-700 whitespace-pre-line leading-relaxed">{record.description}</p>
            </div>
          )}

          {/* Document File & Image Preview */}
          <div>
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>Attached Medical Document</span>
              {record.files?.[0]?.size && (
                <span className="text-[10px] font-normal text-slate-400 font-mono">
                  {record.files[0].size}
                </span>
              )}
            </h4>

            {record.files && record.files.length > 0 ? (
              <div className="space-y-3">
                {record.files.map((file, idx) => {
                  const fileSrc = idx === 0 && resolvedImageUrl ? resolvedImageUrl : (file.dataUrl || file.url || '');
                  const hasImage = isImage(file.name, fileSrc);

                  return (
                    <div key={idx} className="bg-slate-50 rounded-2xl p-3 border border-slate-200">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 truncate">
                          <Icon name="attach_file" className="text-teal-600 text-sm flex-shrink-0" />
                          <span className="text-xs font-medium text-slate-800 truncate">{file.name}</span>
                        </div>
                        {file.storagePath && (
                          <span className="text-[9px] font-bold text-teal-700 bg-teal-100 px-2 py-0.5 rounded-full flex-shrink-0 ml-1">
                            Private Storage
                          </span>
                        )}
                      </div>

                      {hasImage && fileSrc ? (
                        <div className="rounded-xl overflow-hidden bg-slate-900/5 border border-slate-200 flex items-center justify-center max-h-[380px] p-2">
                          <img
                            src={fileSrc}
                            alt={file.name || 'Medical Document'}
                            className="max-h-[360px] w-auto max-w-full object-contain rounded-lg shadow-sm"
                          />
                        </div>
                      ) : (
                        <div className="py-8 text-center text-slate-500 bg-white rounded-xl border border-dashed border-slate-200">
                          <Icon name="description" className="text-4xl text-slate-300 mb-1" />
                          <p className="text-xs font-medium text-slate-700">Document File Attached</p>
                          <p className="text-[11px] text-slate-400">{file.name}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-8 text-center text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-xs">
                No physical file attached to this record.
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-full border border-slate-300 text-slate-700 hover:bg-slate-100 font-semibold text-xs transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
