import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://nqpjukldzxrijskmlrvm.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_lDxF-d8itkbu9yRPyLt21g_ERu4j_Yv';

export const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Fetch records from Supabase database (strictly user-uploaded records)
 */
export async function fetchRecordsFromSupabase() {
  try {
    const { data, error } = await supabase
      .from('medical_records')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && Array.isArray(data)) {
      return data.map((row) => ({
        id: row.id,
        title: row.title,
        description: row.description || row.title,
        doctorName: row.doctor_name,
        category: row.category,
        date: row.date,
        rawDate: row.raw_date,
        time: row.time,
        status: row.status || 'Verified Record',
        files: row.files || [],
        ocrData: row.ocr_data,
      }));
    }
  } catch (err) {
    console.warn('Supabase fetch failed or offline; using local cache:', err);
  }
  return null;
}

/**
 * Insert or upsert user-uploaded record directly into Supabase database
 */
export async function insertRecordToSupabase(record) {
  try {
    const rawDateVal =
      record.rawDate && typeof record.rawDate === 'string' && record.rawDate.trim() !== ''
        ? record.rawDate.trim()
        : null;

    const { data, error } = await supabase.from('medical_records').upsert([
      {
        id: record.id,
        patient_id: record.patientId || 'NNM24cc059',
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
      },
    ]);
    if (error) {
      console.warn('Supabase insert/upsert warning:', error.message);
    }
    return { data, error };
  } catch (err) {
    console.warn('Could not insert/upsert to Supabase:', err);
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
    console.warn('Could not save QR token to Supabase:', err);
    return { error: err };
  }
}
