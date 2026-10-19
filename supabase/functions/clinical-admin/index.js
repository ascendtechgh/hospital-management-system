import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const hospitalRoles = new Set([
  'hospitaladmin', 'consulting', 'nurse', 'labs', 'pharmacy', 'reception',
]);
const patientRecordRoles = new Set([
  'hospitaladmin', 'consulting', 'nurse', 'labs', 'pharmacy', 'reception',
]);

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

function requiredText(value, label, maxLength, { optional = false } = {}) {
  if (optional && (value === undefined || value === null || value === '')) return '';
  if (typeof value !== 'string') throw new HttpError(400, `${label} is required.`);
  const result = value.trim();
  if ((!optional && !result) || result.length > maxLength) {
    throw new HttpError(400, `${label} must be ${optional ? 'no more than' : 'between 1 and'} ${maxLength} characters.`);
  }
  return result;
}

function validArray(value, label, maxLength) {
  if (!Array.isArray(value) || value.length > maxLength) {
    throw new HttpError(400, `${label} must be a list of at most ${maxLength} items.`);
  }
  return value;
}

async function getPatient(client, patientId, hospitalId, allowUnchecked = false) {
  if (typeof patientId !== 'string' || !patientId) {
    throw new HttpError(400, 'Patient ID is required.');
  }
  let query = client.from('patients')
    .select('id, hospital_id, full_name, date_of_birth, age_at_registration, sex, checked_in_at')
    .eq('id', patientId).eq('hospital_id', hospitalId);
  if (!allowUnchecked) query = query.not('checked_in_at', 'is', null);
  const { data, error } = await query.maybeSingle();
  if (error) throw new HttpError(500, `Could not verify patient: ${error.message}`);
  if (!data) throw new HttpError(404, 'Checked-in patient was not found.');
  return data;
}

async function patientRecord(client, hospitalId, patientId, actorRole) {
  const patient = await getPatient(client, patientId, hospitalId, actorRole === 'reception');
  const [consultationsResult, labResult, prescriptionsResult] = await Promise.all([
    client.from('consultations')
      .select('id, doctor_id, chief_complaint, history, examination, assessment, plan, created_at')
      .eq('hospital_id', hospitalId).eq('patient_id', patientId)
      .order('created_at', { ascending: false }).limit(100),
    client.from('lab_orders')
      .select('id, consultation_id, lab_code, requested_by, priority, status, request_notes, result_value, result_notes, requested_at, completed_by, completed_at')
      .eq('hospital_id', hospitalId).eq('patient_id', patientId)
      .order('requested_at', { ascending: false }).limit(250),
    client.from('prescriptions')
      .select('id, consultation_id, drug_code, prescribed_by, dose, route, frequency, duration, quantity, instructions, status, created_at')
      .eq('hospital_id', hospitalId).eq('patient_id', patientId)
      .order('created_at', { ascending: false }).limit(250),
  ]);
  for (const result of [consultationsResult, labResult, prescriptionsResult]) {
    if (result.error) throw new HttpError(500, `Could not load clinical record: ${result.error.message}`);
  }

  const consultations = consultationsResult.data || [];
  const labs = labResult.data || [];
  const prescriptions = prescriptionsResult.data || [];
  const consultationIds = consultations.map((item) => item.id);
  const diagnosisRowsResult = consultationIds.length
    ? await client.from('consultation_diagnoses')
      .select('consultation_id, diagnosis_id, is_primary, notes, diagnosis:diagnosis_catalog(id, category, name)')
      .in('consultation_id', consultationIds)
    : { data: [], error: null };
  if (diagnosisRowsResult.error) {
    throw new HttpError(500, `Could not load diagnoses: ${diagnosisRowsResult.error.message}`);
  }
  const labCodes = [...new Set(labs.map((item) => item.lab_code))];
  const drugCodes = [...new Set(prescriptions.map((item) => item.drug_code))];
  const [labCatalogResult, drugCatalogResult, dispenseResult] = await Promise.all([
    labCodes.length ? client.from('lab_catalog').select('code, category, name').in('code', labCodes) : { data: [], error: null },
    drugCodes.length ? client.from('drug_catalog').select('code, category, name').in('code', drugCodes) : { data: [], error: null },
    prescriptions.length ? client.from('pharmacy_dispensations')
      .select('id, prescription_id, quantity, notes, dispensed_at, dispensed_by')
      .eq('hospital_id', hospitalId).in('prescription_id', prescriptions.map((item) => item.id))
      .order('dispensed_at', { ascending: false })
      : { data: [], error: null },
  ]);
  if (labCatalogResult.error || drugCatalogResult.error || dispenseResult.error) {
    throw new HttpError(500, 'Could not load the clinical catalog details.');
  }
  const labsByCode = new Map((labCatalogResult.data || []).map((item) => [item.code, item]));
  const drugsByCode = new Map((drugCatalogResult.data || []).map((item) => [item.code, item]));
  const dispensations = dispenseResult.data || [];
  const totalDispensed = new Map();
  for (const item of dispensations) {
    totalDispensed.set(item.prescription_id, (totalDispensed.get(item.prescription_id) || 0) + item.quantity);
  }
  return {
    patient,
    consultations: consultations.map((item) => ({
      ...item,
      diagnoses: (diagnosisRowsResult.data || []).filter((diagnosis) => diagnosis.consultation_id === item.id),
    })),
    lab_orders: labs.map((item) => ({ ...item, lab: labsByCode.get(item.lab_code) || null })),
    prescriptions: prescriptions.map((item) => ({
      ...item,
      drug: drugsByCode.get(item.drug_code) || null,
      dispensed_quantity: totalDispensed.get(item.id) || 0,
      dispensations: dispensations.filter((dispense) => dispense.prescription_id === item.id),
    })),
  };
}

