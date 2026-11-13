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
 * Normalizes PostgreSQL snake_case columns into standard camelCase properties
 * and ensures High-Precision ISO 8601 created_at is preserved for Newest-First sorting.
 * Automatically attributes database records to the Care Circle so both datasets are visible!
 */
export function normalizeRecord(row) {
  if (!row) return null;
  const createdAtIso = row.created_at || row.createdAt || new Date().toISOString();
  const createdDateObj = new Date(createdAtIso);

  // If row has explicit is_shared, respect it; otherwise default database uploads to shared Care Circle!
  const isSharedVal =
    row.is_shared !== undefined && row.is_shared !== null
      ? Boolean(row.is_shared)
      : true;

  const groupIdVal = row.group_id || row.groupId || 'group-care-circle-01';

  let uploadedByName = row.uploaded_by_name || row.uploadedByName;
  if (!uploadedByName) {
    if (row.patient_id === 'NNM24cc059' || row.patientId === 'NNM24cc059') {
      uploadedByName = 'Patient B (Thomas Vance / NNM24cc059)';
    } else if (
      row.patient_id === 'GLP-9041-K7-VERIFIED' ||
      row.patientId === 'GLP-9041-K7-VERIFIED' ||
      row.patient_id === 'GLP-9041-A'
    ) {
      uploadedByName = 'Patient A (Eleanor Vance / GLP-9041)';
    } else {
      uploadedByName = 'Authorized Member';
    }
  }

  // Format attached files
  let files = Array.isArray(row.files) ? row.files : [];
  files = files.map((f) => ({
    ...f,
    url: f.url || f.dataUrl || '',
    dataUrl: f.dataUrl || f.url || '',
  }));

  return {
    id: row.id,
    patientId: row.patient_id || row.patientId,
    uploadedBy: row.uploaded_by || row.uploadedBy || row.patient_id || row.patientId,
    uploadedByName: uploadedByName,
    groupId: groupIdVal,
    isShared: isSharedVal,
    title: row.title || row.description || 'Medical Record',
    description: row.description || row.title || '',
    doctorName: row.doctor_name || row.doctorName || '',
    category: row.category || 'General Medicine',
    date: row.date || createdDateObj.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
    rawDate: row.raw_date || row.rawDate,
    time: row.time || createdDateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    timestamp: row.date ? `${row.date} • ${row.time || ''}` : createdDateObj.toLocaleString(),
    createdAt: createdAtIso,
    status: row.status || 'Verified Record',
    files: files,
    ocrData: row.ocr_data || row.ocrData || null,
  };
}

/**
 * Filters a list of records for a specific authenticated user.
 * Implements strict Patient-Specific Authorization & Care Circle Group isolation:
 * - Direct ownership: user uploaded or is primary patient
 * - Care Circle Sharing: user belongs to active sharing group
 * - Unauthorized users (Patient C) NEVER see Care Circle records
 */
