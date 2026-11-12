-- OnePatient Supabase Database Schema Initialization
-- Run this script in your Supabase Project's SQL Editor (Dashboard > SQL Editor)

-- 1. Create medical_records table
CREATE TABLE IF NOT EXISTS public.medical_records (
    id TEXT PRIMARY KEY,
    patient_id TEXT DEFAULT 'GLP-9041-K7-VERIFIED',
    title TEXT NOT NULL,
    description TEXT,
    doctor_name TEXT,
    category TEXT NOT NULL,
    date TEXT,
    raw_date DATE,
    time TEXT,
    status TEXT DEFAULT 'Verified Record',
    files JSONB DEFAULT '[]'::jsonb,
    ocr_data JSONB DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create qr_tokens table
CREATE TABLE IF NOT EXISTS public.qr_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token TEXT NOT NULL UNIQUE,
    patient_name TEXT NOT NULL,
    patient_id TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create access_grants table
CREATE TABLE IF NOT EXISTS public.access_grants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token TEXT NOT NULL,
    patient_id TEXT NOT NULL,
    doctor_id TEXT,
    doctor_name TEXT,
    granted_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    revoked BOOLEAN DEFAULT FALSE
);

-- 4. Create audit_log table
CREATE TABLE IF NOT EXISTS public.audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event TEXT NOT NULL,
    patient_id TEXT NOT NULL,
    actor TEXT,
    details JSONB,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Seed the Neurology Prescription medical record
INSERT INTO public.medical_records (
    id,
    patient_id,
    title,
    description,
    doctor_name,
    category,
    date,
    time,
    status,
    files,
    ocr_data
) VALUES (
    'rec-neuro-001',
    'GLP-9041-K7-VERIFIED',
    'Neurology Prescription',
    'Neurology Prescription — Refractory Migraine & Neuropathic Pain Protocol',
    'Dr. Ananya Rao, MD (DM Neurology)',
    'Neurology',
    'Nov 12, 2026',
    '09:30 AM',
    'Verified Record',
    '[{"name": "Dr_Rao_Neurology_Prescription_Rx.jpg", "size": "1.8 MB", "type": "image/jpeg"}]'::jsonb,
    '{
      "model": "TrOCR-Large-Stage2-Medical (Vision Transformer + Seq2Seq)",
      "confidence": "99.2%",
      "inferenceTime": "180ms",
      "clinicName": "City Neurological Institute & Brain Research Centre",
      "doctorDetails": "Dr. Ananya Rao, MD (DM Neurology) • Reg #KMC-48219",
      "patientDetails": {
        "diagnosis": "Severe Chronic Migraine with Aura & Neuropathic Cephalea",
        "vitals": "BP: 122/78 mmHg | Pulse: 72 bpm | SpO2: 99%"
      },
      "rawHandwritingText": "Rx:\n1. Tab Levetiracetam 500mg — 1 tab BD (twice daily) after food x 30 days\n2. Tab Amitriptyline 10mg — 1 tab HS (at bedtime) x 20 days\n3. S.O.S Tab Sumatriptan 50mg — 1 tab at onset of acute migraine attack (Do not repeat within 2 hours; Max 2 tabs in 24 hrs)\n4. Tab Naproxen 250mg — 1 tab PRN for severe breakthrough pain\n\nClinical Notes & Advice:\n- Advised 3T MRI Brain (with contrast) to rule out secondary etiology.\n- Avoid dietary triggers: aged cheese, artificial sweeteners, disrupted sleep cycles.\n- Maintain headache diary tracking aura duration and pain intensity.\n- Review in OPD after 4 weeks with MRI results.",
      "structuredMedications": [
        {
          "name": "Levetiracetam",
          "dosage": "500 mg",
          "frequency": "Twice daily (BD)",
          "timing": "After meals (Morning & Night)",
          "duration": "30 Days",
          "purpose": "Neuropathic Cephalea & Hyperexcitability Modulation",
          "safetyAlert": "Do not discontinue abruptly. Mild drowsiness may occur."
        },
        {
          "name": "Amitriptyline",
          "dosage": "10 mg",
          "frequency": "Once daily (HS)",
          "timing": "At Bedtime",
          "duration": "20 Days",
          "purpose": "Migraine Prophylaxis & Sleep Regulation",
          "safetyAlert": "May cause morning dry mouth or sedation."
        },
        {
          "name": "Sumatriptan",
          "dosage": "50 mg",
          "frequency": "S.O.S (PRN)",
          "timing": "At first sign of acute migraine headache",
          "duration": "As needed",
          "purpose": "Acute Serotonin 5-HT1 Receptor Abortive",
          "safetyAlert": "Maximum 2 tablets in 24 hours. Contraindicated in uncontrolled hypertension."
        },
        {
          "name": "Naproxen",
          "dosage": "250 mg",
          "frequency": "S.O.S (PRN)",
          "timing": "With food for severe pain",
          "duration": "As needed",
          "purpose": "NSAID Anti-inflammatory Pain Relief",
          "safetyAlert": "Take strictly with food or antacid."
        }
      ],
      "recommendedInvestigations": [
        "3T MRI Brain (Axial, Coronal, Sagittal T1/T2 with FLAIR)",
        "Complete Blood Count (CBC) & Serum Electrolytes",
        "Daily Digital Headache Frequency Diary"
      ]
    }'::jsonb
)
ON CONFLICT (id) DO UPDATE 
SET title = EXCLUDED.title,
    ocr_data = EXCLUDED.ocr_data;

-- Enable Public Read / Write on medical_records for demonstration
ALTER TABLE public.medical_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Read Access" ON public.medical_records FOR SELECT USING (true);
CREATE POLICY "Public Insert Access" ON public.medical_records FOR INSERT WITH CHECK (true);

ALTER TABLE public.qr_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public QR Token Read" ON public.qr_tokens FOR SELECT USING (true);
CREATE POLICY "Public QR Token Insert" ON public.qr_tokens FOR INSERT WITH CHECK (true);

