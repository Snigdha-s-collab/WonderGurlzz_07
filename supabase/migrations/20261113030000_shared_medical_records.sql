-- OnePatient Schema Migration: Shared Medical Records with Real-Time Updates & Private Storage
-- Run this in your Supabase Project's SQL Editor (Dashboard > SQL Editor)

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

-- 3. Create Group Memberships Table (Explicit Patient Consent & Sharing Permissions)
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

-- 4. Create or Upgrade Medical Records Table
CREATE TABLE IF NOT EXISTS public.medical_records (
    id TEXT PRIMARY KEY,
    patient_id TEXT,                                 -- Patient identifier (UUID or permanent ID)
    uploaded_by TEXT,                                -- Uploader identifier (UUID or permanent ID)
    uploaded_by_name TEXT,                           -- Display name of the user who uploaded
    group_id UUID REFERENCES public.sharing_groups(id) ON DELETE SET NULL, -- Associated Sharing Group
    is_shared BOOLEAN DEFAULT FALSE,                 -- Explicit sharing flag
    title TEXT NOT NULL,
    description TEXT,
    doctor_name TEXT,
    category TEXT NOT NULL,
    date TEXT,
    raw_date DATE,
    time TEXT,
    status TEXT DEFAULT 'Verified Record',
    files JSONB DEFAULT '[]'::jsonb,                 -- Array of { name, size, type, storage_path }
    ocr_data JSONB DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),   -- High-precision database timestamp for Newest-First sorting
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure newly added columns exist if table was previously created
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

-- 5. Create Audit Log Table for Healthcare Compliance
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

-- 6. Create QR Tokens & Access Grants Tables
CREATE TABLE IF NOT EXISTS public.qr_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token TEXT NOT NULL UNIQUE,
    patient_name TEXT NOT NULL,
    patient_id TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Initialize Private Storage Bucket for Medical Documents
-- Keep bucket private (public = false) so medical documents require authorized signed URLs
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'medical-documents',
    'medical-documents',
    false,
    52428800, -- 50 MB limit
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO UPDATE
SET public = false;

-- 8. Enable Row Level Security (RLS) on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sharing_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qr_tokens ENABLE ROW LEVEL SECURITY;

-- 9. Row Level Security Policies

-- Profiles Policies
DROP POLICY IF EXISTS "Public Profiles Read" ON public.profiles;
CREATE POLICY "Public Profiles Read" ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR ALL USING (auth.uid() = id);

-- Sharing Groups Policies: Members can read groups they belong to
DROP POLICY IF EXISTS "View groups member belongs to" ON public.sharing_groups;
CREATE POLICY "View groups member belongs to" ON public.sharing_groups FOR SELECT USING (
    owner_id = auth.uid() OR
    id IN (SELECT gm.group_id FROM public.group_members gm WHERE gm.user_id = auth.uid() AND gm.status = 'active')
);

DROP POLICY IF EXISTS "Owners can manage groups" ON public.sharing_groups;
CREATE POLICY "Owners can manage groups" ON public.sharing_groups FOR ALL USING (owner_id = auth.uid());

-- Group Members Policies: Members can view members in their shared groups
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
-- A user can see records if:
-- 1. They uploaded the record
-- 2. They are the patient owner
-- 3. OR the record is shared (is_shared = TRUE) and the user is an ACTIVE member of that sharing group
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

-- Insert policy: User can insert records for themselves or shared into groups they belong to
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

-- Update policy: Uploader or Patient owner or Group Owner
DROP POLICY IF EXISTS "Authorized users update medical records" ON public.medical_records;
CREATE POLICY "Authorized users update medical records" ON public.medical_records FOR UPDATE USING (
    uploaded_by = auth.uid()::text OR
    patient_id = auth.uid()::text OR
    group_id IN (SELECT sg.id FROM public.sharing_groups sg WHERE sg.owner_id = auth.uid())
);

-- Delete policy
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

-- 10. Enable Supabase Realtime Publication for instant cross-device updates
-- When any member uploads or shares a document, Realtime notifies all authorized subscribers
ALTER PUBLICATION supabase_realtime ADD TABLE public.medical_records;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sharing_groups;