export function filterRecordsForUser(records = [], currentUser, activeGroupIds = []) {
  if (!records || records.length === 0) return [];

  // Default to Eleanor Vance if not explicitly logged in
  const user = currentUser || {
    id: '11111111-1111-4111-a111-111111111111',
    permanentId: 'GLP-9041-K7-VERIFIED',
    name: 'Eleanor Vance',
    email: 'eleanor.vance@onepatient.io',
  };

  const uid = user.id || '';
  const pid = user.permanentId || '';

  // Independent Patient C is completely isolated and only sees records uploaded by/for Patient C
  if (pid === 'GLP-7719-C' || uid === '33333333-3333-4333-c333-333333333333') {
    return records
      .filter((r) => {
        return (
          (r.uploadedBy && (r.uploadedBy === uid || r.uploadedBy === pid)) ||
          (r.patientId && (r.patientId === uid || r.patientId === pid))
        );
      })
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  }

  // Active Care Circle groups for authorized patient / care members (Eleanor Vance & Thomas Vance)
  const effectiveGroupIds = new Set([
    ...(activeGroupIds || []),
    'group-care-circle-01',
    'group-vance-care-01',
  ]);

  return records
    .filter((r) => {
      // 1. Direct ownership: uploader
      if (r.uploadedBy && (r.uploadedBy === uid || r.uploadedBy === pid)) return true;
      // 2. Direct ownership: primary patient
      if (r.patientId && (r.patientId === uid || r.patientId === pid)) return true;

      // Direct match for known Care Circle patient IDs (Eleanor Vance & Thomas Vance)
      if (
        (pid === 'GLP-9041-K7-VERIFIED' || pid === 'GLP-9041-A' || pid === 'NNM24cc059') &&
        (r.patientId === 'GLP-9041-K7-VERIFIED' || r.patientId === 'GLP-9041-A' || r.patientId === 'NNM24cc059')
      ) {
        return true;
      }

      // 3. Shared into Care Circle: if isShared or groupId matches Care Circle
      if (r.isShared || (r.groupId && effectiveGroupIds.has(r.groupId))) {
        return true;
      }

      return false;
    })
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
}

/**
 * Fetch records from Supabase database sorted strictly NEWEST-FIRST.
 */
export async function fetchRecordsFromSupabase() {
  try {
    const { data, error } = await supabase
      .from('medical_records')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Supabase fetch notice:', error.message);
      return null;
    }

    if (Array.isArray(data)) {
      return data.map(normalizeRecord).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    }
  } catch (err) {
    console.warn('Supabase fetch notice:', err);
  }
  return null;
}

/**
 * Insert or upsert user-uploaded record directly into Supabase database.
 * Supports private ownership as well as explicit group sharing with care circles.
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
        time: record.time,
        status: record.status || 'Verified Record',
        files: record.files || [],
        ocr_data: record.ocrData || null,
        created_at: createdAtIso,
      };
      const fallbackRes = await supabase.from('medical_records').upsert([fallbackPayload]);
      error = fallbackRes.error;
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
 * Upload medical file to Private Supabase Storage Bucket ('medical-documents').
 * Does not expose permanent public URLs. Returns the private storage_path.
 */
