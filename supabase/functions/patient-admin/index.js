import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const hospitalRoles = new Set([
  'hospitaladmin',
  'consulting',
  'nurse',
  'labs',
  'pharmacy',
  'reception',
]);
const receptionOnlyActions = new Set(['create', 'update', 'delete', 'check_in']);
const vitalsReadRoles = new Set([
  'hospitaladmin',
  'consulting',
  'nurse',
  'labs',
  'pharmacy',
  'reception',
]);
const patientFields = [
  'id',
  'hospital_id',
  'full_name',
  'patient_number',
  'phone',
  'date_of_birth',
  'age_at_registration',
  'sex',
  'residence',
  'address',
  'parent_name',
  'parent_phone',
  'emergency_contact_name',
  'emergency_contact_phone',
  'insurance_enabled',
  'insurance_type',
  'insurance_provider',
  'insurance_number',
  'insurance_expiry',
  'checked_in_at',
  'checked_in_insured',
  'checked_in_insurance_provider',
  'checked_in_insurance_number',
  'created_at',
  'updated_at',
];

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function respond(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function text(value, label, maxLength, { optional = false } = {}) {
  if (optional && (value === undefined || value === null || value === '')) {
    return '';
  }
  if (typeof value !== 'string') {
    throw new HttpError(400, `${label} is required.`);
  }
  const result = value.trim();
  if (!result && optional) return '';
  if (!result || result.length > maxLength) {
    throw new HttpError(400, `${label} must be between 1 and ${maxLength} characters.`);
  }
  return result;
}

function validDate(value, label, { optional = false } = {}) {
  if (optional && (value === null || value === undefined || value === '')) {
    return null;
  }
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new HttpError(400, `${label} must be a valid date.`);
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new HttpError(400, `${label} must be a valid date.`);
  }
  return value;
}

function patientPayload(payload) {
  const fullName = text(payload.full_name, 'Patient name', 160);
  const sex = payload.sex;
  if (sex !== 'male' && sex !== 'female') {
    throw new HttpError(400, 'Choose male or female.');
  }

  const dateOfBirth = validDate(payload.date_of_birth, 'Date of birth', { optional: true });
  let age = null;
  if (!dateOfBirth) {
    const parsedAge = Number(payload.age_at_registration);
    if (!Number.isInteger(parsedAge) || parsedAge < 0 || parsedAge > 130) {
      throw new HttpError(400, 'Enter an age between 0 and 130, or enter a date of birth.');
    }
    age = parsedAge;
  } else if (dateOfBirth > new Date().toISOString().slice(0, 10)) {
    throw new HttpError(400, 'Date of birth cannot be in the future.');
  }

  const insuranceEnabled = payload.insurance_enabled === true;
  let insurance = {
    insurance_enabled: false,
    insurance_type: null,
    insurance_provider: null,
    insurance_number: null,
    insurance_expiry: null,
  };
  if (insuranceEnabled) {
    const type = payload.insurance_type;
    if (type !== 'nhis' && type !== 'other') {
      throw new HttpError(400, 'Choose NHIS or another insurance provider.');
    }
    const provider = type === 'nhis'
      ? 'NHIS'
      : text(payload.insurance_provider, 'Insurance provider', 120);
    insurance = {
      insurance_enabled: true,
      insurance_type: type,
      insurance_provider: provider,
      insurance_number: text(payload.insurance_number, 'Insurance number', 120),
      insurance_expiry: validDate(payload.insurance_expiry, 'Insurance expiry date'),
    };
  }

  return {
    full_name: fullName,
    ...(Object.prototype.hasOwnProperty.call(payload, 'patient_number') ? { patient_number: text(payload.patient_number, 'Patient number', 40, { optional: true }) || null } : {}),
    ...(Object.prototype.hasOwnProperty.call(payload, 'phone') ? { phone: text(payload.phone, 'Phone number', 40, { optional: true }) || null } : {}),
    date_of_birth: dateOfBirth,
    age_at_registration: age,
    sex,
    residence: text(payload.residence, 'Residence', 180, { optional: true }),
    address: text(payload.address, 'Address', 500, { optional: true }),
    parent_name: text(payload.parent_name, 'Parent or guardian name', 160, { optional: true }),
    parent_phone: text(payload.parent_phone, 'Parent or guardian number', 40, { optional: true }),
    emergency_contact_name: text(payload.emergency_contact_name, 'Emergency contact name', 160, { optional: true }),
    emergency_contact_phone: text(payload.emergency_contact_phone, 'Emergency contact number', 40, { optional: true }),
    ...insurance,
  };
}

