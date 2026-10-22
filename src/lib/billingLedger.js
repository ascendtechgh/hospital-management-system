const STORAGE_KEY = 'ascendhms.billing.v1';
const RECONCILIATION_KEY = 'ascendhms.reconciliation.v1';
const CATALOG_KEY = 'ascendhms.billing-catalog.v1';
const CLAIMS_KEY = 'ascendhms.nhis-claims.v1';

let storageScope = 'local';

export function setBillingScope(scope) {
  storageScope = String(scope || 'local');
}

function scopedKey(key) {
  return `${key}:${encodeURIComponent(storageScope)}`;
}

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
  const ledger = readJson(scopedKey(STORAGE_KEY), { charges: [], payments: [], unpricedServices: [] });
  return {
    charges: Array.isArray(ledger.charges) ? ledger.charges : [],
    payments: Array.isArray(ledger.payments) ? ledger.payments : [],
    unpricedServices: Array.isArray(ledger.unpricedServices) ? ledger.unpricedServices : [],
  };
}

export function saveLedger(ledger) {
  writeJson(scopedKey(STORAGE_KEY), ledger);
}

export function getBillingCatalog() {
  const catalog = readJson(scopedKey(CATALOG_KEY), { services: [] });
  return { services: Array.isArray(catalog.services) ? catalog.services : [] };
}

export function saveBillingCatalog(catalog) {
  const services = Array.isArray(catalog?.services) ? catalog.services : [];
  const seen = new Set();
  for (const service of services) {
    const key = `${String(service.category).toLowerCase()}:${String(service.sourceCode).trim().toLowerCase()}`;
    if (!service.id || !CHARGE_CATEGORIES.includes(service.category) || !String(service.name || '').trim() || !String(service.sourceCode || '').trim()) {
      throw new Error('Each tariff needs a category, service name and unique source code.');
    }
    if (seen.has(key)) throw new Error('A tariff already exists for this category and source code.');
    seen.add(key);
    if (!Number.isFinite(Number(service.cashPrice)) || Number(service.cashPrice) < 0 ||
      !Number.isFinite(Number(service.nhisPrice ?? 0)) || Number(service.nhisPrice ?? 0) < 0) {
      throw new Error('Tariff prices must be valid non-negative amounts.');
    }
  }
  writeJson(scopedKey(CATALOG_KEY), { services });
  return { services };
}

export function recordFulfilledService({ patient, visitId, category, description, quantity = 1, sourceRefId, sourceCode, sourceStatus = 'Completed' }) {
  if (!patient?.id || !sourceRefId || !['completed', 'dispensed', 'confirmed'].includes(String(sourceStatus).toLowerCase())) {
    throw new Error('A patient and completed or fulfilled source record are required before billing.');
  }
  const ledger = getLedger();
  if (ledger.charges.some((item) => item.sourceRefId === sourceRefId && item.category === category) ||
      ledger.unpricedServices.some((item) => item.sourceRefId === sourceRefId && item.category === category)) {
    return { status: 'duplicate', charge: ledger.charges.find((item) => item.sourceRefId === sourceRefId && item.category === category) || null };
  }
  const tariff = getBillingCatalog().services.find((item) =>
    item.category === category && String(item.sourceCode).trim().toLowerCase() === String(sourceCode || '').trim().toLowerCase());
  if (!tariff) {
    const service = {
      id: crypto.randomUUID(), patientId: patient.id, patientName: patient.full_name || 'Patient',
      mrn: patient.patient_number || patient.mrn || '', visitId: visitId || '', category,
      description: String(description || category).trim(), quantity: Math.max(1, Math.floor(Number(quantity) || 1)),
      sourceRefId, sourceCode: String(sourceCode || ''), sourceStatus, createdAt: new Date().toISOString(),
      insuranceSnapshot: { insurance_enabled: patient.insurance_enabled, insurance_expiry: patient.insurance_expiry },
    };
    ledger.unpricedServices.unshift(service);
    saveLedger(ledger);
    return { status: 'unpriced', service };
  }
  const charge = createCharge({
    patient, visitId, category, description: description || tariff.name, quantity,
    unitPrice: Number(tariff.cashPrice), nhisPrice: Number(tariff.nhisPrice || 0),
    sourceRefId, sourceStatus,
  });
  appendCharge(charge);
  return { status: 'billed', charge };
}