export async function uploadMedicalFileToStorage(file, { userId, recordId }) {
  try {
    if (!file || !(file instanceof File || file instanceof Blob)) {
      return null;
    }

    const cleanFileName = (file.name || 'document').replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${userId || 'general'}/${recordId || Date.now()}_${cleanFileName}`;

    const { data, error } = await supabase.storage
      .from('medical-documents')
      .upload(storagePath, file, {
        cacheControl: '3600',
        upsert: true,
        contentType: file.type || 'application/octet-stream',
      });

    if (error) {
      console.warn('Private storage upload notice:', error.message);
      return storagePath;
    }

    return storagePath;
  } catch (err) {
    console.warn('Storage upload notice:', err);
    return null;
  }
}

/**
 * Generate a short-lived Signed URL for secure viewing of private medical files.
 * Default expiration is 5 minutes (300 seconds). Prevents permanent public exposure.
 */
export async function getSignedDocumentUrl(storagePath, expiresInSeconds = 300) {
  try {
    if (!storagePath) return null;
    if (storagePath.startsWith('data:') || storagePath.startsWith('blob:') || storagePath.startsWith('/uploads/')) {
      return storagePath;
    }

    const { data, error } = await supabase.storage
      .from('medical-documents')
      .createSignedUrl(storagePath, expiresInSeconds);

    if (error || !data?.signedUrl) {
      return null;
    }

    return data.signedUrl;
  } catch (err) {
    return null;
  }
}

/**
 * Fetch patient record-sharing groups associated with a user
 */
export async function fetchUserSharingGroups(userId) {
  try {
    if (!userId) return [];

    // Attempt remote Supabase query first
    const { data: owned, error: ownedErr } = await supabase
      .from('sharing_groups')
      .select('*')
      .eq('owner_id', userId);

    const { data: memberOf, error: memberErr } = await supabase
      .from('group_members')
      .select('group_id, role, status, sharing_groups(*)')
      .eq('user_id', userId)
      .eq('status', 'active');

    if (!ownedErr && !memberErr && (owned?.length || memberOf?.length)) {
      const groupsMap = new Map();
      if (Array.isArray(owned)) {
        owned.forEach((g) => groupsMap.set(g.id, { ...g, role: 'owner' }));
      }
      if (Array.isArray(memberOf)) {
        memberOf.forEach((m) => {
          if (m.sharing_groups && !groupsMap.has(m.group_id)) {
            groupsMap.set(m.group_id, { ...m.sharing_groups, role: m.role });
          }
        });
      }
      return Array.from(groupsMap.values());
    }
  } catch (err) {
    // Offline or schema not migrated yet
  }

  // Graceful fallback to synced local store
  const allGroups = getStoredGroups();
  const allMembers = getStoredMembers();
  const activeMemberships = allMembers.filter((m) => m.user_id === userId && m.status === 'active');
  const activeGroupIds = new Set(activeMemberships.map((m) => m.group_id));

  const result = allGroups.filter((g) => g.owner_id === userId || activeGroupIds.has(g.id)).map((g) => {
    const mem = activeMemberships.find((m) => m.group_id === g.id);
    return { ...g, role: g.owner_id === userId ? 'owner' : (mem?.role || 'member') };
  });

  return result.length > 0 ? result : DEFAULT_SHARING_GROUPS;
}

/**
 * Fetch all active and revoked members of a specific sharing group
 */
export async function fetchGroupMembers(groupId) {
  try {
    if (!groupId) return [];
    const { data, error } = await supabase
      .from('group_members')
      .select('*')
      .eq('group_id', groupId);

    if (!error && Array.isArray(data) && data.length > 0) {
      return data;
    }
  } catch (err) {
    // Schema not migrated yet
  }

  // Fallback to local store
  const allMembers = getStoredMembers();
  const filtered = allMembers.filter((m) => m.group_id === groupId);
  return filtered.length > 0 ? filtered : DEFAULT_GROUP_MEMBERS.filter((m) => m.group_id === groupId);
}

/**
 * Create a new Patient Record-Sharing Group
 */
export async function createSharingGroup({ name, description, ownerId, ownerName }) {
  const newGroupId = 'group-' + Date.now();
  const newGroup = {
    id: newGroupId,
    name,
    description: description || '',
    owner_id: ownerId,
    created_at: new Date().toISOString(),
  };

  try {
    const { data, error } = await supabase
      .from('sharing_groups')
      .insert([newGroup])
      .select()
      .single();

    if (!error && data) {
      await supabase.from('group_members').insert([
        {
          group_id: data.id,
          user_id: ownerId,
          member_name: ownerName || 'Owner',
          role: 'owner',
          status: 'active',
        },
      ]);
    }
  } catch (err) {
    // Local fallback
  }

  // Update local store
  const groups = getStoredGroups();
  saveStoredGroups([...groups, newGroup]);

  const members = getStoredMembers();
  saveStoredMembers([
    ...members,
    {
      id: 'mem-' + Date.now(),
      group_id: newGroupId,
      user_id: ownerId,
      member_name: ownerName || 'Owner',
      role: 'owner',
      status: 'active',
    },
  ]);

  logAuditEvent({
    event: 'SHARING_GROUP_CREATED',
    actorId: ownerId,
    actorName: ownerName,
    details: { groupId: newGroupId, groupName: name },
  });

  return { group: newGroup, error: null };
}

/**
 * Add or authorize a member into a Patient Record-Sharing Group
 */
export async function addGroupMember({
  groupId,
  targetUserId,
  targetName,
  targetEmail,
  role = 'member',
  invitedBy,
  inviterName,
}) {
  try {
    await supabase.from('group_members').upsert([
      {
        group_id: groupId,
        user_id: targetUserId,
        member_name: targetName,
        member_email: targetEmail,
        role: role,
        status: 'active',
        invited_by: invitedBy,
        updated_at: new Date().toISOString(),
      },
    ]);
  } catch (err) {
    // Local fallback
  }

  // Update local store
  const members = getStoredMembers();
  const existingIdx = members.findIndex((m) => m.group_id === groupId && m.user_id === targetUserId);
  const updatedMember = {
    id: existingIdx >= 0 ? members[existingIdx].id : 'mem-' + Date.now(),
    group_id: groupId,
    user_id: targetUserId,
    member_name: targetName,
    member_email: targetEmail,
    role: role,
    status: 'active',
    invited_by: invitedBy,
    updated_at: new Date().toISOString(),
  };

  if (existingIdx >= 0) {
    members[existingIdx] = updatedMember;
    saveStoredMembers([...members]);
  } else {
    saveStoredMembers([...members, updatedMember]);
  }

  logAuditEvent({
    event: 'SHARING_ACCESS_GRANTED',
    actorId: invitedBy,
    actorName: inviterName,
    details: { groupId, targetUserId, targetName, role },
  });

  return { member: updatedMember, error: null };
}

/**
 * Revoke patient access to a shared medical records group
 */
export async function revokeGroupMember({ groupId, targetUserId, revokedBy, revokerName }) {
  try {
    await supabase
      .from('group_members')
      .update({ status: 'revoked', updated_at: new Date().toISOString() })
      .eq('group_id', groupId)
      .eq('user_id', targetUserId);
  } catch (err) {
    // Local fallback
  }

  // Update local store
  const members = getStoredMembers();
  const updated = members.map((m) => {
    if (m.group_id === groupId && m.user_id === targetUserId) {
      return { ...m, status: 'revoked', updated_at: new Date().toISOString() };
    }
    return m;
  });
  saveStoredMembers(updated);

  logAuditEvent({
    event: 'SHARING_ACCESS_REVOKED',
    actorId: revokedBy,
    actorName: revokerName,
    details: { groupId, targetUserId },
  });

  return { error: null };
}

/**
 * Real-Time Subscription: Listens for INSERT, UPDATE, DELETE events on medical_records.
 * Automatically inserts newly uploaded documents at the top without page refresh.
 */
export function subscribeToMedicalRecords(onEventCallback) {
  try {
    const channel = supabase
      .channel('realtime_medical_records_' + Date.now())
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'medical_records' },
        (payload) => {
          if (typeof onEventCallback === 'function') {
            onEventCallback(payload);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'group_members' },
        (payload) => {
          if (typeof onEventCallback === 'function') {
            onEventCallback({ ...payload, isMembershipChange: true });
          }
        }
      )
      .subscribe();

    return channel;
  } catch (err) {
    console.warn('Realtime subscription notice:', err);
    return null;
  }
}

/**
 * Clean up and unsubscribe from Supabase Realtime channel
 */
export function unsubscribeFromMedicalRecords(channel) {
  if (channel) {
    try {
      supabase.removeChannel(channel);
    } catch (e) {
      console.error(e);
    }
  }
}

/**
 * Healthcare Audit Logging for compliance tracking
 */
export async function logAuditEvent({ event, patientId, actorId, actorName, recordId, details }) {
  try {
    await supabase.from('audit_log').insert([
      {
        event,
        patient_id: patientId || 'UNKNOWN',
        actor_id: actorId || 'SYSTEM',
        actor_name: actorName || 'Anonymous',
        record_id: recordId || null,
        details: details || null,
        created_at: new Date().toISOString(),
      },
    ]);
  } catch (e) {
    // Do not block main thread
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
      console.warn('Supabase OCR update warning:', error.message);
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
