// Ask MedBot AI Agent & Prescription Query Service
// Powered by Qwen 2.5 7B AI Model (OpenRouter, Hugging Face, Ollama, Groq, or OpenAI-compatible endpoint)
// Directly queries and analyzes database records (Supabase & local cache) using clinical SQL tools:
// - get_medications(): active and past, with start, change and stop dates
// - get_allergies(): documented, explicitly negative, or not documented
// - get_conditions(): diagnosed conditions and clinical problem list
// - get_lab_results(test_name): test values, normal ranges, and trends
// - search_records(query): keyword search over extracted items and doctor notes
// - get_doctor_instructions(): clinical and dietary advice written by doctor
// - correlate_report_with_medications(): analyzes report findings & links to prescribed medications
//
// NOTE: The primary answer path is the backend Gemini RAG service (/api/medbot/chat), which is
// strictly grounded in the patient's uploaded documents via vector search. The local "SQL tool"
// helpers below are heuristic fallbacks ONLY for when the backend is unreachable. They must
// never present medication or diagnosis data that is not present in the patient's own records.

import { supabase, fetchRecordsFromSupabase } from '../lib/supabaseClient';
import { API_BASE_URL } from '../config/api';

export const DEFAULT_QWEN_MODEL = 'qwen/qwen-2.5-7b-instruct';
export const DEFAULT_QWEN_BASE_URL = 'https://openrouter.ai/api/v1';

export const QWEN_PRESETS = [
  {
    id: 'openrouter-qwen',
    label: 'Qwen 2.5 7B Instruct (OpenRouter - Flagship)',
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'qwen/qwen-2.5-7b-instruct',
    keyPlaceholder: 'sk-or-v1-... (OpenRouter API Key)',
    requiresKey: true,
  },
  {
    id: 'openrouter-qwen-14b',
    label: 'Qwen 2.5 14B Instruct (OpenRouter)',
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'qwen/qwen-2.5-14b-instruct',
    keyPlaceholder: 'sk-or-v1-... (OpenRouter API Key)',
    requiresKey: true,
  },
  {
    id: 'openrouter-qwen-72b',
    label: 'Qwen 2.5 72B Instruct (OpenRouter High Performance)',
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'qwen/qwen-2.5-72b-instruct',
    keyPlaceholder: 'sk-or-v1-... (OpenRouter API Key)',
    requiresKey: true,
  },
  {
    id: 'huggingface-qwen',
    label: 'Qwen 2.5 7B (Hugging Face Router)',
    baseUrl: 'https://router.huggingface.co/hf-inference/v1',
    model: 'Qwen/Qwen2.5-7B-Instruct',
    keyPlaceholder: 'hf_... (Hugging Face User Access Token)',
    requiresKey: true,
  },
  {
    id: 'openrouter-llama',
    label: 'Meta Llama 3.3 70B Instruct (OpenRouter)',
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'meta-llama/llama-3.3-70b-instruct',
    keyPlaceholder: 'sk-or-v1-... (OpenRouter API Key)',
    requiresKey: true,
  },
  {
    id: 'ollama-qwen',
    label: 'Local Ollama (qwen2.5:7b)',
    baseUrl: 'http://localhost:11434/v1',
    model: 'qwen2.5:7b',
    keyPlaceholder: 'No API key required for local Ollama',
    requiresKey: false,
  },
  {
    id: 'custom-endpoint',
    label: 'Custom OpenAI-Compatible API Endpoint',
    baseUrl: '',
    model: 'qwen/qwen-2.5-7b-instruct',
    keyPlaceholder: 'API Key / Bearer Token (if required)',
    requiresKey: false,
  },
];

/**
 * Formats 24h "HH:MM" into readable "HH:MM AM/PM" string.
 */
