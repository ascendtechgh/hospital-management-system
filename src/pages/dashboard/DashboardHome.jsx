import { useCallback, useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useRealtimeSubscription } from '../../hooks/useRealtimeSubscription.js';
import { dashboardSummary } from '../../lib/dashboardApi.js';

const dashboardConfig = {
  superadmin: {
    cards: [
      ['hospitals', 'Registered hospitals', 'Hospital workspaces'],
      ['staff', 'User accounts', 'All platform profiles'],
    ],
    actions: [],
  },
  hospitaladmin: {
    cards: [
      ['patients', 'Registered patients', 'All patient records'],
      ['insuredPatients', 'Currently insured', 'Insurance expiry is today or later'],
      ['uninsuredPatients', 'Uninsured / expired', 'No insurance or coverage has expired'],
      ['arrivalsToday', 'Arrivals today', 'Recorded check-ins today'],
      ['registrationsToday', 'New registrations', 'Patients added today'],
      ['staff', 'Hospital staff', 'Staff accounts assigned here'],
      ['consultationsToday', 'Consultations today', 'Consultations created today'],
      ['pendingLabs', 'Pending lab orders', 'Waiting for laboratory processing'],
      ['lowLabStock', 'Low lab stock', 'Items at or below reorder level'],
      ['lowPharmacyStock', 'Low medicine stock', 'Items at or below reorder level'],
    ],
    actions: [
      ['Manage staff', '/dashboard/hospitaladmin/staff'],
      ['Patient directory', '/dashboard/hospitaladmin/patients'],
      ['Clinical inventory', '/dashboard/hospitaladmin/clinical-inventory'],
    ],
  },
  reception: {
    cards: [
      ['patients', 'Registered patients', 'Hospital patient directory'],
      ['registrationsToday', 'New registrations', 'Patients added today'],
      ['arrivalsToday', 'Arrivals today', 'Check-ins recorded today'],
      ['insuredArrivalsToday', 'Insured arrivals', 'Insurance confirmed at check-in'],
      ['uninsuredArrivalsToday', 'Non-insured arrivals', 'Insurance not confirmed at check-in'],
      ['expiringSoon', 'Insurance expiring soon', 'Coverage ending within 90 days'],
    ],
    actions: [['Patient directory', '/dashboard/reception/patients']],
  },
  nurse: {
    cards: [
      ['arrivalsToday', 'Arrivals today', 'Recorded patient check-ins'],
      ['vitalsToday', 'Vitals recorded today', 'Observations saved today'],
      ['patients', 'Registered patients', 'Hospital patient directory'],
    ],
    actions: [
      ['Record vitals', '/dashboard/nurse/vitals'],
      ['Patient records', '/dashboard/nurse/patients'],
    ],
  },
  consulting: {
    cards: [
      ['consultationsToday', 'Consultations today', 'Consultations created today'],
      ['arrivalsToday', 'Arrivals today', 'Recorded patient check-ins'],
      ['pendingLabs', 'Pending lab orders', 'Awaiting laboratory processing'],
      ['inProgressLabs', 'Tests in progress', 'Laboratory work underway'],
      ['pendingPrescriptions', 'Pending prescriptions', 'Awaiting pharmacy dispensing'],
    ],
    actions: [
      ['Consultations', '/dashboard/consulting/consultations'],
      ['Patient records', '/dashboard/consulting/patients'],
    ],
  },
  labs: {
    cards: [
      ['pendingLabs', 'Pending orders', 'Waiting to be processed'],
      ['inProgressLabs', 'Tests in progress', 'Currently being processed'],
      ['completedLabsToday', 'Completed today', 'Results recorded today'],
      ['lowStockItems', 'Low-stock items', 'At or below reorder level'],
    ],
    actions: [
      ['Open lab queue', '/dashboard/labs/lab-orders'],
      ['Patient records', '/dashboard/labs/patients'],
    ],
  },
  pharmacy: {
    cards: [
      ['pendingPrescriptions', 'Pending prescriptions', 'Waiting to be dispensed'],
      ['partialPrescriptions', 'Partially dispensed', 'Remaining quantity still due'],
      ['dispensedToday', 'Dispensed today', 'Dispensing transactions recorded today'],
      ['lowStockItems', 'Low-stock medicines', 'At or below reorder level'],
    ],
    actions: [
      ['Open prescription queue', '/dashboard/pharmacy/dispensing'],
      ['Patient records', '/dashboard/pharmacy/patients'],
    ],
  },
};

function formatMetric(value, loading, error) {
  if (loading) return '—';
  if (error || value === undefined || value === null) return '—';
  return new Intl.NumberFormat().format(value);
}