function vitalsPayload(payload) {
  const integer = (value, name, min, max, optional = false) => {
    if (optional && (value === null || value === undefined || value === '')) return null;
    const number = Number(value);
    if (!Number.isInteger(number) || number < min || number > max) {
      throw new HttpError(400, `${name} must be between ${min} and ${max}.`);
    }
    return number;
  };
  const decimal = (value, name, min, max) => {
    if (value === null || value === undefined || value === '') return null;
    const number = Number(value);
    if (!Number.isFinite(number) || number < min || number > max) {
      throw new HttpError(400, `${name} must be between ${min} and ${max}.`);
    }
    return Math.round(number * 100) / 100;
  };
  const values = {
    systolic_blood_pressure: integer(payload.systolic_blood_pressure, 'Systolic blood pressure', 40, 300),
    diastolic_blood_pressure: integer(payload.diastolic_blood_pressure, 'Diastolic blood pressure', 20, 200),
    pulse_rate: integer(payload.pulse_rate, 'Pulse rate', 20, 250),
    temperature_c: decimal(payload.temperature_c, 'Temperature', 25, 45),
    respiratory_rate: integer(payload.respiratory_rate, 'Respiratory rate', 4, 80),
    oxygen_saturation: integer(payload.oxygen_saturation, 'Oxygen saturation', 50, 100),
    weight_kg: decimal(payload.weight_kg, 'Weight', 0.2, 500),
    height_cm: decimal(payload.height_cm, 'Height', 20, 280),
    notes: payload.notes === undefined || payload.notes === null ? '' : payload.notes,
  };
  if (values.systolic_blood_pressure <= values.diastolic_blood_pressure) {
    throw new HttpError(400, 'Systolic blood pressure must be higher than diastolic blood pressure.');
  }
  if (typeof values.notes !== 'string' || values.notes.length > 1000) {
    throw new HttpError(400, 'Notes must be 1000 characters or fewer.');
  }
  return values;
}

async function getPatient(client, patientId, hospitalId, role) {
  if (typeof patientId !== 'string' || !patientId) {
    throw new HttpError(400, 'Patient ID is required.');
  }
  let query = client.from('patients').select(patientFields.join(','))
    .eq('id', patientId).eq('hospital_id', hospitalId);
  if (role !== 'reception') query = query.not('checked_in_at', 'is', null);
  const { data, error } = await query.maybeSingle();
  if (error) throw new HttpError(500, `Could not load patient: ${error.message}`);
  if (!data) throw new HttpError(404, 'Patient was not found or has not been checked in.');
  return data;
}

async function listPatients(client, hospitalId, role) {
  let query = client.from('patients').select(patientFields.join(','))
    .eq('hospital_id', hospitalId).order('created_at', { ascending: false }).limit(500);
  if (role !== 'reception') query = query.not('checked_in_at', 'is', null);
  const { data, error } = await query;
  if (error) throw new HttpError(500, `Could not load patients: ${error.message}`);
  return { patients: data || [] };
}

async function createPatient(client, hospitalId, userId, payload) {
  const values = patientPayload(payload);
  const { data, error } = await client.from('patients')
    .insert({ ...values, hospital_id: hospitalId, created_by: userId })
    .select(patientFields.join(',')).single();
  if (error) throw new HttpError(500, `Could not register patient: ${error.message}`);
  return { patient: data };
}

