import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://nqpjukldzxrijskmlrvm.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_lDxF-d8itkbu9yRPyLt21g_ERu4j_Yv';

export const supabase = createClient(supabaseUrl, supabaseKey);

// Default seeded Neurology Prescription with rich handwritten OCR metadata
export const SEEDED_NEUROLOGY_RECORD = {
  id: 'rec-neuro-001',
  title: 'Neurology Prescription',
  description: 'Neurology Prescription — Refractory Migraine & Neuropathic Pain Protocol',
  doctorName: 'Dr. Ananya Rao, MD (DM Neurology)',
  category: 'Neurology',
  date: 'Nov 12, 2026',
  rawDate: '2026-11-12',
  time: '09:30 AM',
  timestamp: 'Nov 12, 2026 • 09:30 AM',
  status: 'Verified Record',
  files: [
    {
      name: 'Dr_Rao_Neurology_Prescription_Rx.jpg',
      size: '1.8 MB',
      type: 'image/jpeg',
    },
  ],
  ocrData: {
    model: 'TrOCR-Large-Stage2-Medical (Vision Transformer + Seq2Seq)',
    confidence: '99.2%',
    inferenceTime: '180ms',
    clinicName: 'City Neurological Institute & Brain Research Centre',
    doctorDetails: 'Dr. Ananya Rao, MD (DM Neurology) • Reg #KMC-48219',
    patientDetails: {
      diagnosis: 'Severe Chronic Migraine with Aura & Neuropathic Cephalea',
      vitals: 'BP: 122/78 mmHg | Pulse: 72 bpm | SpO2: 99%',
    },
    rawHandwritingText: `Rx:
1. Tab Levetiracetam 500mg — 1 tab BD (twice daily) after food x 30 days
2. Tab Amitriptyline 10mg — 1 tab HS (at bedtime) x 20 days
3. S.O.S Tab Sumatriptan 50mg — 1 tab at onset of acute migraine attack (Do not repeat within 2 hours; Max 2 tabs in 24 hrs)
4. Tab Naproxen 250mg — 1 tab PRN for severe breakthrough pain

Clinical Notes & Advice:
- Advised 3T MRI Brain (with contrast) to rule out secondary etiology.
- Avoid dietary triggers: aged cheese, artificial sweeteners, disrupted sleep cycles.
- Maintain headache diary tracking aura duration and pain intensity.
- Review in OPD after 4 weeks with MRI results.`,
    structuredMedications: [
      {
        name: 'Levetiracetam',
        dosage: '500 mg',
        frequency: 'Twice daily (BD)',
        timing: 'After meals (Morning & Night)',
        duration: '30 Days',
        purpose: 'Neuropathic Cephalea & Hyperexcitability Modulation',
        safetyAlert: 'Do not discontinue abruptly. Mild drowsiness may occur.',
      },
      {
        name: 'Amitriptyline',
        dosage: '10 mg',
        frequency: 'Once daily (HS)',
        timing: 'At Bedtime',
        duration: '20 Days',
        purpose: 'Migraine Prophylaxis & Sleep Regulation',
        safetyAlert: 'May cause morning dry mouth or sedation.',
      },
      {
        name: 'Sumatriptan',
        dosage: '50 mg',
        frequency: 'S.O.S (PRN)',
        timing: 'At first sign of acute migraine headache',
        duration: 'As needed',
        purpose: 'Acute Serotonin 5-HT1 Receptor Abortive',
        safetyAlert: 'Maximum 2 tablets in 24 hours. Contraindicated in uncontrolled hypertension.',
      },
      {
        name: 'Naproxen',
        dosage: '250 mg',
        frequency: 'S.O.S (PRN)',
        timing: 'With food for severe pain',
        duration: 'As needed',
        purpose: 'NSAID Anti-inflammatory Pain Relief',
        safetyAlert: 'Take strictly with food or antacid.',
      },
    ],
    recommendedInvestigations: [
      '3T MRI Brain (Axial, Coronal, Sagittal T1/T2 with FLAIR)',
      'Complete Blood Count (CBC) & Serum Electrolytes',
      'Daily Digital Headache Frequency Diary',
    ],
  },
};

/**
 * Fetch records from Supabase database
 */
export async function fetchRecordsFromSupabase() {
  try {
    const { data, error } = await supabase
      .from('medical_records')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && Array.isArray(data) && data.length > 0) {
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
 * Insert newly uploaded record to Supabase database
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
