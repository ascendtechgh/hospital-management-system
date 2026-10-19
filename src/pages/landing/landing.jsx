import { useState } from 'react';

const productViews = [
  {
    name: 'Patients',
    image: '/landing/patients.webp',
    description:
      'Register once, find anyone fast, and keep demographics and insurance details together.',
    alt: 'AscendHMS patient list with identifiers, age, contact details and insurance',
  },
  {
    name: 'Appointments',
    image: '/landing/appointments.webp',
    description:
      'See the day at a glance and keep appointments connected to the right patient and team.',
    alt: 'AscendHMS appointments workspace',
  },
  {
    name: 'Laboratory',
    image: '/landing/laboratory.webp',
    description:
      'Track investigations from request to result with a queue organized around your team.',
    alt: 'AscendHMS laboratory workspace',
  },
  {
    name: 'Pharmacy',
    image: '/landing/pharmacy.webp',
    description:
      'Move from prescription to dispensing while keeping pharmacy work in one focused view.',
    alt: 'AscendHMS pharmacy workspace',
  },
  {
    name: 'Billing',
    image: '/landing/billing.webp',
    description:
      'Bring invoices, payments, patient and insurer shares, and NHIS claims together.',
    alt: 'AscendHMS billing workspace',
  },
];

const capabilities = [
  {
    number: '01',
    title: 'Clinical care',
    description: 'A continuous view of the patient, from triage through consultation.',
    items: [
      'Consultation queue and workspace',
      'Nursing vitals and care tasks',
      'Patient records and history',
      'Diagnoses and prescriptions per visit',
    ],
    icon: '✳',
  },
  {
    number: '02',
    title: 'Diagnostics',
    description: 'Keep each request moving and every result tied to its patient.',
    items: [
      'Laboratory orders with priority',
      'Lab queue by status',
      'Results recorded against the patient',
      'Lab inventory and analytics',
    ],
    icon: '⌕',
  },
  {
    number: '03',
    title: 'Pharmacy',
    description: 'A clear path from prescriptions to dispensing and inventory.',
    items: [
      'Prescriptions from consultations',
      'Dispensing records',
      'Pharmacy queue',
      'Pharmacy inventory',
    ],
    icon: '＋',
  },
  {
    number: '04',
    title: 'Finance & claims',
    description: 'See the financial picture across patients and insurers.',
    items: [
      'Invoices and payments',
      'Patient and insurer shares',
      'NHIS claim drafts and review',
      'NHIA tariff catalogue',
    ],
    icon: '↗',
  },
  {
    number: '05',
    title: 'Operations',
    description: 'Give administrators the tools to support the whole hospital.',
    items: [
      'Appointments and department queues',
      'Staff accounts and roles',
      'Reports with CSV export',
      'Notifications and staff messages',
    ],
    icon: '▦',
  },
];

const teams = [
  {
    number: '01',
    title: 'Doctors',
    description: 'A clear queue and one workspace for the visit.',
    tools: ['Consultation queue', 'Diagnoses', 'Prescriptions', 'Lab requests'],
    icon: '✳',
  },
  {
    number: '02',
    title: 'Nurses',
    description: 'Vitals and care tasks without the clutter.',
    tools: ['Vitals', 'Care tasks', 'Patient list'],
    icon: '＋',
  },
  {
    number: '03',
    title: 'Laboratory staff',
    description: 'Work through requests by priority and status.',
    tools: ['Lab queue', 'Orders', 'Results', 'Inventory'],
    icon: '⌕',
  },
  {
    number: '04',
    title: 'Pharmacy staff',
    description: 'From prescription to dispensing in one place.',
    tools: ['Prescriptions', 'Dispensing', 'Inventory'],
    icon: '◈',
  },
  {
    number: '05',
    title: 'Reception & billing',
    description: 'Register, book and bill without switching systems.',
    tools: ['Registration', 'Appointments', 'Invoices', 'Payments'],
    icon: '▤',
  },
  {
    number: '06',
    title: 'Hospital administrators',
    description: 'Oversight of operations, people and claims.',
    tools: ['Overview', 'Staff', 'Reports', 'NHIS claims'],
    icon: '⌂',
  },
];

const workflow = [
  ['01', 'Patient', 'Arrives at the hospital'],
  ['02', 'Registration', 'One record, one identifier'],
  ['03', 'Appointment & queue', 'The right team, the right time'],
  ['04', 'Clinical care', 'Nursing and consultation'],
  ['05', 'Laboratory & pharmacy', 'Tests and medication'],
  ['06', 'Billing & claims', 'Invoices, payments, NHIS'],
  ['07', 'Reports & management', 'Oversight of the whole'],
];