export function billUnpricedService(serviceId) {
  const ledger = getLedger();
  const service = ledger.unpricedServices.find((item) => item.id === serviceId);
  if (!service) throw new Error('The pending service could not be found.');
  const tariff = getBillingCatalog().services.find((item) =>
    item.category === service.category && String(item.sourceCode).trim().toLowerCase() === String(service.sourceCode || '').trim().toLowerCase());
  if (!tariff) throw new Error('Add a tariff matching this service category and source code first.');
  if (ledger.charges.some((item) => item.sourceRefId === service.sourceRefId && item.category === service.category)) {
    ledger.unpricedServices = ledger.unpricedServices.filter((item) => item.id !== serviceId);
    saveLedger(ledger);
    return { status: 'duplicate' };
  }
  const charge = createCharge({
    patient: { id: service.patientId, full_name: service.patientName, patient_number: service.mrn, ...service.insuranceSnapshot },
    visitId: service.visitId, category: service.category, description: service.description,
    quantity: service.quantity, unitPrice: Number(tariff.cashPrice), nhisPrice: Number(tariff.nhisPrice || 0),
    sourceRefId: service.sourceRefId, sourceStatus: service.sourceStatus,
  });
  ledger.charges.unshift(charge);
  ledger.unpricedServices = ledger.unpricedServices.filter((item) => item.id !== serviceId);
  saveLedger(ledger);
  return { status: 'billed', charge };
}

export function getReconciliations() {
  return readJson(scopedKey(RECONCILIATION_KEY), []);
}

export function getNhisClaims() {
  const claims = readJson(scopedKey(CLAIMS_KEY), []);
  return Array.isArray(claims) ? claims : [];
}

function saveNhisClaims(claims) {
  writeJson(scopedKey(CLAIMS_KEY), claims);
}

export function createNhisClaimBatch(chargeIds, actor = 'Current user') {
  const ledger = getLedger();
  const claims = getNhisClaims();
  const selected = ledger.charges.filter((charge) =>
    chargeIds.includes(charge.id) &&
    moneyToPesewas(charge.insurerAmount) > 0 &&
    !charge.claimId && !['Draft', 'Submitted', 'Partially Paid', 'Paid'].includes(charge.claimStatus) &&
    charge.status !== 'Waived');
  if (!selected.length) throw new Error('Select unclaimed charge lines with an insurer amount greater than zero.');
  const year = new Date().getFullYear();
  const sequence = claims.filter((claim) => claim.claimNumber?.startsWith(`NHIS-${year}-`)).length + 1;
  const now = new Date().toISOString();
  const batch = {
    id: crypto.randomUUID(),
    claimNumber: `NHIS-${year}-${String(sequence).padStart(4, '0')}`,
    status: 'Draft',
    chargeIds: selected.map((charge) => charge.id),
    lines: selected.map((charge) => ({
      chargeId: charge.id, patientId: charge.patientId, patientName: charge.patientName,
      mrn: charge.mrn || '', category: charge.category, description: charge.description,
      sourceRefId: charge.sourceRefId, quantity: charge.quantity,
      chargeAmount: charge.chargeAmount, insurerAmount: charge.insurerAmount,
      createdAt: charge.createdAt,
    })),
    totalAmount: pesewasToMoney(selected.reduce((sum, charge) => sum + moneyToPesewas(charge.insurerAmount), 0)),
    createdBy: actor,
    createdAt: now,
    submittedAt: null,
    settledAt: null,
    settledAmount: null,
    notes: '',
  };
  for (const charge of selected) {
    charge.claimId = batch.id;
    charge.claimNumber = batch.claimNumber;
    charge.claimStatus = 'Draft';
    charge.updatedAt = now;
  }
  saveLedger(ledger);
  saveNhisClaims([batch, ...claims]);
  return batch;
}