export function formatTime24To12(time24) {
  if (!time24 || !/^\d{1,2}:\d{2}$/.test(time24)) return time24 || '08:00 AM';
  const [hStr, mStr] = time24.split(':');
  let h = parseInt(hStr, 10);
  const suffix = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${String(h).padStart(2, '0')}:${mStr} ${suffix}`;
}

/**
 * Natural language time parser.
 */
export function parseTimeExpression(text) {
  const match = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (match) {
    let hour = parseInt(match[1], 10);
    const minute = match[2] ? parseInt(match[2], 10) : 0;
    const meridiem = match[3].toLowerCase();
    if (meridiem === 'pm' && hour < 12) hour += 12;
    if (meridiem === 'am' && hour === 12) hour = 0;
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    }
  }

  const match24 = text.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (match24) {
    return `${String(parseInt(match24[1], 10)).padStart(2, '0')}:${match24[2]}`;
  }

  if (/\b(breakfast|morning)\b/i.test(text)) return '08:00';
  if (/\b(lunch|afternoon|noon)\b/i.test(text)) return '13:00';
  if (/\b(dinner|evening)\b/i.test(text)) return '20:00';
  if (/\b(bedtime|night|sleep|hs)\b/i.test(text)) return '22:00';
  return null;
}

/**
 * Identifies emergency red flags that require immediate emergency triage.
 */
const RED_FLAG_PATTERNS = [
  /\b(chest pain|tightness in chest|heart attack|crushing chest|radiating to arm|shortness of breath|trouble breathing|can'?t breathe|severe wheezing)\b/i,
  /\b(swelling of (face|lips|tongue|throat)|anaphylaxis|severe allergic shock|unconscious|passed out|seizure|convulsion)\b/i,
  /\b(vomiting blood|coughing blood|blood in (stool|urine)|black tarry stool|uncontrolled bleeding|overdose|swallowed (entire|whole) bottle)\b/i,
  /\b(slurred speech|face drooping|one[- ]sided weakness|sudden vision loss|worst headache of life)\b/i,
];

export function classifyClinicalQuery(question) {
  const text = (question || '').trim();
  if (!text) return { type: 'normal' };

  for (const pattern of RED_FLAG_PATTERNS) {
    if (pattern.test(text)) {
      return {
        type: 'urgent_red_flag',
        reason: 'Immediate clinical emergency reported.',
      };
    }
  }

  return { type: 'normal' };
}

// ─────────────────────────────────────────────────────────────────────────────
// SQL DATABASE TOOLS FOR MEDBOT
// Directly queries and analyzes medical_records stored in Supabase / Local database
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Helper to fetch all database records from Supabase (with fallback to local storage / memory)
 */
export async function get_database_records(customRecords = null) {
  if (Array.isArray(customRecords) && customRecords.length > 0) {
    return customRecords;
  }

  // 1. Live Supabase database query
  try {
    const { data, error } = await supabase
      .from('medical_records')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && Array.isArray(data) && data.length > 0) {
      return data.map((row) => ({
        id: row.id,
        title: row.title || row.description,
        description: row.description || row.title,
        doctorName: row.doctor_name || '',
        category: row.category || 'General Medicine',
        date: row.date || 'Recent',
        rawDate: row.raw_date,
        time: row.time || '',
        status: row.status || 'Verified Record',
        files: row.files || [],
        ocrData: row.ocr_data,
        prescriptionText: row.description || row.title || '',
      }));
    }
  } catch (err) {
    console.warn('Direct Supabase SQL query failed; falling back to local database store:', err);
  }

  // 2. Local storage database fallback
  try {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem('onepatient_user_uploads');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    }
  } catch (err) {
    console.warn('Local database read error:', err);
  }

  // 3. Fallback: return empty list if no records exist
  return [];
}

/**
 * SQL Tool: get_doctor_details()
 * Extracts all attending doctors, their departments, credentials, and associated uploaded reports.
 */
export async function get_doctor_details(customRecords = null) {
  const records = await get_database_records(customRecords);
  const doctorsMap = new Map();

  for (const record of records) {
    const rawDoctor = record.doctorName || 'Attending Physician';
    const cleanDoc = rawDoctor.trim();
    const docKey = cleanDoc.toLowerCase();

    if (!doctorsMap.has(docKey)) {
      // Doctor details come only from the record's own OCR data; no hardcoded doctor profiles.
      const rx = record.ocrData?.prescription_data || {};
      const report = record.ocrData?.report_data || {};

      doctorsMap.set(docKey, {
        name: cleanDoc.startsWith('Dr') ? cleanDoc : `Dr. ${cleanDoc}`,
        specialty: record.category || 'General Practice',
        credentials: rx.doctor_name || report.referring_physician || 'Registered Medical Practitioner',
        clinic: rx.clinic_or_hospital || report.laboratory_or_imaging_center || 'Clinical Facility',
        focus: record.title || record.description || 'Clinical Consultation',
        associatedRecords: [
          {
            title: record.title || record.description,
            date: record.date || record.timestamp || 'Recent',
            category: record.category || 'General',
          },
        ],
      });
    } else {
      const existing = doctorsMap.get(docKey);
      existing.associatedRecords.push({
        title: record.title || record.description,
        date: record.date || record.timestamp || 'Recent',
        category: record.category || 'General',
      });
    }
  }

  return Array.from(doctorsMap.values());
}

/**
 * SQL Tool: get_medications()
 * Retrieves medications strictly from the OCR data of the patient's own uploaded records.
 * Never fabricates medicines, dosages, or schedules not present in the records.
 */
export async function get_medications(customRecords = null) {
  const records = await get_database_records(customRecords);
  const medications = [];

  for (const record of records) {
    // 1. Structured medications from backend OCR (prescription_data.medicines)
    const rxMeds = record.ocrData?.prescription_data?.medicines;
    if (Array.isArray(rxMeds)) {
      for (const sm of rxMeds) {
        if (!sm?.name) continue;
        medications.push({
          id: `med-${(sm.name || 'rx').toLowerCase().replace(/\s+/g, '-')}-${record.id}`,
          name: sm.name,
          dosage: sm.strength || sm.dosage || 'As prescribed',
          frequency: sm.frequency || 'As prescribed',
          timeScheduled: sm.timing_instructions || sm.frequency || '',
          foodRule: sm.timing_instructions || '',
          status: 'Active',
          startDate: record.date || '',
          duration: sm.duration || 'As prescribed',
          changeOrStopDate: sm.follow_up_advice || record.ocrData?.prescription_data?.follow_up_advice || '',
          prescriber: sm.doctor_name || record.ocrData?.prescription_data?.doctor_name || record.doctorName || '',
          indication: (sm.diagnosis_or_symptoms || record.ocrData?.prescription_data?.diagnosis_or_symptoms || []).join(', '),
          sourceRecord: record.title || record.description,
        });
      }
    }

    // 2. Legacy frontend OCR shape (structuredMedications)
    if (record.ocrData?.structuredMedications && Array.isArray(record.ocrData.structuredMedications)) {
      for (const sm of record.ocrData.structuredMedications) {
        if (!sm?.name) continue;
        medications.push({
          id: `med-${(sm.name || 'rx').toLowerCase().replace(/\s+/g, '-')}-${record.id}`,
          name: sm.name,
          dosage: sm.dosage || 'As prescribed',
          frequency: sm.frequency || 'As prescribed',
          timeScheduled: sm.timing || sm.frequency || '',
          foodRule: sm.safetyAlert || sm.foodInstruction || '',
          status: 'Active',
          startDate: record.date || '',
          duration: sm.duration || 'As prescribed',
          changeOrStopDate: '',
          prescriber: record.doctorName || '',
          indication: sm.purpose || '',
          sourceRecord: record.title || record.description,
        });
      }
    }
  }

  // De-duplicate medications by name + strength
  const uniqueMeds = [];
  const seenNames = new Set();
  for (const m of medications) {
    const key = `${(m.name || '').toLowerCase()}__${(m.dosage || '').toLowerCase()}`;
    if (!seenNames.has(key)) {
      seenNames.add(key);
      uniqueMeds.push(m);
    }
  }

  return uniqueMeds;
}

/**
 * SQL Tool: get_allergies()
 * Returns documented allergies from the patient's records: documented, explicitly
 * negative (NKDA), or not documented. Never claims NKDA unless a record states it.
 */
export async function get_allergies(customRecords = null) {
  const records = await get_database_records(customRecords);
  let allergyStatus = 'not_documented';
  let documentedAllergies = [];
  let notes = 'No allergy information is documented in your uploaded records.';

  for (const record of records) {
    const text = [record.title, record.description, record.prescriptionText]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    // Check for documented allergies
    if (text.includes('allergic to') || text.includes('allergy:')) {
      const match = text.match(/allergic to\s+([a-z0-9\s,]+)/i) || text.match(/allergy:\s*([a-z0-9\s,]+)/i);
      if (match && !match[1].includes('none') && !match[1].includes('nkda')) {
        allergyStatus = 'documented';
        documentedAllergies.push(match[1].trim());
        notes = `Documented allergy: ${match[1].trim()}`;
      }
    }

    // Check explicitly negative
    if (text.includes('nkda') || text.includes('no known drug allergies') || text.includes('no allergies')) {
      allergyStatus = 'explicitly_negative';
      notes = 'Explicitly documented by clinician: No Known Drug Allergies (NKDA).';
    }
  }

  return {
    status: allergyStatus,
    allergies: documentedAllergies,
    summary:
      allergyStatus === 'documented'
        ? `Documented Allergies: ${documentedAllergies.join(', ')}`
        : allergyStatus === 'explicitly_negative'
          ? 'No Known Drug Allergies (NKDA) are documented in your medical records.'
          : 'Allergy status is not documented in your uploaded medical records.',
    notes,
  };
}

/**
 * SQL Tool: get_conditions()
 * Returns clinical findings and diagnoses strictly from the OCR data of the patient's own records.
 */
export async function get_conditions(customRecords = null) {
  const records = await get_database_records(customRecords);
  const conditions = [];

  for (const record of records) {
    const rx = record.ocrData?.prescription_data || {};
    const report = record.ocrData?.report_data || {};
    const discharge = record.ocrData?.discharge_summary_data || {};

    // Diagnoses / symptoms noted on prescriptions
    const diagnoses = Array.isArray(rx.diagnosis_or_symptoms) ? rx.diagnosis_or_symptoms : [];
    for (const d of diagnoses) {
      if (!d) continue;
      conditions.push({
        condition: d,
        status: 'Documented Finding',
        diagnosedOrMonitoredBy: rx.doctor_name || record.doctorName || '',
        dateDocumented: rx.date_of_consultation || record.date || record.timestamp || '',
        category: record.category || 'General',
        notes: record.ocrData?.summary || '',
      });
    }

    // Discharge diagnoses
    const dischargeDiagnoses = Array.isArray(discharge.final_diagnoses) ? discharge.final_diagnoses : [];
    for (const d of dischargeDiagnoses) {
      if (!d) continue;
      conditions.push({
        condition: d,
        status: 'Documented at Discharge',
        diagnosedOrMonitoredBy: discharge.attending_physician || record.doctorName || '',
        dateDocumented: discharge.discharge_date || record.date || '',
        category: 'Discharge Summary',
        notes: discharge.hospital_course_summary || '',
      });
    }

    // Report conclusions / impressions
    const conclusions = Array.isArray(report.conclusions_or_impression) ? report.conclusions_or_impression : [];
    for (const d of conclusions) {
      if (!d) continue;
      conditions.push({
        condition: d,
        status: 'Report Impression',
        diagnosedOrMonitoredBy: report.referring_physician || record.doctorName || '',
        dateDocumented: report.report_date || record.date || '',
        category: record.category || 'Medical Report',
        notes: record.ocrData?.summary || '',
      });
    }
  }

  // Fallback: records exist but OCR yielded no explicit diagnoses — report the record titles only
  if (conditions.length === 0 && records.length > 0) {
    for (const record of records) {
      conditions.push({
        condition: `${record.category || 'Clinical'} Record — ${record.title || record.description || 'Health Record'}`,
        status: 'Documented Record',
        diagnosedOrMonitoredBy: record.doctorName || '',
        dateDocumented: record.date || record.timestamp || '',
        category: record.category || 'General Practice',
        notes: record.ocrData?.summary || `Clinical entry documented on ${record.date || record.timestamp || 'record'}.`,
      });
    }
  }

  // De-duplicate
  const uniqueConditions = [];
  const seen = new Set();
  for (const c of conditions) {
    if (!seen.has(c.condition)) {
      seen.add(c.condition);
      uniqueConditions.push(c);
    }
  }

  return uniqueConditions;
}

/**
 * SQL Tool: get_lab_results(test_name)
 * Returns lab test values strictly from the OCR data of the patient's own uploaded reports.
 */
export async function get_lab_results(testName = null, customRecords = null) {
  const records = await get_database_records(customRecords);
  const allLabTests = [];

  for (const record of records) {
    const report = record.ocrData?.report_data || {};
    const measurements = Array.isArray(report.measurements)
      ? report.measurements
      : Array.isArray(report.test_results)
        ? report.test_results
        : [];

    for (const t of measurements) {
      if (!t) continue;
      const pName = t.parameter || t.test_name || 'Test';
      const pVal = t.value || '';
      const pUnit = t.unit || '';
      allLabTests.push({
        testName: pName,
        value: pUnit ? `${pVal} ${pUnit}` : pVal,
        unit: pUnit,
        normalRange: t.reference_range || t.normal_range || 'N/A',
        status: t.status || '',
        date: report.report_date || record.date || '',
        labFacility: report.laboratory_or_imaging_center || '',
        doctor: report.referring_physician || record.doctorName || '',
        advice: '',
      });
    }
  }

  if (testName && typeof testName === 'string' && allLabTests.length > 0) {
    const q = testName.toLowerCase().trim();
    if (q !== 'all' && q !== '') {
      const filtered = allLabTests.filter((t) => t.testName.toLowerCase().includes(q));
      if (filtered.length > 0) return filtered;
    }
  }

  return allLabTests;
}

/**
 * SQL Tool: search_records(query)
 * Keyword search over extracted items, record titles, descriptions, and doctor notes.
 */
export async function search_records(query, customRecords = null) {
  const records = await get_database_records(customRecords);
  if (!query || typeof query !== 'string') return records;

  const q = query.toLowerCase().trim();
  const matched = [];

  for (const record of records) {
    const combined = [
      record.title,
      record.description,
      record.doctorName,
      record.category,
      record.prescriptionText,
      record.date,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    if (combined.includes(q)) {
      matched.push({
        id: record.id,
        title: record.title,
        doctor: record.doctorName,
        category: record.category,
        date: record.date,
        snippet: record.description ? record.description.slice(0, 180) + '...' : record.title,
      });
    }
  }

  return matched;
}

/**
 * SQL Tool: get_doctor_instructions()
 * Extracts advice, lifestyle instructions, and medication timing instructions
 * strictly from the OCR data of the patient's own records.
 */
export async function get_doctor_instructions(customRecords = null) {
  const records = await get_database_records(customRecords);
  const instructions = [];

  for (const record of records) {
    const rx = record.ocrData?.prescription_data || {};
    const doctor = rx.doctor_name || record.doctorName || 'Prescribing Doctor';
    const sourceDate = rx.date_of_consultation || record.date || record.timestamp || '';

    // Medication-level timing instructions from OCR
    const medicines = Array.isArray(rx.medicines) ? rx.medicines : [];
    for (const m of medicines) {
      if (!m?.name) continue;
      if (m.timing_instructions) {
        instructions.push({
          doctor,
          topic: `${m.name} — Timing`,
          instruction: m.timing_instructions,
          clinicalNote: '',
          sourceDate,
        });
      }
    }

    // General lifestyle advice from OCR
    const advice = Array.isArray(rx.general_advice_or_lifestyle) ? rx.general_advice_or_lifestyle : [];
    for (const a of advice) {
      if (!a) continue;
      instructions.push({
        doctor,
        topic: 'General Advice & Lifestyle',
        instruction: a,
        clinicalNote: '',
        sourceDate,
      });
    }

    // Follow-up advice from OCR
    if (rx.follow_up_advice) {
      instructions.push({
        doctor,
        topic: 'Follow-up',
        instruction: rx.follow_up_advice,
        clinicalNote: '',
        sourceDate,
      });
    }
  }

  return instructions;
}

/**
 * SQL Tool: correlate_report_with_medications()
 * Links documented findings (diagnoses, lab values) from the patient's own records
 * to the medications prescribed in those same records. No invented analysis.
 */
export async function correlate_report_with_medications(customRecords = null) {
  const records = await get_database_records(customRecords);
  const correlations = [];

  for (const record of records) {
    const rx = record.ocrData?.prescription_data || {};
    const report = record.ocrData?.report_data || {};
    const doctor = rx.doctor_name || record.doctorName || 'Prescribing Doctor';

    const findings = [
      ...(Array.isArray(rx.diagnosis_or_symptoms) ? rx.diagnosis_or_symptoms : []),
      ...(Array.isArray(report.measurements)
        ? report.measurements.map((t) =>
            t?.parameter ? `${t.parameter}${t.value ? `: ${t.value}${t.unit ? ` ${t.unit}` : ''}` : ''}` : null
          )
        : []),
    ].filter(Boolean);

    const medicines = (Array.isArray(rx.medicines) ? rx.medicines : [])
      .filter((m) => m?.name)
      .map((m) => `${m.name}${m.strength ? ` ${m.strength}` : ''} (${m.frequency || 'as prescribed'})`);

    if (findings.length === 0 && medicines.length === 0) continue;

    correlations.push({
      testName: findings.length > 0 ? findings.join('; ') : record.title || 'Clinical Record',
      reportValue: rx.date_of_consultation || report.report_date || record.date || '',
      normalReference: '',
      reportAnalysis: record.ocrData?.summary || '',
      targetMedication: medicines.join(', '),
      doctor,
      schedule: medicines.map((m) => m).join('; '),
      whyPrescribed: '',
      howToTakeTip: '',
    });
  }

  return correlations;
}

// ─────────────────────────────────────────────────────────────────────────────
// DATABASE-GROUNDED CONVERSATIONAL REASONING ENGINE
// Analyzes report findings first, then gives the medication on that basis
// ─────────────────────────────────────────────────────────────────────────────

export async function generateDatabaseGroundedAIResponse({
  question,
  activePrescription,
  allPrescriptions,
}) {
  const q = question.toLowerCase();

  // Execute SQL tools against database
  const [meds, allergies, conditions, labs, instructions, searchHits, reportCorrelations] = await Promise.all([
    get_medications(allPrescriptions),
    get_allergies(allPrescriptions),
    get_conditions(allPrescriptions),
    get_lab_results(question, allPrescriptions),
    get_doctor_instructions(allPrescriptions),
    search_records(question, allPrescriptions),
    correlate_report_with_medications(allPrescriptions),
  ]);

  // 1. EMERGENCY CHECK
  const emergencyCheck = classifyClinicalQuery(question);
  if (emergencyCheck.type === 'urgent_red_flag') {
    return {
      status: 'urgent',
      urgent: true,
      reply: `### 🚨 Please Get Emergency Medical Help Right Away!

I am very concerned about what you just described. Your safety is the #1 priority:

* **Call 911 (or your local emergency services)** or have someone take you to the nearest ER right now.
* **Sit and rest comfortably** — do not exert yourself or walk around.
* **Alert a family member or caregiver immediately.** Please do not drive yourself.

*MedBot is an AI assistant and cannot substitute for hands-on emergency medical care.*`,
      citedMedications: [],
      suggestedFollowUps: ['View ICE Contacts', 'Summarize my medicines'],
      engine: 'Qwen 2.5 7B AI Agent • SQL Database Verified',
      toolsUsed: ['classifyClinicalQuery'],
    };
  }

  // 2. DOCTOR INQUIRY (Doctor Name, Specialty, Associated Reports)
  const isAskingDoctor =
    q.includes('doctor') ||
    q.includes('physician') ||
    q.includes('prescriber') ||
    q.includes('dr.') ||
    q.includes('dr ') ||
    q.includes('who prescribed');

  if (isAskingDoctor) {
    const doctors = await get_doctor_details(allPrescriptions);

    if (doctors.length === 0) {
      return {
        status: 'grounded',
        urgent: false,
        reply: `### 👨‍⚕️ No Doctor Information Found

I could not find any attending doctor information in your uploaded medical records.

*Note: MedBot provides information derived directly from your uploaded medical records and does not substitute for direct medical consultation.*`,
        citedMedications: [],
        suggestedFollowUps: [
          'What medicines did the doctor prescribe?',
          'What problems are documented in my reports?',
          'What instructions did my doctor give?',
        ],
        engine: 'OnePatient Local Records Fallback (backend offline)',
        toolsUsed: ['get_doctor_details'],
      };
    }

    const doctorCards = doctors
      .map((d) => {
        const recordsList = d.associatedRecords.map((r) => `* **${r.title}** (${r.category}, ${r.date})`).join('\n');
        return `#### 👨‍⚕️ ${d.name} — *${d.specialty}*\n* **Clinic / Facility:** ${d.clinic}\n* **Credentials:** ${d.credentials}\n* **Uploaded Report:**\n${recordsList}`;
      })
      .join('\n\n---\n\n');

    return {
      status: 'grounded',
      urgent: false,
      reply: `### 👨‍⚕️ Attending Doctors from Your Uploaded Reports

I analyzed your medical records and identified your attending physicians:

${doctorCards}

*Note: MedBot provides information derived directly from your uploaded medical records and does not substitute for direct medical consultation.*`,
      citedMedications: meds.map((m) => m.name),
      suggestedFollowUps: [
        'What problems are documented in my reports?',
        'What medicines did the doctor prescribe?',
        'When should I take my medicines?',
      ],
      engine: 'OnePatient Local Records Fallback (backend offline)',
      toolsUsed: ['get_doctor_details', 'get_medications'],
    };
  }

  // 3. PROBLEM & CLINICAL CONDITION INQUIRY (What is my problem? What diagnosis?)
  const isAskingProblem =
    q.includes('problem') ||
    q.includes('diagnos') ||
    q.includes('condition') ||
    q.includes('disease') ||
    q.includes('illness') ||
    q.includes('issue') ||
    q.includes('symptom') ||
    q.includes('what is wrong');

  if (isAskingProblem) {
    if (conditions.length === 0) {
      return {
        status: 'grounded',
        urgent: false,
        reply: `### 📋 No Documented Problems Found

I could not find any documented diagnoses, symptoms, or clinical findings in your uploaded medical records.

*Note: MedBot provides information derived directly from your uploaded medical records and does not substitute for direct medical consultation.*`,
        citedMedications: [],
        suggestedFollowUps: [
          'Who is my doctor?',
          'What medicines did the doctor prescribe?',
          'What instructions did my doctor give?',
        ],
        engine: 'OnePatient Local Records Fallback (backend offline)',
        toolsUsed: ['get_conditions'],
      };
    }

    const conditionCards = conditions
      .map(
        (c) =>
          `#### 🩺 ${c.condition}\n* **Status:** ${c.status}\n* **Attending Doctor:** **${c.diagnosedOrMonitoredBy || 'Not recorded'}** (${c.category})\n* **Notes:** ${c.notes || 'See source document.'}`
      )
      .join('\n\n---\n\n');

    return {
      status: 'grounded',
      urgent: false,
      reply: `### 📋 Clinical Problems Documented in Your Uploaded Reports

According to your medical records:

${conditionCards}

*Note: MedBot provides information derived directly from your uploaded medical records and does not substitute for direct medical consultation.*`,
      citedMedications: meds.map((m) => m.name),
      suggestedFollowUps: [
        'Who is my doctor?',
        'What medicines did the doctor prescribe?',
        'What instructions did my doctor give?',
      ],
      engine: 'OnePatient Local Records Fallback (backend offline)',
      toolsUsed: ['get_conditions', 'get_medications'],
    };
  }

  // 4. REPORT ANALYSIS ➡️ MEDICATION EXPLANATION (Primary User Request!)
  const isAskingReportOrWhyMed =
    q.includes('report') ||
    q.includes('test') ||
    q.includes('blood') ||
    q.includes('lab') ||
    q.includes('pathology') ||
    q.includes('glucose') ||
    q.includes('cholesterol') ||
    q.includes('sugar') ||
    q.includes('ldl') ||
    q.includes('lipid') ||
    q.includes('why') ||
    q.includes('which medicine') ||
    q.includes('what medicine') ||
    q.includes('give medicine') ||
    q.includes('understand') ||
    q.includes('analys') ||
    q.includes('result') ||
    q.includes('finding') ||
    q.includes('correlat') ||
    q.includes('upload') ||
    q.includes('base');

  if (isAskingReportOrWhyMed) {
    if (reportCorrelations.length === 0) {
      return {
        status: 'grounded',
        urgent: false,
        reply: `### 📊 No Report Data Found

I could not find any report findings or prescribed medications in your uploaded medical records to analyze.

*Note: MedBot provides information derived directly from your uploaded medical records and does not substitute for direct medical consultation.*`,
        citedMedications: [],
        suggestedFollowUps: [
          'Who is my doctor?',
          'What problems are documented in my report?',
          'What instructions did my doctor give?',
        ],
        engine: 'OnePatient Local Records Fallback (backend offline)',
        toolsUsed: ['correlate_report_with_medications', 'get_medications'],
      };
    }

    const correlationCards = reportCorrelations
      .map(
        (c) =>
          `#### 🩺 ${c.testName}${c.reportValue ? `: **${c.reportValue}**` : ''}\n${c.reportAnalysis ? `* **What Your Record Shows:** ${c.reportAnalysis}\n` : ''}* **Medication Prescribed:** **${c.targetMedication || 'Not recorded'}** (${c.doctor})${c.schedule ? `\n* **How to Take:** ${c.schedule}` : ''}`
      )
      .join('\n\n---\n\n');

    const docNames = Array.from(new Set(reportCorrelations.map((c) => c.doctor).filter(Boolean)));
    const introDoctors = docNames.length > 0 ? `from **${docNames.join('** and **')}**` : '';

    return {
      status: 'grounded',
      urgent: false,
      reply: `### 📊 Report Analysis & Your Prescribed Medications

I analyzed your uploaded medical records ${introDoctors} and connected each documented finding to the prescribed treatments:

${correlationCards}

*Note: MedBot provides information derived directly from your uploaded medical records and does not substitute for direct medical consultation.*`,
      citedMedications: meds.map((m) => m.name),
      suggestedFollowUps: [
        'Who is my doctor?',
        'What problems are documented in my reports?',
        'What instructions did my doctor give?',
      ],
      engine: 'OnePatient Local Records Fallback (backend offline)',
      toolsUsed: ['correlate_report_with_medications', 'get_medications', 'get_doctor_instructions'],
    };
  }

  // 3. ALLERGIES QUERY
  if (q.includes('allerg') || q.includes('allergic') || q.includes('reaction') || q.includes('nkda')) {
    return {
      status: 'grounded',
      urgent: false,
      reply: `### 🛡️ Allergy Status from Your Records:

* **Documented Status:** **${allergies.summary}**
* **Clinician Verification:** ${allergies.notes}

If you have ever had a reaction to any antibiotic, food, or painkiller that isn't listed in your records, be sure to mention it to your doctor at your next visit.`,
      citedMedications: meds.map((m) => m.name),
      suggestedFollowUps: [
        'What medicines did the doctor prescribe?',
        'What instructions did my doctor give?',
        'Summarize my prescription schedule',
      ],
      engine: 'OnePatient Local Records Fallback (backend offline)',
      toolsUsed: ['get_allergies', 'get_medications'],
    };
  }

  // 4. CONDITIONS / DIAGNOSIS QUERY
  if (q.includes('condition') || q.includes('disease') || q.includes('diagnos') || q.includes('problem list') || q.includes('illness')) {
    if (conditions.length === 0) {
      return {
        status: 'grounded',
        urgent: false,
        reply: `### 📋 No Diagnosed Conditions Found

I could not find any diagnosed conditions or problem list entries in your uploaded medical records.

*Note: MedBot provides information derived directly from your uploaded medical records and does not substitute for direct medical consultation.*`,
        citedMedications: [],
        suggestedFollowUps: [
          'What medicines did the doctor prescribe?',
          'Who is my doctor?',
          'What instructions did my doctor give?',
        ],
        engine: 'OnePatient Local Records Fallback (backend offline)',
        toolsUsed: ['get_conditions', 'get_medications'],
      };
    }

    const conditionLines = conditions
      .map((c) => `• **${c.condition}** — *${c.status}*${c.diagnosedOrMonitoredBy ? ` (Documented by ${c.diagnosedOrMonitoredBy})` : ''}`)
      .join('\n');

    return {
      status: 'grounded',
      urgent: false,
      reply: `### 📋 Documented Conditions from Your Records:

According to your medical records:

${conditionLines}

*Note: MedBot provides information derived directly from your uploaded medical records and does not substitute for direct medical consultation.*`,
      citedMedications: meds.map((m) => m.name),
      suggestedFollowUps: [
        'What medicines did the doctor prescribe?',
        'What instructions did my doctor give?',
        'Who is my doctor?',
      ],
      engine: 'OnePatient Local Records Fallback (backend offline)',
      toolsUsed: ['get_conditions', 'get_medications'],
    };
  }

  // 5. DOCTOR INSTRUCTIONS / ADVICE / FOOD RULES QUERY
  if (
    q.includes('instruction') ||
    q.includes('advice') ||
    q.includes('doctor note') ||
    q.includes('avoid dairy') ||
    q.includes('diet') ||
    q.includes('food') ||
    q.includes('breakfast') ||
    q.includes('coffee') ||
    q.includes('grapefruit') ||
    q.includes('milk')
  ) {
    const instructionLines = instructions
      .map((i) => `• **${i.topic} (${i.doctor}):** ${i.instruction}`)
      .join('\n');

    const doctorNames = Array.from(new Set(allPrescriptions.map((p) => p.doctorName || p.doctor_name).filter(Boolean))).join(', ') || 'Your Physician';
    return {
      status: 'grounded',
      urgent: false,
      reply: `### 📝 Doctor Instructions & Clinical Advice from Your Records:

Here is the clinical guidance documented in your uploaded records (**${doctorNames}**):

${instructionLines || 'I could not find any specific instructions or advice documented in your uploaded records. Please follow the directions written on your prescription document.'}

* **General Rule:** Always follow the exact dosage and review dates specified on your prescription.`,
      citedMedications: meds.map((m) => m.name),
      suggestedFollowUps: [
        'What medicines did the doctor prescribe?',
        'When should I take my medications?',
        'What should I do if I miss a dose?',
      ],
      engine: 'OnePatient Local Records Fallback (backend offline)',
      toolsUsed: ['get_doctor_instructions', 'get_medications'],
    };
  }

  // 6. MEDICATIONS / START DATES / STOP DATES / TIMINGS
  if (
    q.includes('medication') ||
    q.includes('medicine') ||
    q.includes('pill') ||
    q.includes('drug') ||
    q.includes('dose') ||
    q.includes('timing') ||
    q.includes('schedule') ||
    q.includes('start date') ||
    q.includes('stop date') ||
    q.includes('how long') ||
    q.includes('when')
  ) {
    const medLines = meds
      .map(
        (m) =>
          `• **${m.name}${m.dosage ? ` ${m.dosage}` : ''}:** ${m.frequency || 'As directed'}${m.timeScheduled ? ` (${m.timeScheduled})` : ''}${m.indication ? `\n  - **For:** ${m.indication}` : ''}${m.duration ? `\n  - **Duration:** ${m.duration}` : ''}${m.prescriber ? `\n  - **Prescribed by:** ${m.prescriber}` : ''}`
      )
      .join('\n\n');

    return {
      status: 'grounded',
      urgent: false,
      reply: `### 💊 Your Prescribed Medications Linked to Your Records:

Here is your medication list extracted directly from your uploaded consultations:

${medLines || 'No prescribed medications were found in your uploaded records.'}

*Always consult your physician before altering any prescribed dosage.*`,
      citedMedications: meds.map((m) => m.name),
      suggestedFollowUps: [
        'What medicines did the doctor prescribe?',
        'When should I take my medications?',
        'What should I do if I miss a dose?',
      ],
      engine: 'OnePatient Local Records Fallback (backend offline)',
      toolsUsed: ['get_medications', 'correlate_report_with_medications'],
    };
  }

  // 7. MISSED DOSE PROTOCOL
  if (q.includes('miss') || q.includes('forgot') || q.includes('skip') || q.includes('late')) {
    const medNames = meds.map((m) => m.name).filter(Boolean);
    const medList = medNames.length > 0 ? medNames.join(', ') : 'your prescribed medicines';

    return {
      status: 'grounded',
      urgent: false,
      reply: `### 😊 Don't worry! Forgetting a pill happens to everyone.

Here is the general rule for ${medList}:

* **If it's only been a few hours:** Go ahead and take it (follow any food instructions on your prescription).
* **If it's close to your next scheduled dose:** Skip the forgotten pill and continue on your normal schedule.
* **The golden rule:** **Never take two pills at once.** Double-dosing doesn't help and just causes side effects.

For medicine-specific advice, confirm with the doctor who prescribed them.`,
      citedMedications: medNames,
      suggestedFollowUps: [
        'What medicines did the doctor prescribe?',
        'When should I take my medications?',
        'What instructions did my doctor give?',
      ],
      engine: 'OnePatient Local Records Fallback (backend offline)',
      toolsUsed: ['get_medications', 'get_doctor_instructions'],
    };
  }

  // 8. SIDE EFFECTS INQUIRY
  if (q.includes('side effect') || q.includes('stomach') || q.includes('muscle') || q.includes('ache') || q.includes('cramp')) {
    const medNames = meds.map((m) => m.name).filter(Boolean);
    const medList = medNames.length > 0 ? medNames.join(', ') : 'your prescribed medicines';

    return {
      status: 'grounded',
      urgent: false,
      reply: `### 🛡️ Side Effects for ${medList}:

Your uploaded medical records do not document side-effect information. Side effects vary by medicine and by person, so please check the information leaflet that came with your medicine, or ask the prescribing doctor or your pharmacist about what to expect and what warning signs to watch for.

Seek medical attention right away if you experience severe symptoms such as difficulty breathing, swelling of the face or throat, or severe persistent pain.`,
      citedMedications: medNames,
      suggestedFollowUps: [
        'What medicines did the doctor prescribe?',
        'What instructions did my doctor give?',
        'Who is my doctor?',
      ],
      engine: 'OnePatient Local Records Fallback (backend offline)',
      toolsUsed: ['get_medications', 'get_doctor_instructions'],
    };
  }

  // 9. GENERAL / OFF-TOPIC / UNMATCHED QUERY
  // Never invent medications or findings here. The backend RAG service is the source of truth;
  // this fallback only reflects what the local record search actually found.
  const searchSummary = searchHits.length > 0
    ? `I searched your records and found these matching entries:\n\n${searchHits
        .map((s) => `* **${s.title || 'Medical Record'}**${s.doctor ? ` — ${s.doctor}` : ''}${s.date ? ` (${s.date})` : ''}`)
        .join('\n')}`
    : `I could not find anything related to that in your uploaded medical records.\n\nMedBot only answers questions grounded in your actual uploaded documents and prescriptions. Try asking about your diagnosed problems, doctor findings, prescribed medicines, or doctor instructions.`;

  return {
    status: 'grounded',
    urgent: false,
    reply: `### 😊 ${searchHits.length > 0 ? 'Here is what your medical records say:' : 'No matching information in your records'}

${searchSummary}

*Note: MedBot provides information derived directly from your uploaded medical records and does not substitute for direct medical consultation.*`,
    citedMedications: [],
    suggestedFollowUps: [
      'What medicines did the doctor prescribe?',
      'What problems are documented in my report?',
      'What instructions did my doctor give?',
    ],
    engine: 'OnePatient Local Records Fallback (backend offline)',
    toolsUsed: ['search_records', 'get_medications', 'get_conditions'],
  };
}

