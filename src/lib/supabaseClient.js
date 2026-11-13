import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SUPABASE_URL) ||
  'https://nqpjukldzxrijskmlrvm.supabase.co'
).trim().replace(/\/+$/, '');

const supabaseKey = (
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) ||
  'sb_publishable_lDxF-d8itkbu9yRPyLt21g_ERu4j_Yv'
).trim();

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

// Initial synthetic patient sharing groups for Care Circle
export const DEFAULT_SHARING_GROUPS = [
  {
    id: 'group-care-circle-01',
    name: 'OnePatient Care Circle',
    description: 'Shared medical records between Eleanor Vance (GLP-9041) and Thomas Vance (NNM24cc059)',
    owner_id: '11111111-1111-4111-a111-111111111111',
    created_at: '2026-11-12T08:00:00.000Z',
  },
  {
    id: 'group-vance-care-01',
    name: 'OnePatient Care Circle',
    description: 'Shared medical records between Eleanor Vance (GLP-9041) and Thomas Vance (NNM24cc059)',
    owner_id: '11111111-1111-4111-a111-111111111111',
    created_at: '2026-11-12T08:00:00.000Z',
  },
];

// Initial group memberships (Patient A owner, Patient B member with active consent; Patient C NOT included)
export const DEFAULT_GROUP_MEMBERS = [
  {
    id: 'mem-vance-01',
    group_id: 'group-care-circle-01',
    user_id: '11111111-1111-4111-a111-111111111111',
    member_name: 'Patient A (Eleanor Vance / GLP-9041)',
    member_email: 'patient.a@onepatient.app',
    role: 'owner',
    status: 'active',
    updated_at: '2026-11-12T08:00:00.000Z',
  },
  {
    id: 'mem-vance-02',
    group_id: 'group-care-circle-01',
    user_id: '22222222-2222-4222-b222-222222222222',
    member_name: 'Patient B (Thomas Vance / NNM24cc059)',
    member_email: 'patient.b@onepatient.app',
    role: 'member',
    status: 'active',
    updated_at: '2026-11-12T08:00:00.000Z',
  },
  {
    id: 'mem-vance-alt-01',
    group_id: 'group-vance-care-01',
    user_id: '11111111-1111-4111-a111-111111111111',
    member_name: 'Patient A (Eleanor Vance / GLP-9041)',
    member_email: 'patient.a@onepatient.app',
    role: 'owner',
    status: 'active',
    updated_at: '2026-11-12T08:00:00.000Z',
  },
  {
    id: 'mem-vance-alt-02',
    group_id: 'group-vance-care-01',
    user_id: '22222222-2222-4222-b222-222222222222',
    member_name: 'Patient B (Thomas Vance / NNM24cc059)',
    member_email: 'patient.b@onepatient.app',
    role: 'member',
    status: 'active',
    updated_at: '2026-11-12T08:00:00.000Z',
  },
];

// No hard-coded records: all medical records load strictly from the database
export const DEFAULT_SYNTHETIC_RECORDS = [];

// Local store helpers for sync fallback
function getStoredGroups() {
  try {
    const raw = localStorage.getItem('onepatient_sharing_groups');
    return raw ? JSON.parse(raw) : DEFAULT_SHARING_GROUPS;
  } catch (e) {
    return DEFAULT_SHARING_GROUPS;
  }
}

function saveStoredGroups(groups) {
  try {
    localStorage.setItem('onepatient_sharing_groups', JSON.stringify(groups));
  } catch (e) {
    console.error(e);
  }
}

function getStoredMembers() {
  try {
    const raw = localStorage.getItem('onepatient_group_members');
    return raw ? JSON.parse(raw) : DEFAULT_GROUP_MEMBERS;
  } catch (e) {
    return DEFAULT_GROUP_MEMBERS;
  }
}

function saveStoredMembers(members) {
  try {
    localStorage.setItem('onepatient_group_members', JSON.stringify(members));
  } catch (e) {
    console.error(e);
  }
}

/**
 * Fetch records from Supabase database scoped to authenticated patient
 */