async function catalogs(client, hospitalId) {
  const [diagnoses, labs, drugs, labStock, drugStock] = await Promise.all([
    client.from('diagnosis_catalog').select('id, category, name').order('category').order('name'),
    client.from('lab_catalog').select('code, category, name, initial_stock_status').order('category').order('name'),
    client.from('drug_catalog').select('code, category, name').order('category').order('name'),
    client.from('hospital_lab_inventory').select('lab_code, quantity_on_hand, reorder_level, demo_stock').eq('hospital_id', hospitalId),
    client.from('hospital_pharmacy_inventory').select('drug_code, quantity_on_hand, reorder_level, demo_stock').eq('hospital_id', hospitalId),
  ]);
  for (const result of [diagnoses, labs, drugs, labStock, drugStock]) {
    if (result.error) throw new HttpError(500, `Could not load clinical catalogs: ${result.error.message}`);
  }
  const labInventory = new Map((labStock.data || []).map((item) => [item.lab_code, item]));
  const drugInventory = new Map((drugStock.data || []).map((item) => [item.drug_code, item]));
  return {
    diagnoses: diagnoses.data || [],
    labs: (labs.data || []).map((item) => ({ ...item, inventory: labInventory.get(item.code) || null })),
    drugs: (drugs.data || []).map((item) => ({ ...item, inventory: drugInventory.get(item.code) || null })),
  };
}

async function labQueue(client, hospitalId) {
  const { data, error } = await client.from('lab_orders')
    .select('id, patient_id, consultation_id, lab_code, requested_by, priority, status, request_notes, requested_at')
    .eq('hospital_id', hospitalId).in('status', ['pending', 'in_progress'])
    .order('priority', { ascending: false }).order('requested_at', { ascending: true }).limit(500);
  if (error) throw new HttpError(500, `Could not load lab queue: ${error.message}`);
  const records = data || [];
  return attachPatientAndCatalog(client, hospitalId, records, 'lab_code', 'lab_catalog');
}

