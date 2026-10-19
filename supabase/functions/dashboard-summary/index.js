import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const hospitalRoles = new Set(['hospitaladmin', 'consulting', 'nurse', 'labs', 'pharmacy', 'reception']);

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
function respond(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
function dayBounds() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const end = new Date(start.getTime() + 86400000);
  return { start: start.toISOString(), end: end.toISOString(), date: start.toISOString().slice(0, 10) };
}
async function count(client, table, configure = (query) => query) {
  let query = client.from(table).select('id', { count: 'exact', head: true });
  query = configure(query);
  const { count: value, error } = await query;
  if (error) throw new HttpError(500, `Could not calculate ${table} dashboard summary: ${error.message}`);
  return value ?? 0;
}
async function rows(client, table, columns, configure) {
  let query = client.from(table).select(columns);
  query = configure(query);
  const { data, error } = await query;
  if (error) throw new HttpError(500, `Could not load ${table} dashboard summary: ${error.message}`);
  return data || [];
}
Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return respond(405, { error: 'Use POST for dashboard summaries.' });
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !anonKey || !serviceKey) throw new HttpError(500, 'Dashboard service is not configured.');

    const authorization = request.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) throw new HttpError(401, 'Sign in to view dashboard data.');
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: authError } = await authClient.auth.getUser();
    if (authError || !userData?.user) throw new HttpError(401, 'Your session is invalid. Please sign in again.');

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: actor, error: actorError } = await admin.from('profiles')
      .select('id, role, hospital_id').eq('id', userData.user.id).maybeSingle();
    if (actorError) throw new HttpError(500, `Could not verify your dashboard access: ${actorError.message}`);
    if (!actor) throw new HttpError(403, 'Your account profile was not found.');

    let payload;
    try { payload = await request.json(); } catch { throw new HttpError(400, 'Request body must be valid JSON.'); }
    if (payload?.action !== 'summary') throw new HttpError(400, 'Unsupported dashboard action.');

    const { start, end, date } = dayBounds();
    if (actor.role === 'superadmin') {
      const [hospitals, staff] = await Promise.all([
        count(admin, 'hospitals'),
        count(admin, 'profiles'),
      ]);
      return respond(200, { role: actor.role, date, metrics: { hospitals, staff } });
    }
    if (!hospitalRoles.has(actor.role) || !actor.hospital_id) {
      throw new HttpError(403, 'Your account cannot view hospital dashboard summaries.');
    }

    const hospital = (query) => query.eq('hospital_id', actor.hospital_id);
    const today = (column) => (query) => hospital(query).gte(column, start).lt(column, end);
    const metrics = {};

    if (['hospitaladmin', 'reception'].includes(actor.role)) {
      const [
        patients, insuredPatients, uninsuredPatients, expiredInsurance, expiringSoon,
        registrationsToday, arrivalsToday, insuredArrivalsToday, uninsuredArrivalsToday,
      ] = await Promise.all([
        count(admin, 'patients', hospital),
        count(admin, 'patients', (q) => hospital(q).eq('insurance_enabled', true).gte('insurance_expiry', date)),
        count(admin, 'patients', (q) => hospital(q).eq('insurance_enabled', false)),
        count(admin, 'patients', (q) => hospital(q).eq('insurance_enabled', true).lt('insurance_expiry', date)),
        count(admin, 'patients', (q) => hospital(q).eq('insurance_enabled', true).gte('insurance_expiry', date).lte('insurance_expiry', new Date(Date.parse(date + 'T00:00:00Z') + 90 * 86400000).toISOString().slice(0, 10))),
        count(admin, 'patients', today('created_at')),
        count(admin, 'patient_visits', today('checked_in_at')),
        count(admin, 'patient_visits', (q) => hospital(q).gte('checked_in_at', start).lt('checked_in_at', end).eq('insured_at_checkin', true)),
        count(admin, 'patient_visits', (q) => hospital(q).gte('checked_in_at', start).lt('checked_in_at', end).eq('insured_at_checkin', false)),
      ]);
      Object.assign(metrics, { patients, insuredPatients, uninsuredPatients, expiredInsurance, expiringSoon, registrationsToday, arrivalsToday, insuredArrivalsToday, uninsuredArrivalsToday });
    } else {
      metrics.patients = await count(admin, 'patients', hospital);
      metrics.arrivalsToday = await count(admin, 'patient_visits', today('checked_in_at'));
    }

    if (actor.role === 'hospitaladmin') {
      const [staff, consultationsToday, pendingLabs, inProgressLabs, pendingPrescriptions, partialPrescriptions, lowLabStock, lowPharmacyStock] = await Promise.all([
        count(admin, 'profiles', (q) => q.eq('hospital_id', actor.hospital_id)),
        count(admin, 'consultations', today('created_at')),
        count(admin, 'lab_orders', (q) => hospital(q).eq('status', 'pending')),
        count(admin, 'lab_orders', (q) => hospital(q).eq('status', 'in_progress')),
        count(admin, 'prescriptions', (q) => hospital(q).eq('status', 'pending')),
        count(admin, 'prescriptions', (q) => hospital(q).eq('status', 'partial')),
        rows(admin, 'hospital_lab_inventory', 'lab_code, quantity_on_hand, reorder_level', hospital),
        rows(admin, 'hospital_pharmacy_inventory', 'drug_code, quantity_on_hand, reorder_level', hospital),
      ]);
      Object.assign(metrics, { staff, consultationsToday, pendingLabs, inProgressLabs, pendingPrescriptions, partialPrescriptions,
        lowLabStock: lowLabStock.filter((item) => item.quantity_on_hand <= item.reorder_level).length,
        lowPharmacyStock: lowPharmacyStock.filter((item) => item.quantity_on_hand <= item.reorder_level).length });
    } else if (actor.role === 'nurse') {
      metrics.vitalsToday = await count(admin, 'patient_vitals', today('recorded_at'));
    } else if (actor.role === 'consulting') {
      const [consultationsToday, pendingLabs, inProgressLabs, pendingPrescriptions] = await Promise.all([
        count(admin, 'consultations', today('created_at')),
        count(admin, 'lab_orders', (q) => hospital(q).eq('status', 'pending')),
        count(admin, 'lab_orders', (q) => hospital(q).eq('status', 'in_progress')),
        count(admin, 'prescriptions', (q) => hospital(q).eq('status', 'pending')),
      ]);
      Object.assign(metrics, { consultationsToday, pendingLabs, inProgressLabs, pendingPrescriptions });
    } else if (actor.role === 'labs') {
      const [pendingLabs, inProgressLabs, completedLabsToday, inventory] = await Promise.all([
        count(admin, 'lab_orders', (q) => hospital(q).eq('status', 'pending')),
        count(admin, 'lab_orders', (q) => hospital(q).eq('status', 'in_progress')),
        count(admin, 'lab_orders', today('completed_at')),
        rows(admin, 'hospital_lab_inventory', 'lab_code, quantity_on_hand, reorder_level', hospital),
      ]);
      Object.assign(metrics, { pendingLabs, inProgressLabs, completedLabsToday,
        lowStockItems: inventory.filter((item) => item.quantity_on_hand <= item.reorder_level).length });
    } else if (actor.role === 'pharmacy') {
      const [pendingPrescriptions, partialPrescriptions, dispensedToday, inventory] = await Promise.all([
        count(admin, 'prescriptions', (q) => hospital(q).eq('status', 'pending')),
        count(admin, 'prescriptions', (q) => hospital(q).eq('status', 'partial')),
        count(admin, 'pharmacy_dispensations', today('dispensed_at')),
        rows(admin, 'hospital_pharmacy_inventory', 'drug_code, quantity_on_hand, reorder_level', hospital),
      ]);
      Object.assign(metrics, { pendingPrescriptions, partialPrescriptions, dispensedToday,
        lowStockItems: inventory.filter((item) => item.quantity_on_hand <= item.reorder_level).length });
    } else if (actor.role === 'reception') {
      // Reception metrics are patient-flow focused; clinical details are not returned.
    }
    return respond(200, { role: actor.role, hospital_id: actor.hospital_id, date, metrics });
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    return respond(status, { error: error instanceof Error ? error.message : 'Could not load dashboard summary.' });
  }
});
