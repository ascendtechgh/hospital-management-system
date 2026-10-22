import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Link,
  NavLink,
  Navigate,
  Outlet,
  useNavigate,
  useParams,
} from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useRealtimeSubscription } from '../../hooks/useRealtimeSubscription.js';
import { supabase } from '../../lib/supabase.js';

const roleLabels = {
  superadmin: 'Super Admin',
  hospitaladmin: 'Hospital Admin',
  consulting: 'Consulting',
  nurse: 'Nursing',
  labs: 'Laboratory',
  pharmacy: 'Pharmacy',
  reception: 'Reception',
  cashier: 'Cashier',
  billing_claims: 'Billing & Claims',
};

function SearchIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
      <circle cx="10.8" cy="10.8" r="6.8" />
      <path d="m16 16 4.2 4.2" />
    </svg>
  );
}

function DashboardIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="4" rx="1.5" />
      <rect x="13.5" y="10.5" width="7" height="10" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function StaffIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.8 20v-1.6A4.4 4.4 0 0 1 7.2 14h3.6a4.4 4.4 0 0 1 4.4 4.4V20" />
      <path d="M16 4.8a3.5 3.5 0 0 1 0 6.8M17.2 14h.6a4.4 4.4 0 0 1 4.4 4.4V20" />
    </svg>
  );
}

function PatientsIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
      <path d="M12 3v18M3 12h18" />
      <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
      <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z" />
      <path d="M10 21h4" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" fill="none">
      <path d="m4 6 4 4 4-4" />
    </svg>
  );
}

function getInitials(name, email) {
  const source = name?.trim() || email?.split('@')[0] || 'User';
  const parts = source.split(/[\s._-]+/).filter(Boolean);
  return parts
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}