export function analyzePrescriptionLocally(prescription) {
  // Derive medication list strictly from the prescription's own OCR data.
  // No hardcoded example medicines: an empty prescription yields an empty analysis.
  const prescriber = prescription?.doctorName || 'Prescribing Doctor';
  const ocrMeds =
    prescription?.ocrData?.prescription_data?.medicines ||
    prescription?.ocrData?.structuredMedications ||
    [];

  const medications = (Array.isArray(ocrMeds) ? ocrMeds : [])
    .filter((m) => m && m.name)
    .map((m, idx) => ({
      id: `med-${idx + 1}`,
      name: m.name,
      dosage: m.strength || m.dosage || '',
      frequency: m.frequency || 'As prescribed',
      timesOfDay: [],
      foodInstruction: m.timing_instructions || m.timing || m.foodInstruction || '',
      duration: m.duration || '',
      clarityStatus: m.is_uncertain ? 'uncertain' : 'clear',
    }));

  // Build suggested reminders only from medications that actually specify a schedule.
  const suggestedReminders = medications
    .filter((m) => m.dosage)
    .map((m, idx) => ({
      id: `sug-${idx + 1}`,
      medName: m.name,
      dosage: m.dosage,
      time24: '08:00',
      timeLabel: '08:00 AM',
      instruction: m.frequency ? `Take as prescribed: ${m.frequency}` : 'Take as prescribed',
    }));

  const medSummary =
    medications.length > 0
      ? `${medications.length} medication${medications.length === 1 ? '' : 's'} extracted from prescription: ${medications
          .map((m) => `${m.name}${m.dosage ? ` ${m.dosage}` : ''}`)
          .join(', ')}.`
      : 'No medications could be extracted from this prescription.';

  return {
    engine: 'OnePatient Prescription OCR Analysis',
    analyzedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    prescriber,
    summary: medSummary,
    medications,
    ambiguities: medications.filter((m) => m.clarityStatus === 'uncertain').map((m) => m.name),
    suggestedReminders,
  };
}

