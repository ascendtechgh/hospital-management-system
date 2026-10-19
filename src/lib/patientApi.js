import { supabase } from './supabase.js';

export async function patientRequest(action, payload = {}) {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const { data, error } = await supabase.functions.invoke('patient-admin', {
    body: { action, ...payload },
  });

  if (error) {
    const response = error.context;
    if (response && typeof response.json === 'function') {
      try {
        const body = await response.json();
        if (body?.error) {
          throw new Error(body.error);
        }
      } catch (parseError) {
        if (parseError instanceof Error && parseError.message !== error.message) {
          throw parseError;
        }
      }
    }
    throw new Error(error.message || 'Patient request failed.');
  }

  if (data?.error) {
    throw new Error(data.error);
  }
  return data;
}

export function calculateAge(dateOfBirth, today = new Date()) {
  if (!dateOfBirth) return null;
  const [year, month, day] = dateOfBirth.split('-').map(Number);
  if (!year || !month || !day) return null;
  let age = today.getFullYear() - year;
  if (
    today.getMonth() + 1 < month ||
    (today.getMonth() + 1 === month && today.getDate() < day)
  ) {
    age -= 1;
  }
  return age >= 0 ? age : null;
}

export function insuranceStatus(patient, today = new Date()) {
  if (!patient?.insurance_enabled) return 'uninsured';
  if (!patient.insurance_expiry) return 'expired';
  const expiry = new Date(`${patient.insurance_expiry}T00:00:00`);
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (expiry < todayStart) return 'expired';

  const thresholdMonth = today.getMonth() + 3;
  const thresholdLastDay = new Date(
    today.getFullYear(),
    thresholdMonth + 1,
    0,
  ).getDate();
  const activeThreshold = new Date(
    today.getFullYear(),
    thresholdMonth,
    Math.min(today.getDate(), thresholdLastDay),
  );
  return expiry >= activeThreshold ? 'active' : 'nearing';
}

export function insuranceDaysRemaining(expiryDate, today = new Date()) {
  if (!expiryDate) return null;
  const [year, month, day] = expiryDate.split('-').map(Number);
  const expiry = Date.UTC(year, month - 1, day);
  const current = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((expiry - current) / 86_400_000);
}
