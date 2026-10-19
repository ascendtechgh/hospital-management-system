import { Link } from 'react-router-dom';
import {
  calculateAge,
  insuranceDaysRemaining,
  insuranceStatus,
} from '../../../lib/patientApi.js';

function PatientCard({ patient, basePath, today, action }) {
  const age = calculateAge(patient.date_of_birth, today) ?? patient.age_at_registration;
  const currentInsurance = insuranceStatus(patient, today);
  const initials = patient.full_name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
  const patientPath = `${basePath}/patients/${patient.id}`;
  const residence = patient.residence || patient.address || 'Residence not recorded';
  const insuranceDetail = patient.insurance_enabled
    ? `${patient.insurance_provider || 'Provider not recorded'} · ${formatCountdown(insuranceDaysRemaining(patient.insurance_expiry, today))}`
    : 'No insurance recorded';

  return (
    <article className="patient-card">
      <div className="patient-card-glow" aria-hidden="true" />
      <div className="patient-card-content">
        <div className="patient-card-topline">
          <span className="patient-card-record-label">PATIENT RECORD</span>
          <InsuranceBadge patient={patient} today={today} />
        </div>

        <div className="patient-card-identity">
          <span className="patient-avatar" aria-hidden="true">{initials || 'P'}</span>
          <div className="patient-card-name-group">
            <h3 title={patient.full_name}>{patient.full_name}</h3>
            <p className="patient-card-subtitle">
              {age === null || age === undefined ? 'Age not provided' : `${age} years`}
              {' · '}{patient.sex === 'male' ? 'Male' : patient.sex === 'female' ? 'Female' : 'Sex not recorded'}
            </p>
          </div>
        </div>

        <p className="patient-card-residence" title={residence}>
          <span aria-hidden="true">⌖</span>
          <span>{residence}</span>
        </p>

        <div className="patient-card-facts">
          <div className="patient-card-fact">
            <span>Coverage</span>
            <strong className={`is-${currentInsurance}`}>
              {insuranceLabel(currentInsurance)}
            </strong>
            <small title={insuranceDetail}>{insuranceDetail}</small>
          </div>
          <div className="patient-card-fact">
            <span>Visit</span>
            <strong className={patient.checked_in_at ? 'is-checked-in' : ''}>
              {patient.checked_in_at ? 'Checked in' : 'Not checked in'}
            </strong>
            <small>{patient.checked_in_at ? `Since ${formatDateTime(patient.checked_in_at)}` : `Registered ${formatDate(patient.created_at)}`}</small>
          </div>
        </div>

        <div className="patient-card-footer">
          <Link className="patient-card-primary-action" to={patientPath}>
            Open patient record <span aria-hidden="true">→</span>
          </Link>
          {action}
        </div>
      </div>
    </article>
  );
}

export function InsuranceBadge({ patient, today }) {
  const status = insuranceStatus(patient, today);
  return (
    <span className={`patient-insurance-badge is-${status}`}>
      {insuranceLabel(status)}
    </span>
  );
}

function insuranceLabel(status) {
  return status === 'active'
    ? 'Active'
    : status === 'nearing'
      ? 'Nearing expiry'
      : status === 'expired'
        ? 'Expired'
        : 'Uninsured';
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function formatCountdown(days) {
  if (days === null) return 'No expiry date';
  if (days < 0) return `Expired ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago`;
  if (days === 0) return 'Expires today';
  return `${days} day${days === 1 ? '' : 's'} remaining`;
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'time unavailable';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export default PatientCard;