async function pharmacyQueue(client, hospitalId) {
  const { data, error } = await client.from('prescriptions')
    .select('id, patient_id, consultation_id, drug_code, prescribed_by, dose, route, frequency, duration, quantity, instructions, status, created_at')
    .eq('hospital_id', hospitalId).in('status', ['pending', 'partial'])
    .order('created_at', { ascending: true }).limit(500);
  if (error) throw new HttpError(500, `Could not load pharmacy queue: ${error.message}`);
  const records = data || [];
  const enriched = await attachPatientAndCatalog(client, hospitalId, records, 'drug_code', 'drug_catalog');
  if (!records.length) return { items: [] };
  const [dispenses, stocks] = await Promise.all([
    client.from('pharmacy_dispensations').select('prescription_id, quantity')
      .eq('hospital_id', hospitalId).in('prescription_id', records.map((item) => item.id)),
    client.from('hospital_pharmacy_inventory').select('drug_code, quantity_on_hand, reorder_level, demo_stock')
      .eq('hospital_id', hospitalId),
  ]);
  if (dispenses.error || stocks.error) throw new HttpError(500, 'Could not load pharmacy stock or dispensing history.');
  const dispensedTotals = new Map();
  for (const item of dispenses.data || []) {
    dispensedTotals.set(item.prescription_id, (dispensedTotals.get(item.prescription_id) || 0) + item.quantity);
  }
  const inventory = new Map((stocks.data || []).map((item) => [item.drug_code, item]));
  return {
    items: enriched.items.map((item) => ({
      ...item,
      dispensed_quantity: dispensedTotals.get(item.id) || 0,
      inventory: inventory.get(item.drug_code) || null,
    })),
  };
}

async function attachPatientAndCatalog(client, hospitalId, records, codeField, catalogTable) {
  if (!records.length) return { items: [] };
  const patientIds = [...new Set(records.map((item) => item.patient_id))];
  const codes = [...new Set(records.map((item) => item[codeField]))];
  const [patients, catalog] = await Promise.all([
    client.from('patients').select('id, full_name, date_of_birth, age_at_registration, sex')
      .eq('hospital_id', hospitalId).in('id', patientIds),
    client.from(catalogTable).select('*').in('code', codes),
  ]);
  if (patients.error || catalog.error) throw new HttpError(500, 'Could not load patient or catalog details.');
  const patientMap = new Map((patients.data || []).map((item) => [item.id, item]));
  const catalogMap = new Map((catalog.data || []).map((item) => [item.code, item]));
  return {
    items: records.map((item) => ({
      ...item,
      patient: patientMap.get(item.patient_id) || null,
      catalog_item: catalogMap.get(item[codeField]) || null,
    })),
  };
}

function consultationPayload(payload) {
  const consultation = {};
  for (const field of ['chief_complaint', 'history', 'examination', 'assessment', 'plan']) {
    consultation[field] = requiredText(
      payload[field],
      field.replaceAll('_', ' '),
      5000,
      { optional: true },
    );
  }

  const diagnoses = validArray(payload.diagnoses || [], 'Diagnoses', 30).map((item) => {
    const diagnosisId = Number(item?.diagnosis_id);
    if (!Number.isInteger(diagnosisId) || diagnosisId < 1) {
      throw new HttpError(400, 'Choose a valid diagnosis.');
    }
    if (item.is_primary !== undefined && typeof item.is_primary !== 'boolean') {
      throw new HttpError(400, 'Diagnosis primary status must be true or false.');
    }
    return {
      diagnosis_id: diagnosisId,
      is_primary: item.is_primary === true,
      notes: requiredText(item.notes, 'Diagnosis notes', 1000, { optional: true }),
    };
  });
  const labOrders = validArray(payload.lab_orders || [], 'Lab requests', 50).map((item) => {
    const labCode = requiredText(item?.lab_code, 'Laboratory test code', 20);
    const priority = item.priority || 'routine';
    if (!['routine', 'urgent'].includes(priority)) {
      throw new HttpError(400, 'Choose routine or urgent priority for each lab request.');
    }
    return {
      lab_code: labCode,
      priority,
      request_notes: requiredText(item.request_notes, 'Lab request notes', 1000, { optional: true }),
    };
  });
  const prescriptions = validArray(payload.prescriptions || [], 'Prescriptions', 50).map((item) => {
    const quantity = Number(item.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100000) {
      throw new HttpError(400, 'Prescription quantity must be a positive whole number.');
    }
    return {
      drug_code: requiredText(item.drug_code, 'Medicine code', 20),
      dose: requiredText(item.dose, 'Dose', 300),
      route: requiredText(item.route, 'Route', 120, { optional: true }),
      frequency: requiredText(item.frequency, 'Frequency', 300),
      duration: requiredText(item.duration, 'Duration', 300),
      quantity,
      instructions: requiredText(item.instructions, 'Prescription instructions', 1000, { optional: true }),
    };
  });

  return { consultation, diagnoses, labOrders, prescriptions };
}

