const STORAGE_KEY = 'ascendhms.billing.v1';
const RECONCILIATION_KEY = 'ascendhms.reconciliation.v1';

export const CHARGE_CATEGORIES = ['Consultation', 'Laboratory', 'Pharmacy', 'Procedure'];
export const PAYMENT_METHODS = ['Cash', 'Mobile Money', 'Bank Card'];

export function moneyToPesewas(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.round(numeric * 100);
}

export function pesewasToMoney(value) {
  return Number((Number(value || 0) / 100).toFixed(2));
}

export function formatGHS(value) {
  return new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' }).format(Number(value || 0));
}

function readJson(key, fallback) {
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  window.localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent('ascendhms:billing-change'));
}

export function getLedger() {
  const ledger = readJson(STORAGE_KEY, { charges: [], payments: [] });
  return {
    charges: Array.isArray(ledger.charges) ? ledger.charges : [],
    payments: Array.isArray(ledger.payments) ? ledger.payments : [],
  };
}

export function saveLedger(ledger) {
  writeJson(STORAGE_KEY, ledger);
}

export function getReconciliations() {
  return readJson(RECONCILIATION_KEY, []);
}

export function saveReconciliation(record) {
  const all = getReconciliations();
  all.unshift(record);
  writeJson(RECONCILIATION_KEY, all);
  return all;
}

export function isInsuranceActive(patient, now = new Date()) {
  if (!patient?.insurance_enabled || !patient?.insurance_expiry) return false;
  const expiry = new Date(`${patient.insurance_expiry}T23:59:59`);
  return !Number.isNaN(expiry.getTime()) && expiry >= now;
}

export function createCharge({ patient, visitId, category, description, quantity = 1, unitPrice, nhisPrice, sourceRefId, sourceStatus }) {
  if (!patient?.id || !sourceRefId || !['completed', 'dispensed', 'confirmed'].includes(String(sourceStatus).toLowerCase())) {
    throw new Error('A patient and a completed or fulfilled source record are required before billing.');
  }
  if (!CHARGE_CATEGORIES.includes(category)) throw new Error('Select a valid charge category.');
  const qty = Number(quantity);
  const cash = Number(unitPrice);
  const tariff = Number(nhisPrice ?? 0);
  if (!Number.isInteger(qty) || qty < 1 || !Number.isFinite(cash) || cash < 0) {
    throw new Error('Enter a valid quantity and cash price.');
  }
  const grossPesewas = moneyToPesewas(qty * cash);
  const coveredPesewas = isInsuranceActive(patient) ? Math.min(grossPesewas, moneyToPesewas(qty * Math.max(0, tariff))) : 0;
  return {
    id: crypto.randomUUID(),
    visitId: visitId || '',
    patientId: patient.id,
    patientName: patient.full_name || 'Patient',
    mrn: patient.patient_number || patient.mrn || '',
    category,
    description: String(description || category).trim(),
    quantity: qty,
    unitPrice: cash,
    chargeAmount: pesewasToMoney(grossPesewas),
    insurerAmount: pesewasToMoney(coveredPesewas),
    patientAmount: pesewasToMoney(grossPesewas - coveredPesewas),
    status: 'Pending',
    sourceRefId,
    sourceStatus,
    createdAt: new Date().toISOString(),
  };
}

export function appendCharge(charge) {
  const ledger = getLedger();
  const duplicate = ledger.charges.some((item) => item.sourceRefId === charge.sourceRefId && item.category === charge.category);
  if (duplicate) throw new Error('This fulfilled source has already been added to the billing ledger.');
  ledger.charges.unshift(charge);
  saveLedger(ledger);
  return charge;
}

export function recordPayment({ patientId, visitId, chargeIds, amountPaid, paymentMethod, cashierName, cashierId, momoRef, cashTendered, changeGiven, network }) {
  const ledger = getLedger();
  const selected = ledger.charges.filter((charge) => chargeIds.includes(charge.id) && charge.patientId === patientId && !['Settled', 'Claimed', 'Waived'].includes(charge.status));
  if (!selected.length) throw new Error('No unsettled charges were selected.');
  const due = selected.reduce((sum, charge) => sum + moneyToPesewas(charge.patientAmount - paidAgainstCharge(ledger.payments, charge.id)), 0);
  const paid = moneyToPesewas(amountPaid);
  if (paid <= 0 || paid > due) throw new Error('Payment must be greater than zero and cannot exceed the patient balance.');
  if (paymentMethod === 'Cash' && moneyToPesewas(cashTendered) < paid) throw new Error('Cash tendered cannot be less than the payment amount.');
  if (paymentMethod === 'Mobile Money' && !String(momoRef || '').trim()) throw new Error('Enter the Mobile Money transaction reference.');
  const now = new Date();
  const year = now.getFullYear();
  const nextReceipt = ledger.payments.filter((p) => p.receiptNumber.startsWith(`RCP-${year}-`)).length + 1;
  const payment = {
    id: crypto.randomUUID(),
    receiptNumber: `RCP-${year}-${String(nextReceipt).padStart(4, '0')}`,
    patientId,
    visitId: visitId || '',
    chargeIds: selected.map((charge) => charge.id),
    allocations: (() => { let remaining = paid; const result = {}; for (const charge of selected) { const outstanding = Math.max(0, moneyToPesewas(charge.patientAmount) - paidAgainstCharge(ledger.payments, charge.id)); const applied = Math.min(remaining, outstanding); result[charge.id] = pesewasToMoney(applied); remaining -= applied; } return result; })(),
    amountPaid: pesewasToMoney(paid),
    paymentMethod,
    network: network || '',
    momoRef: momoRef || '',
    cashTendered: paymentMethod === 'Cash' ? Number(cashTendered) : undefined,
    changeGiven: paymentMethod === 'Cash' ? pesewasToMoney(moneyToPesewas(cashTendered) - paid) : undefined,
    cashierName: cashierName || 'Cashier',
    cashierId: cashierId || 'local-user',
    createdAt: now.toISOString(),
  };
  ledger.payments.unshift(payment);
  for (const charge of selected) {
    const chargePaid = paidAgainstCharge(ledger.payments, charge.id);
    charge.status = chargePaid >= moneyToPesewas(charge.patientAmount) ? 'Settled' : chargePaid > 0 ? 'Partially Settled' : 'Pending';
    charge.updatedAt = now.toISOString();
  }
  saveLedger(ledger);
  return payment;
}

export function paidAgainstCharge(payments, chargeId) {
  return payments.reduce((sum, payment) => {
    if (payment.allocations && Object.prototype.hasOwnProperty.call(payment.allocations, chargeId)) return sum + moneyToPesewas(payment.allocations[chargeId]);
    if (payment.chargeIds?.length === 1 && payment.chargeIds[0] === chargeId) return sum + moneyToPesewas(payment.amountPaid);
    return sum;
  }, 0);
}

export function patientBalance(charge, payments) {
  return pesewasToMoney(Math.max(0, moneyToPesewas(charge.patientAmount) - paidAgainstCharge(payments, charge.id)));
}

export function auditEvent(action, detail, actor = 'Current user') {
  const key = 'ascendhms.audit.v1';
  const entries = readJson(key, []);
  entries.unshift({ id: crypto.randomUUID(), action, detail, actor, createdAt: new Date().toISOString() });
  writeJson(key, entries.slice(0, 500));
}