async function updatePatient(client, hospitalId, patientId, payload) {
  const values = patientPayload(payload);
  const { data, error } = await client.from('patients')
    .update(values).eq('id', patientId).eq('hospital_id', hospitalId)
    .select(patientFields.join(',')).maybeSingle();
  if (error) throw new HttpError(500, `Could not update patient: ${error.message}`);
  if (!data) throw new HttpError(404, 'Patient not found.');
  return { patient: data };
}

async function checkInPatient(client, hospitalId, userId, patientId) {
  if (typeof patientId !== 'string' || !patientId) {
    throw new HttpError(400, 'Patient ID is required.');
  }
  const { data, error } = await client.rpc('check_in_patient', {
    p_hospital_id: hospitalId,
    p_user_id: userId,
    p_patient_id: patientId,
  });
  if (error) {
    const message = error.message || 'Could not check in patient.';
    const status = /not found/i.test(message) ? 404 : 500;
    throw new HttpError(status, `Could not check in patient: ${message}`);
  }
  return data;
}

function validFilterDate(value, label) {
  if (value === undefined || value === null || value === '') return null;
  return validDate(value, label);
}

function validFilterTimestamp(value, label) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') {
    throw new HttpError(400, `${label} must be a valid UTC timestamp.`);
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()) || !value.endsWith('Z') || parsed.toISOString() !== value) {
    throw new HttpError(400, `${label} must be a valid UTC timestamp.`);
  }
  return value;
}

async function listVitals(client, hospitalId, actorRole, payload) {
  const patientId = payload.patient_id;
  let query = client.from('patient_vitals')
    .select('id, patient_id, hospital_id, recorded_by, systolic_blood_pressure, diastolic_blood_pressure, pulse_rate, temperature_c, respiratory_rate, oxygen_saturation, weight_kg, height_cm, notes, recorded_at, created_at')
    .eq('hospital_id', hospitalId)
    .order('recorded_at', { ascending: false })
    .limit(500);

  if (patientId !== undefined) {
    if (typeof patientId !== 'string' || !patientId) {
      throw new HttpError(400, 'Patient ID must be a valid identifier.');
    }
    const patient = await getPatient(client, patientId, hospitalId, actorRole);
    query = query.eq('patient_id', patient.id).limit(250);
  }

  const from = validFilterDate(payload.from, 'Start date');
  const to = validFilterDate(payload.to, 'End date');
  if (from && to && from > to) {
    throw new HttpError(400, 'Start date must not be after the end date.');
  }
  const fromAt = validFilterTimestamp(payload.from_at, 'Start timestamp');
  const toBefore = validFilterTimestamp(payload.to_before, 'End timestamp');
  if (fromAt && toBefore && fromAt >= toBefore) {
    throw new HttpError(400, 'Start timestamp must be before the end timestamp.');
  }
  if (fromAt) query = query.gte('recorded_at', fromAt);
  else if (from) query = query.gte('recorded_at', `${from}T00:00:00.000Z`);
  if (toBefore) query = query.lt('recorded_at', toBefore);
  else if (to) query = query.lt('recorded_at', `${addDays(to, 1)}T00:00:00.000Z`);

  const { data, error } = await query;
  if (error) throw new HttpError(500, `Could not load vitals history: ${error.message}`);
  const records = data || [];
  if (!records.length) return { vitals: [] };

  const patientIds = [...new Set(records.map((record) => record.patient_id))];
  const { data: patients, error: patientsError } = await client.from('patients')
    .select('id, full_name, date_of_birth, age_at_registration, sex, residence, address, insurance_enabled, insurance_provider, insurance_expiry, checked_in_at, checked_in_insured')
    .eq('hospital_id', hospitalId)
    .in('id', patientIds);
  if (patientsError) throw new HttpError(500, `Could not load patient details for vitals: ${patientsError.message}`);
  const patientsById = new Map((patients || []).map((patient) => [patient.id, patient]));
  return {
    vitals: records
      .filter((record) => patientsById.has(record.patient_id))
      .map((record) => ({ ...record, patient: patientsById.get(record.patient_id) })),
  };
}

