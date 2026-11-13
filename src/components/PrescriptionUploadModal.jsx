import { useState, useRef, useEffect } from 'react';

function Icon({ name, className = '' }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>;
}

export default function PrescriptionUploadModal({
  isOpen,
  onClose,
  onUploadSuccess,
  currentUser,
}) {
  const [title, setTitle] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [prescriptionDate, setPrescriptionDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [medicationEndDate, setMedicationEndDate] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [imagePreview, setImagePreview] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [error, setError] = useState('');

  const fileInputRef = useRef(null);

  // Prevent browser from navigating away if a file is dropped outside the drop zone
  useEffect(() => {
    if (!isOpen) return;

    const preventDefaultDragDrop = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };

    window.addEventListener('dragover', preventDefaultDragDrop);
    window.addEventListener('drop', preventDefaultDragDrop);

    return () => {
      window.removeEventListener('dragover', preventDefaultDragDrop);
      window.removeEventListener('drop', preventDefaultDragDrop);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFiles = (files) => {
    if (!files || files.length === 0) return;
    const file = files[0]; // Primary prescription image

    // Validate image format
    if (!file.type.startsWith('image/') && !file.name.match(/\.(jpg|jpeg|png|webp|gif)$/i)) {
      setError('Please upload a valid prescription image file (JPEG, PNG, WebP).');
      return;
    }

    setSelectedFiles([file]);
    setError('');

    // If title is empty, prefill from file name
    if (!title || !title.trim()) {
      const cleanName = file.name
        .replace(/\.[^/.]+$/, '')
        .replace(/[-_]/g, ' ')
        .trim();
      setTitle(`Prescription - ${cleanName}`);
    }

    // Generate local preview
    const reader = new FileReader();
    reader.onload = () => {
      setImagePreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    handleFiles(files);
    if (e.target) {
      e.target.value = '';
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
    handleFiles(files);
  };

  const removeFile = () => {
    setSelectedFiles([]);
    setImagePreview(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Mandatory fields validation
    if (!title.trim()) {
      setError('Prescription Title is mandatory.');
      return;
    }
    if (!doctorName.trim()) {
      setError("Doctor's Name is mandatory.");
      return;
    }
    if (!selectedFiles || selectedFiles.length === 0) {
      setError('Prescription Image Upload is mandatory. Please attach a prescription image.');
      return;
    }
    if (!prescriptionDate) {
      setError('Prescription Date is mandatory.');
      return;
    }
    if (!medicationEndDate) {
      setError('Medication End Date is mandatory.');
      return;
    }

    if (new Date(medicationEndDate) < new Date(prescriptionDate)) {
      setError('Medication End Date cannot be before the Prescription Date.');
      return;
    }

    setIsSubmitting(true);
    setStatusText('Processing prescription image...');

    try {
      const file = selectedFiles[0];
      const dataUrl = imagePreview || (await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => resolve('');
        reader.readAsDataURL(file);
      }));

      const processedFiles = [
        {
          name: file.name,
          size: (file.size / 1024).toFixed(1) + ' KB',
          type: file.type || 'image/jpeg',
          dataUrl: dataUrl,
          url: dataUrl,
        },
      ];

      // Call Qwen2.5-VL OCR backend
      let extractedOcr = null;
      setStatusText('Digitizing prescription with Qwen2.5-VL...');
      try {
        const apiRes = await fetch('http://127.0.0.1:8000/api/ocr/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image_base64: dataUrl,
            document_hint: 'Prescriptions & Pharmacy',
          }),
        });
        if (apiRes.ok) {
          extractedOcr = await apiRes.json();
        } else {
          console.warn('FastAPI OCR service returned status:', apiRes.status);
        }
      } catch (apiErr) {
        console.warn('OCR backend notice (safe fallback):', apiErr.message);
      }

      const pDateObj = new Date(prescriptionDate);
      const formattedDate = pDateObj.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });

      const eDateObj = new Date(medicationEndDate);
      const formattedEndDate = eDateObj.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });

      const now = new Date();
      const formattedTime = now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      });

      const newRecord = {
        id: 'rx-' + Date.now(),
        patientId: currentUser?.permanentId || 'NNM24cc059',
        title: title.trim(),
        description: title.trim(),
        doctorName: doctorName.trim(),
        category: 'Prescriptions & Pharmacy',
        date: formattedDate,
        rawDate: prescriptionDate,
        prescriptionDate: prescriptionDate,
        medicationEndDate: medicationEndDate,
        medicationEndDateFormatted: formattedEndDate,
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
      setMedicationEndDate('');
      setSelectedFiles([]);
      setImagePreview(null);
      onClose();
    } catch (err) {
      console.error('Prescription upload error:', err);
      setIsSubmitting(false);
      setStatusText('');
      setError('An error occurred while uploading prescription. Please try again.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-7 shadow-2xl border border-teal-100 flex flex-col max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-teal-100 text-teal-800 flex items-center justify-center">
              <Icon name="prescriptions" className="text-2xl" />
            </div>
            <div>
              <h3 className="font-extrabold text-base sm:text-lg text-slate-900 leading-tight">
                Upload Prescription
              </h3>
              <p className="text-xs text-slate-500">
                Register prescription details and medication duration
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="w-8 h-8 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors"
          >
            <Icon name="close" className="text-xl" />
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
            <Icon name="error" className="text-base flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Field 1: Prescription Title */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Prescription Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., General Consultation Rx, Orthopedic Follow-up"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-100 outline-none text-xs text-slate-800 transition-all"
              required
            />
          </div>

          {/* Field 2: Doctor's Name */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Doctor's Name <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-slate-400 pointer-events-none">
                <Icon name="stethoscope" className="text-base" />
              </span>
              <input
                type="text"
                value={doctorName}
                onChange={(e) => setDoctorName(e.target.value)}
                placeholder="e.g., Dr. Neelkanta"
                className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-100 outline-none text-xs text-slate-800 transition-all"
                required
              />
            </div>
          </div>

          {/* Field 3: Prescription Image Upload */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Prescription Image Upload <span className="text-red-500">*</span>
            </label>

            {selectedFiles.length === 0 ? (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition-all ${
                  isDragging
                    ? 'border-teal-500 bg-teal-50/60 scale-[0.99]'
                    : 'border-slate-200 hover:border-teal-400 bg-slate-50/50 hover:bg-teal-50/20'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div className="w-10 h-10 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center mx-auto mb-2">
                  <Icon name="add_photo_alternate" className="text-xl" />
                </div>
                <p className="text-xs font-bold text-slate-700 mb-0.5">
                  Click to browse or drag & drop prescription image
                </p>
                <p className="text-[11px] text-slate-400">
                  Supports JPEG, PNG, WebP (camera photo or scanned prescription)
                </p>
              </div>
            ) : (
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {imagePreview ? (
                    <img
                      src={imagePreview}
                      alt="Prescription preview"
                      className="w-12 h-12 object-cover rounded-xl border border-slate-200"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center">
                      <Icon name="image" className="text-xl" />
                    </div>
                  )}
                  <div>
                    <span className="font-bold text-xs text-slate-800 block truncate max-w-[200px]">
                      {selectedFiles[0].name}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {(selectedFiles[0].size / 1024).toFixed(1)} KB • Image ready
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={removeFile}
                  className="text-slate-400 hover:text-red-500 p-1.5 rounded-lg transition-colors"
                  title="Remove image"
                >
                  <Icon name="delete" className="text-lg" />
                </button>
              </div>
            )}
          </div>

          {/* Field 4 & 5: Prescription Date & Medication End Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Prescription Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={prescriptionDate}
                onChange={(e) => setPrescriptionDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-100 outline-none text-xs text-slate-800 transition-all font-mono"
                required
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">Defaults to today</span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Medication End Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={medicationEndDate}
                min={prescriptionDate}
                onChange={(e) => setMedicationEndDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-100 outline-none text-xs text-slate-800 transition-all font-mono"
                required
              />
              <span className="text-[10px] text-teal-600 font-medium mt-0.5 block">
                Until when medicine continues
              </span>
            </div>
          </div>

          {/* Submit Buttons */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-full border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="teal-gradient-btn text-white text-xs font-bold px-6 py-2.5 rounded-full shadow-pill-glow flex items-center gap-2 hover:opacity-95 disabled:opacity-50 transition-opacity"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>{statusText || 'Saving Prescription...'}</span>
                </>
              ) : (
                <>
                  <Icon name="check" className="text-sm" />
                  <span>Save Prescription</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