async function validateConsultationCatalogs(client, { diagnoses, labOrders, prescriptions }) {
  const [diagnosisResult, labResult, drugResult] = await Promise.all([
    diagnoses.length
      ? client.from('diagnosis_catalog').select('id').in('id', diagnoses.map((item) => item.diagnosis_id))
      : { data: [], error: null },
    labOrders.length
      ? client.from('lab_catalog').select('code').in('code', labOrders.map((item) => item.lab_code))
      : { data: [], error: null },
    prescriptions.length
      ? client.from('drug_catalog').select('code').in('code', prescriptions.map((item) => item.drug_code))
      : { data: [], error: null },
  ]);
  for (const result of [diagnosisResult, labResult, drugResult]) {
    if (result.error) throw new HttpError(500, `Could not validate clinical catalog items: ${result.error.message}`);
  }
  if ((diagnosisResult.data || []).length !== new Set(diagnoses.map((item) => item.diagnosis_id)).size) {
    throw new HttpError(400, 'One or more diagnoses are not in the diagnosis catalog.');
  }
  if ((labResult.data || []).length !== new Set(labOrders.map((item) => item.lab_code)).size) {
    throw new HttpError(400, 'One or more laboratory tests are not in the lab catalog.');
  }
  if ((drugResult.data || []).length !== new Set(prescriptions.map((item) => item.drug_code)).size) {
    throw new HttpError(400, 'One or more medicines are not in the pharmacy catalog.');
  }
}

async function saveConsultation(client, hospitalId, userId, payload) {
  const { consultation, diagnoses } = consultationPayload(payload);
  await validateConsultationCatalogs(client, { diagnoses, labOrders: [], prescriptions: [] });

  let consultationId = payload.consultation_id;
  if (consultationId !== undefined && (typeof consultationId !== 'string' || !consultationId)) {
    throw new HttpError(400, 'Consultation ID is invalid.');
  }

  if (consultationId) {
    const { data: existing, error: findError } = await client.from('consultations')
      .select('id, patient_id')
      .eq('id', consultationId).eq('hospital_id', hospitalId)
      .eq('patient_id', payload.patient_id).maybeSingle();
    if (findError) throw new HttpError(500, `Could not load consultation: ${findError.message}`);
    if (!existing) throw new HttpError(404, 'Consultation not found for this patient.');

    const { error: updateError } = await client.from('consultations')
      .update(consultation).eq('id', consultationId).eq('hospital_id', hospitalId);
    if (updateError) throw new HttpError(500, `Could not save consultation notes: ${updateError.message}`);

    if (diagnoses.length) {
      const { error } = await client.from('consultation_diagnoses').upsert(
        diagnoses.map((item) => ({ ...item, consultation_id: consultationId })),
        { onConflict: 'consultation_id,diagnosis_id', ignoreDuplicates: true },
      );
      if (error) throw new HttpError(500, `Consultation notes were saved, but diagnoses could not be added: ${error.message}`);
    }
  } else {
    const { data, error } = await client.rpc('create_consultation_workflow', {
      p_hospital_id: hospitalId,
      p_patient_id: payload.patient_id,
      p_actor_id: userId,
      p_consultation: consultation,
      p_diagnoses: diagnoses,
      p_lab_orders: [],
      p_prescriptions: [],
    });
    if (error) throw new HttpError(400, `Could not save consultation: ${error.message}`);
    consultationId = data;
  }

  return { consultation_id: consultationId, saved: true };
}