export async function fetchRecordsFromSupabase(patientId = null) {
  try {
    let query = supabase
      .from('medical_records')
      .select('*')
      .order('created_at', { ascending: false });

    // Enforce patient scoping so users cannot access another patient's records
    if (patientId) {
      query = query.eq('patient_id', patientId);
    }

    const { data, error } = await query;

    if (!error && Array.isArray(data)) {
      return data.map((row) => ({
        id: row.id,
        patientId: row.patient_id,
        title: row.title,
        description: row.description || row.title,
        doctorName: row.doctor_name,
        category: row.category,
        date: row.date,
        rawDate: row.raw_date,
        time: row.time,
        status:
          row.status && !row.status.toLowerCase().includes('cryptograph')
            ? row.status
            : 'Verified Record',
        files: row.files || [],
        ocrData: row.ocr_data,
      }));
    }
    if (error) {
      console.warn('Supabase query error:', error.message);
    }
  } catch (err) {
    console.warn('Supabase fetch notice:', err);
  }
  return null;
}

/**
 * Insert or upsert user-uploaded record directly into Supabase database
 * Persists full files array and verified ocr_data JSONB
 */
export async function insertRecordToSupabase(record) {
  try {
    const createdAtIso = record.createdAt || new Date().toISOString();
    const rawDateVal =
      record.rawDate && typeof record.rawDate === 'string' && record.rawDate.trim() !== ''
        ? record.rawDate.trim()
        : null;

    const payload = {
      id: record.id,
      patient_id: record.patientId || null,
      uploaded_by: record.uploadedBy || null,
      uploaded_by_name: record.uploadedByName || null,
      group_id: record.groupId || null,
      is_shared: Boolean(record.isShared),
      title: record.title || record.description || 'Medical Record',
      description: record.description || record.title || '',
      doctor_name: record.doctorName || '',
      category: record.category || 'General Medicine',
      date: record.date || new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
      raw_date: rawDateVal,
      time: record.time || new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      status: record.status || 'Verified Record',
      files: record.files || [],
      ocr_data: record.ocrData || null,
      created_at: createdAtIso,
      updated_at: new Date().toISOString(),
    };

    let { data, error } = await supabase.from('medical_records').upsert([payload]);

    // Graceful fallback if extended group columns are pending SQL migration in Supabase
    if (error && error.message && error.message.includes('column')) {
      const fallbackPayload = {
        id: record.id,
        patient_id: record.patientId || null,
        title: record.title || record.description || 'Medical Record',
        description: record.description || record.title || '',
        doctor_name: record.doctorName || '',
        category: record.category || 'General Medicine',
        date: record.date,
        raw_date: rawDateVal,
        time: record.time || new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        status:
          record.status && !record.status.toLowerCase().includes('cryptograph')
            ? record.status
            : 'Verified Record',
        files: record.files || [],
        ocr_data: record.ocrData || null, // Stage 5: Save verified OCR response into JSONB column
      },
    ]);
    if (error) {
      console.warn('Supabase insert/upsert warning:', error.message);
    }

    if (!error) {
      logAuditEvent({
        event: record.isShared ? 'SHARED_RECORD_UPLOADED' : 'PRIVATE_RECORD_UPLOADED',
        patientId: record.patientId,
        actorId: record.uploadedBy,
        actorName: record.uploadedByName,
        recordId: record.id,
        details: {
          title: record.title,
          category: record.category,
          isShared: record.isShared,
          groupId: record.groupId,
        },
      });
    }

    return { data, error };
  } catch (err) {
    console.warn('Could not insert/upsert to Supabase:', err);
    return { error: err };
  }
}

/**
 * Update OCR data for a specific record in Supabase (e.g., following human verification)
 */
export async function updateRecordOCRInSupabase(recordId, ocrData) {
  try {
    const { data, error } = await supabase
      .from('medical_records')
      .update({ ocr_data: ocrData })
      .eq('id', recordId);

    if (error) {
      console.warn('Supabase update OCR warning:', error.message);
    }
    return { data, error };
  } catch (err) {
    console.warn('Could not update OCR in Supabase:', err);
    return { error: err };
  }
}

/**
 * Save single-use QR token to Supabase database
 */
export async function saveQRTokenToSupabase(tokenData) {
  try {
    const { data, error } = await supabase.from('qr_tokens').insert([
      {
        token: tokenData.token,
        patient_name: tokenData.patientName,
        patient_id: tokenData.patientId,
        expires_at: new Date(tokenData.expiresAt).toISOString(),
        used: false,
      },
    ]);
    return { data, error };
  } catch (err) {
    return { error: err };
  }
}
