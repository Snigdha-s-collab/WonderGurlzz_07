-- OnePatient Supabase Database Schema Initialization
-- Pure schema definition without hardcoded seed records

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

-- 5. Row Level Security Policies
ALTER TABLE public.medical_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Read Access" ON public.medical_records;
CREATE POLICY "Public Read Access" ON public.medical_records FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public Insert Access" ON public.medical_records;
CREATE POLICY "Public Insert Access" ON public.medical_records FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Public Update Access" ON public.medical_records;
CREATE POLICY "Public Update Access" ON public.medical_records FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Public Delete Access" ON public.medical_records;
CREATE POLICY "Public Delete Access" ON public.medical_records FOR DELETE USING (true);

ALTER TABLE public.qr_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public QR Token Read" ON public.qr_tokens;
CREATE POLICY "Public QR Token Read" ON public.qr_tokens FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public QR Token Insert" ON public.qr_tokens;
CREATE POLICY "Public QR Token Insert" ON public.qr_tokens FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Public QR Token Update" ON public.qr_tokens;
CREATE POLICY "Public QR Token Update" ON public.qr_tokens FOR UPDATE USING (true);
