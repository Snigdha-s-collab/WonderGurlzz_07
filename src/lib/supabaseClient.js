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
 * Insert newly user-uploaded record directly into Supabase database
 */
export async function insertRecordToSupabase(record) {
  try {
    const { data, error } = await supabase.from('medical_records').insert([
      {
        id: record.id,
        title: record.title || record.description,
        description: record.description,
        doctor_name: record.doctorName,
        category: record.category,
        date: record.date,
        raw_date: record.rawDate,
        time: record.time,
        status: record.status || 'Verified Record',
        files: record.files || [],
        ocr_data: record.ocrData || null,
      },
    ]);
    if (error) {
      console.warn('Supabase insert warning:', error.message);
    }
    return { data, error };
  } catch (err) {
    console.warn('Could not insert to Supabase:', err);
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
