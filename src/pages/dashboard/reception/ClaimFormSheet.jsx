import { useEffect } from 'react';
import { createPortal } from 'react-dom';

const MAIN_DIAGNOSIS_ROWS = 4;
const MAIN_LAB_ROWS = 5;
const MAIN_MEDICINE_ROWS = 5;

function dateParts(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

function ageAtDate(dateOfBirth, serviceDate) {
  if (!dateOfBirth || !serviceDate) return '';
  const birth = new Date(`${dateOfBirth}T00:00:00`);
  const service = new Date(serviceDate);
  if (Number.isNaN(birth.getTime()) || Number.isNaN(service.getTime())) return '';
  let age = service.getFullYear() - birth.getFullYear();
  if (
    service.getMonth() < birth.getMonth() ||
    (service.getMonth() === birth.getMonth() && service.getDate() < birth.getDate())
  ) age -= 1;
  return age >= 0 ? String(age) : '';
}

function PageHeading({ hospitalName, hospitalId, claimDate }) {
  return (
    <header className="claim-sheet-header">
      <div>
        <h1>National Health Insurance Scheme</h1>
        <strong>Claim Form · Regulation 62</strong>
      </div>
      <div className="claim-sheet-facility">
        <span>{hospitalName || 'Health facility'}</span>
        <span>Facility ID: {hospitalId || ''}</span>
        <span>Claim date: {claimDate}</span>
        <b>DRAFT · FOR CLAIMS OFFICER REVIEW</b>
      </div>
    </header>
  );
}

function ClaimTable({ title, columns, rows, emptyRows = 0 }) {
  const visibleRows = [...rows, ...Array.from({ length: Math.max(0, emptyRows - rows.length) }, () => null)];
  return (
    <section className="claim-sheet-section">
      <h2>{title}</h2>
      <table>
        <thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead>
        <tbody>
          {visibleRows.map((row, index) => (
            <tr key={row?.id || `blank-${index}`}>
              {columns.map((column) => (
                <td key={column}>{row?.[column] || ''}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export default function ClaimFormSheet({
  patient,
  consultation,
  labOrders,
  prescriptions,
  hospital,
  onPrinted,
}) {
  useEffect(() => {
    const handleAfterPrint = () => onPrinted();
    window.addEventListener('afterprint', handleAfterPrint);
    const timer = window.setTimeout(() => window.print(), 250);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, [onPrinted]);

  const diagnoses = consultation.diagnoses || [];
  const claimDate = dateParts(consultation.created_at);
  const primaryPhone = patient.parent_phone || patient.emergency_contact_phone || '';
  const diagnosisRows = diagnoses.map((diagnosis) => ({
    'Diagnosis / clinical note': [
      diagnosis.diagnosis?.name || 'Diagnosis',
      diagnosis.notes,
    ].filter(Boolean).join(' — '),
    'ICD-10': '',
    'G-DRG': '',
    id: `${diagnosis.consultation_id}-${diagnosis.diagnosis_id}`,
  }));
  const labRows = labOrders.map((order) => ({
    Investigation: order.lab?.name || order.lab_code,
    'Request / result': [
      order.request_notes,
      order.result_value && `Result: ${order.result_value}`,
      order.result_notes,
    ].filter(Boolean).join(' · '),
    Date: dateParts(order.requested_at),
    Status: order.status?.replace('_', ' ') || '',
    id: order.id,
  }));
  const medicineRows = prescriptions.map((prescription) => ({
    Medicine: prescription.drug?.name || prescription.drug_code,
    Directions: [
      prescription.dose,
      prescription.route,
      prescription.frequency,
      prescription.duration,
      prescription.instructions,
    ].filter(Boolean).join(' · '),
    Quantity: prescription.quantity ?? '',
    'Unit cost': '',
    'Total cost': '',
    id: prescription.id,
  }));
  const overflowDiagnoses = diagnosisRows.slice(MAIN_DIAGNOSIS_ROWS);
  const overflowLabs = labRows.slice(MAIN_LAB_ROWS);
  const overflowMedicines = medicineRows.slice(MAIN_MEDICINE_ROWS);
  const hasOverflow = overflowDiagnoses.length + overflowLabs.length + overflowMedicines.length > 0;
  return createPortal(
    <article className="claim-print-sheet">
      <section className="claim-print-page">
        <PageHeading
          hospitalName={hospital?.name}
          hospitalId={hospital?.id}
          claimDate={claimDate}
        />
        <div className="claim-sheet-banner">
          <span>Claim number</span><b />
          <span>NHIS member number</span><b>{consultation.insurance_number_snapshot || ''}</b>
          <span>CCC / eligibility code</span><b />
        </div>
        <section className="claim-sheet-section">
          <h2>Member information</h2>
          <div className="claim-sheet-fields">
            <div><span>Member name</span><b>{patient.full_name}</b></div>
            <div><span>Gender</span><b>{patient.sex === 'male' ? 'Male' : patient.sex === 'female' ? 'Female' : ''}</b></div>
            <div><span>Date of birth</span><b>{dateParts(patient.date_of_birth)}</b></div>
            <div><span>Age at service</span><b>{ageAtDate(patient.date_of_birth, consultation.created_at)}</b></div>
            <div><span>Hospital record no.</span><b>{patient.id}</b></div>
            <div><span>Ghana Card</span><b /></div>
            <div><span>Patient / guardian phone</span><b>{primaryPhone}</b></div>
            <div><span>Scheme</span><b>{consultation.insurance_type_snapshot === 'nhis' ? 'NHIS' : ''}</b></div>
            <div><span>Scheme provider</span><b>{consultation.insurance_provider_snapshot || ''}</b></div>
          </div>
        </section>
        <section className="claim-sheet-section">
          <h2>Service details</h2>
          <div className="claim-sheet-fields">
            <div><span>Service type</span><b>☒ Outpatient　☐ Pharmacy　☐ Diagnostic　☐ In-patient</b></div>
            <div><span>Date of service</span><b>{claimDate}</b></div>
            <div><span>Specialty code / description</span><b /></div>
            <div><span>Outcome / duration</span><b /></div>
            <div><span>Facility ID</span><b>{hospital?.id || ''}</b></div>
          </div>
        </section>
        <ClaimTable
          title="Procedures / services"
          columns={['Description', 'Service date', 'G-DRG code']}
          rows={[]}
          emptyRows={3}
        />
        <p className="claim-sheet-disclaimer">
          Draft generated from the saved consultation. Coverage and all claim details require verification.
          No tariff amounts or reimbursement codes are supplied by this system.
        </p>
      </section>

      <section className="claim-print-page">
        <PageHeading
          hospitalName={hospital?.name}
          hospitalId={hospital?.id}
          claimDate={claimDate}
        />
        <div className="claim-sheet-notes">
          <h2>Consultation notes and plan</h2>
          {[
            ['Chief complaint', consultation.chief_complaint],
            ['History', consultation.history],
            ['Examination', consultation.examination],
            ['Assessment', consultation.assessment],
            ['Plan', consultation.plan],
          ].filter(([, text]) => text).map(([label, text]) => (
            <p key={label}><b>{label}</b>{text}</p>
          ))}
          {!consultation.chief_complaint && !consultation.history && !consultation.examination &&
            !consultation.assessment && !consultation.plan && <p>No notes recorded.</p>}
        </div>
        <ClaimTable
          title="Diagnosis(es)"
          columns={['Diagnosis / clinical note', 'ICD-10', 'G-DRG']}
          rows={diagnosisRows.slice(0, MAIN_DIAGNOSIS_ROWS)}
          emptyRows={MAIN_DIAGNOSIS_ROWS}
        />
        <ClaimTable
          title="Investigations"
          columns={['Investigation', 'Request / result', 'Date', 'Status']}
          rows={labRows.slice(0, MAIN_LAB_ROWS)}
          emptyRows={MAIN_LAB_ROWS}
        />
        <ClaimTable
          title="Medicines"
          columns={['Medicine', 'Directions', 'Quantity', 'Unit cost', 'Total cost']}
          rows={medicineRows.slice(0, MAIN_MEDICINE_ROWS)}
          emptyRows={MAIN_MEDICINE_ROWS}
        />
        <div className="claim-sheet-summary">
          <b>Claim summary</b>
          <span>Services / G-DRG: ____________________</span>
          <span>Investigations: ____________________</span>
          <span>Medicines: ____________________</span>
          <strong>Total: ____________________</strong>
        </div>
        <div className="claim-sheet-signatures">
          <span>Claimant declaration / signature</span><span>Facility insurance officer</span><span>Scheme use only</span>
        </div>
      </section>

      {hasOverflow && (
        <section className="claim-print-page">
          <PageHeading
            hospitalName={hospital?.name}
            hospitalId={hospital?.id}
            claimDate={claimDate}
          />
          <h2 className="claim-sheet-continuation-title">Continuation sheet · {patient.full_name}</h2>
          {overflowDiagnoses.length > 0 && (
            <ClaimTable title="Additional diagnoses" columns={['Diagnosis / clinical note', 'ICD-10', 'G-DRG']} rows={overflowDiagnoses} />
          )}
          {overflowLabs.length > 0 && (
            <ClaimTable title="Additional investigations" columns={['Investigation', 'Request / result', 'Date', 'Status']} rows={overflowLabs} />
          )}
          {overflowMedicines.length > 0 && (
            <ClaimTable title="Additional medicines" columns={['Medicine', 'Directions', 'Quantity', 'Unit cost', 'Total cost']} rows={overflowMedicines} />
          )}
        </section>
      )}
    </article>,
    document.body,
  );
}