async function createVitals(client, hospitalId, userId, actorRole, payload) {
  if (actorRole !== 'nurse') {
    throw new HttpError(403, 'Only nursing staff can record patient vitals.');
  }
  const patient = await getPatient(client, payload.patient_id, hospitalId, actorRole);
  const values = vitalsPayload(payload);
  const { data, error } = await client.from('patient_vitals')
    .insert({
      ...values,
      hospital_id: hospitalId,
      patient_id: patient.id,
      recorded_by: userId,
    })
    .select('id, patient_id, hospital_id, recorded_by, systolic_blood_pressure, diastolic_blood_pressure, pulse_rate, temperature_c, respiratory_rate, oxygen_saturation, weight_kg, height_cm, notes, recorded_at, created_at')
    .single();
  if (error) throw new HttpError(500, `Could not save patient vitals: ${error.message}`);
  return { vital: { ...data, patient } };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return respond(405, { error: 'Method not allowed.' });

  try {
    const token = request.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) throw new HttpError(401, 'Sign in to access patients.');
    const url = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !anonKey || !serviceKey) {
      throw new HttpError(500, 'Patient management is not configured on the server.');
    }
    const identityClient = createClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const adminClient = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: { user }, error: authError } = await identityClient.auth.getUser(token);
    if (authError || !user) throw new HttpError(401, 'Your session is invalid or expired. Sign in again.');

    const { data: actor, error: profileError } = await adminClient.from('profiles')
      .select('id, role, hospital_id').eq('id', user.id).maybeSingle();
    if (profileError) throw new HttpError(500, `Could not verify hospital access: ${profileError.message}`);
    if (!actor || !hospitalRoles.has(actor.role) || !actor.hospital_id) {
      throw new HttpError(403, 'A hospital account is required to access patients.');
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      throw new HttpError(400, 'Request body must contain valid JSON.');
    }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new HttpError(400, 'Request body must be a JSON object.');
    }
    const action = payload.action;
    if (receptionOnlyActions.has(action) && actor.role !== 'reception') {
      throw new HttpError(403, 'Only reception staff can change patient registrations or check patients in.');
    }

    let result;
    switch (action) {
      case 'list':
        result = await listPatients(adminClient, actor.hospital_id, actor.role);
        break;
      case 'read':
        result = { patient: await getPatient(adminClient, payload.patient_id, actor.hospital_id, actor.role) };
        break;
      case 'insurers': {
        const { data, error } = await adminClient.from('hospital_insurance_providers')
          .select('provider_name').eq('hospital_id', actor.hospital_id)
          .order('provider_name', { ascending: true });
        if (error) throw new HttpError(500, `Could not load insurance providers: ${error.message}`);
        result = { providers: ['NHIS', ...(data || []).map((item) => item.provider_name)] };
        break;
      }
      case 'create':
        result = await createPatient(adminClient, actor.hospital_id, user.id, payload);
        break;
      case 'update':
        result = await updatePatient(adminClient, actor.hospital_id, payload.patient_id, payload);
        break;
      case 'delete': {
        const existing = await getPatient(adminClient, payload.patient_id, actor.hospital_id, 'reception');
        const { error } = await adminClient.from('patients').delete()
          .eq('id', existing.id).eq('hospital_id', actor.hospital_id);
        if (error) throw new HttpError(500, `Could not delete patient: ${error.message}`);
        result = { deleted_id: existing.id };
        break;
      }
      case 'check_in':
        result = await checkInPatient(adminClient, actor.hospital_id, user.id, payload.patient_id);
        break;
      case 'vitals_list':
        if (!vitalsReadRoles.has(actor.role)) throw new HttpError(403, 'You cannot view patient vitals.');
        result = await listVitals(adminClient, actor.hospital_id, actor.role, payload);
        break;
      case 'vitals_create':
        result = await createVitals(adminClient, actor.hospital_id, user.id, actor.role, payload);
        break;
      default:
        throw new HttpError(400, 'This patient service action is unavailable.');
    }

    return respond(200, result);
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : 'Patient request failed unexpectedly.';
    return respond(status, { error: message });
  }
});

function addDays(dateValue, days) {
  const [year, month, day] = dateValue.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}
