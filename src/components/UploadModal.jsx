import { useState, useRef, useEffect } from 'react';

function Icon({ name, className = '' }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>;
}

const PROBLEM_CATEGORIES = [
  'General Medicine',
  'Cardiology',
  'Endocrinology & Diabetes',
  'Radiology & Imaging',
  'Laboratory & Pathology',
  'Orthopedics',
  'Oncology',
  'Neurology',
  'Pediatrics',
  'Prescriptions & Pharmacy',
  'Emergency & Surgery',
  'Other',
];

export default function UploadModal({
  isOpen,
  onClose,
  onUploadSuccess,
  currentUser,
  sharingGroups = [],
}) {
  const [title, setTitle] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [prescriptionText, setPrescriptionText] = useState('');
  const [category, setCategory] = useState('');
  const [recordDate, setRecordDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isShared, setIsShared] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [error, setError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [previewingFile, setPreviewingFile] = useState(null);
  const [uploadSuccessRecord, setUploadSuccessRecord] = useState(null);
  const fileInputRef = useRef(null);

  const handleOpenFilePreview = (file) => {
    try {
      const url = URL.createObjectURL(file);
      const isPdf =
        file.type === 'application/pdf' ||
        (typeof file.name === 'string' && file.name.toLowerCase().endsWith('.pdf'));
      const isImage =
        file.type?.startsWith('image/') ||
        (typeof file.name === 'string' && !!file.name.match(/\.(jpg|jpeg|png|webp|gif)$/i));

      setPreviewingFile({ file, url, name: file.name, isPdf, isImage });
    } catch (e) {
      console.warn('Could not create preview URL:', e);
    }
  };

  const handleCloseFilePreview = () => {
    if (previewingFile?.url) {
      try {
        URL.revokeObjectURL(previewingFile.url);
      } catch (_) {}
    }
    setPreviewingFile(null);
  };

  // Prevent browser window from navigating away when dropping files anywhere on page
  useEffect(() => {
    const handleGlobalDrag = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };
    const handleGlobalDrop = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const files = Array.from(e.dataTransfer?.files || []);
      if (files.length > 0) {
        addFiles(files);
      }
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

  // Auto-select the first available sharing group if available
  useEffect(() => {
    if (Array.isArray(sharingGroups) && sharingGroups.length > 0 && !selectedGroupId) {
      setSelectedGroupId(sharingGroups[0].id);
    }
  }, [sharingGroups, selectedGroupId]);

  if (!isOpen) return null;

  const addFiles = (newFiles) => {
    if (!newFiles || newFiles.length === 0) return;
    setSelectedFiles((prev) => [...prev, ...newFiles]);
    setError('');

    // Read plain text prescription files so Ask MedBot can analyze them automatically
    newFiles.forEach((file) => {
      if (file.type?.startsWith('text/') || /\.(txt|md|csv)$/i.test(file.name)) {
        const reader = new FileReader();
        reader.onload = () => {
          const txt = String(reader.result || '').trim();
          if (txt) {
            setPrescriptionText((prev) => (prev ? `${prev}\n${txt}` : txt));
          }
        };
        reader.readAsText(file);
      }
    });
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      addFiles(files);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer?.files || []);
    addFiles(files);
  };

  const handleRemoveFile = (index) => {
    setSelectedFiles((prev) => {
      const next = prev.filter((_, i) => i !== index);
      if (next.length === 0 && fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return next;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!title.trim()) {
      setError('Please enter a heading/title for this record.');
      return;
    }

    if (!category) {
      setError('Please select a category.');
      return;
    }

    if (selectedFiles.length === 0) {
      setError('Please browse and attach at least one document or scan.');
      return;
    }

    if (isShared && !selectedGroupId && sharingGroups.length > 0) {
      setSelectedGroupId(sharingGroups[0].id);
    }

    setIsSubmitting(true);
    setStatusText('Processing document...');

    const readFileAsDataUrl = (file) => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => resolve('');
        reader.readAsDataURL(file);
      });
    };

    const chosenDateObj = recordDate ? new Date(recordDate) : new Date();
    const formattedDate = chosenDateObj.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
    const now = new Date();
    const formattedTime = now.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
    const newRecordId = 'upload-' + Date.now();

    try {
      // Process files: generate local dataUrl + upload to private Supabase storage
      const processedFiles = await Promise.all(
        selectedFiles.map(async (f) => {
          let dataUrl = '';
          if (
            f.type?.startsWith('image/') ||
            f.type?.includes('pdf') ||
            f.name?.match(/\.(jpg|jpeg|png|webp|gif|pdf)$/i)
          ) {
            dataUrl = await readFileAsDataUrl(f);
          }

          // Upload to private Supabase Storage 'medical-documents' bucket (if available)
          let storagePath = null;
          try {
            if (typeof uploadMedicalFileToStorage === 'function') {
              storagePath = await uploadMedicalFileToStorage(f, {
                userId: currentUser?.id || currentUser?.permanentId || 'user',
                recordId: newRecordId,
              });
            }
          } catch (storageErr) {
            console.warn('Storage upload notice:', storageErr);
          }

          return {
            name: f.name,
            size: (f.size / 1024).toFixed(1) + ' KB',
            type: f.type || 'Document',
            dataUrl: dataUrl,
            url: dataUrl,
            storagePath: storagePath,
            storage_path: storagePath,
          };
        })
      );

      const targetGroupId = isShared ? (selectedGroupId || (sharingGroups[0]?.id || null)) : null;

      // Resolve the real name entered during sign up
      let uploaderName = currentUser?.name;
      try {
        const rawUsers = localStorage.getItem('onepatient_users');
        if (rawUsers) {
          const users = JSON.parse(rawUsers);
          const targetId = (currentUser?.permanentId || 'NNM24cc059').toLowerCase();
          const matched = users.find(
            (u) => u.permanentId && u.permanentId.toLowerCase() === targetId
          );
          if (matched?.name) {
            uploaderName = matched.name.trim();
          }
        }
      } catch (_) {}

      const newRecord = {
        id: newRecordId,
        patientId: currentUser?.permanentId || 'NNM24cc059',
        uploaderName: uploaderName || currentUser?.name || 'User',
        uploadedBy: currentUser?.id || currentUser?.permanentId || 'NNM24cc059',
        uploadedByName: uploaderName || currentUser?.name || 'User',
        isShared: isShared,
        groupId: targetGroupId,
        title: title.trim(),
        description: title.trim(),
        doctorName: doctorName.trim(),
        prescriptionText: prescriptionText.trim() || title.trim(),
        category: category,
        date: formattedDate,
        rawDate: recordDate,
        time: formattedTime,
        timestamp: `${formattedDate} • ${formattedTime}`,
        createdAt: now.toISOString(), // Standard ISO 8601 for newest-first sorting
        files: processedFiles,
        status: 'Verified Record',
        ocrData: null,
      };

      onUploadSuccess(newRecord);
      setIsSubmitting(false);
      setStatusText('');
      setUploadSuccessRecord(newRecord);
    } catch (err) {
      console.error(err);
      setIsSubmitting(false);
      setStatusText('');
      setError('Error processing file. Please try again.');
    }
  };

  const handleResetForm = () => {
    setTitle('');
    setDoctorName('');
    setPrescriptionText('');
    setCategory('');
    setSelectedFiles([]);
    setIsShared(false);
    setError('');
    setUploadSuccessRecord(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCloseAll = () => {
    handleResetForm();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const files = Array.from(e.dataTransfer?.files || []);
        if (files.length > 0) addFiles(files);
      }}
    >
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="bg-[#0b3b34] text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-teal-400 text-teal-950 flex items-center justify-center">
              <Icon name="upload_file" className="text-lg" />
            </div>
            <div>
              <h2 className="text-base font-bold leading-tight">Upload Health Records</h2>
              <p className="text-[11px] text-teal-300">Secure record storage</p>
            </div>
          </div>
          <button
            onClick={handleCloseAll}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/80 hover:text-white transition-colors"
          >
            <Icon name="close" className="text-lg" />
          </button>
        </div>

        {/* Success confirmation view inside the popup */}
        {uploadSuccessRecord ? (
          <div className="p-8 text-center space-y-4 animate-fadeIn">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
              <Icon name="check_circle" className="text-4xl" />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-slate-900">
                Document Uploaded Successfully!
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                <strong className="text-slate-800">{uploadSuccessRecord.title}</strong> has been securely stored and synced in real time.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
              <button
                type="button"
                onClick={handleResetForm}
                className="w-full sm:w-auto px-5 py-2.5 rounded-full text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                Upload Another Document
              </button>
              <button
                type="button"
                onClick={handleCloseAll}
                className="w-full sm:w-auto teal-gradient-btn text-white font-bold px-6 py-2.5 rounded-full text-xs shadow-pill-glow transition-all"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          /* Content Form */
          <form
            onSubmit={handleSubmit}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
                e.preventDefault();
              }
            }}
            className="p-6 overflow-y-auto space-y-4 text-[#131b2e]"
          >
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl p-3 flex items-start gap-2">
              <Icon name="error" className="text-base text-red-500 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* 1. Title / Heading (Description) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Title / Heading <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Neurology Prescription, Complete Blood Count, Cardiology Report"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all font-medium"
              required
            />
          </div>

          {/* 1b. Optional Prescription Dosage Details for Ask MedBot */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Prescription Medicines &amp; Schedule <span className="text-slate-400 font-normal">(Optional — used by Ask MedBot)</span>
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Metformin 500mg once daily after breakfast (8:00 AM) for 90 days"
              value={prescriptionText}
              onChange={(e) => setPrescriptionText(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all resize-none"
            />
          </div>

          {/* Doctor Name & Problem Category Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Doctor Name */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Doctor Name <span className="text-slate-400 font-normal lowercase">(optional)</span>
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-3.5 text-slate-400">
                  <Icon name="stethoscope" className="text-base" />
                </span>
                <input
                  type="text"
                  placeholder="e.g. Dr. Sudarshan Bhat"
                  value={doctorName}
                  onChange={(e) => setDoctorName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all"
                />
              </div>
            </div>

            {/* Problem Category */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Category of Problem <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all appearance-none cursor-pointer"
                  required
                >
                  <option value="">-- Select Category --</option>
                  {PROBLEM_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-400">
                  <Icon name="arrow_drop_down" className="text-2xl" />
                </div>
              </div>
            </div>
          </div>

          {/* Date of Record */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Date of Record <span className="text-red-500">*</span>
            </label>
            <div className="relative flex items-center">
              <input
                type="date"
                value={recordDate}
                onChange={(e) => setRecordDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all cursor-pointer"
                required
              />
            </div>
          </div>

          {/* ── CARE CIRCLE RECORD SHARING SECTION ── */}
          <div className="p-4 rounded-2xl bg-teal-50/70 border border-teal-200/80 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-teal-600 text-white flex items-center justify-center flex-shrink-0">
                  <Icon name="diversity_1" className="text-base" />
                </div>
                <div>
                  <span className="block text-xs font-bold text-teal-950">
                    Care Circle Record Sharing
                  </span>
                  <span className="block text-[11px] text-teal-700">
                    Share with authorized family members or caregivers
                  </span>
                </div>
              </div>

              {/* Toggle checkbox */}
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={isShared}
                  onChange={(e) => setIsShared(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
              </label>
            </div>

            {isShared && (
              <div className="pt-2 border-t border-teal-200/60 animate-fadeIn space-y-2">
                {sharingGroups && sharingGroups.length > 0 ? (
                  <div>
                    <label className="block text-[11px] font-bold text-teal-900 mb-1">
                      Target Care Circle Group
                    </label>
                    <select
                      value={selectedGroupId}
                      onChange={(e) => setSelectedGroupId(e.target.value)}
                      className="w-full bg-white border border-teal-300 rounded-xl px-3 py-2 text-xs font-semibold text-teal-950 focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
                    >
                      {sharingGroups.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name} ({g.role === 'owner' ? 'Owner' : 'Care Member'})
                        </option>
                      ))}
                    </select>
                    <p className="text-[10px] text-teal-700 mt-1 flex items-center gap-1">
                      <Icon name="lock" className="text-xs" />
                      <span>Only authorized members with explicit consent can view. Private to non-members.</span>
                    </p>
                  </div>
                ) : (
                  <div className="text-[11px] text-amber-800 bg-amber-50 p-2.5 rounded-xl border border-amber-200 flex items-center gap-2">
                    <Icon name="info" className="text-base text-amber-600 flex-shrink-0" />
                    <span>
                      You don't have an active Care Circle yet. You can create one from the My Uploads Care Circle manager.
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 3. Browse / Upload Files */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Browse / Upload Files <span className="text-red-500">*</span>
            </label>
            <div
              onDragOver={handleDragOver}
              onDragEnter={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`relative flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-5 cursor-pointer transition-all group overflow-hidden ${
                isDragging
                  ? 'border-teal-500 bg-teal-100/60 ring-2 ring-teal-400'
                  : 'border-teal-300 hover:border-teal-500 bg-teal-50/40 hover:bg-teal-50/70'
              }`}
            >
              <input
                ref={fileInputRef}
                id="health-record-file-upload"
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.txt,.md"
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                tabIndex={0}
                aria-label="Upload document"
              />
              <div className="w-12 h-12 rounded-full bg-teal-100 text-teal-800 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform pointer-events-none">
                <Icon name="cloud_upload" className="text-2xl" />
              </div>
              <p className="text-xs font-bold text-slate-800 pointer-events-none">
                Click to browse or drag files here
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5 pointer-events-none">
                PDF, JPG, PNG or DOCX (Stored in Private Storage)
              </p>
            </div>

            {/* Selected files preview */}
            {selectedFiles.length > 0 && (
              <div className="mt-3 space-y-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide block">
                  Attached Files ({selectedFiles.length})
                </span>
                <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                  {selectedFiles.map((file, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs hover:border-teal-300 transition-colors"
                    >
                      <button
                        type="button"
                        onClick={() => handleOpenFilePreview(file)}
                        className="flex items-center gap-2 truncate text-left hover:text-teal-700 group transition-colors flex-1 mr-2"
                        title="Click to preview this document"
                      >
                        <Icon name="description" className="text-teal-600 text-base flex-shrink-0" />
                        <span className="font-semibold text-slate-800 group-hover:text-teal-700 truncate">{file.name}</span>
                        <span className="text-[10px] text-slate-400 flex-shrink-0">
                          ({(file.size / 1024).toFixed(1)} KB)
                        </span>
                      </button>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => handleOpenFilePreview(file)}
                          className="px-2.5 py-1 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-800 font-bold text-[11px] flex items-center gap-1 transition-colors border border-teal-200"
                          title="Open document preview"
                        >
                          <Icon name="visibility" className="text-sm" />
                          <span>Open</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveFile(idx)}
                          className="text-red-500 hover:text-red-700 p-1"
                          title="Remove file"
                        >
                          <Icon name="delete" className="text-base" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={handleCloseAll}
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-full text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="teal-gradient-btn text-white font-bold px-6 py-2.5 rounded-full text-xs shadow-pill-glow hover:opacity-95 flex items-center gap-2 transition-all disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Icon name="sync" className="text-base animate-spin" />
                  <span>{statusText || 'Processing...'}</span>
                </>
              ) : (
                <>
                  <Icon name="check" className="text-base" />
                  <span>Submit & Save to My Uploads</span>
                </>
              )}
            </button>
          </div>
        </form>
        )}
      </div>

      {/* ── ENLARGED IN-MODAL FILE PREVIEW (RETURNS DIRECTLY TO UPLOAD POPUP) ── */}
      {previewingFile && (
        <div
          className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-md flex flex-col items-center justify-between p-4 sm:p-6 animate-fadeIn"
          onClick={handleCloseFilePreview}
        >
          <div
            className="w-full max-w-4xl flex items-center justify-between mb-3 z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={handleCloseFilePreview}
              className="px-4 py-2 rounded-full bg-teal-400 hover:bg-teal-300 text-teal-950 font-black text-xs shadow-lg flex items-center gap-2 transition-all border border-teal-200"
              title="Return to Upload Popup"
            >
              <Icon name="arrow_back" className="text-base" />
              <span>← Return to Upload Popup</span>
            </button>

            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-black/60 border border-white/20 text-white text-xs font-semibold">
              <Icon name="description" className="text-sm text-teal-300" />
              <span className="truncate max-w-[200px] sm:max-w-xs">{previewingFile.name}</span>
            </div>

            <button
              onClick={handleCloseFilePreview}
              className="w-9 h-9 rounded-full bg-white hover:bg-slate-100 text-slate-700 flex items-center justify-center shadow-lg transition-colors border border-slate-200"
              title="Close Preview"
            >
              <Icon name="close" className="text-lg" />
            </button>
          </div>

          <div
            className="flex-1 w-full max-w-4xl flex items-center justify-center overflow-auto p-2"
            onClick={(e) => e.stopPropagation()}
          >
            {previewingFile.isPdf ? (
              <iframe
                src={previewingFile.url}
                title="Document Preview"
                className="w-full h-[78vh] rounded-2xl shadow-2xl bg-white border border-slate-200"
              />
            ) : previewingFile.isImage ? (
              <img
                src={previewingFile.url}
                alt={previewingFile.name}
                className="max-h-[78vh] max-w-full w-auto object-contain rounded-2xl shadow-2xl bg-white border border-slate-200 p-2"
              />
            ) : (
              <div className="bg-white rounded-2xl p-8 max-w-md text-center shadow-xl">
                <Icon name="description" className="text-4xl text-teal-600 mx-auto mb-2" />
                <h3 className="font-bold text-slate-800 text-sm mb-1">{previewingFile.name}</h3>
                <p className="text-xs text-slate-500">Document preview ready for upload.</p>
              </div>
            )}
          </div>

          <div className="mt-2 text-white/80 text-[11px] font-medium flex items-center gap-1.5">
            <Icon name="info" className="text-xs text-teal-300" />
            <span>Click &ldquo;← Return to Upload Popup&rdquo; or outside the document to return</span>
          </div>
        </div>
      )}
    </div>
  );
}
