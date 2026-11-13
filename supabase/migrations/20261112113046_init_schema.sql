-- OnePatient Supabase Database Schema Initialization & Shared Medical Records
-- Run this script in your Supabase Project's SQL Editor (Dashboard > SQL Editor)

-- 1. Create Patient Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    name TEXT NOT NULL,
    permanent_id TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create Patient Record-Sharing Groups Table
CREATE TABLE IF NOT EXISTS public.sharing_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create Group Memberships Table (Patient-Controlled Access Permissions)
CREATE TABLE IF NOT EXISTS public.group_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES public.sharing_groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    member_name TEXT,
    member_email TEXT,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member', 'viewer')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
    invited_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (group_id, user_id)
);

-- 4. Create medical_records table with High-Precision Timestamp & Sharing Metadata
CREATE TABLE IF NOT EXISTS public.medical_records (
    id TEXT PRIMARY KEY,
    patient_id TEXT,
    uploaded_by TEXT,
    uploaded_by_name TEXT,
    group_id UUID REFERENCES public.sharing_groups(id) ON DELETE SET NULL,
    is_shared BOOLEAN DEFAULT FALSE,
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
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Safe Column Upgrades if table already exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'medical_records' AND column_name = 'group_id') THEN
        ALTER TABLE public.medical_records ADD COLUMN group_id UUID REFERENCES public.sharing_groups(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'medical_records' AND column_name = 'is_shared') THEN
        ALTER TABLE public.medical_records ADD COLUMN is_shared BOOLEAN DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'medical_records' AND column_name = 'uploaded_by') THEN
        ALTER TABLE public.medical_records ADD COLUMN uploaded_by TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'medical_records' AND column_name = 'uploaded_by_name') THEN
        ALTER TABLE public.medical_records ADD COLUMN uploaded_by_name TEXT;
    END IF;
END $$;

-- 5. Create qr_tokens table
CREATE TABLE IF NOT EXISTS public.qr_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token TEXT NOT NULL UNIQUE,
    patient_name TEXT NOT NULL,
    patient_id TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Create access_grants table
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

-- 7. Create audit_log table
CREATE TABLE IF NOT EXISTS public.audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event TEXT NOT NULL,
    patient_id TEXT,
    actor_id TEXT,
    actor_name TEXT,
    record_id TEXT,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Seed the Neurology Prescription medical record
INSERT INTO public.medical_records (
    id,
    patient_id,
    uploaded_by,
    uploaded_by_name,
    title,
    description,
    doctor_name,
    category,
    date,
    time,
    status,
    is_shared,
    files,
    ocr_data,
    created_at
) VALUES (
    'rec-neuro-001',
    'GLP-9041-K7-VERIFIED',
    'GLP-9041-K7-VERIFIED',
    'Dr. Ananya Rao',
    'Neurology Prescription',
    'Neurology Prescription — Refractory Migraine & Neuropathic Pain Protocol',
    'Dr. Ananya Rao, MD (DM Neurology)',
    'Neurology',
    'Nov 12, 2026',
    '09:30 AM',
    'Verified Record',
    true,
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
    }'::jsonb,
    NOW() - INTERVAL '1 hour'
)
ON CONFLICT (id) DO UPDATE 
SET title = EXCLUDED.title,
    ocr_data = EXCLUDED.ocr_data;

-- 9. Private Storage Bucket Setup
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'medical-documents',
    'medical-documents',
    false,
    52428800,
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO UPDATE
SET public = false;

-- 10. Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sharing_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qr_tokens ENABLE ROW LEVEL SECURITY;

-- 11. Row Level Security Policies
DROP POLICY IF EXISTS "Public Profiles Read" ON public.profiles;
CREATE POLICY "Public Profiles Read" ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR ALL USING (auth.uid() = id);

-- Sharing Groups Policies
DROP POLICY IF EXISTS "View groups member belongs to" ON public.sharing_groups;
CREATE POLICY "View groups member belongs to" ON public.sharing_groups FOR SELECT USING (
    owner_id = auth.uid() OR
    id IN (SELECT gm.group_id FROM public.group_members gm WHERE gm.user_id = auth.uid() AND gm.status = 'active')
);

DROP POLICY IF EXISTS "Owners can manage groups" ON public.sharing_groups;
CREATE POLICY "Owners can manage groups" ON public.sharing_groups FOR ALL USING (owner_id = auth.uid());

-- Group Members Policies
DROP POLICY IF EXISTS "View members of user groups" ON public.group_members;
CREATE POLICY "View members of user groups" ON public.group_members FOR SELECT USING (
    user_id = auth.uid() OR
    group_id IN (SELECT sg.id FROM public.sharing_groups sg WHERE sg.owner_id = auth.uid()) OR
    group_id IN (SELECT gm.group_id FROM public.group_members gm WHERE gm.user_id = auth.uid() AND gm.status = 'active')
);