function DashboardHome({ role: dashboardRole }) {
  const { profile } = useAuth();
  const { hospitalLoading } = useOutletContext();
  const role = dashboardRole || profile?.role;
  const config = dashboardConfig[role] || dashboardConfig.superadmin;
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadSummary = useCallback(async () => {
    try {
      const result = await dashboardSummary();
      if (result.role !== role) throw new Error('Your role changed. Refresh the page to reload your dashboard.');
      setSummary(result);
      setError('');
    } catch (loadError) {
      setError(loadError.message || 'Dashboard information could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [role]);

  useEffect(() => {
    setLoading(true);
    void loadSummary();
  }, [loadSummary]);

  // Fallback refresh keeps counts current while protected-table realtime policies are configured.
  useEffect(() => {
    const refreshId = window.setInterval(() => { void loadSummary(); }, 60000);
    return () => window.clearInterval(refreshId);
  }, [loadSummary]);

  const refreshFromRealtime = useCallback(() => { void loadSummary(); }, [loadSummary]);
  const isHospitalUser = role !== 'superadmin';
  const isAdmin = role === 'hospitaladmin';
  const isReception = role === 'reception';
  const isNurse = role === 'nurse';
  const isConsulting = role === 'consulting';
  const isLabs = role === 'labs';
  const isPharmacy = role === 'pharmacy';

  useRealtimeSubscription({
    table: 'patients',
    filter: profile?.hospital_id ? `hospital_id=eq.${profile.hospital_id}` : null,
    enabled: isHospitalUser && Boolean(profile?.hospital_id) && (isAdmin || isReception),
    onChange: refreshFromRealtime,
  });
  useRealtimeSubscription({
    table: 'patient_visits',
    filter: profile?.hospital_id ? `hospital_id=eq.${profile.hospital_id}` : null,
    enabled: isHospitalUser && Boolean(profile?.hospital_id),
    onChange: refreshFromRealtime,
  });
  useRealtimeSubscription({
    table: 'profiles',
    filter: profile?.hospital_id ? `hospital_id=eq.${profile.hospital_id}` : null,
    enabled: isAdmin && Boolean(profile?.hospital_id),
    onChange: refreshFromRealtime,
  });
  useRealtimeSubscription({
    table: 'patient_vitals',
    filter: profile?.hospital_id ? `hospital_id=eq.${profile.hospital_id}` : null,
    enabled: isNurse && Boolean(profile?.hospital_id),
    onChange: refreshFromRealtime,
  });
  useRealtimeSubscription({
    table: 'consultations',
    filter: profile?.hospital_id ? `hospital_id=eq.${profile.hospital_id}` : null,
    enabled: Boolean(profile?.hospital_id) && (isAdmin || isConsulting),
    onChange: refreshFromRealtime,
  });
  useRealtimeSubscription({
    table: 'lab_orders',
    filter: profile?.hospital_id ? `hospital_id=eq.${profile.hospital_id}` : null,
    enabled: Boolean(profile?.hospital_id) && (isAdmin || isConsulting || isLabs),
    onChange: refreshFromRealtime,
  });
  useRealtimeSubscription({
    table: 'prescriptions',
    filter: profile?.hospital_id ? `hospital_id=eq.${profile.hospital_id}` : null,
    enabled: Boolean(profile?.hospital_id) && (isAdmin || isConsulting || isPharmacy),
    onChange: refreshFromRealtime,
  });
  useRealtimeSubscription({
    table: 'pharmacy_dispensations',
    filter: profile?.hospital_id ? `hospital_id=eq.${profile.hospital_id}` : null,
    enabled: Boolean(profile?.hospital_id) && (isAdmin || isPharmacy),
    onChange: refreshFromRealtime,
  });
  useRealtimeSubscription({
    table: 'hospital_lab_inventory',
    filter: profile?.hospital_id ? `hospital_id=eq.${profile.hospital_id}` : null,
    enabled: Boolean(profile?.hospital_id) && (isAdmin || isLabs),
    onChange: refreshFromRealtime,
  });
  useRealtimeSubscription({
    table: 'hospital_pharmacy_inventory',
    filter: profile?.hospital_id ? `hospital_id=eq.${profile.hospital_id}` : null,
    enabled: isAdmin || isPharmacy,
    onChange: refreshFromRealtime,
  });
  useRealtimeSubscription({
    table: 'hospitals',
    enabled: role === 'superadmin',
    onChange: refreshFromRealtime,
  });

  const metrics = summary?.metrics || {};

  return (
    <div className={`dashboard-home dashboard-operations-home dashboard-home-${role}`}>
      <section className="dashboard-operational-grid" aria-label="Operational summary">
        {config.cards.map(([key, label, hint]) => (
          <article className="dashboard-operational-card" key={key}>
            <span className="dashboard-operational-label">{label}</span>
            <strong className="dashboard-operational-value">{formatMetric(metrics[key], loading, error)}</strong>
            <span className="dashboard-operational-hint">{hint}</span>
          </article>
        ))}
      </section>

      {error && (
        <div className="dashboard-summary-error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => { setLoading(true); void loadSummary(); }}>Try again</button>
        </div>
      )}

      {isHospitalUser && (
        <section className="dashboard-operations-section">
          <div className="dashboard-section-heading">
            <div>
              <span className="workspace-overline">QUICK ACCESS</span>
              <h2>Go to work</h2>
            </div>
          </div>
          <div className="dashboard-quick-actions">
            {config.actions.map(([label, to]) => (
              <Link className="dashboard-quick-action" to={to} key={to}>
                <span>{label}</span>
                <span aria-hidden="true">↗</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {role === 'superadmin' && (
        <section className="dashboard-operations-section">
          <div className="dashboard-section-heading">
            <div>
              <span className="workspace-overline">PLATFORM</span>
              <h2>System-wide overview</h2>
            </div>
          </div>
          <p className="dashboard-summary-note">
            These totals reflect registered hospitals and user profiles. Subscription, claims, and revenue metrics are not shown until their source data is available.
          </p>
        </section>
      )}

      {isAdmin && (
        <section className="dashboard-operations-section">
          <div className="dashboard-section-heading">
            <div>
              <span className="workspace-overline">PATIENT COVERAGE</span>
              <h2>Insurance at a glance</h2>
            </div>
            <Link className="dashboard-text-link" to="/dashboard/hospitaladmin/patients">Patient directory <span aria-hidden="true">→</span></Link>
          </div>
          <p className="dashboard-summary-note">
            “Currently insured” uses the recorded expiry date. “Uninsured / expired” includes patients without insurance and patients whose recorded coverage has expired. Arrivals are counted from visit history.
          </p>
        </section>
      )}

      {hospitalLoading && role !== 'superadmin' && (
        <p className="dashboard-summary-note">Loading hospital workspace…</p>
      )}
    </div>
  );
}

export default DashboardHome;
