import { Link } from 'react-router-dom';
import {
  calculateAge,
  insuranceDaysRemaining,
  insuranceStatus,
} from '../../../lib/patientApi.js';

function PatientCard({ patient, basePath, today, action }) {
  const age = calculateAge(patient.date_of_birth, today) ?? patient.age_at_registration;
  const currentInsurance = insuranceStatus(patient, today);
  return (
    <article className="patient-card">
      <div className="patient-card-header">
        <span className="patient-avatar">
          {patient.full_name
            .split(/\s+/)
            .slice(0, 2)
            .map((part) => part[0]?.toUpperCase())
            .join('')}
        </span>
        <InsuranceBadge patient={patient} today={today} />
      </div>
      <h3>{patient.full_name}</h3>
      <p className="patient-card-subtitle">
        {age === null || age === undefined ? 'Age not provided' : `${age} years old`}
        {' · '}{patient.sex === 'male' ? 'Male' : 'Female'}
      </p>
      <div className="patient-card-meta">
        <span>{patient.residence || patient.address || 'No residence recorded'}</span>
        <span className={patient.checked_in_at ? 'patient-checkin-state is-checked-in' : 'patient-checkin-state'}>
          {patient.checked_in_at ? 'Checked in' : 'Not checked in'}
        </span>
      </div>
      {patient.insurance_enabled && (
        <p className={`patient-current-insurance is-${currentInsurance}`}>
          {patient.insurance_provider} · {insuranceLabel(currentInsurance)} ·{' '}
          {formatCountdown(insuranceDaysRemaining(patient.insurance_expiry, today))}
        </p>
      )}
      <div className="patient-card-footer">
        <span>Registered {formatDate(patient.created_at)}</span>
        <div className="patient-card-links">
          <Link to={`${basePath}/patients/${patient.id}`}>
            Details <span aria-hidden="true">→</span>
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

export default PatientCard;