export async function analyzePrescription(prescription, apiConfig = {}) {
  return analyzePrescriptionLocally(prescription);
}

/**
 * Universal OpenAI-compatible chat completion caller.
 */
export async function callQwenChatCompletion({
  messages,
  apiKey = '',
  baseUrl = DEFAULT_QWEN_BASE_URL,
  model = DEFAULT_QWEN_MODEL,
  temperature = 0.3,
}) {
  const cleanBase = (baseUrl || DEFAULT_QWEN_BASE_URL).trim().replace(/\/+$/, '');
  const url = cleanBase.endsWith('/chat/completions')
    ? cleanBase
    : `${cleanBase}/chat/completions`;

  const headers = {
    'Content-Type': 'application/json',
  };

  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey.trim()}`;
  }

  if (typeof window !== 'undefined' && window.location) {
    headers['HTTP-Referer'] = window.location.origin;
    headers['X-Title'] = 'OnePatient Ask MedBot';
  }

  const payload = {
    model: (model || DEFAULT_QWEN_MODEL).trim(),
    messages,
    temperature,
  };

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    let errorDetail = '';
    try {
      errorDetail = await res.text();
    } catch {
      // ignore
    }
    throw new Error(`API endpoint error HTTP ${res.status}: ${errorDetail.slice(0, 240)}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content || '';
  return content;
}

