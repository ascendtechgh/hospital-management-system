import test from 'node:test';
import assert from 'node:assert/strict';
import {
  billUnpricedService,
  createNhisClaimBatch,
  formatGHS,
  getLedger,
  getNhisClaims,
  moneyToPesewas,
  patientBalance,
  recordFulfilledService,
  recordPayment,
  saveBillingCatalog,
  setBillingScope,
  updateNhisClaimStatus,
} from '../src/lib/billingLedger.js';

const storage = new Map();
globalThis.window = {
  localStorage: {
    getItem(key) { return storage.has(key) ? storage.get(key) : null; },
    setItem(key, value) { storage.set(key, String(value)); },
    removeItem(key) { storage.delete(key); },
    clear() { storage.clear(); },
  },
  dispatchEvent() {},
};
globalThis.CustomEvent = class CustomEvent {
  constructor(type) { this.type = type; }
};

function reset() {
  storage.clear();
  setBillingScope('test-hospital');
}

const insuredPatient = {
  id: 'patient-1',
  full_name: 'Akua Mensah',
  patient_number: 'MRN-100001',
  insurance_enabled: true,
  insurance_type: 'nhis',
  insurance_provider: 'NHIS',
  insurance_number: 'NHIS-00001',
  insurance_expiry: '2099-12-31',
};

test('GHS helpers use integer pesewas', () => {
  assert.equal(moneyToPesewas(12.34), 1234);
  assert.equal(moneyToPesewas('not money'), 0);
  assert.match(formatGHS(12.34), /12\.34/);
});

test('completed service without tariff is queued, then billed when priced', () => {
  reset();
  const result = recordFulfilledService({
    patient: insuredPatient,
    category: 'Laboratory',
    description: 'Full blood count',
    quantity: 1,
    sourceRefId: 'lab-order-1',
    sourceCode: 'LAB-001',
    sourceStatus: 'Completed',
  });
  assert.equal(result.status, 'unpriced');
  assert.equal(getLedger().unpricedServices.length, 1);
  saveBillingCatalog({ services: [{
    id: 'tariff-1',
    category: 'Laboratory',
    sourceCode: 'LAB-001',
    name: 'Full blood count',
    cashPrice: 100,
    nhisPrice: 80,
  }] });
  const billed = billUnpricedService(result.service.id);
  assert.equal(billed.status, 'billed');
  assert.equal(billed.charge.chargeAmount, 100);
  assert.equal(billed.charge.insurerAmount, 80);
  assert.equal(billed.charge.patientAmount, 20);
  assert.equal(getLedger().unpricedServices.length, 0);
  assert.equal(getLedger().charges.length, 1);
});

test('duplicate fulfilled source cannot create a second charge', () => {
  reset();
  saveBillingCatalog({ services: [{
    id: 'tariff-1', category: 'Consultation', sourceCode: 'CONSULTATION',
    name: 'Consultation', cashPrice: 50, nhisPrice: 40,
  }] });
  const input = {
    patient: insuredPatient, category: 'Consultation', description: 'Consultation',
    sourceRefId: 'visit-1', sourceCode: 'CONSULTATION', sourceStatus: 'Completed',
  };
  assert.equal(recordFulfilledService(input).status, 'billed');
  assert.equal(recordFulfilledService(input).status, 'duplicate');
  assert.equal(getLedger().charges.length, 1);
});

test('partial cashier payment reduces the balance and allocates by charge', () => {
  reset();
  saveBillingCatalog({ services: [{
    id: 'tariff-1', category: 'Consultation', sourceCode: 'CONSULTATION',
    name: 'Consultation', cashPrice: 50, nhisPrice: 0,
  }] });
  const result = recordFulfilledService({
    patient: { ...insuredPatient, insurance_enabled: false },
    category: 'Consultation', description: 'Consultation', sourceRefId: 'visit-2',
    sourceCode: 'CONSULTATION', sourceStatus: 'Completed',
  });
  const charge = result.charge;
  const payment = recordPayment({
    patientId: insuredPatient.id,
    chargeIds: [charge.id],
    amountPaid: 20,
    paymentMethod: 'Cash',
    cashierName: 'Cashier',
    cashTendered: 20,
  });
  assert.equal(payment.amountPaid, 20);
  assert.equal(patientBalance(getLedger().charges[0], getLedger().payments), 30);
  assert.equal(getLedger().charges[0].status, 'Partially Settled');
});

test('NHIS claim can be submitted and settled in partial payments', () => {
  reset();
  saveBillingCatalog({ services: [{
    id: 'tariff-1', category: 'Laboratory', sourceCode: 'LAB-001',
    name: 'Full blood count', cashPrice: 100, nhisPrice: 80,
  }] });
  const result = recordFulfilledService({
    patient: insuredPatient, category: 'Laboratory', description: 'Full blood count',
    sourceRefId: 'lab-claim-1', sourceCode: 'LAB-001', sourceStatus: 'Completed',
  });
  const claim = createNhisClaimBatch([result.charge.id], 'Accounts');
  assert.equal(claim.totalAmount, 80);
  assert.equal(claim.status, 'Draft');
  updateNhisClaimStatus(claim.id, 'Submitted');
  const partial = updateNhisClaimStatus(claim.id, 'Paid', { settledAmount: 30, note: 'First remittance' });
  assert.equal(partial.status, 'Partially Paid');
  assert.equal(partial.settledAmount, 30);
  const paid = updateNhisClaimStatus(claim.id, 'Paid', { settledAmount: 50, note: 'Final remittance' });
  assert.equal(paid.status, 'Paid');
  assert.equal(paid.settledAmount, 80);
  assert.equal(getNhisClaims()[0].status, 'Paid');
});

test('local billing records are isolated by hospital scope', () => {
  reset();
  recordFulfilledService({
    patient: insuredPatient, category: 'Laboratory', description: 'Test',
    sourceRefId: 'lab-scope-1', sourceCode: 'LAB-UNKNOWN', sourceStatus: 'Completed',
  });
  assert.equal(getLedger().unpricedServices.length, 1);
  setBillingScope('another-hospital');
  assert.equal(getLedger().unpricedServices.length, 0);
  setBillingScope('test-hospital');
  assert.equal(getLedger().unpricedServices.length, 1);
});

test('NHIS tariff is not assigned to a different insurance provider', () => {
  reset();
  saveBillingCatalog({ services: [{
    id: 'tariff-1', category: 'Laboratory', sourceCode: 'LAB-001',
    name: 'Full blood count', cashPrice: 100, nhisPrice: 80,
  }] });
  const result = recordFulfilledService({
    patient: { ...insuredPatient, insurance_type: 'other', insurance_provider: 'Private Provider' },
    category: 'Laboratory', description: 'Full blood count', sourceRefId: 'lab-private-1',
    sourceCode: 'LAB-001', sourceStatus: 'Completed',
  });
  assert.equal(result.charge.insurerAmount, 0);
  assert.equal(result.charge.patientAmount, 100);
});
