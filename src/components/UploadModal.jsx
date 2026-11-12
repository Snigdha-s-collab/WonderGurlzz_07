import { useState } from 'react';

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

export default function UploadModal({ isOpen, onClose, onUploadSuccess }) {
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setSelectedFiles((prev) => [...prev, ...files]);
      setError('');
    }
  };

  const handleRemoveFile = (index) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!description.trim()) {
      setError('Please enter a description for this medication/record.');
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

    setIsSubmitting(true);

    const now = new Date();
    const formattedDate = now.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
    const formattedTime = now.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const newRecord = {
      id: 'upload-' + Date.now(),
      description: description.trim(),
      category: category,
      date: formattedDate,
      time: formattedTime,
      timestamp: `${formattedDate} • ${formattedTime}`,
      files: selectedFiles.map((f) => ({
        name: f.name,
        size: (f.size / 1024).toFixed(1) + ' KB',
        type: f.type || 'Document',
      })),
      status: 'Cryptographically Verified',
    };

    setTimeout(() => {
      onUploadSuccess(newRecord);
      setIsSubmitting(false);
      setDescription('');
      setCategory('');
      setSelectedFiles([]);
      onClose();
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100 max-h-[92vh] flex flex-col">
        
        {/* Header */}
        <div className="bg-[#0b3b34] text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-teal-400 text-teal-950 flex items-center justify-center">
              <Icon name="upload_file" className="text-lg" />
            </div>
            <div>
              <h2 className="text-base font-bold leading-tight">Upload Health Records</h2>
              <p className="text-[11px] text-teal-300">Secure cryptographic notarization</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/80 hover:text-white transition-colors"
          >
            <Icon name="close" className="text-lg" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 text-[#131b2e]">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl p-3 flex items-start gap-2">
              <Icon name="error" className="text-base text-red-500 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* 1. Description of Medication / Condition */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Description of Medication / Problem <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={3}
              placeholder="e.g. Daily Metformin 500mg prescription, fasting glucose blood report, post-surgery follow-up summary..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all resize-none"
              required
            />
          </div>

          {/* 2. Category of Problems */}
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
                <option value="">-- Select Problem Category --</option>
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

          {/* 3. Browse / Upload Files */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Browse / Upload Files <span className="text-red-500">*</span>
            </label>
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-teal-300 hover:border-teal-500 bg-teal-50/40 hover:bg-teal-50/70 rounded-2xl p-5 cursor-pointer transition-colors group">
              <input
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="w-12 h-12 rounded-full bg-teal-100 text-teal-800 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                <Icon name="cloud_upload" className="text-2xl" />
              </div>
              <p className="text-xs font-bold text-slate-800">
                Click to browse or drag files here
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                PDF, JPG, PNG or DOCX (Max 25MB each)
              </p>
            </label>

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
                      className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Icon name="description" className="text-teal-600 text-base flex-shrink-0" />
                        <span className="font-medium text-slate-800 truncate">{file.name}</span>
                        <span className="text-[10px] text-slate-400 flex-shrink-0">
                          ({(file.size / 1024).toFixed(1)} KB)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveFile(idx)}
                        className="text-red-500 hover:text-red-700 p-1"
                        title="Remove file"
                      >
                        <Icon name="delete" className="text-base" />
                      </button>
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
              onClick={onClose}
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
                  <span>Notarizing...</span>
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
      </div>
    </div>
  );
}