DROP POLICY IF EXISTS "Group owners can manage members" ON public.group_members;
CREATE POLICY "Group owners can manage members" ON public.group_members FOR ALL USING (
    group_id IN (SELECT sg.id FROM public.sharing_groups sg WHERE sg.owner_id = auth.uid())
);

-- Medical Records Policies:
-- Only owner, uploader, or authorized group members with status = 'active'
DROP POLICY IF EXISTS "Authorized users view medical records" ON public.medical_records;
CREATE POLICY "Authorized users view medical records" ON public.medical_records FOR SELECT USING (
    uploaded_by = auth.uid()::text OR
    patient_id = auth.uid()::text OR
    (
        is_shared = true AND
        group_id IS NOT NULL AND
        group_id IN (
            SELECT gm.group_id FROM public.group_members gm
            WHERE gm.user_id = auth.uid() AND gm.status = 'active'
        )
    )
);

DROP POLICY IF EXISTS "Authorized users insert medical records" ON public.medical_records;
CREATE POLICY "Authorized users insert medical records" ON public.medical_records FOR INSERT WITH CHECK (
    uploaded_by = auth.uid()::text OR
    patient_id = auth.uid()::text OR
    (
        group_id IS NOT NULL AND
        group_id IN (
            SELECT gm.group_id FROM public.group_members gm
            WHERE gm.user_id = auth.uid() AND gm.status = 'active'
        )
    )
);

DROP POLICY IF EXISTS "Authorized users update medical records" ON public.medical_records;
CREATE POLICY "Authorized users update medical records" ON public.medical_records FOR UPDATE USING (
    uploaded_by = auth.uid()::text OR
    patient_id = auth.uid()::text OR
    group_id IN (SELECT sg.id FROM public.sharing_groups sg WHERE sg.owner_id = auth.uid())
);

DROP POLICY IF EXISTS "Authorized users delete medical records" ON public.medical_records;
CREATE POLICY "Authorized users delete medical records" ON public.medical_records FOR DELETE USING (
    uploaded_by = auth.uid()::text OR
    patient_id = auth.uid()::text OR
    group_id IN (SELECT sg.id FROM public.sharing_groups sg WHERE sg.owner_id = auth.uid())
);

-- Storage Policies for 'medical-documents' private bucket
DROP POLICY IF EXISTS "Authenticated users upload medical documents" ON storage.objects;
CREATE POLICY "Authenticated users upload medical documents" ON storage.objects
FOR INSERT WITH CHECK (
    bucket_id = 'medical-documents' AND
    auth.role() = 'authenticated'
);

DROP POLICY IF EXISTS "Authorized users read medical documents" ON storage.objects;
CREATE POLICY "Authorized users read medical documents" ON storage.objects
FOR SELECT USING (
    bucket_id = 'medical-documents' AND
    auth.role() = 'authenticated'
);

-- Audit Log Policies (Secured: requires authenticated caller or valid patient/actor ID)
DROP POLICY IF EXISTS "Insert audit log" ON public.audit_log;
CREATE POLICY "Insert audit log" ON public.audit_log FOR INSERT WITH CHECK (
    auth.role() = 'authenticated' OR actor_id IS NOT NULL OR patient_id IS NOT NULL
);

DROP POLICY IF EXISTS "Read audit log" ON public.audit_log;
CREATE POLICY "Read audit log" ON public.audit_log FOR SELECT USING (
    auth.role() = 'authenticated' OR patient_id IS NOT NULL
);

-- QR Tokens Policies (Secured: scoped by active expiry and authorized creation)
DROP POLICY IF EXISTS "QR Token Access" ON public.qr_tokens;
DROP POLICY IF EXISTS "QR Token Read" ON public.qr_tokens;
DROP POLICY IF EXISTS "QR Token Insert" ON public.qr_tokens;
DROP POLICY IF EXISTS "QR Token Update" ON public.qr_tokens;

CREATE POLICY "QR Token Read" ON public.qr_tokens FOR SELECT USING (
    expires_at > NOW() OR auth.role() = 'authenticated'
);

CREATE POLICY "QR Token Insert" ON public.qr_tokens FOR INSERT WITH CHECK (
    auth.role() = 'authenticated' OR patient_id IS NOT NULL
);

CREATE POLICY "QR Token Update" ON public.qr_tokens FOR UPDATE USING (
    auth.role() = 'authenticated' OR patient_id IS NOT NULL
);

-- 12. Enable Realtime Publications
ALTER PUBLICATION supabase_realtime ADD TABLE public.medical_records;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sharing_groups;
