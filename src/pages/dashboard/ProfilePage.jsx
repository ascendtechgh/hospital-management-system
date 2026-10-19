import { Link, useOutletContext } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.jsx';

function ProfilePage() {
  const { user, profile } = useAuth();
  const { hospital, hospitalLoading } = useOutletContext();

  return (
    <section className="dashboard-subpage">
      <div className="subpage-heading">
        <span className="workspace-overline">ACCOUNT</span>
        <h1>Your profile</h1>
        <p>Your signed-in identity and hospital workspace association.</p>
      </div>
      <article className="workspace-panel profile-detail-panel">
        <div className="profile-hero">
          <span className="profile-large-avatar">
            {profile?.full_name?.trim().charAt(0).toUpperCase() || 'U'}
          </span>
          <div>
            <h2>{profile?.full_name || 'Account'}</h2>
            <p>{profile?.role}</p>
          </div>
        </div>
        <dl className="profile-detail-grid">
          <div>
            <dt>Full name</dt>
            <dd>{profile?.full_name || '—'}</dd>
          </div>
          <div>
            <dt>Email address</dt>
            <dd>{user?.email || '—'}</dd>
          </div>
          <div>
            <dt>Phone number</dt>
            <dd>{profile?.phone || '—'}</dd>
          </div>
          <div>
            <dt>Role</dt>
            <dd>{profile?.role || '—'}</dd>
          </div>
          <div className="profile-detail-wide">
            <dt>Hospital workspace</dt>
            <dd>
              {hospitalLoading
                ? 'Loading…'
                : hospital
                  ? `${hospital.name} · ${hospital.id}`
                  : profile?.role === 'superadmin'
                    ? 'Platform-wide access'
                    : 'Not available'}
            </dd>
          </div>
        </dl>
      </article>
      <Link
        className="dashboard-text-link subpage-back-link"
        to={`/dashboard/${profile?.role}`}
      >
        <span aria-hidden="true">←</span> Back to dashboard
      </Link>
    </section>
  );
}

export default ProfilePage;