export function updateNhisClaimStatus(claimId, status, { note = '', settledAmount } = {}) {
  if (!['Submitted', 'Paid', 'Rejected'].includes(status)) throw new Error('Choose a valid claim status.');
  const claims = getNhisClaims();
  const claim = claims.find((item) => item.id === claimId);
  if (!claim) throw new Error('NHIS claim batch was not found.');
  if (status === 'Submitted' && claim.status !== 'Draft') throw new Error('Only draft claims can be marked submitted.');
  if (status === 'Paid' && !['Submitted', 'Partially Paid'].includes(claim.status)) throw new Error('Only submitted or partially paid claims can receive a payment.');
  if (status === 'Rejected' && claim.status !== 'Submitted') throw new Error('Only submitted claims with no payment received can be rejected.');
  if (status === 'Rejected' && !String(note).trim()) throw new Error('Add the NHIS rejection reason before recording it.');
  if (status === 'Paid') {
    const amount = moneyToPesewas(settledAmount);
    const outstanding = Math.max(0, moneyToPesewas(claim.totalAmount) - moneyToPesewas(claim.settledAmount || 0));
    if (amount <= 0 || amount > outstanding) throw new Error('Enter a positive insurer payment no greater than the outstanding claim amount.');
    const cumulative = moneyToPesewas(claim.settledAmount || 0) + amount;
    claim.settledAmount = pesewasToMoney(cumulative);
    claim.status = cumulative >= moneyToPesewas(claim.totalAmount) ? 'Paid' : 'Partially Paid';
    if (claim.status === 'Paid') claim.settledAt = new Date().toISOString();
  }
  const now = new Date().toISOString();
  if (status !== 'Paid') claim.status = status;
  claim.notes = String(note || '').trim();
  if (status === 'Submitted') claim.submittedAt = now;
  const ledger = getLedger();
  for (const charge of ledger.charges) {
    if (charge.claimId !== claimId) continue;
    charge.claimStatus = claim.status;
    if (status === 'Rejected') {
      charge.claimId = null;
      charge.claimNumber = null;
    }
    charge.updatedAt = now;
  }
  saveLedger(ledger);
  saveNhisClaims(claims);
  return claim;
}

export function saveReconciliation(record) {
  const all = getReconciliations();
  all.unshift(record);
  writeJson(scopedKey(RECONCILIATION_KEY), all);
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
  ledger.unpricedServices = ledger.unpricedServices.filter((item) => !(item.sourceRefId === charge.sourceRefId && item.category === charge.category));
  saveLedger(ledger);
  return charge;
}

export function recordPayment({ patientId, visitId, chargeIds, amountPaid, paymentMethod, cashierName, cashierId, momoRef, cashTendered, changeGiven, network }) {
  const ledger = getLedger();
  const selected = ledger.charges.filter((charge) => chargeIds.includes(charge.id) && charge.patientId === patientId && !['Settled', 'Claimed', 'Waived'].includes(charge.status));
  if (!selected.length) throw new Error('No unsettled charges were selected.');
  const due = selected.reduce((sum, charge) => sum + Math.max(0, moneyToPesewas(charge.patientAmount) - paidAgainstCharge(ledger.payments, charge.id)), 0);
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
  const key = scopedKey('ascendhms.audit.v1');
  const entries = readJson(key, []);
  entries.unshift({ id: crypto.randomUUID(), action, detail, actor, createdAt: new Date().toISOString() });
  writeJson(key, entries.slice(0, 500));
}
