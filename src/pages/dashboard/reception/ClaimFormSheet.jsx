import { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';

const MAIN_PROCEDURE_ROWS = 3;
const MAIN_DIAGNOSIS_ROWS = 4;
const MAIN_LAB_ROWS = 5;
const MAIN_MEDICINE_ROWS = 5;

function claimReference(consultation) {
  const raw = String(consultation?.id || '').replace(/[^0-9]/g, '');
  const suffix = (raw || '0').slice(-6).padStart(6, '0');
  return `CLM-${new Date(consultation?.created_at || Date.now()).getFullYear()}-${suffix}`.slice(0, 13);
}

function money(value) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

function validDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateParts(value) {
  const date = validDate(value);
  return date ? new Intl.DateTimeFormat('en-GB', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(date) : '';
}

function ageAtDate(dateOfBirth, serviceDate) {
  const birth = validDate(dateOfBirth);
  const service = validDate(serviceDate);
  if (!birth || !service) return '';
  let years = service.getFullYear() - birth.getFullYear();
  if (service.getMonth() < birth.getMonth() ||
    (service.getMonth() === birth.getMonth() && service.getDate() < birth.getDate())) years -= 1;
  return years >= 0 ? String(years) : '';
}

function digits(value, count) {
  return String(value ?? '').replace(/[^a-zA-Z0-9]/g, '').slice(0, count).split('');
}

function Boxes({ value, count, grow = false }) {
  const chars = digits(value, count);
  return (
    <span className={`nf-boxes${grow ? ' nf-boxes-grow' : ''}`} aria-label={String(value || 'Blank')}>
      {Array.from({ length: count }, (_, index) => (
        <span className="nf-c" key={index}>{chars[index] || ''}</span>
      ))}
    </span>
  );
}

function DateBoxes({ iso }) {
  const date = validDate(iso);
  const day = date ? String(date.getDate()).padStart(2, '0') : '';
  const month = date ? String(date.getMonth() + 1).padStart(2, '0') : '';
  const year = date ? String(date.getFullYear()) : '';
  return <span className="nf-date"><Boxes value={day} count={2} /> <i>/</i> <Boxes value={month} count={2} /> <i>/</i> <Boxes value={year} count={4} /></span>;
}

function Check({ on, label }) {
  return <span className="nf-check-item"><span className={`nf-check${on ? ' is-checked' : ''}`}>{on ? '×' : ''}</span>{label}</span>;
}

function Amount({ value, ints = 4 }) {
  if (value === null || value === undefined || value === '') {
    return <span className="nf-amount"><Boxes value="" count={ints} /> <b>.</b> <Boxes value="" count={2} /></span>;
  }
  const amount = Number(value);
  if (!Number.isFinite(amount)) return <span className="nf-amount"><Boxes value="" count={ints} /> <b>.</b> <Boxes value="" count={2} /></span>;
  const [whole, fraction] = amount.toFixed(2).split('.');
  return <span className="nf-amount"><Boxes value={whole.padStart(ints, '0').slice(-ints)} count={ints} /> <b>.</b> <Boxes value={fraction} count={2} /></span>;
}

function Field({ label, children, className = '' }) {
  return <div className={`nf-field ${className}`}><span>{label}</span><div className="nf-field-value">{children}</div></div>;
}

function PageHeading({ claimDate, hospital }) {
  return (
    <header className="nf-heading">
      <div className="nf-heading-main">
        <h1>NATIONAL HEALTH INSURANCE SCHEME</h1>
        <strong>CLAIM FORM (REGULATION 62)</strong>
        <span>NAME OF HEALTH FACILITY: {hospital?.name || '________________________________'}</span>
      </div>
      <div className="nf-heading-side">
        <span>FORM NO.</span><b>NHIS / 62</b>
        <span>DATE OF CLAIM</span><DateBoxes iso={claimDate} />
      </div>
    </header>
  );
}

function SheetTable({ title, headers, rows, count, className = '' }) {
  const padded = [...rows.slice(0, count), ...Array.from({ length: Math.max(0, count - rows.length) }, () => null)];
  return (
    <section className={`nf-section ${className}`}>
      <h2>{title}</h2>
      <table className="nf-table">
        <thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead>
        <tbody>{padded.map((row, index) => (
          <tr key={row?.id || `blank-${index}`}>
            {headers.map((header) => <td key={header}>{row?.[header] || ''}</td>)}
          </tr>
        ))}</tbody>
      </table>
    </section>
  );
}

function ClaimPageOne({ patient, consultation, hospital, claimDate, procedures, claimNumber, hiCode }) {
  const sex = patient.sex?.toLowerCase();
  const age = ageAtDate(patient.date_of_birth, consultation.created_at);
  return (
    <section className="nf-page">
      <PageHeading claimDate={consultation.created_at} hospital={hospital} />
      <div className="nf-top-fields">
        <Field label="NAME OF SCHEME"><Boxes value={consultation.insurance_provider_snapshot || 'NHIS'} count={26} grow /></Field>
        <Field label="CLAIM NUMBER"><Boxes value={claimNumber} count={13} /></Field>
        <Field label="HI CODE"><Boxes value={hiCode || hospital?.hi_code || hospital?.insurance_code || ""} count={12} /></Field>
      </div>

      <section className="nf-section">
        <h2>CLIENT INFORMATION</h2>
        <div className="nf-client-grid">
          <Field label="SURNAME"><Boxes value={patient.full_name?.trim().split(/\s+/).slice(-1)[0] || ''} count={20} grow /></Field>
          <Field label="OTHER NAMES"><Boxes value={patient.full_name?.trim().split(/\s+/).slice(0, -1).join(' ') || ''} count={20} grow /></Field>
          <Field label="GENDER"><span className="nf-check-row"><Check on={sex === 'male'} label="M" /><Check on={sex === 'female'} label="F" /></span></Field>
          <Field label="DATE OF BIRTH"><DateBoxes iso={patient.date_of_birth} /></Field>
          <Field label="AGE"><Boxes value={age} count={2} /></Field>
          <Field label="NHIS NUMBER"><Boxes value={consultation.insurance_number_snapshot} count={10} /></Field>
          <Field label="HOSPITAL RECORD NO."><Boxes value={patient.medical_record_number || patient.id?.replace(/-/g, '').slice(0, 9)} count={9} /></Field>
        </div>
      </section>

      <section className="nf-section">
        <h2>SERVICES PROVIDED</h2>
        <div className="nf-check-row nf-wrap">
          <Check on label="Outpatient" /><Check label="Pharmacy" /><Check label="Diagnostic" /><Check label="In-patient" />
          <span className="nf-spacer" /><Check label="All Inclusive" /><Check on label="Unbundled" />
        </div>
        <div className="nf-check-row nf-wrap">
          <Check on label="Discharged" /><Check label="Died" /><Check label="Transferred Out" /><Check label="Absconded" />
        </div>
        <div className="nf-service-dates">
          <Field label="1ST VISIT"><DateBoxes iso={consultation.created_at} /></Field>
          <Field label="2ND VISIT"><DateBoxes /></Field>
          <Field label="3RD VISIT"><DateBoxes /></Field>
          <Field label="4TH VISIT"><DateBoxes /></Field>
          <Field label="DURATION (DAYS)"><Boxes value="01" count={2} /></Field>
        </div>
        <div className="nf-check-row nf-wrap">
          <Check on={!['I10', 'E11.9'].some((code) => (consultation.diagnoses || []).some((d) => d.diagnosis?.code === code))} label="Acute Episode" />
          <Check on={['I10', 'E11.9'].some((code) => (consultation.diagnoses || []).some((d) => d.diagnosis?.code === code))} label="Chronic Follow-Up" />
          <Field label="SPECIALTY CODE"><Boxes value="OPD" count={7} /></Field>
          <Field label="DESCRIPTION"><span>Outpatient</span></Field>
        </div>
      </section>

      <SheetTable title="PROCEDURES (1 TO 3)" headers={['#', 'Description', 'Date', 'G-DRG']} count={MAIN_PROCEDURE_ROWS}
        rows={procedures.map((item, index) => ({ '#': index + 1, Description: item.description || item.name || '', Date: dateParts(item.date || consultation.created_at), 'G-DRG': item.code || '', id: item.id || index }))} />
      <footer className="nf-footer"><span>HEALTH FACILITY: {hospital?.name || ''}</span><span>Page 1 of 2</span></footer>
    </section>
  );
}

function ClaimPageTwo({ patient, consultation, hospital, claimDate, diagnoses, labs, medicines, claimNumber }) {
  const procedureTotal = (consultation.procedures || []).reduce((sum, item) => sum + (money(item.total_amount ?? item.totalAmount ?? item.tariff_amount ?? item.price) || 0), 0);
  const investigationTotal = labs.reduce((sum, item) => sum + (money(item.total_amount ?? item.totalAmount ?? item.tariff_amount ?? item.price) || 0), 0);
  const medicineTotal = medicines.reduce((sum, item) => {
    const lineTotal = money(item.total_amount ?? item.totalAmount ?? item.total_price);
    const unit = money(item.unit_price ?? item.unitPrice ?? item.price);
    return sum + (lineTotal ?? (unit == null ? 0 : unit * Number(item.quantity || 0)));
  }, 0);
  const summaryLines = [
    ['A. In-patient tariff', null],
    ['B. Out-patient tariff', procedureTotal || null],
    ['C. Investigations', investigationTotal || null],
    ['D. Pharmacy', medicineTotal || null],
  ];
  const totalClaimed = procedureTotal + investigationTotal + medicineTotal;
  return (
    <section className="nf-page">
      <PageHeading claimDate={claimDate} hospital={hospital} />
      <SheetTable title="DIAGNOSES (1 TO 4)" headers={['#', 'Description', 'ICD-10', 'G-DRG']} count={MAIN_DIAGNOSIS_ROWS}
        rows={diagnoses.map((item, index) => ({ '#': index + 1, Description: [item.diagnosis?.name || 'Diagnosis', item.notes].filter(Boolean).join(' - '), 'ICD-10': item.diagnosis?.code || '', 'G-DRG': item.gdrg || '', id: item.consultation_id + item.diagnosis_id + index }))} />
      <SheetTable title="INVESTIGATIONS (1 TO 5)" headers={['#', 'Investigation', 'Date', 'NHIA / tariff code']} count={MAIN_LAB_ROWS}
        rows={labs.map((item, index) => ({ '#': index + 1, Investigation: item.lab?.name || item.lab_code || '', Date: dateParts(item.requested_at), 'NHIA / tariff code': item.nhia_code || '', id: item.id || index }))} />
      <SheetTable title="MEDICINES (1 TO 5)" headers={['#', 'Description', 'Price (GHS)', 'Qty', 'Total (GHS)', 'NHIA code']} count={MAIN_MEDICINE_ROWS}
        rows={medicines.map((item, index) => ({ '#': index + 1, Description: item.drug?.name || item.drug_code || '', 'Price (GHS)': money(item.unit_price ?? item.unitPrice ?? item.price) == null ? '' : Number(item.unit_price ?? item.unitPrice ?? item.price).toFixed(2), Qty: item.quantity ?? '', 'Total (GHS)': money(item.total_amount ?? item.totalAmount ?? item.total_price) == null ? (money(item.unit_price ?? item.unitPrice ?? item.price) == null ? '' : (Number(item.unit_price ?? item.unitPrice ?? item.price) * Number(item.quantity || 0)).toFixed(2)) : Number(item.total_amount ?? item.totalAmount ?? item.total_price).toFixed(2), 'NHIA code': item.nhia_code || item.drug?.nhia_code || item.drug?.code || '', id: item.id || index }))} />
      <section className="nf-section nf-summary">
        <h2>CLIENT CLAIM SUMMARY (GHS)</h2>
        <div className="nf-summary-grid">
          {summaryLines.map(([label, value]) => <div key={label}><span>{label}</span><Amount value={value} /></div>)}
          <div className="nf-total"><strong>TOTAL CLAIMED</strong><Amount value={totalClaimed || null} ints={5} /></div>
        </div>
        <div className="nf-signature-row">
          <div><span>HEALTH FACILITY INSURANCE OFFICER - SIGNATURE</span><div className="nf-signature-line" /></div>
          <div><span>NAME</span><div className="nf-signature-line" /></div>
          <div><span>DATE</span><DateBoxes iso={claimDate} /></div>
        </div>
      </section>
      <section className="nf-section nf-scheme-only">
        <h2>SCHEME USE ONLY</h2>
        <div className="nf-scheme-grid">
          <Field label="DATE RECEIVED"><DateBoxes /></Field>
          <Field label="ACTION 1"><Check label="Approved" /><Check label="Rejected" /></Field>
          <Field label="DATE"><DateBoxes /></Field>
          <Field label="SIGNED BY"><span className="nf-signature-line" /></Field>
          <Field label="ACTION 2"><Check label="Approved" /><Check label="Rejected" /></Field>
          <Field label="DATE"><DateBoxes /></Field>
          <Field label="SIGNED BY"><span className="nf-signature-line" /></Field>
        </div>
      </section>
      <footer className="nf-footer"><span>MRN: {patient.medical_record_number || patient.id || ''} · NHIS: {consultation.insurance_number_snapshot || ''}</span><span>Page 2 of 2</span></footer>
    </section>
  );
}

function ContinuationPage({ patient, hospital, claimDate, title, rows, headers }) {
  return (
    <section className="nf-page">
      <PageHeading claimDate={claimDate} hospital={hospital} />
      <h2 className="nf-continuation-title">CONTINUATION SHEET · {title}</h2>
      <p>Patient: <strong>{patient.full_name}</strong> · Record no.: {patient.medical_record_number || patient.id || ''}</p>
      <table className="nf-table"><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead>
        <tbody>{rows.map((row, index) => <tr key={row.id || index}>{headers.map((header) => <td key={header}>{row[header] || ''}</td>)}</tr>)}</tbody>
      </table>
      <footer className="nf-footer"><span>Continuation sheet - verify all codes and tariffs before submission.</span></footer>
    </section>
  );
}

const printStyles = `
.claim-print-overlay{position:fixed;inset:0;z-index:10000;background:rgba(15,23,42,.68);display:flex;flex-direction:column;align-items:center;padding:16px;overflow:auto;color:#111827}
.claim-print-toolbar{position:sticky;top:0;z-index:2;width:min(100%,1100px);display:flex;align-items:center;gap:10px;padding:12px 16px;background:#fff;border:1px solid #d1d5db;border-radius:12px;margin-bottom:16px;box-shadow:0 8px 28px #0002}
.claim-print-toolbar strong{margin-right:auto;font-size:14px}.claim-print-toolbar button{border:1px solid #cbd5e1;border-radius:8px;padding:9px 13px;background:#fff;color:#111827;font:600 13px system-ui;cursor:pointer}.claim-print-toolbar .nf-print-primary{background:#14532d;color:#fff;border-color:#14532d}
.claim-print-workspace{width:100%;display:flex;flex-direction:column;align-items:center;gap:18px}
.claim-print-sheet{width:210mm;color:#000;background:#e5e7eb;padding:8mm;box-sizing:border-box;font-family:Arial,Helvetica,sans-serif;font-size:8pt}
.nf-page{width:186mm;min-height:277mm;box-sizing:border-box;background:#fff;padding:0;position:relative;margin:0 auto 8mm;page-break-after:always;break-after:page;overflow:hidden}
.nf-page:last-child{page-break-after:auto;break-after:auto}
.nf-heading{display:flex;justify-content:space-between;gap:4mm;border-bottom:.5mm solid #000;padding-bottom:2mm;margin-bottom:2mm}.nf-heading-main{display:flex;flex-direction:column;gap:1mm}.nf-heading h1{font-size:17pt;line-height:1.1;margin:0;font-weight:800}.nf-heading-main>strong{font-size:10pt}.nf-heading-main>span,.nf-heading-side>span{font-size:7pt}.nf-heading-side{min-width:40mm;display:flex;flex-direction:column;gap:1mm;text-align:right;align-items:flex-end}.nf-heading-side>b{font-size:8pt}
.nf-top-fields{display:grid;grid-template-columns:1.2fr 1fr 1fr;gap:2mm;margin-bottom:2mm}.nf-field{min-width:0;display:flex;flex-direction:column;gap:1mm}.nf-field>span:first-child{font-size:6.5pt;font-weight:700;text-transform:uppercase}.nf-field-value{min-height:5mm;display:flex;align-items:center;gap:1mm;min-width:0}.nf-section{border:.25mm solid #000;margin:0 0 2mm;padding:1.5mm}.nf-section h2{font-size:8pt;margin:0 0 1.5mm;font-weight:800}.nf-client-grid{display:grid;grid-template-columns:1fr 1fr .75fr;gap:2mm 3mm}.nf-service-dates{display:grid;grid-template-columns:repeat(5,1fr);gap:2mm;margin:2mm 0}.nf-check-row{display:flex;align-items:center;gap:3mm;min-height:5mm}.nf-wrap{flex-wrap:wrap}.nf-spacer{flex:1}.nf-check-item{display:inline-flex;align-items:center;gap:1mm;white-space:nowrap;font-size:7pt}.nf-check{width:3mm;height:3mm;border:.25mm solid #000;display:inline-flex;align-items:center;justify-content:center;font-weight:900;font-size:9pt;line-height:1}.nf-check.is-checked{font-size:10pt}.nf-boxes{display:inline-flex;align-items:stretch;flex-shrink:0}.nf-c{width:4.5mm;height:5.2mm;border:.25mm solid #000;margin-left:-.25mm;box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;font:8pt 'Courier New',monospace;white-space:nowrap}.nf-boxes-grow .nf-c{flex:1}.nf-date{display:inline-flex;align-items:center;gap:.4mm;white-space:nowrap}.nf-date i{font-style:normal;font-weight:700}.nf-amount{display:inline-flex;align-items:center;gap:.3mm}.nf-amount b{font-family:'Courier New',monospace}
.nf-table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:7pt}.nf-table th,.nf-table td{border:.25mm solid #000;padding:1mm;vertical-align:middle;overflow-wrap:anywhere}.nf-table th{font-size:6.5pt;text-align:center;background:#f3f4f6}.nf-table tbody tr{height:7mm}.nf-table th:first-child,.nf-table td:first-child{width:7mm;text-align:center}.nf-summary-grid{display:grid;grid-template-columns:1fr 1fr;gap:1.5mm 5mm}.nf-summary-grid>div{display:flex;align-items:center;justify-content:space-between;gap:2mm;min-height:7mm;border-bottom:.2mm solid #777}.nf-total{grid-column:1/-1;border-top:.5mm solid #000;border-bottom:.5mm solid #000;font-size:10pt;padding:1mm 0}.nf-signature-row{display:grid;grid-template-columns:1.5fr 1fr .8fr;gap:3mm;margin-top:3mm}.nf-signature-row>div{display:flex;flex-direction:column;gap:2mm}.nf-signature-row span,.nf-scheme-grid .nf-field>span:first-child{font-size:6.5pt;font-weight:700}.nf-signature-line{display:block;border-bottom:.25mm solid #000;height:8mm}.nf-scheme-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:3mm}.nf-footer{position:absolute;bottom:0;left:0;right:0;border-top:.2mm solid #777;padding-top:1mm;display:flex;justify-content:space-between;font-size:6.5pt}.nf-continuation-title{font-size:12pt;margin:8mm 0 4mm}.nf-scheme-only{margin-top:2mm}
@page{size:A4;margin:10mm 12mm}
@media print{body > #root{display:none!important}html,body{background:#fff!important;margin:0!important;padding:0!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}.claim-print-overlay{position:static;inset:auto;display:block;overflow:visible;padding:0;background:#fff!important}.claim-print-toolbar{display:none!important}.claim-print-workspace{display:block}.claim-print-sheet{width:186mm;padding:0;background:#fff!important;margin:0 auto}.nf-page{width:186mm;height:277mm;min-height:277mm;margin:0;overflow:hidden;box-shadow:none}.nf-page:last-child{break-after:auto!important;page-break-after:auto!important}.nf-table th{background:#fff!important}}
@media screen and (max-width:760px){.claim-print-toolbar{flex-wrap:wrap}.claim-print-toolbar strong{width:100%}.claim-print-sheet{transform-origin:top center;width:186mm;max-width:none}.claim-print-workspace{align-items:flex-start;overflow:auto}.claim-print-overlay{align-items:flex-start}}
`;

export default function ClaimFormSheet({
  patient,
  consultation,
  labOrders = [],
  prescriptions = [],
  hospital,
  onPrinted,
}) {
  const diagnoses = consultation.diagnoses || [];
  const claimDate = consultation.created_at;
  const claimNumber = useMemo(() => claimReference(consultation), [consultation?.id, consultation?.created_at]);
  const hiCode = hospital?.hi_code || hospital?.insurance_code || '';
  const procedures = consultation.procedures || [];
  const diagnosisRows = useMemo(() => diagnoses.map((item, index) => ({
    '#': index + 1,
    Description: [item.diagnosis?.name || 'Diagnosis', item.notes].filter(Boolean).join(' - '),
    'ICD-10': item.diagnosis?.code || '',
    'G-DRG': item.gdrg || '',
    id: item.consultation_id + item.diagnosis_id + index,
  })), [diagnoses]);
  const labRows = useMemo(() => labOrders.map((item, index) => ({
    '#': index + 1,
    Investigation: item.lab?.name || item.lab_code || '',
    Date: dateParts(item.requested_at),
    'NHIA / tariff code': item.nhia_code || '',
    id: item.id || index,
  })), [labOrders]);
  const medicineRows = useMemo(() => prescriptions.map((item, index) => ({
    '#': index + 1,
    Description: item.drug?.name || item.drug_code || '',
    'Price (GHS)': '',
    Qty: item.quantity ?? '',
    'Total (GHS)': '',
    'NHIA code': item.nhia_code || '',
    id: item.id || index,
  })), [prescriptions]);
  const overflowDiagnoses = diagnosisRows.slice(MAIN_DIAGNOSIS_ROWS);
  const overflowLabs = labRows.slice(MAIN_LAB_ROWS);
  const overflowMedicines = medicineRows.slice(MAIN_MEDICINE_ROWS);
  const overflowProcedures = procedures.slice(MAIN_PROCEDURE_ROWS);
  const hasOverflow = overflowDiagnoses.length + overflowLabs.length + overflowMedicines.length + overflowProcedures.length > 0;

  useEffect(() => {
    const handleAfterPrint = () => onPrinted?.();
    window.addEventListener('afterprint', handleAfterPrint);
    return () => window.removeEventListener('afterprint', handleAfterPrint);
  }, [onPrinted]);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') onPrinted?.();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onPrinted]);

  const print = () => window.print();
  return createPortal(
    <>
      <style>{printStyles}</style>
      <div className="claim-print-overlay" role="dialog" aria-modal="true" aria-label="NHIS claim form preview" onMouseDown={(event) => {
        if (event.target === event.currentTarget) onPrinted?.();
      }}>
        <div className="claim-print-toolbar">
          <strong>NHIS Claim Form · Regulation 62</strong>
          <span>Draft preview · verify blank codes and tariffs before submission</span>
          <button type="button" onClick={print} className="nf-print-primary">Print Claim Form (A4)</button>
          <button type="button" onClick={onPrinted}>Close</button>
        </div>
        <div className="claim-print-workspace">
          <article className="claim-print-sheet">
            <ClaimPageOne patient={patient} consultation={consultation} hospital={hospital} claimDate={claimDate} procedures={procedures} claimNumber={claimNumber} hiCode={hiCode} />
            <ClaimPageTwo patient={patient} consultation={consultation} hospital={hospital} claimDate={claimDate} diagnoses={diagnoses} labs={labOrders} medicines={prescriptions} claimNumber={claimNumber} />
            {hasOverflow && (
              <ContinuationPage patient={patient} hospital={hospital} claimDate={claimDate} title="ADDITIONAL CLAIM LINES"
                rows={[
                  ...overflowProcedures.map((item, index) => ({ '#': MAIN_PROCEDURE_ROWS + index + 1, Description: item.description || item.name || '', Date: dateParts(item.date || claimDate), Code: item.code || '', id: item.id || `p-${index}` })),
                  ...overflowDiagnoses.map((item, index) => ({ '#': MAIN_DIAGNOSIS_ROWS + index + 1, Description: item.Description, Date: '', Code: item['ICD-10'], id: item.id || `d-${index}` })),
                  ...overflowLabs.map((item, index) => ({ '#': MAIN_LAB_ROWS + index + 1, Description: item.Investigation, Date: item.Date, Code: item['NHIA / tariff code'], id: item.id || `l-${index}` })),
                  ...overflowMedicines.map((item, index) => ({ '#': MAIN_MEDICINE_ROWS + index + 1, Description: item.Description, Date: '', Code: item['NHIA code'], id: item.id || `m-${index}` })),
                ]}
                headers={['#', 'Description', 'Date', 'Code']} />
            )}
          </article>
        </div>
      </div>
    </>,
    document.body,
  );
}