const safeguards = [
  {
    title: 'Hospital-specific workspaces',
    description:
      "Each hospital works in its own workspace, and access to data is scoped to the signed-in hospital by database policy.",
  },
  {
    title: 'Signed-in access',
    description:
      "Staff use their own accounts to reach the application. There is no shared login to the hospital's data.",
  },
  {
    title: 'Role-based tools',
    description:
      'Each role gets its own navigation and actions, and role checks run in the database as well as in the interface.',
  },
  {
    title: 'Controlled staff accounts',
    description:
      'Administrators add staff. Deactivated accounts and locked workspaces are blocked from operational data.',
  },
];

function ArrowIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none">
      <path d="M4.25 10h11.5M10 4.25 15.75 10 10 15.75" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none">
      <path d="m4.5 10.25 3.5 3.5 7.5-7.5" />
    </svg>
  );
}

function Landing() {
  const [activeView, setActiveView] = useState(0);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const selectedView = productViews[activeView];

  const selectProductTab = (event, index) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const nextIndex = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? productViews.length - 1
        : (index + (event.key === 'ArrowRight' ? 1 : -1) + productViews.length) % productViews.length;
    setActiveView(nextIndex);
    document.getElementById(`product-tab-${nextIndex}`)?.focus();
  };

  return (
    <div className="landing">
      <header className="site-header">
        <a
          className="brand"
          href="/"
          aria-label="AscendHMS homepage"
          title="Go to homepage"
        >
          <img
            className="brand-mark"
            src="/branding/ascendhms-logo.png"
            alt="AscendHMS"
          />
        </a>
        <nav className="main-nav" aria-label="Main navigation">
          <a href="#product" onClick={() => setMobileNavOpen(false)}>Product</a>
          <a href="#capabilities" onClick={() => setMobileNavOpen(false)}>Features</a>
          <a href="#how-it-works" onClick={() => setMobileNavOpen(false)}>How it works</a>
          <a href="#security" onClick={() => setMobileNavOpen(false)}>Security</a>
        </nav>
        <div className="header-actions">
          <a className="sign-in-link" href="/login">
            Sign in
          </a>
          <a className="button button-small button-dark" href="/signup">
            Get started <ArrowIcon />
          </a>
          <button
            className={`mobile-menu-toggle${mobileNavOpen ? ' is-open' : ''}`}
            type="button"
            aria-label={mobileNavOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileNavOpen}
            aria-controls="mobile-site-nav"
            onClick={() => setMobileNavOpen((open) => !open)}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
        {mobileNavOpen && (
          <nav className="mobile-site-nav" id="mobile-site-nav" aria-label="Mobile navigation">
            <a href="#product" onClick={() => setMobileNavOpen(false)}>Product</a>
            <a href="#capabilities" onClick={() => setMobileNavOpen(false)}>Features</a>
            <a href="#how-it-works" onClick={() => setMobileNavOpen(false)}>How it works</a>
            <a href="#security" onClick={() => setMobileNavOpen(false)}>Security</a>
            <a href="/login" onClick={() => setMobileNavOpen(false)}>Sign in</a>
          </nav>
        )}
      </header>

      <main id="top">
        <section className="hero section-shell">
          <div className="hero-content">
            <h1>
              One system for
              <br />
              the <span>modern hospital.</span>
            </h1>
            <p className="hero-copy">
              AscendHMS brings patient records, clinical care, nursing, laboratory,
              pharmacy and hospital administration into one connected workspace.
              Teams can work from a shared patient record, with available features
              depending on your hospital's deployment.
            </p>
            <div className="hero-actions">
              <a className="button button-dark" href="/signup">
                Get started <ArrowIcon />
              </a>
              <a className="button button-light" href="#product">
                Explore AscendHMS
              </a>
            </div>
            <div className="hero-proof">
              <span>
                <CheckIcon /> Role-based workspaces
              </span>
              <span>
                <CheckIcon /> NHIS workflow support
              </span>
              <span>
                <CheckIcon /> Desktop, tablet and phone
              </span>
            </div>
          </div>

          <div className="hero-visual" aria-label="AscendHMS in action">
            <div className="hero-visual-glow" />
            <div className="hero-window">
              <div className="window-topbar">
                <div className="window-dots" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </div>
                <div className="window-address">
                  <span className="address-lock">⌑</span> ascendhms.com/app
                </div>
                <span className="window-avatar">A</span>
              </div>
              <img
                className="hero-screen"
                src="/landing/patients.webp"
                alt="AscendHMS patient list with identifiers, age, contact details and insurance"
              />
            </div>
            <div className="floating-note">
              <span className="note-icon">✓</span>
              <span>
                <strong>One connected record</strong>
                <small>Every team, in sync</small>
              </span>
            </div>
            <div className="hero-caption">
              <span className="caption-pulse" />
              A clearer view of hospital operations
            </div>
          </div>
          <a className="scroll-cue" href="#product" aria-label="Scroll to product">
            <span />
          </a>
        </section>

        <section className="product-section section-shell" id="product">
          <div className="section-heading product-heading">
            <div>
              <p className="section-kicker">The product</p>
              <h2>See the system your teams will use.</h2>
            </div>
            <p className="section-intro">
              Explore the AscendHMS interface preview, shown with sample
              data to illustrate how teams can work in one connected system.
            </p>
          </div>
          <div className="product-demo">
            <div className="product-sidebar">
              <a className="demo-brand" href="#top">
                <img src="/branding/ascendhms-logo.png" alt="" />
                <span>Ascend<span>HMS</span></span>
              </a>
              <span className="demo-side-label">WORKSPACE</span>
              <div className="demo-nav-item demo-nav-active">
                <span className="demo-nav-icon">▦</span> Overview
              </div>
              <div className="demo-nav-item">
                <span className="demo-nav-icon">◉</span> Patients
              </div>
              <div className="demo-nav-item">
                <span className="demo-nav-icon">▣</span> Appointments
              </div>
              <div className="demo-nav-item">
                <span className="demo-nav-icon">⌕</span> Laboratory
              </div>
              <div className="demo-nav-item">
                <span className="demo-nav-icon">◈</span> Pharmacy
              </div>
              <div className="demo-nav-item">
                <span className="demo-nav-icon">↗</span> Billing
              </div>
              <div className="demo-sidebar-bottom">
                <span className="sidebar-avatar">A</span>
                <span>
                  <strong>Sample account</strong>
                  <small>Illustrative workspace</small>
                </span>
                <span className="sidebar-more">···</span>
              </div>
            </div>
            <div className="product-screen-area">
              <div className="product-screen-head">
                <div>
                  <span className="screen-overline">WORKSPACE / {selectedView.name.toUpperCase()}</span>
                  <h3>{selectedView.name}</h3>
                  <p>{selectedView.description}</p>
                </div>
                <span className="screen-status screen-status-preview">
                  <i /> Interface preview
                </span>
              </div>
              <div className="product-tabs" role="tablist" aria-label="Product screens">
                {productViews.map((view, index) => (
                  <button
                    className={`product-tab${activeView === index ? ' is-active' : ''}`}
                    id={`product-tab-${index}`}
                    key={view.name}
                    type="button"
                    role="tab"
                    aria-selected={activeView === index}
                    aria-controls="product-screen"
                    tabIndex={activeView === index ? 0 : -1}
                    onKeyDown={(event) => selectProductTab(event, index)}
                    onClick={() => setActiveView(index)}
                  >
                    {view.name}
                  </button>
                ))}
              </div>
              <div
                className="product-image-frame"
                id="product-screen"
                role="tabpanel"
                aria-labelledby={`product-tab-${activeView}`}
              >
                <img src={selectedView.image} alt={selectedView.alt} />
              </div>
              <div className="screen-foot">
                <span>AscendHMS <span className="screen-foot-dot">·</span> Product preview</span>
                <span>Sample data</span>
              </div>
            </div>
          </div>
          <p className="product-disclaimer">
            Illustrative interface previews use sample data and are not a live hospital workspace. Confirm enabled modules during deployment.
          </p>
        </section>

        <section className="capabilities-section" id="capabilities">
          <div className="section-shell">
            <div className="section-heading">
              <div>
                <p className="section-kicker">What it covers</p>
                <h2>The core of hospital work, in one place.</h2>
              </div>
              <p className="section-intro">
                From the front desk to the pharmacy counter and the claims
                office.
              </p>
            </div>
            <div className="capability-grid">
              {capabilities.map((capability) => (
                <article className="capability-card" key={capability.number}>
                  <div className="card-topline">
                    <span className="capability-icon">{capability.icon}</span>
                    <span className="card-number">{capability.number}</span>
                  </div>
                  <h3>{capability.title}</h3>
                  <p className="capability-description">{capability.description}</p>
                  <ul className="check-list">
                    {capability.items.map((item) => (
                      <li key={item}>
                        <CheckIcon /> {item}
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
              <aside className="connected-note">
                <div className="connected-symbol" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
                <p className="section-kicker">One connected record</p>
                <h3>Care works better when it connects.</h3>
                <p>
                  Every department works from the same patient, so information
                  entered once is available where it is needed.
                </p>
                <a href="#how-it-works">
                  See how it works <ArrowIcon />
                </a>
              </aside>
            </div>
          </div>
        </section>

        <section className="teams-section section-shell" id="teams">
          <div className="section-heading">
            <div>
              <p className="section-kicker">For every team</p>
              <h2>Built for the whole hospital.</h2>
            </div>
            <p className="section-intro">
              Everyone signs in to the same system and sees the tools that
              belong to their work.
            </p>
          </div>
          <div className="teams-grid">
            {teams.map((team) => (
              <article className="team-card" key={team.number}>
                <div className="team-card-head">
                  <span className="team-icon">{team.icon}</span>
                  <span className="card-number">{team.number}</span>
                </div>
                <h3>{team.title}</h3>
                <p>{team.description}</p>
                <div className="tool-tags">
                  {team.tools.map((tool) => (
                    <span key={tool}>{tool}</span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="workflow-section" id="how-it-works">
          <div className="section-shell">
            <div className="section-heading workflow-heading">
              <div>
                <p className="section-kicker">How it works</p>
                <h2>From arrival to reporting, one connected flow.</h2>
              </div>
              <p className="section-intro">
                A patient is registered once. Every department that follows
                works from that record.
              </p>
            </div>
            <div className="workflow-track">
              {workflow.map(([number, title, detail]) => (
                <article className="workflow-step" key={number}>
                  <div className="workflow-marker">
                    <span>{number}</span>
                  </div>
                  <p className="workflow-step-label">STEP {number}</p>
                  <h3>{title}</h3>
                  <p className="workflow-detail">{detail}</p>
                </article>
              ))}
            </div>
            <p className="workflow-note">
              <span>↗</span>
              Every hospital works differently. Teams use the parts they need,
              in the order that suits them; emergencies, walk-ins and direct
              investigations do not have to follow this path.
            </p>
          </div>
        </section>

        <section className="security-section section-shell" id="security">
          <div className="security-intro">
            <p className="section-kicker">Security &amp; trust</p>
            <h2>Access that follows responsibility.</h2>
            <p>
              Clear, verifiable controls built into how the application works.
            </p>
            <div className="security-seal">
              <span className="seal-icon">⌑</span>
              <span>
                <strong>Designed around roles</strong>
                <small>Access scoped to responsibility</small>
              </span>
            </div>
          </div>
          <div className="safeguard-list">
            {safeguards.map((safeguard, index) => (
              <article className="safeguard" key={safeguard.title}>
                <span className="safeguard-number">0{index + 1}</span>
                <div>
                  <h3>{safeguard.title}</h3>
                  <p>{safeguard.description}</p>
                </div>
                <span className="safeguard-check">
                  <CheckIcon />
                </span>
              </article>
            ))}
          </div>
          <p className="security-footnote">
            Hosting, data-protection requirements and security reviews are
            agreed with each hospital as part of deployment.
          </p>
        </section>

        <section className="closing-section section-shell">
          <div className="closing-card">
            <div className="closing-orb closing-orb-one" />
            <div className="closing-orb closing-orb-two" />
            <div className="closing-content">
              <p className="closing-kicker">A better way to work together</p>
              <h2>Bring your hospital operations into one system.</h2>
              <p>
                Set up your hospital workspace, add your staff, and give every
                team the tools for their work.
              </p>
              <div className="closing-actions">
                <a className="button button-white" href="/signup">
                  Get started <ArrowIcon />
                </a>
                <a className="closing-sign-in" href="/login">
                  Sign in
                </a>
              </div>
            </div>
            <div className="closing-decoration" aria-hidden="true">
              <div className="closing-cross">+</div>
              <span className="closing-decoration-label">ASCENDHMS</span>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="footer-main section-shell">
          <a
            className="brand footer-brand"
            href="/"
            aria-label="AscendHMS homepage"
            title="Go to homepage"
          >
            <img
              className="brand-mark"
              src="/branding/ascendhms-logo.png"
              alt="AscendHMS"
            />
          </a>
          <p className="footer-description">
            Hospital management, thoughtfully connected.
          </p>
          <nav className="footer-nav" aria-label="Footer navigation">
            <a href="#product">Product</a>
            <a href="#capabilities">Features</a>
            <a href="#how-it-works">How it works</a>
            <a href="#security">Security</a>
            <a href="/login">Sign in</a>
          </nav>
        </div>
        <div className="footer-bottom section-shell">
          <span>AscendHMS — Hospital Management System by Ascend Technologies</span>
          <span>© 2026 Ascend Technologies</span>
        </div>
      </footer>
    </div>
  );
}

export default Landing;