export default function DashboardLayout() {
  const { role } = useParams();
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const roleLabel = roleLabels[profile?.role] || 'Dashboard';
  const basePath = `/dashboard/${profile?.role || role}`;
  const [hospital, setHospital] = useState(null);
  const [hospitalError, setHospitalError] = useState('');
  const [notifications, setNotifications] = useState([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationError, setNotificationError] = useState('');
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState(null);
  const [menuError, setMenuError] = useState('');
  const searchRef = useRef(null);
  const profileMenuRef = useRef(null);
  const notificationMenuRef = useRef(null);

  const loadHospital = useCallback(async () => {
    if (!supabase || !profile?.hospital_id) {
      setHospital(null);
      setHospitalError('');
      return;
    }

    const { data, error } = await supabase
      .from('hospitals')
      .select('id, name, phone, email, address')
      .eq('id', profile.hospital_id)
      .maybeSingle();

    if (error) {
      setHospitalError(error.message);
      return;
    }

    setHospitalError('');
    setHospital(data);
  }, [profile?.hospital_id]);

  const loadNotifications = useCallback(async () => {
    if (!supabase || !user?.id) {
      setNotifications([]);
      setNotificationsLoading(false);
      return;
    }

    setNotificationsLoading(true);
    let query = supabase
      .from('notifications')
      .select('id, title, message, created_at, read_at')
      .order('created_at', { ascending: false })
      .limit(20);

    if (profile?.hospital_id) {
      query = query
        .eq('hospital_id', profile.hospital_id)
        .or(
          `recipient_user_id.eq.${user.id},and(recipient_user_id.is.null,target_role.is.null),and(recipient_user_id.is.null,target_role.eq.${profile.role})`,
        );
    } else {
      query = query.eq('recipient_user_id', user.id);
    }

    const { data, error } = await query;
    if (error) {
      setNotificationError(error.message);
      setNotificationsLoading(false);
      return;
    }

    setNotificationError('');
    setNotifications(data || []);
    setNotificationsLoading(false);
  }, [profile?.hospital_id, profile?.role, user?.id]);

  const hospitalRealtime = useRealtimeSubscription({
    table: 'hospitals',
    filter: profile?.hospital_id ? `id=eq.${profile.hospital_id}` : null,
    enabled: Boolean(profile?.hospital_id),
    onChange: () => {
      void loadHospital();
    },
  });

  const notificationRealtime = useRealtimeSubscription({
    table: 'notifications',
    filter: profile?.hospital_id
      ? `hospital_id=eq.${profile.hospital_id}`
      : user?.id
        ? `recipient_user_id=eq.${user.id}`
        : null,
    enabled: Boolean(user?.id),
    onChange: () => {
      void loadNotifications();
    },
  });

  useEffect(() => {
    void loadHospital();
  }, [loadHospital]);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    function handleOutsidePointer(event) {
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(event.target) &&
        notificationMenuRef.current &&
        !notificationMenuRef.current.contains(event.target)
      ) {
        setOpenMenu(null);
      }
    }

    function handleEscape(event) {
      if (event.key === 'Escape') {
        setOpenMenu(null);
        setSearchOpen(false);
        searchRef.current?.blur();
      }
    }

    function handleSearchShortcut(event) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpenMenu(null);
        setSearchOpen(true);
        searchRef.current?.focus();
      }
    }

    document.addEventListener('pointerdown', handleOutsidePointer);
    document.addEventListener('keydown', handleEscape);
    document.addEventListener('keydown', handleSearchShortcut);
    return () => {
      document.removeEventListener('pointerdown', handleOutsidePointer);
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('keydown', handleSearchShortcut);
    };
  }, []);

  const searchItems = useMemo(() => {
    const items = [
      {
        id: 'dashboard',
        title: 'Dashboard',
        detail: roleLabel,
        href: basePath,
        keywords: 'dashboard overview home',
      },
      {
        id: 'profile',
        title: profile?.full_name || 'My profile',
        detail: user?.email || 'Profile',
        href: `${basePath}/profile`,
        keywords: `${profile?.full_name || ''} ${profile?.phone || ''} ${user?.email || ''} profile account`,
      },
      {
        id: 'settings',
        title: 'Settings',
        detail: 'Account security',
        href: `${basePath}/settings`,
        keywords: 'settings password security account',
      },
    ];

    if (profile?.role === 'hospitaladmin') {
      items.push({
        id: 'staff',
        title: 'Staff',
        detail: 'Hospital team',
        href: `${basePath}/staff`,
        keywords: 'staff team users accounts employees',
      });
    }

    if (profile?.role !== 'superadmin') {
      items.push({
        id: 'patients',
        title: 'Patients',
        detail: 'Checked-in patients',
        href: `${basePath}/patients`,
        keywords: 'patient directory registration checked in',
      });
    }

    if (profile?.role === 'nurse') {
      items.push({
        id: 'vitals',
        title: 'Check vitals',
        detail: 'Nursing observations',
        href: `${basePath}/vitals`,
        keywords: 'vitals observations nursing patient history',
      });
    }

    if (profile?.role === 'consulting') {
      items.push({
        id: 'consultations',
        title: 'Consultations',
        detail: 'Diagnoses, lab requests and prescriptions',
        href: `${basePath}/consultations`,
        keywords: 'consultation diagnosis laboratory request prescription',
      });
    }

    if (profile?.role === 'labs') {
      items.push({
        id: 'lab-orders',
        title: 'Laboratory',
        detail: 'Requests, results and test stock',
        href: `${basePath}/lab-orders`,
        keywords: 'laboratory lab requests results tests inventory',
      });
    }

    if (profile?.role === 'pharmacy') {
      items.push({
        id: 'dispensing',
        title: 'Pharmacy',
        detail: 'Prescriptions and medicine stock',
        href: `${basePath}/dispensing`,
        keywords: 'pharmacy prescriptions dispensing drugs inventory',
      });
    }
    if (['hospitaladmin', 'superadmin', 'reception', 'cashier', 'billing_claims'].includes(profile?.role)) {
      items.push({
        id: 'accounts',
        title: 'Accounts and cashier',
        detail: 'Patient balances, receipts and reconciliation',
        href: `${basePath}/accounts`,
        keywords: 'accounts billing cashier receipts payments finance reconciliation',
      });
    }
    if (profile?.role === 'reception') {
      items.push({
        id: 'patient-import',
        title: 'Bulk patient import',
        detail: 'Validate and import patient records',
        href: `${basePath}/patients/import`,
        keywords: 'patient import csv excel bulk upload',
      });
    }

    if (hospital) {
      items.push({
        id: 'hospital',
        title: hospital.name,
        detail: hospital.id,
        href: basePath,
        keywords: `${hospital.name} ${hospital.id} ${hospital.email} ${hospital.phone} ${hospital.address}`,
      });
    }

    return items;
  }, [
    basePath,
    hospital,
    profile?.full_name,
    profile?.phone,
    profile?.role,
    roleLabel,
    user?.email,
  ]);

  const searchResults = search.trim()
    ? searchItems.filter((item) =>
        `${item.title} ${item.detail} ${item.keywords}`
          .toLowerCase()
          .includes(search.trim().toLowerCase()),
      )
    : [];
  const unreadCount = notifications.filter((notification) => !notification.read_at).length;

  async function handleSignOut() {
    setMenuError('');
    try {
      await signOut();
      navigate('/login', { replace: true });
    } catch (error) {
      setMenuError(error.message || 'We couldn’t sign you out.');
    }
  }

  function handleSearchSubmit(event) {
    event.preventDefault();
    if (searchResults.length) {
      navigate(searchResults[0].href);
      setSearchOpen(false);
      setSearch('');
    }
  }

  if (role !== profile?.role) {
    return <Navigate to={basePath} replace />;
  }

  const initials = getInitials(profile?.full_name, user?.email);

  return (
    <div className="dashboard-app-shell">
      <a className="skip-to-content" href="#main-content">Skip to main content</a>
      <aside className="dashboard-sidebar" aria-label="Main sidebar">
        <div className="sidebar-brand-row">
          <Link className="sidebar-logo" to="/" aria-label="AscendHMS homepage">
            <picture>
              <source
                media="(max-width: 720px)"
                srcSet="/branding/favicon.png"
              />
              <img src="/branding/ascendhms-logo.png" alt="AscendHMS" />
            </picture>
          </Link>
        </div>
        <div className="sidebar-section-label">WORKSPACE</div>
        <nav className="sidebar-navigation" aria-label="Workspace navigation">
          <NavLink
            className={({ isActive }) =>
              `sidebar-nav-link${isActive ? ' is-active' : ''}`
            }
            to={basePath}
            end
            title="Dashboard"
          >
            <DashboardIcon />
            <span>Dashboard</span>
          </NavLink>
          {profile?.role === 'hospitaladmin' && (
            <NavLink
              className={({ isActive }) =>
                `sidebar-nav-link${isActive ? ' is-active' : ''}`
              }
              to={`${basePath}/staff`}
              title="Staff"
            >
              <StaffIcon />
              <span>Staff</span>
            </NavLink>
          )}
          {(profile?.role === 'reception' || profile?.role === 'nurse') && (
            <NavLink
              className={({ isActive }) =>
                `sidebar-nav-link${isActive ? ' is-active' : ''}`
              }
              to={`${basePath}/patients`}
              title="Patients"
            >
              <PatientsIcon />
              <span>Patients</span>
            </NavLink>
          )}
          {profile?.role === 'nurse' && (
            <NavLink
              className={({ isActive }) =>
                `sidebar-nav-link${isActive ? ' is-active' : ''}`
              }
              to={`${basePath}/vitals`}
              title="Check vitals"
            >
              <span className="sidebar-nav-symbol" aria-hidden="true">⌁</span>
              <span>Check vitals</span>
            </NavLink>
          )}
          {profile?.role === 'consulting' && (
            <NavLink className={({ isActive }) => `sidebar-nav-link${isActive ? ' is-active' : ''}`} to={`${basePath}/consultations`} title="Consultations">
              <span className="sidebar-nav-symbol" aria-hidden="true">✚</span><span>Consultations</span>
            </NavLink>
          )}
          {profile?.role === 'labs' && (
            <NavLink className={({ isActive }) => `sidebar-nav-link${isActive ? ' is-active' : ''}`} to={`${basePath}/lab-orders`} title="Laboratory">
              <span className="sidebar-nav-symbol" aria-hidden="true">⌕</span><span>Laboratory</span>
            </NavLink>
          )}
          {profile?.role === 'pharmacy' && (
            <NavLink className={({ isActive }) => `sidebar-nav-link${isActive ? ' is-active' : ''}`} to={`${basePath}/dispensing`} title="Pharmacy">
              <span className="sidebar-nav-symbol" aria-hidden="true">＋</span><span>Pharmacy</span>
            </NavLink>
          )}
          {['hospitaladmin', 'superadmin', 'reception'].includes(profile?.role) && (
            <NavLink className={({ isActive }) => `sidebar-nav-link${isActive ? ' is-active' : ''}`} to={`${basePath}/accounts`} title="Accounts and cashier">
              <span className="sidebar-nav-symbol" aria-hidden="true">₵</span><span>Accounts</span>
            </NavLink>
          )}
        </nav>
      </aside>

      <div className="dashboard-main-column">
        <header className="dashboard-topbar">
          <div className="topbar-actions">
            <div className="global-search-wrap">
              <form className="global-search" role="search" onSubmit={handleSearchSubmit}>
                <SearchIcon />
                <input
                  ref={searchRef}
                  type="search"
                  value={search}
                  placeholder="Search your workspace"
                  aria-label="Search your workspace"
                  aria-expanded={searchOpen && Boolean(search.trim())}
                  aria-controls="dashboard-search-results"
                  onFocus={() => setSearchOpen(true)}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setSearchOpen(true);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') {
                      setSearchOpen(false);
                    }
                  }}
                />
                <kbd>Ctrl K</kbd>
              </form>
              {searchOpen && search.trim() && (
                <div className="search-results" id="dashboard-search-results">
                  <span className="dropdown-eyebrow">WORKSPACE RESULTS</span>
                  {searchResults.length ? (
                    searchResults.map((item) => (
                      <Link
                        className="search-result"
                        to={item.href}
                        key={item.id}
                        onClick={() => {
                          setSearchOpen(false);
                          setSearch('');
                        }}
                      >
                        <span className="search-result-icon">
                          {item.id === 'hospital' ? 'H' : item.id === 'profile' ? initials : '⌕'}
                        </span>
                        <span>
                          <strong>{item.title}</strong>
                          <small>{item.detail}</small>
                        </span>
                        <span className="search-result-enter">↵</span>
                      </Link>
                    ))
                  ) : (
                    <p className="dropdown-empty">No matching workspace results.</p>
                  )}
                </div>
              )}
            </div>

            <div className="topbar-menu-anchor" ref={notificationMenuRef}>
              <button
                className={`topbar-icon-button${openMenu === 'notifications' ? ' is-open' : ''}`}
                type="button"
                aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
                aria-expanded={openMenu === 'notifications'}
                onClick={() =>
                  setOpenMenu((current) =>
                    current === 'notifications' ? null : 'notifications',
                  )
                }
              >
                <BellIcon />
                {unreadCount > 0 && (
                  <span className="notification-count">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
              {openMenu === 'notifications' && (
                <section className="topbar-dropdown notifications-dropdown">
                  <div className="dropdown-heading">
                    <div>
                      <span className="dropdown-eyebrow">YOUR WORKSPACE</span>
                      <h2>Notifications</h2>
                    </div>
                    {unreadCount > 0 && (
                      <span className="dropdown-count">{unreadCount} new</span>
                    )}
                  </div>
                  {notificationError ? (
                    <p className="dropdown-error">
                      Notifications could not be loaded: {notificationError}
                    </p>
                  ) : notificationsLoading ? (
                    <div className="dropdown-empty-state">
                      <span className="auth-spinner" aria-hidden="true" />
                      <p>Loading notifications…</p>
                    </div>
                  ) : notifications.length ? (
                    <div className="notification-list">
                      {notifications.map((notification) => (
                        <article className="notification-item" key={notification.id}>
                          <span
                            className={`notification-status${notification.read_at ? '' : ' is-unread'}`}
                          />
                          <div>
                            <h3>{notification.title}</h3>
                            {notification.message && <p>{notification.message}</p>}
                            <time dateTime={notification.created_at}>
                              {new Intl.DateTimeFormat(undefined, {
                                dateStyle: 'medium',
                                timeStyle: 'short',
                              }).format(new Date(notification.created_at))}
                            </time>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <div className="dropdown-empty-state">
                      <span className="empty-bell">
                        <BellIcon />
                      </span>
                      <strong>You’re all caught up</strong>
                      <p>New workspace notifications will appear here.</p>
                    </div>
                  )}
                </section>
              )}
            </div>

            <div className="topbar-menu-anchor" ref={profileMenuRef}>
              <button
                className={`avatar-menu-button${openMenu === 'profile' ? ' is-open' : ''}`}
                type="button"
                aria-label="Open account menu"
                aria-expanded={openMenu === 'profile'}
                onClick={() =>
                  setOpenMenu((current) => (current === 'profile' ? null : 'profile'))
                }
              >
                <span className="user-avatar">{initials}</span>
                <span className="avatar-account-name">
                  <strong>{profile?.full_name || user?.email}</strong>
                  <small>{roleLabel}</small>
                </span>
                <ChevronIcon />
              </button>
              {openMenu === 'profile' && (
                <div className="topbar-dropdown profile-dropdown">
                  <div className="profile-dropdown-person">
                    <span className="user-avatar user-avatar-large">{initials}</span>
                    <span>
                      <strong>{profile?.full_name || 'Account'}</strong>
                      <small>{user?.email}</small>
                    </span>
                  </div>
                  <div className="dropdown-divider" />
                  <Link
                    className="profile-dropdown-link"
                    to={`${basePath}/profile`}
                    onClick={() => setOpenMenu(null)}
                  >
                    <span className="dropdown-link-icon">◎</span> Profile
                  </Link>
                  <Link
                    className="profile-dropdown-link"
                    to={`${basePath}/settings`}
                    onClick={() => setOpenMenu(null)}
                  >
                    <span className="dropdown-link-icon">⚙</span> Settings
                  </Link>
                  {menuError && (
                    <p className="dropdown-error" role="alert">
                      {menuError}
                    </p>
                  )}
                  <div className="dropdown-divider" />
                  <button
                    className="profile-dropdown-link profile-dropdown-logout"
                    type="button"
                    onClick={() => void handleSignOut()}
                  >
                    <span className="dropdown-link-icon">↗</span> Log out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="workspace-main" id="main-content" tabIndex="-1">
          <div className="workspace-content">
            {hospitalError && (
              <p className="auth-notice auth-notice-error" role="alert">
                Hospital workspace could not be loaded: {hospitalError}
              </p>
            )}
            {(hospitalRealtime.error || notificationRealtime.error) && (
              <p className="auth-notice auth-notice-error" role="status">
                Live updates are unavailable for part of this workspace. Refresh
                to reconnect.
              </p>
            )}
            <Outlet
              context={{
                hospital,
                hospitalLoading: Boolean(profile?.hospital_id) && !hospital && !hospitalError,
                hospitalRealtimeStatus: hospitalRealtime.status,
                hospitalRealtimeError: hospitalRealtime.error,
                notificationRealtimeStatus: notificationRealtime.status,
                notificationRealtimeError: notificationRealtime.error,
                unreadCount,
              }}
            />
          </div>
        </main>
      </div>
    </div>
  );
}
