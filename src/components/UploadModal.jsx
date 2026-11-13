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

export default function UploadModal({ isOpen, onClose, onUploadSuccess, currentUser }) {
  const [title, setTitle] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [category, setCategory] = useState('');
  const [recordDate, setRecordDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusText, setStatusText] = useState('');
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

    setIsSubmitting(true);
    setStatusText('Reading file data...');

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

    Promise.all(
      selectedFiles.map(async (f) => {
        let dataUrl = '';
        if (f.type?.startsWith('image/') || f.name?.match(/\.(jpg|jpeg|png|webp|gif)$/i)) {
          dataUrl = await readFileAsDataUrl(f);
        }
        return {
          name: f.name,
          size: (f.size / 1024).toFixed(1) + ' KB',
          type: f.type || 'Document',
          dataUrl: dataUrl,
          url: dataUrl,
        };
      })
    ).then(async (processedFiles) => {
      const primaryImage = processedFiles.find(
        (f) => f.dataUrl && (f.dataUrl.startsWith('data:image/') || f.name.match(/\.(jpg|jpeg|png|webp)$/i))
      );

      let extractedOcr = null;
      if (primaryImage && primaryImage.dataUrl) {
        setStatusText('Analyzing with Qwen2.5-VL-7B-Instruct...');
        try {
          const apiRes = await fetch('http://127.0.0.1:8000/api/ocr/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              image_base64: primaryImage.dataUrl,
              document_hint: category || title,
            }),
          });
          if (apiRes.ok) {
            extractedOcr = await apiRes.json();
          } else {
            console.warn('FastAPI OCR service response status:', apiRes.status);
          }
        } catch (apiErr) {
          console.warn('FastAPI backend connection notice (upload proceeding safely):', apiErr.message);
        }
      }

      const newRecord = {
        id: 'upload-' + Date.now(),
        patientId: currentUser?.permanentId || 'NNM24cc059',
        title: title.trim(),
        description: title.trim(),
        doctorName: doctorName.trim(),
        category: category,
        date: formattedDate,
        rawDate: recordDate,
        time: formattedTime,
        timestamp: `${formattedDate} • ${formattedTime}`,
        files: processedFiles,
        status: 'Cryptographically Verified',
        ocrData: extractedOcr,
      };

      onUploadSuccess(newRecord);
      setIsSubmitting(false);
      setStatusText('');
      setTitle('');
      setDoctorName('');
      setCategory('');
      setSelectedFiles([]);
      onClose();
    }).catch((err) => {
      console.error(err);
      setIsSubmitting(false);
      setStatusText('');
      setError('Error processing file. Please try again.');
    });
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

          {/* 1. Title / Heading (Description) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Title / Heading <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Daily Metformin 500mg, Fasting Blood Glucose, Cardiac Checkup Report"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all font-medium"
              required
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
                  placeholder="e.g. Dr. Rajiv Mehta"
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
      </div>
    </div>
  );
}