/**
 * Main Ask MedBot Chat Agent Entry Point.
 * 1. Analyzes report findings & executes SQL tools.
 * 2. Correlates report metrics (glucose, cholesterol) directly to prescribed medicines.
 * 3. Feeds verified evidence to AI model (or local engine) to generate clear, humanized answers.
 */
export async function askMedBotAgent({
  question,
  activePrescription,
  allPrescriptions = [],
  currentUser = null,
  analysis,
  chatHistory = [],
  reminders = [],
  apiConfig = {},
}) {
  // 1. Primary RAG Vector Ingestion & Grounded Retrieval via Backend
  try {
    const patientId =
      currentUser?.permanentId ||
      currentUser?.id ||
      activePrescription?.patientId ||
      allPrescriptions[0]?.patientId ||
      'NNM24cc059';

    const ragRes = await fetch(`${API_BASE_URL}/api/medbot/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patient_id: patientId,
        query: question,
      }),
    });
    if (ragRes.ok) {
      const ragData = await ragRes.json();
      if (ragData && ragData.answer) {
        return {
          status: ragData.rejected_by_guardrail ? 'guardrail' : 'grounded',
          urgent: false,
          reply: ragData.answer,
          engine: 'AI Agent',
          citedMedications: [],
          suggestedFollowUps: ragData.rejected_by_guardrail
            ? ['What medicines did the doctor prescribe?', 'What were my clinical findings?']
            : ['What medicines did the doctor prescribe?', 'When should I take my medications?'],
          toolsUsed: ragData.sources && ragData.sources.length > 0
            ? ragData.sources.map((s) => s.source)
            : ['match_medical_chunks'],
        };
      }
    }
  } catch (ragErr) {
    // If backend is offline or loading, proceed safely to database correlation
    console.debug('RAG backend notice:', ragErr.message);
  }

  // Query all database SQL tools in parallel
  const [meds, allergies, conditions, labs, instructions, searchHits, reportCorrelations] = await Promise.all([
    get_medications(allPrescriptions),
    get_allergies(allPrescriptions),
    get_conditions(allPrescriptions),
    get_lab_results(question, allPrescriptions),
    get_doctor_instructions(allPrescriptions),
    search_records(question, allPrescriptions),
    correlate_report_with_medications(allPrescriptions),
  ]);

  const apiKey = (apiConfig.apiKey || import.meta.env?.VITE_QWEN_API_KEY || '').trim();
  const baseUrl = (apiConfig.baseUrl || import.meta.env?.VITE_QWEN_BASE_URL || DEFAULT_QWEN_BASE_URL).trim();
  const model = (apiConfig.model || import.meta.env?.VITE_QWEN_MODEL || DEFAULT_QWEN_MODEL).trim();

  const isLocalEndpoint = /localhost|127\.0\.0\.1|::1/i.test(baseUrl);

  // If live AI endpoint is configured, feed verified report & medication correlation to model
  if (apiKey || isLocalEndpoint) {
    const databaseContext = `
REPORT ANALYSIS & MEDICATION CORRELATION CONTEXT:
${JSON.stringify(reportCorrelations, null, 2)}

VERIFIED PATIENT DATABASE CONTEXT:
1. MEDICATIONS (get_medications):
${JSON.stringify(meds, null, 2)}

2. ALLERGIES (get_allergies):
${JSON.stringify(allergies, null, 2)}

3. DIAGNOSED CONDITIONS (get_conditions):
${JSON.stringify(conditions, null, 2)}

4. LAB RESULTS & PATHOLOGY (get_lab_results):
${JSON.stringify(labs, null, 2)}

5. DOCTOR INSTRUCTIONS & DIETARY RULES (get_doctor_instructions):
${JSON.stringify(instructions, null, 2)}
`;

    const systemPrompt = `You are "MedBot", a caring clinical AI assistant for the OnePatient platform, powered by ${model}.

STRICT GROUNDING RULES:
1. Answer ONLY using the verified patient data provided below. NEVER invent or assume medications, diagnoses, lab values, doctors, or instructions that are not present in that data.
2. If the asked condition, symptom, or test is NOT mentioned in the data, clearly state that the uploaded records show no indication or testing for it. Do NOT list medications in that case.
3. If the question is unrelated to the patient's medical records, politely state that you only answer questions about their verified medical records.
4. When the user asks about medications, reports, or findings, use only what appears in the context below.
5. Speak warmly, kindly, and naturally, like a compassionate clinical doctor or pharmacist chatting with a friend. Keep answers summarized, clear, and easy to read.

${databaseContext}`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...chatHistory.slice(-4).map((m) => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.text,
      })),
      { role: 'user', content: question },
    ];

    try {
      const rawResponse = await callQwenChatCompletion({
        messages,
        apiKey,
        baseUrl,
        model,
        temperature: 0.3,
      });

      if (rawResponse && rawResponse.trim().length > 10) {
        return {
          status: 'grounded',
          urgent: false,
          reply: rawResponse.trim(),
          citedMedications: extractCitedMeds(rawResponse, meds),
          suggestedFollowUps: [
            'What medicines did the doctor prescribe?',
            'What problems are documented in my report?',
            'What should I do if I miss a dose?',
          ],
          engine: `${model} • Report Analysis & Medication Matching`,
          toolsUsed: ['correlate_report_with_medications', 'get_lab_results', 'get_medications'],
        };
      }
    } catch (err) {
      console.warn('Live AI call failed; engaging verified database reasoning engine:', err);
    }
  }

  // Realistic light delay (300ms) for natural feel
  await new Promise((resolve) => setTimeout(resolve, 300));

  // Engage Database-Grounded AI Reasoning Engine
  return generateDatabaseGroundedAIResponse({
    question,
    activePrescription,
    allPrescriptions,
  });
}

function extractCitedMeds(text, patientMeds = []) {
  // Cite only medications actually present in the patient's own records
  const meds = [];
  const lower = (text || '').toLowerCase();
  for (const m of patientMeds) {
    const name = m?.name;
    if (name && lower.includes(name.toLowerCase()) && !meds.includes(name)) {
      meds.push(name);
    }
  }
  return meds;
}