async function addConsultationItems(client, hospitalId, userId, payload, itemType) {
  if (typeof payload.consultation_id !== 'string' || !payload.consultation_id) {
    throw new HttpError(400, 'Save consultation progress before adding clinical orders.');
  }
  const { data: consultation, error: consultationError } = await client.from('consultations')
    .select('id, patient_id')
    .eq('id', payload.consultation_id).eq('patient_id', payload.patient_id)
    .eq('hospital_id', hospitalId).maybeSingle();
  if (consultationError) throw new HttpError(500, `Could not verify consultation: ${consultationError.message}`);
  if (!consultation) throw new HttpError(404, 'Consultation not found for this patient.');

  if (itemType === 'lab') {
    const labOrders = consultationPayload({ diagnoses: [], lab_orders: payload.lab_orders }).labOrders;
    if (!labOrders.length) throw new HttpError(400, 'Add at least one lab request.');
    await validateConsultationCatalogs(client, { diagnoses: [], labOrders, prescriptions: [] });
    const { error } = await client.from('lab_orders').insert(
      labOrders.map((item) => ({
        ...item,
        hospital_id: hospitalId,
        patient_id: consultation.patient_id,
        consultation_id: consultation.id,
        requested_by: userId,
      })),
    );
    if (error) throw new HttpError(500, `Could not add lab requests: ${error.message}`);
    return { saved: true, count: labOrders.length };
  }

  const prescriptions = consultationPayload({ diagnoses: [], prescriptions: payload.prescriptions }).prescriptions;
  if (!prescriptions.length) throw new HttpError(400, 'Add at least one prescription.');
  await validateConsultationCatalogs(client, { diagnoses: [], labOrders: [], prescriptions });
  const { error } = await client.from('prescriptions').insert(
    prescriptions.map((item) => ({
      ...item,
      hospital_id: hospitalId,
      patient_id: consultation.patient_id,
      consultation_id: consultation.id,
      prescribed_by: userId,
    })),
  );
  if (error) throw new HttpError(500, `Could not add prescriptions: ${error.message}`);
  return { saved: true, count: prescriptions.length };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return respond(405, { error: 'Method not allowed.' });

  try {
    const token = request.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) throw new HttpError(401, 'Sign in to use clinical workflows.');
    const url = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !anonKey || !serviceKey) throw new HttpError(500, 'Clinical workflows are not configured on the server.');
    const identity = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: { user }, error: authError } = await identity.auth.getUser(token);
    if (authError || !user) throw new HttpError(401, 'Your session is invalid or expired. Sign in again.');
    const { data: actor, error: profileError } = await admin.from('profiles')
      .select('id, role, hospital_id').eq('id', user.id).maybeSingle();
    if (profileError) throw new HttpError(500, `Could not verify hospital access: ${profileError.message}`);
    if (!actor || !hospitalRoles.has(actor.role) || !actor.hospital_id) {
      throw new HttpError(403, 'A hospital account is required to access clinical workflows.');
    }
    const payload = await request.json().catch(() => {
      throw new HttpError(400, 'Request body must contain valid JSON.');
    });
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new HttpError(400, 'Request body must be a JSON object.');
    }
    const action = payload.action;
    let result;

    switch (action) {
      case 'catalogs':
        if (!['consulting', 'labs', 'pharmacy', 'hospitaladmin'].includes(actor.role)) {
          throw new HttpError(403, 'Your role cannot view clinical catalogs or inventory.');
        }
        result = await catalogs(admin, actor.hospital_id);
        break;
      case 'patient_record':
        if (!patientRecordRoles.has(actor.role)) throw new HttpError(403, 'You cannot view this clinical record.');
        result = await patientRecord(admin, actor.hospital_id, payload.patient_id, actor.role);
        break;
      case 'consultation_save': {
        if (actor.role !== 'consulting') throw new HttpError(403, 'Only consulting staff can create consultations.');
        await getPatient(admin, payload.patient_id, actor.hospital_id);
        result = await saveConsultation(admin, actor.hospital_id, user.id, payload);
        break;
      }
      case 'lab_orders_add':
      case 'prescriptions_add': {
        if (actor.role !== 'consulting') throw new HttpError(403, 'Only consulting staff can add orders to a consultation.');
        await getPatient(admin, payload.patient_id, actor.hospital_id);
        result = await addConsultationItems(
          admin,
          actor.hospital_id,
          user.id,
          payload,
          action === 'lab_orders_add' ? 'lab' : 'drug',
        );
        break;
      }
      case 'lab_queue':
        if (actor.role !== 'labs') throw new HttpError(403, 'Only laboratory staff can access the lab queue.');
        result = await labQueue(admin, actor.hospital_id);
        break;
      case 'lab_complete': {
        if (actor.role !== 'labs') throw new HttpError(403, 'Only laboratory staff can record results.');
        const resultValue = requiredText(payload.result_value, 'Result', 5000);
        const resultNotes = requiredText(payload.result_notes, 'Result notes', 5000, { optional: true });
        const rpc = await admin.rpc('record_lab_result', {
          p_hospital_id: actor.hospital_id, p_actor_id: user.id, p_order_id: payload.order_id,
          p_result_value: resultValue, p_result_notes: resultNotes,
        });
        if (rpc.error) throw new HttpError(400, `Could not save lab result: ${rpc.error.message}`);
        result = { saved: true };
        break;
      }
      case 'pharmacy_queue':
        if (actor.role !== 'pharmacy') throw new HttpError(403, 'Only pharmacy staff can access prescriptions.');
        result = await pharmacyQueue(admin, actor.hospital_id);
        break;
      case 'inventory_add': {
        const type = payload.item_type;
        const allowedRoles = type === 'lab'
          ? ['labs', 'hospitaladmin']
          : type === 'drug' ? ['pharmacy', 'hospitaladmin'] : [];
        if (!allowedRoles.includes(actor.role)) throw new HttpError(403, 'You cannot update this inventory.');
        if (typeof payload.item_code !== 'string' || !payload.item_code) throw new HttpError(400, 'Choose an inventory item.');
        const quantity = Number(payload.quantity);
        const reorderLevel = Number(payload.reorder_level);
        const replaceDemo = payload.replace_demo === true;
        if (!Number.isInteger(quantity) || quantity < (replaceDemo ? 0 : 1) || quantity > 1000000) {
          throw new HttpError(400, replaceDemo ? 'Counted stock must be a whole number from zero upward.' : 'Stock quantity must be a positive whole number.');
        }
        if (!Number.isInteger(reorderLevel) || reorderLevel < 0 || reorderLevel > 1000000) throw new HttpError(400, 'Reorder level must be a whole number from zero upward.');
        const rpc = await admin.rpc('add_clinical_inventory_stock', {
          p_hospital_id: actor.hospital_id, p_actor_id: user.id, p_item_type: type,
          p_item_code: payload.item_code, p_quantity: quantity, p_reorder_level: reorderLevel,
          p_replace_demo: replaceDemo,
        });
        if (rpc.error) throw new HttpError(400, `Could not add inventory stock: ${rpc.error.message}`);
        result = { saved: true };
        break;
      }
      case 'dispense': {
        if (actor.role !== 'pharmacy') throw new HttpError(403, 'Only pharmacy staff can dispense prescriptions.');
        const quantity = Number(payload.quantity);
        if (!Number.isInteger(quantity) || quantity < 1) throw new HttpError(400, 'Dispense quantity must be a positive whole number.');
        const notes = requiredText(payload.notes, 'Dispensing notes', 1000, { optional: true });
        const rpc = await admin.rpc('dispense_prescription', {
          p_hospital_id: actor.hospital_id, p_actor_id: user.id,
          p_prescription_id: payload.prescription_id, p_quantity: quantity, p_notes: notes,
        });
        if (rpc.error) throw new HttpError(400, `Could not dispense prescription: ${rpc.error.message}`);
        result = { dispensed: true };
        break;
      }
      default:
        throw new HttpError(400, 'This clinical workflow action is unavailable.');
    }
    return respond(200, result);
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : 'Clinical workflow request failed unexpectedly.';
    return respond(status, { error: message });
  }
});
