/* ============================================================
   Kamkhadze PA — Case Manager Application
   Requires: case-manager-auth.js loaded first
   ============================================================ */

// ---- State ----
const State = {
  cases: [],
  view: 'dashboard',    // dashboard | cases | case-detail | zoom | settings
  activeTab: 'overview',
  selectedCaseId: null,
  filter: { search: '', stage: '', visaType: '' },
  emailDraft: null,
  emailLang: 'en',
  zoom: {
    meetings: JSON.parse(localStorage.getItem('km_zoom_meetings') || '[]'),
    showScheduleForm: false,
    scheduleClient: null,
    scheduleCase: '',
    scheduleDate: '',
    scheduleTime: '10:00',
    scheduleDuration: '45',
    scheduleTopic: '',
    clientSearch: '',
  },
  email: {
    tab: 'inbox',          // inbox | sent | drafts | templates | compose
    activeEmailId: null,
    composeData: { to: '', subject: '', body: '' },
    search: '',
    inbox:  JSON.parse(localStorage.getItem('km_email_inbox')  || '[]'),
    sent:   JSON.parse(localStorage.getItem('km_email_sent')   || '[]'),
    drafts: JSON.parse(localStorage.getItem('km_email_drafts') || '[]'),
    notes:  JSON.parse(localStorage.getItem('km_email_notes')  || '{}'),
    templates: JSON.parse(localStorage.getItem('km_email_templates') || '[]'),
    showNewTemplate: false,
    newTpl: { name: '', subject: '', body: '' },
  },
  dropbox: {
    tab: 'files',
    files:     JSON.parse(localStorage.getItem('km_dropbox_files') || '[]'),
    notes:     JSON.parse(localStorage.getItem('km_dropbox_notes') || '{}'),
    activeFileId: null,
    search: '',
  },
  team: JSON.parse(localStorage.getItem('km_team') || JSON.stringify([
    { id: 'u1', name: 'Ana Kamkhadze',  email: 'anka@esq.mba',     role: 'Attorney',       initials: 'AK', color: '#c9a84c' },
    { id: 'u2', name: 'Team Member 2',  email: 'member2@esq.mba',  role: 'Paralegal',      initials: 'TM', color: '#60a5fa' },
    { id: 'u3', name: 'Team Member 3',  email: 'member3@esq.mba',  role: 'Case Assistant', initials: 'CA', color: '#4ade80' },
  ])),
};

// ---- Encrypted Persistence ----
// All case data is AES-256-GCM encrypted before writing to localStorage.
// The encryption key is derived from the user's password (never stored).
const ENC_CASES_KEY = 'km_cases_enc_v1';
const PLAIN_LEGACY  = 'km_cases'; // unencrypted key from pre-auth version

const Storage = {
  async save() {
    try {
      const json = JSON.stringify(State.cases);
      const blob = await Auth.encrypt(json);
      localStorage.setItem(ENC_CASES_KEY, blob);
      // Remove any leftover plaintext data
      localStorage.removeItem(PLAIN_LEGACY);
    } catch (e) {
      console.error('Save failed:', e);
    }
  },
  async load() {
    try {
      const blob = localStorage.getItem(ENC_CASES_KEY);
      if (blob) {
        const json = await Auth.decrypt(blob);
        State.cases = JSON.parse(json);
        return;
      }
      // Migrate unencrypted legacy data if present
      const legacy = localStorage.getItem(PLAIN_LEGACY);
      if (legacy) {
        State.cases = JSON.parse(legacy);
        await Storage.save(); // re-save encrypted
        localStorage.removeItem(PLAIN_LEGACY);
        return;
      }
      State.cases = [];
    } catch {
      State.cases = [];
    }
  },
};

// ---- Import helpers ----
function _visaFromCase(s) {
  const u = (s||'').toUpperCase();
  if (/EB[- ]?1[1A]|EB11|EB1A/.test(u)) return 'EB-1A';
  if (/EB[- ]?2|NIW/.test(u)) return 'EB-2 NIW';
  if (/\bO[- ]?1/.test(u)) return 'O-1A';
  if (/\bE2\b|E2\s|E-2/.test(u)) return 'E-2';
  if (/H[- ]?1B/.test(u)) return 'H-1B';
  if (/\bL[- ]?1/.test(u)) return 'L-1A';
  if (/\bTN\b/.test(u)) return 'TN';
  if (/\bP[- ]?1\b/.test(u)) return 'P-1';
  return 'Other';
}
function _stageFromData(fd, r, exp) {
  const f=(fd||'').toLowerCase(), rx=(r||'').toLowerCase(), ex=(exp||'').toLowerCase();
  if (/denied/.test(f)||/denied/.test(rx)) return 'denied';
  if (/withdrawn|noid/.test(f)||/withdrawn/.test(rx)) return 'closed';
  if (/approved/.test(f)||/approved/.test(rx)||/^approved$/i.test(rx.trim())) return 'approved';
  if (/\brfe\b/.test(f)||/\brfe\b/.test(rx)) return 'rfe';
  if (/interview|iv scheduled/.test(f)||/interview/.test(rx)) return 'filed';
  if (/filed/.test(f)||/^[a-z]{2,3}\d{7}/i.test(rx)) return 'filed';
  if (/nvc/.test(f)||/nvc/.test(rx)) return 'filed';
  if (/docs? pending/i.test(rx)) return 'documents';
  if (/lpr/.test(ex)) return 'approved';
  return 'lead';
}
function _xDate(s) {
  const m=(s||'').match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](20\d{2})/);
  return m?`${m[3]}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`:''
}
function _xApprDate(fd,r) {
  const src=/approved/i.test(fd)?fd:(/approved/i.test(r)?r:'');
  return _xDate(src);
}
function _xReceipt(s) {
  const m=(s||'').match(/\b([A-Z]{2,3}\d{7,13})\b/i);
  return m?m[1].toUpperCase():'';
}
function _xAmt(s) {
  const n=parseFloat((s||'').replace(/[\$,\s]/g,''));
  return (!isNaN(n)&&n>0)?String(n):'';
}

// ---- Helpers ----
function uuid() {
  return 'c' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtDateInput(iso) {
  if (!iso) return '';
  return iso.split('T')[0];
}

function today() {
  return new Date().toISOString().split('T')[0];
}

function getCase(id) {
  return State.cases.find(c => c.id === id);
}

const STAGES = [
  { value: 'lead',           label: 'Lead' },
  { value: 'onboarding',     label: 'Onboarding' },
  { value: 'consultation',   label: 'Consultation' },
  { value: 'representation', label: 'Representation' },
  { value: 'documents',      label: 'Document Collection' },
  { value: 'petition',       label: 'Petition Drafting' },
  { value: 'filed',          label: 'Filed' },
  { value: 'rfe',            label: 'RFE Received' },
  { value: 'approved',       label: 'Approved' },
  { value: 'denied',         label: 'Denied' },
  { value: 'closed',         label: 'Closed' },
];

const VISA_TYPES = [
  'O-1A', 'EB-1A', 'EB-1C', 'EB-2 NIW', 'H-1B', 'L-1A', 'L-1B', 'E-2', 'TN', 'P-1', 'Other'
];

const STAGE_ORDER = STAGES.map(s => s.value);

// Document templates by visa type
const DOC_TEMPLATES = {
  'O-1A': [
    { category: 'Personal Documents', items: [
      'Passport (all pages)', 'Current visa / status documents', 'Professional CV / Resume',
      'Professional headshot (high-res)', 'List of all prior U.S. entries'
    ]},
    { category: 'Criterion Evidence', items: [
      'Awards & prizes documentation', 'Press / media articles (original + translations)',
      'Membership certificates (elite organizations)', 'Judge/reviewer invitations & outcome letters',
      'Original contributions evidence (patents, publications, market impact)',
      'Scholarly articles authored', 'High compensation evidence (offers, contracts, W-2s)',
      'Critical role documentation (board resolutions, org charts)'
    ]},
    { category: 'Employer / Petitioner', items: [
      'Employer support letter', 'Offer letter / contract', 'Company incorporation / registration docs',
      'Company financials / funding docs (if startup)', 'Advisory board documentation'
    ]},
    { category: 'Expert Recommendation Letters', items: [
      'Recommendation letter #1', 'Recommendation letter #2', 'Recommendation letter #3',
      'Recommendation letter #4 (optional)', 'Recommendation letter #5 (optional)'
    ]},
    { category: 'Financial', items: [
      'Most recent tax return (if U.S.)', 'Bank statements (3 months)'
    ]},
  ],
  'EB-1A': [
    { category: 'Personal Documents', items: [
      'Passport (all pages)', 'Current visa / status documents', 'Professional CV / Resume',
      'Professional headshot', 'All prior U.S. entries list', 'Birth certificate + translation'
    ]},
    { category: 'Criterion Evidence', items: [
      'Major national/international awards', 'Press / media coverage articles',
      'Elite membership certificates', 'Judging activity documentation',
      'Original scholarly/scientific contributions', 'Scholarly articles (with citation data)',
      'Artistic exhibition records', 'Leading/critical role documentation',
      'High salary evidence', 'Commercial success documentation'
    ]},
    { category: 'Support Letters', items: [
      'Expert recommendation letter #1', 'Expert recommendation letter #2',
      'Expert recommendation letter #3', 'Expert recommendation letter #4',
      'Expert recommendation letter #5 (optional)'
    ]},
    { category: 'I-140 Specific', items: [
      'National interest statement (if applicable)', 'Future employment / self-employment plan',
      'Company/organization evidence (if self-petitioning)'
    ]},
    { category: 'Financial', items: [
      'Most recent tax return', 'Bank statements (3 months)'
    ]},
  ],
  'EB-2 NIW': [
    { category: 'Personal Documents', items: [
      'Passport (all pages)', 'Current immigration status docs', 'Detailed CV / Resume',
      'Academic transcripts & diplomas', 'Professional licenses / certifications'
    ]},
    { category: 'NIW Evidence', items: [
      'Substantial merit — field description & national importance statement',
      'Well-positioned evidence (publications, grants, patents)',
      'Balance of benefits — future plans description',
      'Research publications list with citations', 'Grant funding documentation',
      'Conference presentations', 'Peer review / editorial roles'
    ]},
    { category: 'Support Letters', items: [
      'Independent expert recommendation #1', 'Independent expert recommendation #2',
      'Independent expert recommendation #3', 'Institutional support letter (optional)'
    ]},
  ],
};

const DEFAULT_DOC_TEMPLATE = [
  { category: 'Personal Documents', items: [
    'Passport (all pages)', 'Current visa / status documents', 'Professional CV / Resume'
  ]},
  { category: 'Case-Specific Documents', items: [
    'Primary evidence document #1', 'Primary evidence document #2', 'Support letter #1'
  ]},
];

function getDocTemplate(visaType) {
  return DOC_TEMPLATES[visaType] || DEFAULT_DOC_TEMPLATE;
}

function buildDefaultDocs(visaType) {
  const template = getDocTemplate(visaType);
  const docs = [];
  template.forEach(cat => {
    cat.items.forEach(name => {
      docs.push({ id: uuid(), category: cat.category, name, status: 'pending', notes: '' });
    });
  });
  return docs;
}

// ---- New Case Factory ----
function newCase(overrides = {}) {
  return {
    id: uuid(),
    firstName: '', lastName: '', email: '', phone: '',
    nationality: '', location: '', company: '',
    visaType: 'O-1A',
    stage: 'lead',
    uscisReceiptNumber: '', consulateCase: '', consulateName: '',
    priorityDate: '', filingDate: '', approvalDate: '',
    consultationDate: '', consultationTime: '', consultationDuration: '60',
    consultationNotes: '', consultationConfirmed: false,
    retainerPaid: false, retainerAmount: '', retainerDate: '',
    filingFeesPaid: false, filingFeesAmount: '',
    dropboxLink: '',
    documents: [],
    exhibits: [],
    petition: {
      coverLetter: '',
      executiveSummary: '',
      legalBrief: '',
      evidenceIndex: '',
      notes: '',
    },
    statusHistory: [],
    emailLog: [],
    notes: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ---- Toast notifications ----
function toast(msg, type = 'success') {
  const container = document.getElementById('toast-container') ||
    (() => {
      const d = document.createElement('div');
      d.id = 'toast-container';
      d.className = 'toast-container';
      document.body.appendChild(d);
      return d;
    })();

  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<span class="toast-icon ${type === 'warn' ? 'warn' : ''}">${type === 'warn' ? '⚠' : '✓'}</span> ${msg}`;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3100);
}

// ---- Render helpers ----
function stageBadge(stage) {
  const label = STAGES.find(s => s.value === stage)?.label || stage;
  return `<span class="badge badge-${stage}">${label}</span>`;
}

function docStatusBadge(status) {
  const labels = { pending: 'Pending', uploaded: 'Uploaded', reviewed: 'Reviewed', approved: 'Approved', missing: 'Missing' };
  return `<span class="badge badge-doc-${status}">${labels[status] || status}</span>`;
}

function svgIcon(name) {
  const icons = {
    dashboard: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>`,
    cases: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>`,
    calendar: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>`,
    email: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>`,
    docs: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>`,
    petition: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>`,
    status: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>`,
    overview: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>`,
    add: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>`,
    back: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>`,
    edit: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>`,
    trash: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>`,
    dropbox: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2L6 6l6 4 6-4-6-4zM6 14l6 4 6-4-6-4-6 4zM6 6l-4 4 4 4 6-4-6-4zM18 6l4 4-4 4-6-4 6-4z"/></svg>`,
    copy: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>`,
    link: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/></svg>`,
    check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 13l4 4L19 7"/></svg>`,
  };
  return icons[name] || '';
}

// ---- SVG icon element ----
function icon(name, cls = '') {
  return `<span class="nav-icon ${cls}">${svgIcon(name)}</span>`;
}

// ---- Sidebar ----
function renderSidebar() {
  const activeView = State.view;
  const activeCaseId = State.selectedCaseId;

  const counts = {
    active: State.cases.filter(c => !['approved','denied','closed'].includes(c.stage)).length,
    consultation: State.cases.filter(c => c.stage === 'consultation').length,
    rfe: State.cases.filter(c => c.stage === 'rfe').length,
  };

  return `
    <aside class="sidebar" id="sidebar">
      <div class="sidebar-logo">
        <a href="index.html" class="logo">ESQ<span>.</span>MBA</a>
        <div class="sidebar-sub">Case Manager</div>
      </div>
      <nav class="sidebar-nav">
        <div class="nav-section-label">Overview</div>
        <button class="nav-item ${activeView === 'dashboard' ? 'active' : ''}" onclick="navigate('dashboard')">
          ${icon('dashboard')} Dashboard
        </button>
        <button class="nav-item ${activeView === 'cases' ? 'active' : ''}" onclick="navigate('cases')">
          ${icon('cases')} All Cases
          ${counts.active ? `<span class="nav-badge">${counts.active}</span>` : ''}
        </button>
        ${counts.consultation ? `
        <button class="nav-item" onclick="navigate('cases'); setFilter('stage','consultation')">
          ${icon('calendar')} Consultations
          <span class="nav-badge">${counts.consultation}</span>
        </button>` : ''}
        ${counts.rfe ? `
        <button class="nav-item" onclick="navigate('cases'); setFilter('stage','rfe')">
          ${icon('docs')} RFE Pending
          <span class="nav-badge" style="background:var(--red-dim);color:var(--red);border-color:rgba(248,113,113,0.2)">${counts.rfe}</span>
        </button>` : ''}
        ${activeCaseId ? (() => {
          const c = getCase(activeCaseId);
          return c ? `
          <div class="nav-section-label" style="margin-top:16px">Current Case</div>
          <button class="nav-item active" onclick="navigate('case-detail','${c.id}')">
            ${icon('overview')} ${c.firstName} ${c.lastName}
          </button>` : '';
        })() : ''}
        <div class="nav-section-label" style="margin-top:16px">Integrations</div>
        <button class="nav-item ${activeView === 'email' ? 'active' : ''}" onclick="navigate('email')">
          ${icon('email')} Email
          ${(() => { const unread = (State.email?.inbox||[]).filter(e => e.unread).length; return unread ? `<span class="nav-badge">${unread}</span>` : ''; })()}
        </button>
        <button class="nav-item ${activeView === 'zoom' ? 'active' : ''}" onclick="navigate('zoom')">
          ${icon('calendar')} Zoom Meetings
        </button>
        <button class="nav-item ${activeView === 'dropbox' ? 'active' : ''}" onclick="navigate('dropbox')">
          ${icon('dropbox')} Dropbox Files
        </button>
        <div class="nav-section-label" style="margin-top:16px">Actions</div>
        <button class="nav-item" onclick="showAddCase()">
          ${icon('add')} New Case
        </button>
        <button class="nav-item ${activeView === 'settings' ? 'active' : ''}" onclick="navigate('settings')">
          ${icon('status')} Settings
        </button>
      </nav>
    </aside>`;
}

// ---- Dashboard ----
function renderDashboard() {
  const cases = State.cases;
  const total = cases.length;
  const active = cases.filter(c => !['approved','denied','closed'].includes(c.stage)).length;
  const approved = cases.filter(c => c.stage === 'approved').length;
  const rfe = cases.filter(c => c.stage === 'rfe').length;
  const filed = cases.filter(c => c.stage === 'filed').length;

  // Recent cases
  const recent = [...cases]
    .sort((a,b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .slice(0, 5);

  // Stage breakdown
  const stageBreakdown = STAGES.map(s => ({
    ...s, count: cases.filter(c => c.stage === s.value).length
  })).filter(s => s.count > 0);

  // Upcoming consultations
  const upcoming = cases.filter(c => c.consultationDate && !c.consultationConfirmed && new Date(c.consultationDate) >= new Date())
    .sort((a,b) => new Date(a.consultationDate) - new Date(b.consultationDate))
    .slice(0, 5);

  return `
    <div class="topbar">
      <div class="topbar-title">Dashboard</div>
      <div class="topbar-actions">
        <button class="btn btn-ghost" onclick="showImportCases()" style="margin-right:4px">
          ${icon('docs')} Import
        </button>
        <button class="btn btn-gold" onclick="showAddCase()">
          ${icon('add')} New Case
        </button>
      </div>
    </div>
    <div class="content">
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-card-label">Total Cases</div>
          <div class="stat-card-value">${total}</div>
          <div class="stat-card-sub">All clients on record</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-label">Active Cases</div>
          <div class="stat-card-value" style="color:var(--blue)">${active}</div>
          <div class="stat-card-sub">Currently in progress</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-label">Filed / Pending</div>
          <div class="stat-card-value" style="color:var(--yellow)">${filed}</div>
          <div class="stat-card-sub">Awaiting USCIS decision</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-label">Approved</div>
          <div class="stat-card-value" style="color:var(--green)">${approved}</div>
          <div class="stat-card-sub">Successful outcomes${total ? ` · ${Math.round(approved/total*100)}%` : ''}</div>
        </div>
      </div>

      ${rfe ? `
      <div class="panel" style="border-color:rgba(248,113,113,0.3);background:var(--red-dim)">
        <div style="display:flex;align-items:center;gap:10px;color:var(--red)">
          <strong>⚠ ${rfe} RFE${rfe>1?'s':''} Pending Response</strong>
          <button class="btn btn-sm btn-ghost" onclick="navigate('cases'); setFilter('stage','rfe')">View Cases →</button>
        </div>
      </div>` : ''}

      <div class="two-col" style="gap:24px">
        <div>
          <div class="panel-title mb-16">Recent Activity</div>
          ${recent.length ? recent.map(c => `
            <div class="flex-between" style="padding:12px 0;border-bottom:1px solid var(--border-2);cursor:pointer" onclick="navigate('case-detail','${c.id}')">
              <div>
                <div style="font-size:14px;font-weight:500;color:var(--text)">${c.firstName} ${c.lastName}</div>
                <div style="font-size:12px;color:var(--text-3)">${c.visaType} · Updated ${fmtDate(c.updatedAt)}</div>
              </div>
              ${stageBadge(c.stage)}
            </div>`).join('') : `<div class="text-muted">No cases yet.</div>`}
        </div>

        <div>
          <div class="panel-title mb-16">Pipeline by Stage</div>
          ${stageBreakdown.map(s => `
            <div class="progress-overview">
              <span class="progress-label" style="font-size:12px">${s.label}</span>
              <div class="progress-bar-wrap">
                <div class="progress-bar-fill" style="width:${total ? Math.round(s.count/total*100) : 0}%"></div>
              </div>
              <span class="progress-pct" style="font-size:12px">${s.count}</span>
            </div>`).join('') || `<div class="text-muted">No cases yet.</div>`}

          ${upcoming.length ? `
          <div class="divider"></div>
          <div class="panel-title mb-8" style="margin-top:0">Upcoming Consultations</div>
          ${upcoming.map(c => `
            <div class="flex-between" style="padding:10px 0;border-bottom:1px solid var(--border-2);cursor:pointer" onclick="navigate('case-detail','${c.id}')">
              <div>
                <div style="font-size:13.5px;color:var(--text)">${c.firstName} ${c.lastName}</div>
                <div style="font-size:12px;color:var(--text-3)">${fmtDate(c.consultationDate)} ${c.consultationTime ? '· ' + c.consultationTime : ''}</div>
              </div>
              <span class="badge badge-consultation">${c.visaType}</span>
            </div>`).join('')}` : ''}
        </div>
      </div>
    </div>`;
}

// ---- Cases List ----
function renderCasesList() {
  let cases = [...State.cases];
  const { search, stage, visaType } = State.filter;

  if (search) {
    const q = search.toLowerCase();
    cases = cases.filter(c =>
      `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      (c.uscisReceiptNumber || '').toLowerCase().includes(q) ||
      (c.visaType || '').toLowerCase().includes(q)
    );
  }
  if (stage) cases = cases.filter(c => c.stage === stage);
  if (visaType) cases = cases.filter(c => c.visaType === visaType);

  cases.sort((a,b) => STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage) || new Date(b.updatedAt) - new Date(a.updatedAt));

  const visaTypes = [...new Set(State.cases.map(c => c.visaType))];

  return `
    <div class="topbar">
      <div class="topbar-title">All Cases <em style="font-size:16px;font-family:var(--font-sans);font-style:normal;color:var(--text-3)">(${cases.length})</em></div>
      <div class="topbar-actions">
        <button class="btn btn-gold" onclick="showAddCase()">
          ${icon('add')} New Case
        </button>
      </div>
    </div>
    <div class="content">
      <div class="list-header">
        <div class="search-filter">
          <div class="search-box">
            <span class="search-icon" style="width:14px;height:14px">${svgIcon('docs')}</span>
            <input type="text" placeholder="Search name, email, receipt #…" value="${search}"
              oninput="State.filter.search=this.value; rerenderCasesList()" />
          </div>
          <select class="filter-select" onchange="State.filter.stage=this.value; rerenderCasesList()">
            <option value="">All Stages</option>
            ${STAGES.map(s => `<option value="${s.value}" ${stage===s.value?'selected':''}>${s.label}</option>`).join('')}
          </select>
          <select class="filter-select" onchange="State.filter.visaType=this.value; rerenderCasesList()">
            <option value="">All Visa Types</option>
            ${visaTypes.map(v => `<option value="${v}" ${visaType===v?'selected':''}>${v}</option>`).join('')}
          </select>
          ${(search||stage||visaType) ? `<button class="btn btn-ghost btn-sm" onclick="State.filter={search:'',stage:'',visaType:''}; rerenderCasesList()">Clear</button>` : ''}
        </div>
      </div>

      ${cases.length === 0 ? `
        <div class="empty-state">
          <div class="empty-state-icon">${svgIcon('cases')}</div>
          <h3>${State.cases.length === 0 ? 'No cases yet' : 'No matching cases'}</h3>
          <p>${State.cases.length === 0 ? 'Start by adding your first client case.' : 'Try adjusting your search or filters.'}</p>
          ${State.cases.length === 0 ? `<button class="btn btn-gold" onclick="showAddCase()">Add First Case</button>` : ''}
        </div>
      ` : `
        <table class="cases-table">
          <thead>
            <tr>
              <th>Client</th>
              <th>Visa</th>
              <th>Stage</th>
              <th>Receipt #</th>
              <th>Consultation</th>
              <th>Doc Progress</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            ${cases.map(c => {
              const docs = c.documents || [];
              const approvedDocs = docs.filter(d => d.status === 'approved' || d.status === 'reviewed').length;
              const docPct = docs.length ? Math.round(approvedDocs / docs.length * 100) : 0;
              return `
                <tr onclick="navigate('case-detail','${c.id}')">
                  <td>
                    <div class="client-name">${c.firstName} ${c.lastName}</div>
                    <div class="client-email">${c.email || '—'}</div>
                  </td>
                  <td><span class="badge badge-onboarding" style="background:transparent;border-color:var(--border-2);color:var(--text-2)">${c.visaType}</span></td>
                  <td>${stageBadge(c.stage)}</td>
                  <td style="font-family:monospace;font-size:12px;color:var(--text-3)">${c.uscisReceiptNumber || c.consulateCase || '—'}</td>
                  <td style="font-size:12px;color:var(--text-3)">${c.consultationDate ? fmtDate(c.consultationDate) + (c.consultationConfirmed ? ' ✓' : '') : '—'}</td>
                  <td style="min-width:100px">
                    ${docs.length ? `
                      <div style="display:flex;align-items:center;gap:8px">
                        <div style="flex:1;height:5px;background:var(--surface-3);border-radius:3px;overflow:hidden">
                          <div style="height:100%;width:${docPct}%;background:linear-gradient(90deg,var(--gold),var(--gold-light));border-radius:3px"></div>
                        </div>
                        <span style="font-size:11px;color:var(--text-3)">${docPct}%</span>
                      </div>` : '<span style="font-size:12px;color:var(--text-3)">—</span>'}
                  </td>
                  <td style="font-size:12px;color:var(--text-3)">${fmtDate(c.updatedAt)}</td>
                </tr>`;
            }).join('')}
          </tbody>
        </table>`}
    </div>`;
}

function rerenderCasesList() {
  document.getElementById('main-content').innerHTML = renderCasesList();
}

function setFilter(key, val) {
  State.filter[key] = val;
  setTimeout(() => rerenderCasesList(), 50);
}

// ---- Case Detail ----
function renderCaseDetail(caseId) {
  const c = getCase(caseId);
  if (!c) { navigate('cases'); return ''; }
  State.selectedCaseId = caseId;

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'schedule', label: 'Consultation' },
    { id: 'emails', label: 'Emails' },
    { id: 'documents', label: 'Documents' },
    { id: 'petition', label: 'Petition' },
    { id: 'status', label: 'USCIS Status' },
  ];

  const docs = c.documents || [];
  const approvedDocs = docs.filter(d => ['approved','reviewed'].includes(d.status)).length;
  const docPct = docs.length ? Math.round(approvedDocs / docs.length * 100) : 0;

  return `
    <div class="topbar">
      <div class="topbar-title">${c.firstName} ${c.lastName} <em>· ${c.visaType}</em></div>
      <div class="topbar-actions">
        <button class="btn btn-ghost btn-sm" onclick="showEditCase('${c.id}')">
          ${icon('edit')} Edit
        </button>
        <button class="btn btn-ghost btn-sm" onclick="advanceStage('${c.id}')">
          Advance Stage →
        </button>
      </div>
    </div>
    <div class="content">
      <button class="back-btn" onclick="navigate('cases')">
        ${icon('back')} Back to Cases
      </button>

      <div class="case-header">
        <div class="case-header-info">
          <h2>${c.firstName} ${c.lastName}</h2>
          <div class="case-meta">
            ${stageBadge(c.stage)}
            <div class="case-meta-item">${svgIcon('docs').replace('class="','class="nav-icon ')} <span>${c.visaType}</span></div>
            ${c.email ? `<div class="case-meta-item">✉ <span>${c.email}</span></div>` : ''}
            ${c.phone ? `<div class="case-meta-item">✆ <span>${c.phone}</span></div>` : ''}
            ${c.nationality ? `<div class="case-meta-item">🌐 <span>${c.nationality}</span></div>` : ''}
            ${c.uscisReceiptNumber ? `<div class="case-meta-item">USCIS: <span style="font-family:monospace">${c.uscisReceiptNumber}</span></div>` : ''}
          </div>
        </div>
        <div class="case-header-actions">
          ${c.email ? `<a href="mailto:${c.email}" class="btn btn-ghost btn-sm">${icon('email')} Email Client</a>` : ''}
        </div>
      </div>

      <div class="tabs">
        ${tabs.map(t => `
          <button class="tab-btn ${State.activeTab === t.id ? 'active' : ''}"
            onclick="switchTab('${t.id}', '${c.id}')">${t.label}</button>
        `).join('')}
      </div>

      <div id="tab-content">
        ${renderTab(State.activeTab, c, docPct)}
      </div>
    </div>`;
}

function switchTab(tabId, caseId) {
  State.activeTab = tabId;
  const c = getCase(caseId);
  if (!c) return;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  event.currentTarget?.classList.add('active');
  document.getElementById('tab-content').innerHTML = renderTab(tabId, c,
    c.documents?.length ? Math.round(c.documents.filter(d => ['approved','reviewed'].includes(d.status)).length / c.documents.length * 100) : 0
  );
}

function renderTab(tab, c, docPct) {
  switch (tab) {
    case 'overview':   return renderOverviewTab(c, docPct);
    case 'schedule':   return renderScheduleTab(c);
    case 'emails':     return renderEmailsTab(c);
    case 'documents':  return renderDocumentsTab(c);
    case 'petition':   return renderPetitionTab(c);
    case 'status':     return renderStatusTab(c);
    default:           return renderOverviewTab(c, docPct);
  }
}

// ---- Overview Tab ----
function renderOverviewTab(c, docPct) {
  const stageIdx = STAGE_ORDER.indexOf(c.stage);

  return `
    <div class="two-col">
      <div>
        <div class="panel">
          <div class="panel-title">Client Information</div>
          <div class="three-col" style="gap:12px">
            ${infoRow('Full Name', `${c.firstName} ${c.lastName}`)}
            ${infoRow('Email', c.email || '—')}
            ${infoRow('Phone', c.phone || '—')}
            ${infoRow('Nationality', c.nationality || '—')}
            ${infoRow('Location', c.location || '—')}
            ${infoRow('Company', c.company || '—')}
          </div>
        </div>

        <div class="panel">
          <div class="panel-title">Case Progress</div>
          <div class="progress-overview" style="margin-bottom:20px">
            <span class="progress-label">Stage</span>
            <div class="progress-bar-wrap">
              <div class="progress-bar-fill" style="width:${Math.round((stageIdx+1)/STAGE_ORDER.length*100)}%"></div>
            </div>
            <span class="progress-pct">${STAGES[stageIdx]?.label || '—'}</span>
          </div>
          <div class="progress-overview">
            <span class="progress-label">Documents</span>
            <div class="progress-bar-wrap">
              <div class="progress-bar-fill" style="width:${docPct}%"></div>
            </div>
            <span class="progress-pct">${docPct}%</span>
          </div>
        </div>

        <div class="panel">
          <div class="panel-title">Financial</div>
          <div class="two-col" style="gap:12px">
            ${infoRow('Retainer', c.retainerPaid ? `✓ Paid${c.retainerAmount ? ' · $'+c.retainerAmount : ''}` : '⏳ Pending', c.retainerPaid ? 'var(--green)' : 'var(--yellow)')}
            ${infoRow('Filing Fees', c.filingFeesPaid ? `✓ Paid${c.filingFeesAmount ? ' · $'+c.filingFeesAmount : ''}` : '⏳ Pending', c.filingFeesPaid ? 'var(--green)' : 'var(--text-3)')}
            ${c.retainerDate ? infoRow('Retainer Date', fmtDate(c.retainerDate)) : ''}
          </div>
        </div>
      </div>

      <div>
        <div class="panel">
          <div class="panel-title">Case Timeline</div>
          <div class="timeline">
            ${renderTimeline(c)}
          </div>
        </div>

        ${c.notes ? `
        <div class="panel">
          <div class="panel-title">Notes</div>
          <div style="font-size:14px;color:var(--text-2);line-height:1.75;white-space:pre-wrap">${escHtml(c.notes)}</div>
        </div>` : ''}

        <div class="panel">
          <div class="panel-title">Quick Actions</div>
          <div style="display:flex;flex-wrap:wrap;gap:8px">
            <button class="btn btn-ghost btn-sm" onclick="switchTab('emails','${c.id}'); State.emailDraft='consultation-confirm'; switchTab('emails','${c.id}')">
              ${icon('email')} Consultation Email
            </button>
            <button class="btn btn-ghost btn-sm" onclick="State.activeTab='emails'; switchTab('emails','${c.id}')">
              ${icon('email')} Send Update
            </button>
            <button class="btn btn-ghost btn-sm" onclick="State.activeTab='documents'; switchTab('documents','${c.id}')">
              ${icon('docs')} View Documents
            </button>
            ${c.uscisReceiptNumber ? `
            <a href="https://egov.uscis.gov/casestatus/mycasestatus.do?appReceiptNum=${c.uscisReceiptNumber}" target="_blank" class="btn btn-ghost btn-sm">
              ${icon('status')} Check USCIS Status ↗
            </a>` : ''}
            <button class="btn btn-ghost btn-sm" onclick="showRepAgreement('${c.id}')">
              ${icon('petition')} Rep. Agreement
            </button>
          </div>
        </div>
      </div>
    </div>`;
}

function infoRow(label, value, color = '') {
  return `
    <div style="margin-bottom:12px">
      <div style="font-size:10px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:var(--text-3);margin-bottom:3px">${label}</div>
      <div style="font-size:13.5px;color:${color || 'var(--text-2)'}">${value || '—'}</div>
    </div>`;
}

function renderTimeline(c) {
  const events = [];
  if (c.createdAt) events.push({ date: c.createdAt, title: 'Case Created', done: true });
  if (c.consultationDate) events.push({ date: c.consultationDate, title: 'Strategy Consultation', note: c.consultationConfirmed ? 'Confirmed' : 'Scheduled', done: c.consultationConfirmed });
  if (c.retainerPaid) events.push({ date: c.retainerDate || c.createdAt, title: 'Representation Agreement Signed', done: true });
  if (c.filingDate) events.push({ date: c.filingDate, title: 'Petition Filed', done: true });
  if (c.stage === 'rfe') events.push({ date: '', title: 'RFE Received', note: 'Response in preparation', done: false });
  if (c.approvalDate) events.push({ date: c.approvalDate, title: 'Approved', done: true });

  if (!events.length) return `<div class="text-muted">No timeline events yet.</div>`;

  return events.map(e => `
    <div class="timeline-item">
      <div class="timeline-dot ${e.done ? 'done' : ''}"></div>
      <div class="timeline-content">
        <div class="timeline-title">${e.title}</div>
        ${e.date ? `<div class="timeline-date">${fmtDate(e.date)}</div>` : ''}
        ${e.note ? `<div class="timeline-note">${e.note}</div>` : ''}
      </div>
    </div>`).join('');
}

// ---- Schedule Tab ----
function renderScheduleTab(c) {
  const slots = ['9:00 AM','9:30 AM','10:00 AM','10:30 AM','11:00 AM','11:30 AM','12:00 PM','1:00 PM','2:00 PM','2:30 PM','3:00 PM','3:30 PM','4:00 PM','4:30 PM','5:00 PM','6:00 PM'];

  return `
    ${c.consultationConfirmed ? `
    <div class="consult-confirmed-banner">
      ${icon('check')} Consultation confirmed — ${fmtDate(c.consultationDate)} at ${c.consultationTime}
    </div>` : ''}

    <div class="two-col">
      <div>
        <div class="panel">
          <div class="panel-title">Schedule Consultation</div>
          <div class="field">
            <label>Date</label>
            <input type="date" value="${fmtDateInput(c.consultationDate)}" min="${today()}"
              onchange="updateCaseField('${c.id}','consultationDate',this.value)" />
          </div>
          <div class="field">
            <label>Select Time Slot</label>
            <div class="time-slots">
              ${slots.map(s => `
                <div class="time-slot ${c.consultationTime === s ? 'selected' : ''}"
                  onclick="updateCaseField('${c.id}','consultationTime','${s}'); this.parentNode.querySelectorAll('.time-slot').forEach(x=>x.classList.remove('selected')); this.classList.add('selected')">
                  ${s}
                </div>`).join('')}
            </div>
          </div>
          <div class="field">
            <label>Duration</label>
            <select onchange="updateCaseField('${c.id}','consultationDuration',this.value)">
              <option value="30" ${c.consultationDuration==='30'?'selected':''}>30 minutes</option>
              <option value="60" ${!c.consultationDuration||c.consultationDuration==='60'?'selected':''}>60 minutes</option>
              <option value="90" ${c.consultationDuration==='90'?'selected':''}>90 minutes</option>
            </select>
          </div>
          <div class="field">
            <label>Consultation Notes</label>
            <textarea placeholder="Strategy notes, eligibility assessment, criteria analysis…"
              onblur="updateCaseField('${c.id}','consultationNotes',this.value)">${escHtml(c.consultationNotes || '')}</textarea>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn btn-gold" onclick="confirmConsultation('${c.id}')">Mark as Confirmed</button>
            <button class="btn btn-ghost" onclick="State.emailDraft='consultation-confirm'; State.activeTab='emails'; switchTab('emails','${c.id}')">
              ${icon('email')} Send Confirmation Email
            </button>
          </div>
        </div>
      </div>

      <div>
        <div class="panel">
          <div class="panel-title">Consultation Details</div>
          ${infoRow('Date', c.consultationDate ? fmtDate(c.consultationDate) : 'Not scheduled')}
          ${infoRow('Time', c.consultationTime || '—')}
          ${infoRow('Duration', c.consultationDuration ? c.consultationDuration + ' minutes' : '60 minutes')}
          ${infoRow('Status', c.consultationConfirmed ? 'Confirmed' : 'Pending confirmation', c.consultationConfirmed ? 'var(--green)' : 'var(--yellow)')}
          ${c.consultationNotes ? `
          <div class="divider"></div>
          <div class="panel-title" style="margin-bottom:8px">Notes from Consultation</div>
          <div style="font-size:13.5px;color:var(--text-2);line-height:1.75;white-space:pre-wrap">${escHtml(c.consultationNotes)}</div>` : ''}
        </div>
      </div>
    </div>`;
}

// ---- Email Templates Tab ----
function renderEmailsTab(c) {
  const templates = [
    { id: 'consultation-confirm', title: 'Consultation Confirmation', desc: 'Confirm scheduled consultation date & time' },
    { id: 'intro-welcome', title: 'Welcome / Introduction', desc: 'Welcome email after initial inquiry' },
    { id: 'representation', title: 'Representation Agreement', desc: 'Send engagement agreement for signing' },
    { id: 'bank-info', title: 'Payment Instructions', desc: 'Retainer and banking details' },
    { id: 'doc-request', title: 'Document Upload Request', desc: 'Request documents via Dropbox link' },
    { id: 'status-update', title: 'Case Status Update', desc: 'Notify client of USCIS case update' },
    { id: 'rfe-received', title: 'RFE Received Notice', desc: 'Inform client of Request for Evidence' },
    { id: 'approval', title: 'Approval Notification', desc: 'Congratulations — case approved!' },
  ];

  const activeDraft = State.emailDraft;

  return `
    ${!activeDraft ? `
    <div class="email-template-grid">
      ${templates.map(t => `
        <div class="email-card" onclick="State.emailDraft='${t.id}'; switchTab('emails','${c.id}')">
          <div class="email-card-icon">${svgIcon('email')}</div>
          <h4>${t.title}</h4>
          <p>${t.desc}</p>
        </div>`).join('')}
    </div>

    ${c.emailLog?.length ? `
    <div class="panel">
      <div class="panel-title">Email Log</div>
      ${c.emailLog.map(e => `
        <div class="flex-between" style="padding:10px 0;border-bottom:1px solid var(--border-2)">
          <div>
            <div style="font-size:13.5px;color:var(--text)">${e.subject}</div>
            <div style="font-size:12px;color:var(--text-3)">${fmtDate(e.date)}</div>
          </div>
          <span class="badge badge-approved">Sent</span>
        </div>`).join('')}
    </div>` : ''}
    ` : renderEmailComposer(c, activeDraft)}`;
}

function renderEmailComposer(c, templateId) {
  const draft = buildEmailDraft(c, templateId);
  return `
    <div style="margin-bottom:16px">
      <button class="btn btn-ghost btn-sm" onclick="State.emailDraft=null; switchTab('emails','${c.id}')">
        ← Back to Templates
      </button>
    </div>
    <div class="email-composer">
      <div class="email-composer-header">
        <span>${draft.templateName}</span>
        <div style="display:flex;gap:8px;align-items:center">
          <div style="display:flex;border:1px solid var(--border-2);border-radius:6px;overflow:hidden">
            <button onclick="State.emailLang='en'; switchTab('emails','${c.id}')" style="padding:4px 10px;font-size:11px;background:${State.emailLang==='en'?'var(--gold)':'transparent'};color:${State.emailLang==='en'?'#000':'var(--text-2)'};border:none;cursor:pointer">EN</button>
            <button onclick="State.emailLang='ka'; switchTab('emails','${c.id}')" style="padding:4px 10px;font-size:11px;background:${State.emailLang==='ka'?'var(--gold)':'transparent'};color:${State.emailLang==='ka'?'#000':'var(--text-2)'};border:none;cursor:pointer">ქართ</button>
          </div>
          <button class="copy-btn" onclick="copyEmailToClipboard('${c.id}')">Copy All</button>
          <a class="btn btn-ghost btn-sm" href="${buildMailtoLink(c, draft)}" target="_blank">Open in Mail App ↗</a>
          <button class="btn btn-gold btn-sm" onclick="logEmailSent('${c.id}','${escAttr(draft.subject)}')">
            Mark as Sent
          </button>
        </div>
      </div>
      <div class="email-composer-fields">
        <div class="email-field-row">
          <span class="email-field-label">To</span>
          <input class="email-field-value" id="email-to" value="${escAttr(c.email || '')}" />
        </div>
        <div style="height:1px;background:var(--border-2)"></div>
        <div class="email-field-row">
          <span class="email-field-label">Subject</span>
          <input class="email-field-value" id="email-subject" value="${escAttr(draft.subject)}" />
        </div>
      </div>
      <div class="email-body">
        <textarea id="email-body" rows="16">${escHtml(draft.body)}</textarea>
      </div>
    </div>`;
}

function buildEmailDraft(c, templateId) {
  const name = c.firstName || 'Client';
  const fullName = `${c.firstName} ${c.lastName}`.trim() || 'Client';
  const visa = c.visaType || 'immigration';
  const consultDate = c.consultationDate ? fmtDate(c.consultationDate) : '[DATE]';
  const consultTime = c.consultationTime || '[TIME]';
  const receipt = c.uscisReceiptNumber || '[RECEIPT NUMBER]';

  const templates = {
    'consultation-confirm': {
      templateName: 'Consultation Confirmation',
      subject: `Your ${visa} Strategy Consultation — Confirmed`,
      body: `Dear ${name},

I am pleased to confirm your strategy consultation with Ana Kamkhadze, Esq. MBA.

Date: ${consultDate}
Time: ${consultTime} (Eastern Time)
Duration: ${c.consultationDuration || 60} minutes
Format: Video call (Zoom link to follow) / Phone

During our session, we will:
• Assess your eligibility profile for ${visa}
• Map your achievements to the relevant USCIS criteria
• Identify any evidence gaps and how to address them
• Outline the optimal visa pathway and timeline

Please have the following ready for our call:
• Updated CV / Resume
• Brief description of your professional achievements
• Any prior immigration filings (if applicable)

If you need to reschedule, please reply to this email at least 24 hours in advance.

Looking forward to speaking with you,

Ana Kamkhadze, Esq. MBA
Founder & Immigration Attorney
Kamkhadze PA
anka@esq.mba | (786) 590-9400
Hollywood Beach, FL

Attorney advertising. Submitting this message does not create an attorney-client relationship.`,
    },

    'intro-welcome': {
      templateName: 'Welcome / Introduction',
      subject: `Welcome to Kamkhadze PA — Next Steps for Your ${visa} Case`,
      body: `Dear ${name},

Welcome to Kamkhadze PA. It is a privilege to represent you in your U.S. immigration journey.

We specialize exclusively in U.S. Immigration and Nationality Law, with deep expertise in ${visa} petitions for extraordinary entrepreneurs, founders, and executives. Our goal is to build the strongest possible case that tells your professional story compellingly to USCIS.

Here is what to expect in the coming weeks:

1. Representation Agreement — Please review and sign the attached engagement letter.
2. Retainer Payment — Payment instructions will follow in a separate email.
3. Document Collection — You will receive a customized checklist and a secure Dropbox folder for uploading documents.
4. Strategy Session — We will schedule a focused call to walk through your evidence architecture.

Please don't hesitate to reach out at any time. My direct line is (786) 590-9400 and email is anka@esq.mba.

Warmly,

Ana Kamkhadze, Esq. MBA
Kamkhadze PA
anka@esq.mba | (786) 590-9400`,
    },

    'representation': {
      templateName: 'Representation Agreement',
      subject: `Representation Agreement — Kamkhadze PA × ${fullName}`,
      body: `Dear ${name},

Please find attached your Representation Agreement with Kamkhadze PA for legal services in connection with your ${visa} petition.

Please review the agreement carefully. It covers:
• Scope of legal services
• Attorney fees and payment schedule
• Your rights and responsibilities as a client
• Communication protocols

To proceed, please:
1. Review the attached agreement
2. Sign and return a copy to anka@esq.mba
3. Retain a copy for your records

Upon receipt of your signed agreement and retainer payment, we will formally open your case file and begin work immediately.

If you have any questions about any provisions in the agreement, please do not hesitate to contact me directly.

Best regards,

Ana Kamkhadze, Esq. MBA
Kamkhadze PA
anka@esq.mba | (786) 590-9400

PRIVILEGED & CONFIDENTIAL — ATTORNEY-CLIENT COMMUNICATION`,
    },

    'bank-info': {
      templateName: 'Payment Instructions',
      subject: `Payment Instructions — Kamkhadze PA`,
      body: `Dear ${name},

Thank you for engaging Kamkhadze PA for your ${visa} representation. Please find below our payment instructions for the retainer fee.

WIRE TRANSFER / ACH:
Bank: [BANK NAME]
Account Name: Kamkhadze PA
Account Number: [ACCOUNT NUMBER]
Routing Number: [ROUTING NUMBER]
Reference: ${fullName} — ${visa}

ZELLE:
Email: anka@esq.mba
Reference: ${fullName} — ${visa}

CHECK (payable to):
Kamkhadze PA
3800 S Ocean Dr
Hollywood Beach, FL [ZIP]

Retainer Amount: $[AMOUNT]
Due By: [DATE]

Please note: your case file will be formally opened upon receipt of both the signed representation agreement and the retainer payment.

Once payment is received, please send a confirmation to anka@esq.mba.

Thank you,

Ana Kamkhadze, Esq. MBA
Kamkhadze PA`,
    },

    'doc-request': {
      templateName: 'Document Upload Request',
      subject: `Action Required: Document Upload — ${visa} Case`,
      body: `Dear ${name},

Your ${visa} case file is now open and we are ready to begin building your evidence portfolio.

DOCUMENT UPLOAD:
Please upload all documents to your secure, private Dropbox folder:
${c.dropboxLink || '[DROPBOX LINK — please add in Case Manager]'}

FOLDER STRUCTURE:
Your folder is organized as follows:
• 01_Personal_Documents — Passport, CV, status docs
• 02_Evidence — Awards, press, publications, contributions
• 03_Support_Letters — Recommendation letters
• 04_Financial — Tax returns, compensation docs
• 05_Correspondence — For any additional documents

PRIORITY DOCUMENTS (please upload first):
• Passport copy (all pages)
• Updated CV / Resume
• Any awards, press articles, or recognition
• Compensation documentation

DOCUMENT GUIDELINES:
• Upload files in PDF, JPG, or PNG format
• Name files clearly (e.g., "Passport_${c.firstName}${c.lastName}.pdf")
• Include English translations for any non-English documents
• Higher quality scans preferred (300 DPI minimum)

Please aim to upload your priority documents within 7 days. I will review as documents come in and will reach out with any questions.

If you have difficulty with the upload link, please email me directly.

Best regards,

Ana Kamkhadze, Esq. MBA
Kamkhadze PA
anka@esq.mba | (786) 590-9400`,
    },

    'status-update': {
      templateName: 'Case Status Update',
      subject: `Case Status Update — ${receipt}`,
      body: `Dear ${name},

I am writing with an update on the status of your ${visa} petition.

USCIS Receipt Number: ${receipt}
Current Status: [STATUS]
Date of Update: ${fmtDate(new Date().toISOString())}

[PROVIDE STATUS DETAILS HERE]

You can also check your case status directly at any time:
https://egov.uscis.gov/casestatus/mycasestatus.do?appReceiptNum=${c.uscisReceiptNumber || ''}

WHAT THIS MEANS:
[Explain what the status means in plain language]

NEXT STEPS:
[Outline next steps]

Please do not hesitate to contact me if you have any questions. I will continue to monitor your case and will notify you promptly of any further updates.

Best regards,

Ana Kamkhadze, Esq. MBA
Kamkhadze PA
anka@esq.mba | (786) 590-9400`,
    },

    'rfe-received': {
      templateName: 'RFE Received Notice',
      subject: `Important: Request for Evidence Received — ${receipt}`,
      body: `Dear ${name},

USCIS has issued a Request for Evidence (RFE) on your ${visa} petition.

Receipt Number: ${receipt}
RFE Date: [DATE]
Response Deadline: [DEADLINE — typically 87 days from RFE date]

This is a routine part of the adjudication process. Receiving an RFE does not mean your case will be denied — it simply means the adjudicator requires additional documentation or clarification on specific points.

USCIS IS REQUESTING:
[List specific items requested in the RFE]

OUR RESPONSE STRATEGY:
I have carefully reviewed the RFE and have developed a response strategy. [Brief description of approach]

WHAT I NEED FROM YOU:
[List any additional documents or information needed from client]

I will have a draft response prepared for your review by [DATE]. Please plan to provide the requested materials within [X] days so we have sufficient time to prepare a thorough response.

Do not be concerned — we will address each point comprehensively. Please call or email me if you have questions.

Best regards,

Ana Kamkhadze, Esq. MBA
Kamkhadze PA
anka@esq.mba | (786) 590-9400`,
    },

    'approval': {
      templateName: 'Approval Notification',
      subject: `APPROVED — Your ${visa} Petition`,
      body: `Dear ${name},

I am thrilled to share wonderful news — your ${visa} petition has been APPROVED by USCIS!

APPROVAL DETAILS:
Receipt Number: ${receipt}
Approval Date: ${c.approvalDate ? fmtDate(c.approvalDate) : '[DATE]'}
Valid Through: [VALIDITY DATE]

This is a tremendous achievement and a testament to the strength of your extraordinary profile. Congratulations!

NEXT STEPS:
[Outline next steps — e.g., visa stamp appointment at consulate, I-485 filing, EAD/AP application, etc.]

It has been a genuine privilege to work with you on this case. Your dedication throughout the process — gathering evidence, collaborating on the legal brief, and your patience during the adjudication period — made all the difference.

Please keep this approval notice in a safe, accessible location.

If you have any questions about your next steps or future immigration planning (EB-1A, renewal, etc.), please do not hesitate to reach out. We would love to continue supporting your U.S. journey.

With warmest congratulations,

Ana Kamkhadze, Esq. MBA
Kamkhadze PA
anka@esq.mba | (786) 590-9400`,
    },
  };

  if (State.emailLang === 'ka') {
    const geo = {
      'consultation-confirm': {
        templateName: 'კონსულტაციის დადასტურება',
        subject: `თქვენი ${visa} სტრატეგიული კონსულტაცია — დადასტურებულია`,
        body: `ძვირფასო ${name},

სიამოვნებით გიდასტურებთ სტრატეგიულ კონსულტაციას ანა კამხაძესთან, Esq. MBA.

თარიღი: ${consultDate}
დრო: ${consultTime} (აღმოსავლეთ სტანდარტული დრო)
ხანგრძლივობა: ${c.consultationDuration || 60} წუთი
ფორმატი: ვიდეო ზარი (Zoom ბმული მოგვიანებით) / ტელეფონი

კონსულტაციის განმავლობაში განვიხილავთ:
• თქვენს ${visa} კრიტერიუმებს
• მტკიცებულებათა სტრუქტურას
• საქმის სტრატეგიას და ვადებს

გთხოვთ, გადაფასების შემთხვევის შემთხვების შეგვატყობინოთ 24 საათით ადრე.

პატივისცემით,

ანა კამხაძე, Esq. MBA
კამხაძე PA
anka@esq.mba | (786) 590-9400`,
      },
      'intro-welcome': {
        templateName: 'მოგესალმებით',
        subject: `კეთილი იყოს თქვენი მობრძანება — კამხაძე PA — ${visa}`,
        body: `ძვირფასო ${name},

კეთილი იყოს თქვენი მობრძანება კამხაძე PA-ში. პატივად მიმაჩნია თქვენი წარმომადგენლობა.

ჩვენ სპეციალიზდებით ${visa} შუამდგომლობებში. ჩვენი მიზანია ყველაზე ძლიერი საქმის მომზადება.

მომდევნო ნაბიჯები:
1. წარმომადგენლობის შეთანხმება — გთხოვთ გადახედოთ და ხელი მოაწეროთ.
2. ავანსის გადახდა — გადახდის ინსტრუქცია გამოგეგზავნებათ ცალკე.
3. დოკუმენტების შეგროვება — მიიღებთ Dropbox-ის ლინქს.
4. სტრატეგიული სესია — შეხვედრა განვიხილავთ თქვენი საქმის არქიტექტურას.

ნებისმიერ კითხვაზე მიმართეთ: anka@esq.mba | (786) 590-9400

პატივისცემით,
ანა კამხაძე, Esq. MBA`,
      },
      'representation': {
        templateName: 'წარმომადგენლობის შეთანხმება',
        subject: `წარმომადგენლობის შეთანხმება — კამხაძე PA × ${fullName}`,
        body: `ძვირფასო ${name},

თანდართულია თქვენი წარმომადგენლობის შეთანხმება კამხაძე PA-სთან ${visa} შუამდგომლობასთან დაკავშირებით.

გთხოვთ:
1. გადახედოთ შეთანხმებას
2. ხელი მოაწეროთ და გამოგვიგზავნოთ anka@esq.mba-ზე
3. შეინახოთ ასლი

ხელმოწერილი შეთანხმებისა და ავანსის მიღების შემდეგ, დაუყოვნლებლივ დავიწყობთ მუშაობა.

PRIVILEGED & CONFIDENTIAL — ATTORNEY-CLIENT COMMUNICATION

პატივისცემით,
ანა კამხაძე, Esq. MBA
კამხაძე PA`,
      },
      'bank-info': {
        templateName: 'გადახდის ინსტრუქცია',
        subject: `გადახდის ინსტრუქცია — კამხაძე PA`,
        body: `ძვირფასო ${name},

გიგზავნით გადახდის ინსტრუქციებს ${visa} წარმომადგენლობის ავანსის გადასახდელად.

WIRE TRANSFER / ACH:
ბანკი: [BANK NAME]
ანგარიშის სახელი: Kamkhadze PA
ანგარიშის ნომერი: [ACCOUNT NUMBER]
Routing: [ROUTING NUMBER]
დანიშნულება: ${fullName} — ${visa}

ZELLE:
Email: anka@esq.mba
დანიშნულება: ${fullName} — ${visa}

CHECK (გამოწერილი):
Kamkhadze PA
3800 S Ocean Dr
Hollywood Beach, FL

ავანსი: $[AMOUNT]
გადახდის ვადა: [DATE]

გადახდის შემდეგ დაგვიდასტურეთ: anka@esq.mba

პატივისცემით,
ანა კამხაძე, Esq. MBA`,
      },
      'doc-request': {
        templateName: 'დოკუმენტების მოთხოვნა',
        subject: `სავალდებულო: დოკუმენტების ატვირთვა — ${visa}`,
        body: `ძვირფასო ${name},

თქვენი ${visa} საქმის ფაილი გახსნილია. გთხოვთ ატვირთოთ დოკუმენტები Dropbox-ის პირად საქაღალდეში:
${c.dropboxLink || '[DROPBOX ბმული]'}

საქაღალდის სტრუქტურა:
• 01_Personal_Documents — პასპორტი, CV, სტატუსი
• 02_Evidence — ჯილდოები, პრესა, პუბლიკაციები
• 03_Support_Letters — სარეკომენდაციო წერილები
• 04_Financial — საგადასახადო, ანაზღაურება
• 05_Correspondence — სხვა

პრიორიტეტული დოკუმენტები (ჯერ ატვირთეთ):
• პასპორტი (ყველა გვერდი)
• განახლებული CV
• ჯილდოები, პრესა, აღიარება

7 დღის განმავლობაში გთხოვთ ატვირთოთ.

პატივისცემით,
ანა კამხაძე, Esq. MBA`,
      },
      'status-update': {
        templateName: 'საქმის სტატუსი',
        subject: `საქმის სტატუსის განახლება — ${receipt}`,
        body: `ძვირფასო ${name},

გიგზავნით განახლებას თქვენი ${visa} შუამდგომლობის სტატუსზე.

USCIS-ის მიღების ნომერი: ${receipt}
მიმდინარე სტატუსი: [სტატუსი]
განახლების თარიღი: ${fmtDate(new Date().toISOString())}

[სტატუსის დეტალები]

სტატუსის პირდაპირ შემოწმება:
https://egov.uscis.gov/casestatus/mycasestatus.do?appReceiptNum=${c.uscisReceiptNumber || ''}

მომდევნო ნაბიჯები: [ახსნა]

პატივისცემით,
ანა კამხაძე, Esq. MBA`,
      },
      'rfe-received': {
        templateName: 'RFE მიღებულია',
        subject: `მნიშვნელოვანი: მტკიცებულების მოთხოვნა — ${receipt}`,
        body: `ძვირფასო ${name},

USCIS-მა გამოაგზავნა Evidence-ის მოთხოვნა (RFE) თქვენს ${visa} შუამდგომლობაზე.

მიღების ნომერი: ${receipt}
RFE თარიღი: [თარიღი]
პასუხის ვადა: [ვადა — ჩვეულებრივ 87 დღე]

ეს სტანდარტული პროცედურის ნაწილია. RFE-ის მიღება არ ნიშნავს უარყოფას.

USCIS მოითხოვს: [სია]

ჩვენი სტრატეგია: [მოკლე აღწერა]

დასჭირდება: [კლიენტისგან საჭირო]

პასუხს მოამზადებ [თარიზამდე].

პატივისცემით,
ანა კამხაძე, Esq. MBA`,
      },
      'approval': {
        templateName: 'დამტკიცება!',
        subject: `დამტკიცდა — თქვენი ${visa} შუამდგომლობა`,
        body: `ძვირფასო ${name},

გილოცავთ! — თქვენი ${visa} შუამდგომლობა USCIS-მა დაამტკიცა!

დამტკიცების დეტალები:
მიღების ნომერი: ${receipt}
დამტკიცების თარიღი: ${c.approvalDate ? fmtDate(c.approvalDate) : '[თარიღი]'}

ეს დიდი მიღწევაა! გილოცავთ!

მომდევნო ნაბიჯები: [ახსნა]

იყო დიდი პატივი ამ საქმეზე თქვენთან ერთად მუშაობა.

თბილი მილოცვით,
ანა კამხაძე, Esq. MBA
კამხაძე PA`,
      },
    };
    return geo[templateId] || geo['status-update'] || templates[templateId] || templates['status-update'];
  }
  return templates[templateId] || templates['status-update'];
}

function buildMailtoLink(c, draft) {
  const to = c.email || '';
  const subject = encodeURIComponent(draft.subject);
  const body = encodeURIComponent(draft.body);
  return `mailto:${to}?subject=${subject}&body=${body}`;
}

function copyEmailToClipboard(caseId) {
  const to = document.getElementById('email-to')?.value || '';
  const subject = document.getElementById('email-subject')?.value || '';
  const body = document.getElementById('email-body')?.value || '';
  const text = `To: ${to}\nSubject: ${subject}\n\n${body}`;
  navigator.clipboard.writeText(text).then(() => toast('Email copied to clipboard'));
}

function logEmailSent(caseId, subject) {
  const c = getCase(caseId);
  if (!c) return;
  if (!c.emailLog) c.emailLog = [];
  c.emailLog.push({ subject, date: new Date().toISOString() });
  c.updatedAt = new Date().toISOString();
  Storage.save();
  toast('Email marked as sent');
  State.emailDraft = null;
  rerenderTab(caseId);
}

// ---- Documents Tab ----
function renderDocumentsTab(c) {
  const docs = c.documents || [];
  const categories = [...new Set(docs.map(d => d.category))];

  const total = docs.length;
  const counts = {
    pending: docs.filter(d => d.status === 'pending').length,
    uploaded: docs.filter(d => d.status === 'uploaded').length,
    reviewed: docs.filter(d => d.status === 'reviewed').length,
    approved: docs.filter(d => d.status === 'approved').length,
    missing: docs.filter(d => d.status === 'missing').length,
  };
  const done = counts.reviewed + counts.approved;
  const pct = total ? Math.round(done / total * 100) : 0;

  return `
    <div class="two-col">
      <div>
        <div class="panel">
          <div class="panel-title">
            Document Progress
            <button class="btn btn-ghost btn-sm" onclick="showAddDocument('${c.id}')">+ Add Document</button>
          </div>
          <div class="progress-overview" style="margin-bottom:20px">
            <span class="progress-label">Complete</span>
            <div class="progress-bar-wrap">
              <div class="progress-bar-fill" style="width:${pct}%"></div>
            </div>
            <span class="progress-pct">${pct}%</span>
          </div>
          <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px">
            <span class="badge badge-doc-pending">${counts.pending} Pending</span>
            <span class="badge badge-doc-uploaded">${counts.uploaded} Uploaded</span>
            <span class="badge badge-doc-reviewed">${counts.reviewed} Reviewed</span>
            <span class="badge badge-doc-approved">${counts.approved} Approved</span>
            ${counts.missing ? `<span class="badge badge-doc-missing">${counts.missing} Missing</span>` : ''}
          </div>
        </div>

        ${!docs.length ? `
        <div class="panel">
          <div class="empty-state" style="padding:40px 20px">
            <div class="empty-state-icon">${svgIcon('docs')}</div>
            <h3 style="font-size:18px">No documents yet</h3>
            <p>Initialize from visa type template or add manually.</p>
            <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
              <button class="btn btn-gold" onclick="initDocuments('${c.id}')">Initialize ${c.visaType} Checklist</button>
              <button class="btn btn-ghost" onclick="showAddDocument('${c.id}')">Add Manually</button>
            </div>
          </div>
        </div>` : `
        <div class="doc-list">
          ${categories.map(cat => {
            const catDocs = docs.filter(d => d.category === cat);
            return `
              <div class="doc-category">
                <div class="doc-category-title">${cat}</div>
                ${catDocs.map(d => `
                  <div class="doc-item">
                    <div class="doc-item-name">${escHtml(d.name)}</div>
                    <div class="doc-item-actions">
                      <select class="doc-status-select" onchange="updateDocStatus('${c.id}','${d.id}',this.value)" style="color:${statusColor(d.status)}">
                        <option value="pending" ${d.status==='pending'?'selected':''}>Pending</option>
                        <option value="uploaded" ${d.status==='uploaded'?'selected':''}>Uploaded</option>
                        <option value="reviewed" ${d.status==='reviewed'?'selected':''}>Reviewed</option>
                        <option value="approved" ${d.status==='approved'?'selected':''}>Approved</option>
                        <option value="missing" ${d.status==='missing'?'selected':''}>Missing</option>
                      </select>
                      <button class="btn-icon" onclick="removeDocument('${c.id}','${d.id}')" title="Remove"
                        style="padding:4px;background:none;border:none;color:var(--text-3);cursor:pointer;font-size:16px">×</button>
                    </div>
                  </div>`).join('')}
              </div>`;
          }).join('')}
        </div>`}
      </div>

      <div>
        <div class="panel">
          <div class="panel-title">Dropbox Folder</div>
          <div class="field">
            <label>Dropbox Shared Link</label>
            <input type="url" placeholder="https://www.dropbox.com/sh/…"
              value="${escAttr(c.dropboxLink || '')}"
              onblur="updateCaseField('${c.id}','dropboxLink',this.value)" />
          </div>
          ${c.dropboxLink ? `
          <a href="${escAttr(c.dropboxLink)}" target="_blank" class="btn btn-ghost btn-sm" style="margin-top:8px">
            ${icon('dropbox')} Open Dropbox Folder ↗
          </a>` : ''}
          <div class="panel-title" style="margin-top:20px;margin-bottom:8px">Suggested Folder Structure</div>
          <div class="dropbox-folder-tree">
<span class="folder">📁 ${c.firstName}_${c.lastName}_${c.visaType.replace(/ /g,'')}_KamkhadzePA/</span>
  <span class="subfolder">├── 01_Personal_Documents/</span>
  <span class="subfolder">│   ├── Passport/</span>
  <span class="subfolder">│   └── CV_Resume/</span>
  <span class="subfolder">├── 02_Evidence/</span>
  <span class="subfolder">│   ├── Awards_Recognition/</span>
  <span class="subfolder">│   ├── Press_Media/</span>
  <span class="subfolder">│   ├── Publications/</span>
  <span class="subfolder">│   ├── Judge_Reviewer/</span>
  <span class="subfolder">│   └── Other_Evidence/</span>
  <span class="subfolder">├── 03_Support_Letters/</span>
  <span class="subfolder">├── 04_Financial_Documents/</span>
  <span class="subfolder">└── 05_Correspondence/</span></div>
          <button class="copy-btn" style="margin-top:8px" onclick="copyFolderStructure('${c.id}')">Copy Folder Names</button>
        </div>

        <div class="panel" style="margin-top:16px">
          <div class="panel-title">Send Document Request Email</div>
          <p style="font-size:13px;color:var(--text-3);margin-bottom:12px">Send the client their Dropbox link and document checklist.</p>
          <button class="btn btn-ghost btn-sm" onclick="State.emailDraft='doc-request'; State.activeTab='emails'; switchTab('emails','${c.id}')">
            ${icon('email')} Compose Document Request
          </button>
        </div>
      </div>
    </div>`;
}

function statusColor(s) {
  const map = { pending: 'var(--text-3)', uploaded: 'var(--blue)', reviewed: 'var(--yellow)', approved: 'var(--green)', missing: 'var(--red)' };
  return map[s] || 'var(--text-3)';
}

function copyFolderStructure(caseId) {
  const c = getCase(caseId);
  if (!c) return;
  const text = `${c.firstName}_${c.lastName}_${c.visaType.replace(/ /g,'')}_KamkhadzePA/\n  01_Personal_Documents/\n    Passport/\n    CV_Resume/\n  02_Evidence/\n    Awards_Recognition/\n    Press_Media/\n    Publications/\n    Judge_Reviewer/\n    Other_Evidence/\n  03_Support_Letters/\n  04_Financial_Documents/\n  05_Correspondence/`;
  navigator.clipboard.writeText(text).then(() => toast('Folder structure copied'));
}

// ---- Petition Tab ----
function renderPetitionTab(c) {
  const p = c.petition || {};
  const exhibits = c.exhibits || [];

  const sections = [
    { key: 'coverLetter', title: 'Cover Letter / Filing Instructions' },
    { key: 'executiveSummary', title: 'Executive Summary of Extraordinary Ability' },
    { key: 'legalBrief', title: 'Legal Brief / Petition Statement' },
    { key: 'evidenceIndex', title: 'Evidence Index / Table of Contents' },
    { key: 'notes', title: 'Internal Notes & Drafting Notes' },
  ];

  return `
    <div class="two-col">
      <div>
        <div class="panel">
          <div class="panel-title">Petition Drafts</div>
          ${sections.map(s => `
            <div class="petition-section">
              <div class="petition-section-header" onclick="togglePetitionSection(this)">
                <h4>${s.title}</h4>
                <span style="color:var(--text-3);font-size:18px;transition:transform 0.2s">▾</span>
              </div>
              <div class="petition-section-body">
                <textarea rows="8" placeholder="Draft ${s.title}…"
                  onblur="updatePetitionField('${c.id}','${s.key}',this.value)">${escHtml(p[s.key] || '')}</textarea>
              </div>
            </div>`).join('')}
        </div>
      </div>

      <div>
        <div class="panel">
          <div class="panel-title">
            Exhibit List
            <button class="btn btn-ghost btn-sm" onclick="showAddExhibit('${c.id}')">+ Add Exhibit</button>
          </div>
          ${exhibits.length ? exhibits.map((ex, i) => `
            <div class="exhibit-item">
              <div class="exhibit-number">Ex.${String(i+1).padStart(2,'0')}</div>
              <div class="exhibit-name">${escHtml(ex.name)}</div>
              ${docStatusBadge(ex.status || 'pending')}
              <button onclick="removeExhibit('${c.id}','${ex.id}')"
                style="background:none;border:none;color:var(--text-3);cursor:pointer;font-size:18px;padding:2px 6px">×</button>
            </div>`).join('') : `
            <div class="empty-state" style="padding:30px 20px">
              <p>No exhibits listed. Add exhibits to build your evidence index.</p>
            </div>`}
        </div>

        <div class="panel" style="margin-top:16px">
          <div class="panel-title">Filing Details</div>
          <div class="field">
            <label>Filing Date</label>
            <input type="date" value="${fmtDateInput(c.filingDate)}"
              onchange="updateCaseField('${c.id}','filingDate',this.value)" />
          </div>
          <div class="field">
            <label>Priority Date</label>
            <input type="date" value="${fmtDateInput(c.priorityDate)}"
              onchange="updateCaseField('${c.id}','priorityDate',this.value)" />
          </div>
          <div class="field">
            <label>Approval Date</label>
            <input type="date" value="${fmtDateInput(c.approvalDate)}"
              onchange="updateCaseField('${c.id}','approvalDate',this.value)" />
          </div>
        </div>
      </div>
    </div>`;
}

function togglePetitionSection(header) {
  const body = header.nextElementSibling;
  const arrow = header.querySelector('span');
  const isOpen = body.style.display !== 'none';
  body.style.display = isOpen ? 'none' : 'block';
  arrow.style.transform = isOpen ? 'rotate(-90deg)' : '';
}

// ---- USCIS Status Tab ----
function renderStatusTab(c) {
  const history = c.statusHistory || [];

  return `
    <div class="two-col">
      <div>
        <div class="status-card">
          <div class="panel-title">USCIS Case Information</div>
          <div class="field">
            <label>USCIS Receipt Number</label>
            <input type="text" placeholder="e.g. IOE1234567890 or WAC2212345678"
              value="${escAttr(c.uscisReceiptNumber || '')}"
              onblur="updateCaseField('${c.id}','uscisReceiptNumber',this.value.toUpperCase())"
              style="font-family:monospace;font-size:16px;letter-spacing:0.05em" />
          </div>
          ${c.uscisReceiptNumber ? `
          <div class="receipt-display">${c.uscisReceiptNumber}</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:20px">
            <a href="https://egov.uscis.gov/casestatus/mycasestatus.do?appReceiptNum=${c.uscisReceiptNumber}"
              target="_blank" class="btn btn-gold btn-sm">
              Check Status on USCIS.gov ↗
            </a>
            <button class="copy-btn" onclick="navigator.clipboard.writeText('${c.uscisReceiptNumber}').then(()=>toast('Receipt number copied'))">
              Copy Receipt #
            </button>
          </div>` : ''}
          <div class="field">
            <label>Consulate Case Number (if applicable)</label>
            <input type="text" placeholder="Case number / NVC number"
              value="${escAttr(c.consulateCase || '')}"
              onblur="updateCaseField('${c.id}','consulateCase',this.value)" />
          </div>
          <div class="field">
            <label>Consulate / Embassy Name</label>
            <input type="text" placeholder="e.g. U.S. Embassy London"
              value="${escAttr(c.consulateName || '')}"
              onblur="updateCaseField('${c.id}','consulateName',this.value)" />
          </div>
        </div>

        <div class="status-card">
          <div class="panel-title">
            Status History
            <button class="btn btn-ghost btn-sm" onclick="showAddStatusUpdate('${c.id}')">+ Add Update</button>
          </div>
          ${history.length ? `
          <div class="status-history">
            ${[...history].reverse().map(h => `
              <div class="status-history-item">
                <div class="status-history-date">${fmtDate(h.date)}</div>
                <div class="status-history-text">${escHtml(h.status)}</div>
              </div>`).join('')}
          </div>` : `<div class="text-muted" style="padding:12px 0">No status updates recorded yet.</div>`}
        </div>
      </div>

      <div>
        <div class="status-card">
          <div class="panel-title">Useful Links</div>
          <div style="display:flex;flex-direction:column;gap:10px">
            <a href="https://egov.uscis.gov/casestatus/mycasestatus.do" target="_blank" class="btn btn-ghost btn-sm" style="justify-content:flex-start">
              ${icon('link')} USCIS Case Status Checker ↗
            </a>
            <a href="https://travel.state.gov/content/travel/en/us-visas/visa-information-resources/wait-times.html" target="_blank" class="btn btn-ghost btn-sm" style="justify-content:flex-start">
              ${icon('link')} Consulate Wait Times ↗
            </a>
            <a href="https://travel.state.gov/content/travel/en/legal/visa-law0/visa-bulletin.html" target="_blank" class="btn btn-ghost btn-sm" style="justify-content:flex-start">
              ${icon('link')} Visa Bulletin (Priority Dates) ↗
            </a>
            <a href="https://egov.uscis.gov/processing-times/" target="_blank" class="btn btn-ghost btn-sm" style="justify-content:flex-start">
              ${icon('link')} USCIS Processing Times ↗
            </a>
            <a href="https://ceac.state.gov/CEACStatTracker/Status.aspx" target="_blank" class="btn btn-ghost btn-sm" style="justify-content:flex-start">
              ${icon('link')} Consular Case Status Tracker ↗
            </a>
          </div>
        </div>

        <div class="status-card" style="margin-top:16px">
          <div class="panel-title">Send Status Update to Client</div>
          <p style="font-size:13px;color:var(--text-3);margin-bottom:12px">
            Compose a status update email to inform your client of the latest case developments.
          </p>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn btn-ghost btn-sm" onclick="State.emailDraft='status-update'; State.activeTab='emails'; switchTab('emails','${c.id}')">
              ${icon('email')} Status Update Email
            </button>
            ${c.stage === 'rfe' ? `
            <button class="btn btn-ghost btn-sm" onclick="State.emailDraft='rfe-received'; State.activeTab='emails'; switchTab('emails','${c.id}')">
              ${icon('email')} RFE Notice Email
            </button>` : ''}
            ${c.stage === 'approved' ? `
            <button class="btn btn-gold btn-sm" onclick="State.emailDraft='approval'; State.activeTab='emails'; switchTab('emails','${c.id}')">
              ${icon('email')} Approval Congratulations
            </button>` : ''}
          </div>
        </div>
      </div>
    </div>`;
}

// ---- Actions ----
function navigate(view, caseId) {
  State.view = view;
  if (caseId) State.selectedCaseId = caseId;
  if (view !== 'case-detail') State.activeTab = 'overview';
  render();
}

function updateCaseField(caseId, field, value) {
  const c = getCase(caseId);
  if (!c) return;
  c[field] = value;
  c.updatedAt = new Date().toISOString();
  Storage.save();
}

function updatePetitionField(caseId, field, value) {
  const c = getCase(caseId);
  if (!c) return;
  if (!c.petition) c.petition = {};
  c.petition[field] = value;
  c.updatedAt = new Date().toISOString();
  Storage.save();
}

function updateDocStatus(caseId, docId, status) {
  const c = getCase(caseId);
  if (!c) return;
  const doc = c.documents?.find(d => d.id === docId);
  if (doc) {
    doc.status = status;
    c.updatedAt = new Date().toISOString();
    Storage.save();
    toast(`Document marked as ${status}`);
  }
}

function removeDocument(caseId, docId) {
  const c = getCase(caseId);
  if (!c) return;
  c.documents = (c.documents || []).filter(d => d.id !== docId);
  c.updatedAt = new Date().toISOString();
  Storage.save();
  rerenderTab(caseId);
}

function removeExhibit(caseId, exhibitId) {
  const c = getCase(caseId);
  if (!c) return;
  c.exhibits = (c.exhibits || []).filter(e => e.id !== exhibitId);
  c.updatedAt = new Date().toISOString();
  Storage.save();
  rerenderTab(caseId);
}

function initDocuments(caseId) {
  const c = getCase(caseId);
  if (!c) return;
  c.documents = buildDefaultDocs(c.visaType);
  c.updatedAt = new Date().toISOString();
  Storage.save();
  toast(`${c.visaType} document checklist initialized`);
  rerenderTab(caseId);
}

function confirmConsultation(caseId) {
  const c = getCase(caseId);
  if (!c) return;
  if (!c.consultationDate || !c.consultationTime) {
    toast('Please select a date and time first', 'warn');
    return;
  }
  c.consultationConfirmed = true;
  if (c.stage === 'lead' || c.stage === 'onboarding') c.stage = 'consultation';
  c.updatedAt = new Date().toISOString();
  Storage.save();
  toast('Consultation confirmed!');
  rerenderTab(caseId);
}

function advanceStage(caseId) {
  const c = getCase(caseId);
  if (!c) return;
  const idx = STAGE_ORDER.indexOf(c.stage);
  if (idx < STAGE_ORDER.length - 1) {
    const nextStage = STAGE_ORDER[idx + 1];
    c.stage = nextStage;
    c.updatedAt = new Date().toISOString();
    Storage.save();
    const label = STAGES.find(s => s.value === nextStage)?.label;
    toast(`Stage advanced to: ${label}`);
    render();
  }
}

function rerenderTab(caseId) {
  const c = getCase(caseId);
  if (!c) return;
  const docPct = c.documents?.length
    ? Math.round(c.documents.filter(d => ['approved','reviewed'].includes(d.status)).length / c.documents.length * 100)
    : 0;
  const tabContent = document.getElementById('tab-content');
  if (tabContent) tabContent.innerHTML = renderTab(State.activeTab, c, docPct);
}

function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function escAttr(str) {
  return String(str || '').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// ---- Modals ----
function showModal(html) {
  const root = document.getElementById('modal-root');
  root.innerHTML = `<div class="modal-overlay" onclick="if(event.target===this)closeModal()">${html}</div>`;
}

function closeModal() {
  document.getElementById('modal-root').innerHTML = '';
}

function showAddCase() {
  showModal(`
    <div class="modal">
      <div class="modal-header">
        <h3>New Case</h3>
        <button class="modal-close" onclick="closeModal()">×</button>
      </div>
      <div class="modal-body">
        <div class="field-row">
          <div class="field"><label>First Name *</label><input id="nc-first" placeholder="Alex" /></div>
          <div class="field"><label>Last Name *</label><input id="nc-last" placeholder="Chen" /></div>
        </div>
        <div class="field"><label>Email</label><input id="nc-email" type="email" placeholder="alex@company.com" /></div>
        <div class="field"><label>Phone</label><input id="nc-phone" placeholder="+1 (555) 000-0000" /></div>
        <div class="field-row">
          <div class="field">
            <label>Visa Type</label>
            <select id="nc-visa">
              ${VISA_TYPES.map(v => `<option value="${v}">${v}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label>Stage</label>
            <select id="nc-stage">
              ${STAGES.map(s => `<option value="${s.value}">${s.label}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="field-row">
          <div class="field"><label>Nationality</label><input id="nc-nat" placeholder="e.g. Georgian" /></div>
          <div class="field"><label>Location</label><input id="nc-loc" placeholder="e.g. New York, NY" /></div>
        </div>
        <div class="field"><label>Company / Organization</label><input id="nc-company" placeholder="e.g. TechCorp Inc." /></div>
        <div class="field"><label>Notes</label><textarea id="nc-notes" rows="3" placeholder="Initial notes, referral source, case summary…"></textarea></div>
        <div class="checkbox-field" style="margin-bottom:16px">
          <input type="checkbox" id="nc-initdocs" checked />
          <label for="nc-initdocs">Initialize document checklist from visa type template</label>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
        <button class="btn btn-gold" onclick="saveNewCase()">Create Case</button>
      </div>
    </div>`);
}

function saveNewCase() {
  const firstName = document.getElementById('nc-first')?.value.trim();
  const lastName = document.getElementById('nc-last')?.value.trim();
  if (!firstName) { toast('First name is required', 'warn'); return; }

  const visaType = document.getElementById('nc-visa')?.value || 'O-1A';
  const initDocs = document.getElementById('nc-initdocs')?.checked;

  const c = newCase({
    firstName,
    lastName: lastName || '',
    email: document.getElementById('nc-email')?.value.trim() || '',
    phone: document.getElementById('nc-phone')?.value.trim() || '',
    visaType,
    stage: document.getElementById('nc-stage')?.value || 'lead',
    nationality: document.getElementById('nc-nat')?.value.trim() || '',
    location: document.getElementById('nc-loc')?.value.trim() || '',
    company: document.getElementById('nc-company')?.value.trim() || '',
    notes: document.getElementById('nc-notes')?.value.trim() || '',
    documents: initDocs ? buildDefaultDocs(visaType) : [],
  });

  State.cases.push(c);
  Storage.save();
  closeModal();
  toast(`Case created: ${firstName} ${lastName}`);
  navigate('case-detail', c.id);
}

function showEditCase(caseId) {
  const c = getCase(caseId);
  if (!c) return;

  showModal(`
    <div class="modal modal-lg">
      <div class="modal-header">
        <h3>Edit Case — ${c.firstName} ${c.lastName}</h3>
        <button class="modal-close" onclick="closeModal()">×</button>
      </div>
      <div class="modal-body">
        <div class="field-row">
          <div class="field"><label>First Name</label><input id="ec-first" value="${escAttr(c.firstName)}" /></div>
          <div class="field"><label>Last Name</label><input id="ec-last" value="${escAttr(c.lastName)}" /></div>
        </div>
        <div class="field"><label>Email</label><input id="ec-email" type="email" value="${escAttr(c.email)}" /></div>
        <div class="field"><label>Phone</label><input id="ec-phone" value="${escAttr(c.phone || '')}" /></div>
        <div class="field-row">
          <div class="field">
            <label>Visa Type</label>
            <select id="ec-visa">
              ${VISA_TYPES.map(v => `<option value="${v}" ${c.visaType===v?'selected':''}>${v}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label>Stage</label>
            <select id="ec-stage">
              ${STAGES.map(s => `<option value="${s.value}" ${c.stage===s.value?'selected':''}>${s.label}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="field-row">
          <div class="field"><label>Nationality</label><input id="ec-nat" value="${escAttr(c.nationality || '')}" /></div>
          <div class="field"><label>Location</label><input id="ec-loc" value="${escAttr(c.location || '')}" /></div>
        </div>
        <div class="field"><label>Company</label><input id="ec-company" value="${escAttr(c.company || '')}" /></div>
        <div class="field-row">
          <div class="field"><label>USCIS Receipt #</label><input id="ec-receipt" value="${escAttr(c.uscisReceiptNumber || '')}" style="font-family:monospace" /></div>
          <div class="field"><label>Retainer Amount ($)</label><input id="ec-retainer" type="number" value="${escAttr(c.retainerAmount || '')}" /></div>
        </div>
        <div class="field-row">
          <div class="checkbox-field" style="margin-top:8px">
            <input type="checkbox" id="ec-rpaid" ${c.retainerPaid?'checked':''} />
            <label for="ec-rpaid">Retainer Paid</label>
          </div>
          <div class="checkbox-field" style="margin-top:8px">
            <input type="checkbox" id="ec-fpaid" ${c.filingFeesPaid?'checked':''} />
            <label for="ec-fpaid">Filing Fees Paid</label>
          </div>
        </div>
        <div class="field"><label>Notes</label><textarea id="ec-notes" rows="3">${escHtml(c.notes || '')}</textarea></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-danger btn-sm" onclick="confirmDeleteCase('${c.id}')">Delete Case</button>
        <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
        <button class="btn btn-gold" onclick="saveEditCase('${c.id}')">Save Changes</button>
      </div>
    </div>`);
}

function saveEditCase(caseId) {
  const c = getCase(caseId);
  if (!c) return;

  c.firstName = document.getElementById('ec-first')?.value.trim() || c.firstName;
  c.lastName = document.getElementById('ec-last')?.value.trim() || c.lastName;
  c.email = document.getElementById('ec-email')?.value.trim() || '';
  c.phone = document.getElementById('ec-phone')?.value.trim() || '';
  c.visaType = document.getElementById('ec-visa')?.value || c.visaType;
  c.stage = document.getElementById('ec-stage')?.value || c.stage;
  c.nationality = document.getElementById('ec-nat')?.value.trim() || '';
  c.location = document.getElementById('ec-loc')?.value.trim() || '';
  c.company = document.getElementById('ec-company')?.value.trim() || '';
  c.uscisReceiptNumber = (document.getElementById('ec-receipt')?.value.trim() || '').toUpperCase();
  c.retainerAmount = document.getElementById('ec-retainer')?.value || '';
  c.retainerPaid = document.getElementById('ec-rpaid')?.checked || false;
  c.filingFeesPaid = document.getElementById('ec-fpaid')?.checked || false;
  c.notes = document.getElementById('ec-notes')?.value.trim() || '';
  c.updatedAt = new Date().toISOString();

  Storage.save();
  closeModal();
  toast('Case updated');
  render();
}

function confirmDeleteCase(caseId) {
  closeModal();
  showModal(`
    <div class="modal" style="max-width:420px">
      <div class="modal-header">
        <h3>Delete Case</h3>
        <button class="modal-close" onclick="closeModal()">×</button>
      </div>
      <div class="modal-body">
        <p style="color:var(--text-2)">Are you sure you want to permanently delete this case? This action cannot be undone.</p>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
        <button class="btn btn-danger" onclick="deleteCase('${caseId}')">Delete Permanently</button>
      </div>
    </div>`);
}

function deleteCase(caseId) {
  State.cases = State.cases.filter(c => c.id !== caseId);
  Storage.save();
  closeModal();
  toast('Case deleted');
  navigate('cases');
}

function showAddDocument(caseId) {
  showModal(`
    <div class="modal" style="max-width:480px">
      <div class="modal-header">
        <h3>Add Document</h3>
        <button class="modal-close" onclick="closeModal()">×</button>
      </div>
      <div class="modal-body">
        <div class="field"><label>Document Name *</label><input id="nd-name" placeholder="e.g. Recommendation Letter from Dr. Smith" /></div>
        <div class="field"><label>Category</label>
          <input id="nd-cat" placeholder="e.g. Support Letters" list="cat-list" />
          <datalist id="cat-list">
            <option>Personal Documents</option>
            <option>Criterion Evidence</option>
            <option>Support Letters</option>
            <option>Financial Documents</option>
            <option>Employer / Petitioner</option>
            <option>Other</option>
          </datalist>
        </div>
        <div class="field">
          <label>Status</label>
          <select id="nd-status">
            <option value="pending">Pending</option>
            <option value="uploaded">Uploaded</option>
            <option value="reviewed">Reviewed</option>
            <option value="approved">Approved</option>
            <option value="missing">Missing</option>
          </select>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
        <button class="btn btn-gold" onclick="saveAddDocument('${caseId}')">Add Document</button>
      </div>
    </div>`);
}

function saveAddDocument(caseId) {
  const name = document.getElementById('nd-name')?.value.trim();
  if (!name) { toast('Document name is required', 'warn'); return; }
  const c = getCase(caseId);
  if (!c) return;
  if (!c.documents) c.documents = [];
  c.documents.push({
    id: uuid(),
    name,
    category: document.getElementById('nd-cat')?.value.trim() || 'Other',
    status: document.getElementById('nd-status')?.value || 'pending',
    notes: '',
  });
  c.updatedAt = new Date().toISOString();
  Storage.save();
  closeModal();
  toast('Document added');
  rerenderTab(caseId);
}

function showAddExhibit(caseId) {
  showModal(`
    <div class="modal" style="max-width:480px">
      <div class="modal-header">
        <h3>Add Exhibit</h3>
        <button class="modal-close" onclick="closeModal()">×</button>
      </div>
      <div class="modal-body">
        <div class="field"><label>Exhibit Name *</label><input id="ne-name" placeholder="e.g. Google News article re: [Client Name]" /></div>
        <div class="field">
          <label>Status</label>
          <select id="ne-status">
            <option value="pending">Pending</option>
            <option value="uploaded">Uploaded</option>
            <option value="reviewed">Reviewed</option>
            <option value="approved">Ready to File</option>
          </select>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
        <button class="btn btn-gold" onclick="saveAddExhibit('${caseId}')">Add Exhibit</button>
      </div>
    </div>`);
}

function saveAddExhibit(caseId) {
  const name = document.getElementById('ne-name')?.value.trim();
  if (!name) { toast('Exhibit name is required', 'warn'); return; }
  const c = getCase(caseId);
  if (!c) return;
  if (!c.exhibits) c.exhibits = [];
  c.exhibits.push({
    id: uuid(),
    name,
    status: document.getElementById('ne-status')?.value || 'pending',
  });
  c.updatedAt = new Date().toISOString();
  Storage.save();
  closeModal();
  toast('Exhibit added');
  rerenderTab(caseId);
}

function showAddStatusUpdate(caseId) {
  showModal(`
    <div class="modal" style="max-width:480px">
      <div class="modal-header">
        <h3>Add Status Update</h3>
        <button class="modal-close" onclick="closeModal()">×</button>
      </div>
      <div class="modal-body">
        <div class="field"><label>Date</label><input id="su-date" type="date" value="${today()}" /></div>
        <div class="field"><label>Status / Description *</label><textarea id="su-text" rows="3" placeholder="e.g. Case transferred to NBC. Initial review completed. No RFE at this time."></textarea></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
        <button class="btn btn-gold" onclick="saveStatusUpdate('${caseId}')">Save Update</button>
      </div>
    </div>`);
}

function saveStatusUpdate(caseId) {
  const status = document.getElementById('su-text')?.value.trim();
  if (!status) { toast('Status description is required', 'warn'); return; }
  const c = getCase(caseId);
  if (!c) return;
  if (!c.statusHistory) c.statusHistory = [];
  c.statusHistory.push({
    id: uuid(),
    date: document.getElementById('su-date')?.value || today(),
    status,
  });
  c.updatedAt = new Date().toISOString();
  Storage.save();
  closeModal();
  toast('Status update saved');
  rerenderTab(caseId);
}

// ---- Import Cases ----
function showImportCases() {
  showModal(`
    <div class="modal modal-lg">
      <div class="modal-header">
        <h3>Import Cases from Excel</h3>
        <button class="modal-close" onclick="closeModal()">×</button>
      </div>
      <div class="modal-body">
        <p style="font-size:13px;color:var(--text-3);margin-bottom:4px">
          In Excel: Select All (Ctrl+A) → Copy (Ctrl+C) → Paste below.<br>
          Columns: # · Last Name · First Name · Case Type · Legal Fee · Filing Fees · Payment · Filing Date · RA · Receipt · Expiration · Priority Date · Officer
        </p>
        <div style="background:rgba(201,168,76,0.08);border:1px solid rgba(201,168,76,0.2);border-radius:6px;padding:10px 12px;margin-bottom:12px;font-size:12px;color:var(--gold)">
          ⚠ Data is imported directly into encrypted storage. It will not appear in source code.
        </div>
        <div class="field">
          <label>Paste Excel Data (Tab-Separated)</label>
          <textarea id="import-data" rows="10" placeholder="Paste rows here — skip or include the header row, it will be auto-detected…" style="font-family:monospace;font-size:11px;line-height:1.4"></textarea>
        </div>
        <div id="import-preview" style="font-size:12px;color:var(--text-3);margin-top:4px"></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
        <button class="btn btn-ghost" onclick="_previewImport()">Preview Count</button>
        <button class="btn btn-ghost" onclick="_executeImport(false)">Add to Existing</button>
        <button class="btn btn-gold" onclick="_executeImport(true)">Replace All & Import</button>
      </div>
    </div>`);
}

function _previewImport() {
  const rows = _parseImportRows(document.getElementById('import-data')?.value||'');
  document.getElementById('import-preview').textContent =
    rows.length ? `✓ ${rows.length} cases parsed and ready.` : '⚠ No valid rows detected.';
}

function _parseImportRows(text) {
  // Supports your spreadsheet layout:
  // [0]Row# [1]Last Name [2]First Name [3]Case [4]Filing Date [5]RA [6]Receipt [7]Expiration [8]Priority Date [9]Officer
  return text.trim().split('\n')
    .map(l => l.split('\t').map(c => c.trim()))
    .filter(cols => {
      if (cols.length < 3) return false;
      // Skip header rows
      if (/last.?name|^#$|^row/i.test(cols[0]||'') || /last.?name|^name$/i.test(cols[1]||'')) return false;
      // Both last and first name must have letters
      if (!/[A-Za-z]/.test(cols[1]||'') || !/[A-Za-z]/.test(cols[2]||'')) return false;
      return true;
    })
    .map(cols => {
      const caseType   = cols[3]||'';
      const filingDate = cols[4]||'';
      const raDate     = cols[5]||'';
      const receipt    = cols[6]||'';
      const expiration = cols[7]||'';
      const priorityDate = cols[8]||'';
      const officer    = cols[9]||'';
      const raDateParsed = _xDate(raDate);
      return newCase({
        lastName:           cols[1]||'',
        firstName:          cols[2]||'',
        visaType:           _visaFromCase(caseType),
        stage:              _stageFromData(filingDate, receipt, expiration),
        retainerDate:       raDateParsed,
        retainerPaid:       !!raDateParsed,
        filingDate:         _xDate(filingDate),
        approvalDate:       _xApprDate(filingDate, receipt),
        uscisReceiptNumber: _xReceipt(receipt),
        priorityDate:       _xDate(priorityDate),
        notes: [
          caseType    ? `Case Type: ${caseType}` : '',
          raDate      ? `RA Date: ${raDate}` : '',
          expiration  ? `Status/Expiration: ${expiration}` : '',
          receipt     ? `Receipt/Notes: ${receipt}` : '',
          officer     ? `Officer: ${officer}` : '',
        ].filter(Boolean).join('\n'),
      });
    });
}

async function _executeImport(replace) {
  const rows = _parseImportRows(document.getElementById('import-data')?.value||'');
  if (!rows.length) { toast('No valid rows found', 'warn'); return; }
  if (replace) State.cases = rows;
  else State.cases = [...State.cases, ...rows];
  await Storage.save();
  closeModal();
  toast(`${rows.length} cases imported successfully`);
  render();
}

// ---- Settings / Integrations ----
function renderSettings() {
  const integrations = [
    {
      id: 'outlook', name: 'Microsoft Outlook', icon: '✉',
      desc: 'Send emails directly from case manager, log sent mail, sync inbox.',
      status: sessionStorage.getItem('km_outlook_token') ? 'connected' : 'disconnected',
      setup: 'Register an app at portal.azure.com → App registrations → Add redirect URI: ' + location.href.split('?')[0],
      configKey: 'km_outlook_client_id', configLabel: 'Azure App Client ID',
      connectFn: '_connectOutlook()',
    },
    {
      id: 'dropbox', name: 'Dropbox', icon: '📦',
      desc: 'Auto-create client folders, generate share links, browse uploaded documents.',
      status: sessionStorage.getItem('km_dropbox_token') ? 'connected' : 'disconnected',
      setup: 'Create an app at dropbox.com/developers → Add OAuth2 redirect URI: ' + location.href.split('?')[0],
      configKey: 'km_dropbox_app_key', configLabel: 'Dropbox App Key',
      connectFn: '_connectDropbox()',
    },
    {
      id: 'zoom', name: 'Zoom', icon: '📹',
      desc: 'Auto-create Zoom meetings for consultations, insert link in confirmation emails.',
      status: sessionStorage.getItem('km_zoom_token') ? 'connected' : 'disconnected',
      setup: 'Create an app at marketplace.zoom.us → OAuth → Add redirect URI: ' + location.href.split('?')[0],
      configKey: 'km_zoom_client_id', configLabel: 'Zoom Client ID',
      connectFn: '_connectZoom()',
    },
  ];

  return `
    <div class="topbar">
      <div class="topbar-title">Settings & Integrations</div>
    </div>
    <div class="content">
      <div class="panel-title mb-16">Integrations</div>
      <p style="font-size:13px;color:var(--text-3);margin-bottom:24px">
        Connect external services to send emails via Outlook, manage documents in Dropbox, and create Zoom meetings automatically.
        Each integration requires a one-time app registration on the respective platform.
      </p>

      ${integrations.map(intg => {
        const connected = intg.status === 'connected';
        const savedKey = localStorage.getItem(intg.configKey) || '';
        return `
        <div class="panel" style="margin-bottom:16px">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px">
            <div style="flex:1">
              <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
                <span style="font-size:22px">${intg.icon}</span>
                <strong style="font-size:15px;color:var(--text)">${intg.name}</strong>
                <span class="badge ${connected ? 'badge-approved' : 'badge-lead'}">${connected ? 'Connected' : 'Not Connected'}</span>
              </div>
              <p style="font-size:13px;color:var(--text-3);margin-bottom:12px">${intg.desc}</p>
              ${!connected ? `
              <details style="margin-bottom:12px">
                <summary style="font-size:12px;color:var(--gold);cursor:pointer">Setup Instructions</summary>
                <p style="font-size:12px;color:var(--text-3);margin-top:8px;padding:10px;background:var(--surface-2);border-radius:6px">${intg.setup}</p>
              </details>
              <div style="display:flex;gap:8px;align-items:center">
                <input id="cfg-${intg.id}" placeholder="${intg.configLabel}" value="${escAttr(savedKey)}"
                  style="flex:1;padding:8px 12px;background:var(--surface-2);border:1px solid var(--border-2);border-radius:6px;color:var(--text);font-size:13px"
                  onblur="localStorage.setItem('${intg.configKey}',this.value)" />
                <button class="btn btn-gold btn-sm" onclick="${intg.connectFn}">Connect</button>
              </div>` : `
              <button class="btn btn-ghost btn-sm" onclick="sessionStorage.removeItem('km_${intg.id}_token'); render()">Disconnect</button>`}
            </div>
          </div>
        </div>`;
      }).join('')}

      <div class="panel" style="margin-top:24px">
        <div class="panel-title">Representation Agreement Template</div>
        <p style="font-size:13px;color:var(--text-3);margin-bottom:12px">
          Create a template for your representation agreement. Use placeholders: {{firstName}}, {{lastName}}, {{visaType}}, {{date}}, {{retainerAmount}}, {{email}}.
        </p>
        <textarea id="ra-template" rows="14" placeholder="Paste your representation agreement template here…"
          style="width:100%;box-sizing:border-box"
          onblur="localStorage.setItem('km_ra_template',this.value)">${escHtml(localStorage.getItem('km_ra_template')||'')}</textarea>
        <div style="margin-top:8px;display:flex;gap:8px">
          <button class="btn btn-ghost btn-sm" onclick="localStorage.setItem('km_ra_template',document.getElementById('ra-template').value); toast('Template saved')">Save Template</button>
        </div>
      </div>

      <div class="panel" style="margin-top:16px">
        <div class="panel-title">Petition Templates</div>
        <p style="font-size:13px;color:var(--text-3);margin-bottom:12px">
          Paste your attorney letter, table of contents, and exhibit templates. Use {{firstName}}, {{lastName}}, {{visaType}}, {{receiptNumber}} as placeholders.
        </p>
        ${['Attorney Cover Letter', 'Table of Contents', 'Exhibit Index'].map((name, i) => `
        <div style="margin-bottom:16px">
          <label style="font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:var(--text-3);display:block;margin-bottom:6px">${name}</label>
          <textarea rows="6" placeholder="Paste ${name} template…"
            onblur="localStorage.setItem('km_petition_tpl_${i}',this.value)"
            style="width:100%;box-sizing:border-box">${escHtml(localStorage.getItem(`km_petition_tpl_${i}`)||'')}</textarea>
        </div>`).join('')}
        <button class="btn btn-ghost btn-sm" onclick="[0,1,2].forEach(i=>{const el=document.querySelectorAll('#settings-content textarea')[i+1]; if(el) localStorage.setItem('km_petition_tpl_'+i,el.value)}); toast('Petition templates saved')">Save All Templates</button>
      </div>

      <div class="panel" style="margin-top:16px">
        <div class="panel-title">Data Management</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-ghost btn-sm" onclick="showImportCases()">Import Cases from Excel</button>
          <button class="btn btn-ghost btn-sm" onclick="_exportCases()">Export All Cases (JSON)</button>
          <button class="btn btn-danger btn-sm" onclick="_confirmClearAll()">Clear All Cases</button>
        </div>
      </div>
    </div>`;
}

function _connectOutlook() {
  const clientId = document.getElementById('cfg-outlook')?.value || localStorage.getItem('km_outlook_client_id');
  if (!clientId) { toast('Enter your Azure App Client ID first', 'warn'); return; }
  localStorage.setItem('km_outlook_client_id', clientId);
  const verifier = _pkceVerifier();
  sessionStorage.setItem('km_pkce_verifier', verifier);
  sessionStorage.setItem('km_oauth_pending', 'outlook');
  _pkceChallenge(verifier).then(challenge => {
    const params = new URLSearchParams({
      client_id: clientId, response_type: 'code', redirect_uri: location.href.split('?')[0],
      scope: 'openid email Mail.Send Mail.ReadWrite offline_access', code_challenge: challenge,
      code_challenge_method: 'S256', state: 'outlook',
    });
    location.href = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params}`;
  });
}

function _connectDropbox() {
  const appKey = document.getElementById('cfg-dropbox')?.value || localStorage.getItem('km_dropbox_app_key');
  if (!appKey) { toast('Enter your Dropbox App Key first', 'warn'); return; }
  localStorage.setItem('km_dropbox_app_key', appKey);
  const verifier = _pkceVerifier();
  sessionStorage.setItem('km_pkce_verifier', verifier);
  sessionStorage.setItem('km_oauth_pending', 'dropbox');
  _pkceChallenge(verifier).then(challenge => {
    const params = new URLSearchParams({
      client_id: appKey, response_type: 'code', redirect_uri: location.href.split('?')[0],
      token_access_type: 'offline', code_challenge: challenge, code_challenge_method: 'S256',
    });
    location.href = `https://www.dropbox.com/oauth2/authorize?${params}`;
  });
}

function _connectZoom() {
  const clientId = document.getElementById('cfg-zoom')?.value || localStorage.getItem('km_zoom_client_id');
  if (!clientId) { toast('Enter your Zoom Client ID first', 'warn'); return; }
  localStorage.setItem('km_zoom_client_id', clientId);
  const verifier = _pkceVerifier();
  sessionStorage.setItem('km_pkce_verifier', verifier);
  sessionStorage.setItem('km_oauth_pending', 'zoom');
  _pkceChallenge(verifier).then(challenge => {
    const params = new URLSearchParams({
      response_type: 'code', client_id: clientId, redirect_uri: location.href.split('?')[0],
      code_challenge: challenge, code_challenge_method: 'S256',
    });
    location.href = `https://zoom.us/oauth/authorize?${params}`;
  });
}

function _pkceVerifier() {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return btoa(String.fromCharCode(...arr)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
}
async function _pkceChallenge(verifier) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
}

// Handle OAuth callback (token exchange happens server-side for code flow;
// for implicit/fragment flow tokens appear in hash)
function _checkOAuthCallback() {
  const params = new URLSearchParams(location.search);
  const hash = new URLSearchParams(location.hash.slice(1));
  const service = params.get('state') || sessionStorage.getItem('km_oauth_pending');
  const code = params.get('code');
  const token = hash.get('access_token');
  if (token && service) {
    sessionStorage.setItem(`km_${service}_token`, token);
    sessionStorage.removeItem('km_oauth_pending');
    history.replaceState({}, '', location.pathname);
    toast(`${service.charAt(0).toUpperCase()+service.slice(1)} connected!`);
    return true;
  }
  if (code && service) {
    // Code flow requires token exchange — show instructions
    toast(`OAuth code received. Token exchange requires a backend redirect URI handler.`, 'warn');
    history.replaceState({}, '', location.pathname);
    return true;
  }
  return false;
}

// Create representation agreement for a case
function showRepAgreement(caseId) {
  const c = getCase(caseId);
  if (!c) return;
  let tmpl = localStorage.getItem('km_ra_template') || '';
  if (!tmpl) {
    toast('No template saved. Go to Settings to add your agreement template.', 'warn');
    navigate('settings');
    return;
  }
  const filled = tmpl
    .replace(/\{\{firstName\}\}/g, c.firstName)
    .replace(/\{\{lastName\}\}/g, c.lastName)
    .replace(/\{\{fullName\}\}/g, `${c.firstName} ${c.lastName}`)
    .replace(/\{\{visaType\}\}/g, c.visaType)
    .replace(/\{\{date\}\}/g, fmtDate(new Date().toISOString()))
    .replace(/\{\{retainerAmount\}\}/g, c.retainerAmount ? `$${c.retainerAmount}` : '[AMOUNT]')
    .replace(/\{\{email\}\}/g, c.email || '[EMAIL]');

  showModal(`
    <div class="modal modal-lg">
      <div class="modal-header">
        <h3>Representation Agreement — ${c.firstName} ${c.lastName}</h3>
        <button class="modal-close" onclick="closeModal()">×</button>
      </div>
      <div class="modal-body">
        <textarea id="ra-doc" rows="18" style="font-family:Georgia,serif;font-size:13px;line-height:1.8">${escHtml(filled)}</textarea>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
        <button class="btn btn-ghost" onclick="navigator.clipboard.writeText(document.getElementById('ra-doc').value).then(()=>toast('Agreement copied'))">Copy Text</button>
        <button class="btn btn-ghost" onclick="_emailRepAgreement('${caseId}')">Send via Email</button>
        <button class="btn btn-gold" onclick="_markRAComplete('${caseId}')">Mark as Sent</button>
      </div>
    </div>`);
}

function _emailRepAgreement(caseId) {
  const c = getCase(caseId);
  if (!c) return;
  const body = document.getElementById('ra-doc')?.value || '';
  const subject = `Representation Agreement — Kamkhadze PA × ${c.firstName} ${c.lastName}`;
  window.open(`mailto:${c.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank');
  _markRAComplete(caseId);
}

function _markRAComplete(caseId) {
  const c = getCase(caseId);
  if (!c) return;
  if (!c.emailLog) c.emailLog = [];
  c.emailLog.push({ subject: 'Representation Agreement sent', date: new Date().toISOString() });
  c.updatedAt = new Date().toISOString();
  Storage.save();
  closeModal();
  toast('Representation agreement marked as sent');
}

function _exportCases() {
  const blob = new Blob([JSON.stringify(State.cases, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `kamkhadze-cases-${today()}.json`; a.click();
  URL.revokeObjectURL(url);
}

function _confirmClearAll() {
  if (confirm('Delete ALL cases permanently? This cannot be undone.')) {
    State.cases = [];
    Storage.save();
    toast('All cases cleared');
    render();
  }
}

// ---- Zoom Meetings Section ----

function zoomSaveMeetings() {
  localStorage.setItem('km_zoom_meetings', JSON.stringify(State.zoom.meetings));
}

function zoomClientMatches() {
  const q = (State.zoom.clientSearch || '').toLowerCase().trim();
  if (!q) return State.cases;
  return State.cases.filter(c =>
    `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) ||
    c.email.toLowerCase().includes(q)
  );
}

function renderZoomMeetings() {
  const zoomConnected = !!sessionStorage.getItem('km_zoom_token');
  const meetings = State.zoom.meetings;
  const now = new Date();

  const todayStr = now.toISOString().split('T')[0];
  const todayMeetings = meetings.filter(m => m.date === todayStr).sort((a,b) => a.time.localeCompare(b.time));
  const upcomingMeetings = meetings.filter(m => m.date > todayStr).sort((a,b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time)).slice(0, 10);
  const pastMeetings = meetings.filter(m => m.date < todayStr).sort((a,b) => b.date.localeCompare(a.date)).slice(0, 5);

  const totalThisWeek = meetings.filter(m => {
    const d = new Date(m.date);
    const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - now.getDay());
    const endOfWeek = new Date(startOfWeek); endOfWeek.setDate(startOfWeek.getDate() + 6);
    return d >= startOfWeek && d <= endOfWeek;
  }).length;

  const nextMeeting = [...todayMeetings, ...upcomingMeetings][0];

  const matches = zoomClientMatches();
  const showSugg = State.zoom.clientSearch.length > 0 && !State.zoom.scheduleClient;

  return `
    <div class="topbar">
      <div class="topbar-title">Zoom Meetings</div>
      <div class="topbar-actions">
        ${zoomConnected
          ? `<span style="font-size:12px;color:var(--green);background:var(--green-dim);border:1px solid rgba(74,222,128,0.2);border-radius:20px;padding:4px 12px;margin-right:8px">● Connected</span>`
          : `<span style="font-size:12px;color:var(--text-3);background:var(--surface-2);border:1px solid var(--border-2);border-radius:20px;padding:4px 12px;margin-right:8px">Not connected — <a href="#" onclick="navigate('settings')" style="color:var(--gold)">Settings →</a></span>`}
        <button class="btn btn-gold" onclick="zoomToggleScheduleForm()">
          ${icon('add')} Schedule Meeting
        </button>
      </div>
    </div>
    <div class="content" id="zoom-content">

      ${State.zoom.showScheduleForm ? `
      <div class="panel" style="margin-bottom:24px;border-color:rgba(201,168,76,0.25)">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
          <div class="panel-title" style="margin-bottom:0">${icon('calendar')} Schedule New Zoom Meeting</div>
          <button class="btn btn-ghost btn-sm" onclick="zoomToggleScheduleForm()">✕ Cancel</button>
        </div>
        <div class="two-col" style="gap:20px">
          <div>
            <div class="field">
              <label>Client</label>
              <div style="position:relative">
                <div class="search-box" style="margin-bottom:0">
                  <span class="search-icon" style="width:14px;height:14px">${svgIcon('cases')}</span>
                  <input type="text"
                    placeholder="Type a name — e.g. Ana Pipia"
                    value="${escAttr(State.zoom.scheduleClient ? State.zoom.scheduleClient.firstName + ' ' + State.zoom.scheduleClient.lastName : State.zoom.clientSearch)}"
                    oninput="State.zoom.clientSearch=this.value; State.zoom.scheduleClient=null; rerenderZoom()"
                    onfocus="if(!State.zoom.scheduleClient){rerenderZoom()}"
                    autocomplete="off"
                    id="zoom-client-input"
                  />
                </div>
                ${showSugg ? `
                <div style="position:absolute;top:100%;left:0;right:0;z-index:50;background:var(--surface);border:1px solid var(--gold);border-radius:6px;overflow:hidden;max-height:200px;overflow-y:auto;margin-top:2px">
                  ${matches.length ? matches.slice(0,8).map(c => `
                    <div onclick="zoomSelectClient('${c.id}')"
                      style="padding:10px 14px;cursor:pointer;display:flex;align-items:center;gap:10px;font-size:13px;color:var(--text-2)"
                      onmouseover="this.style.background='var(--surface-2)'" onmouseout="this.style.background=''">
                      <div style="width:28px;height:28px;border-radius:50%;background:var(--gold-dim);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:500;color:var(--gold);flex-shrink:0">
                        ${c.firstName[0]}${c.lastName[0]||''}
                      </div>
                      <div>
                        <div style="color:var(--text)">${zoomHighlight(c.firstName + ' ' + c.lastName, State.zoom.clientSearch)}</div>
                        <div style="font-size:11px;color:var(--text-3)">${c.visaType} · ${c.email || 'no email'}</div>
                      </div>
                    </div>`).join('') : `<div style="padding:12px 14px;font-size:13px;color:var(--text-3)">No clients found</div>`}
                </div>` : ''}
              </div>
              ${State.zoom.scheduleClient ? `<div style="font-size:12px;color:var(--green);margin-top:4px">✓ ${State.zoom.scheduleClient.firstName} ${State.zoom.scheduleClient.lastName} · ${State.zoom.scheduleClient.email || 'no email on file'}</div>` : ''}
            </div>
            <div class="field">
              <label>Linked Case</label>
              <select onchange="State.zoom.scheduleCase=this.value">
                <option value="">Select case…</option>
                ${State.zoom.scheduleClient ? `<option value="${State.zoom.scheduleClient.visaType}" selected>${State.zoom.scheduleClient.visaType} — ${State.zoom.scheduleClient.firstName} ${State.zoom.scheduleClient.lastName}</option>` : ''}
              </select>
            </div>
            <div class="field">
              <label>Topic / Agenda</label>
              <input type="text" placeholder="e.g. O-1A initial consultation, document review…"
                value="${escAttr(State.zoom.scheduleTopic)}"
                oninput="State.zoom.scheduleTopic=this.value" />
            </div>
          </div>
          <div>
            <div class="field">
              <label>Date</label>
              <input type="date" value="${State.zoom.scheduleDate}" min="${todayStr}"
                onchange="State.zoom.scheduleDate=this.value" />
            </div>
            <div class="field">
              <label>Time</label>
              <input type="time" value="${State.zoom.scheduleTime}"
                onchange="State.zoom.scheduleTime=this.value" />
            </div>
            <div class="field">
              <label>Duration</label>
              <select onchange="State.zoom.scheduleDuration=this.value">
                <option value="30" ${State.zoom.scheduleDuration==='30'?'selected':''}>30 minutes</option>
                <option value="45" ${State.zoom.scheduleDuration==='45'?'selected':''}>45 minutes</option>
                <option value="60" ${State.zoom.scheduleDuration==='60'?'selected':''}>60 minutes</option>
                <option value="90" ${State.zoom.scheduleDuration==='90'?'selected':''}>90 minutes</option>
              </select>
            </div>
            <div style="margin-top:16px;display:flex;gap:8px">
              <button class="btn btn-gold" style="flex:1;justify-content:center" onclick="zoomCreateMeeting()">
                ${icon('calendar')} Create Zoom Link
              </button>
            </div>
            <p style="font-size:11px;color:var(--text-3);margin-top:8px;line-height:1.5">
              ${zoomConnected ? 'A real Zoom link will be created and the client will be shown for email invitation.' : '⚠ Zoom not connected. Link will be saved as pending. Connect Zoom in Settings to generate real links.'}
            </p>
          </div>
        </div>
      </div>` : ''}

      <div class="stats-grid" style="margin-bottom:24px">
        <div class="stat-card">
          <div class="stat-card-label">Today</div>
          <div class="stat-card-value" style="color:var(--blue)">${todayMeetings.length}</div>
          <div class="stat-card-sub">meetings scheduled</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-label">This Week</div>
          <div class="stat-card-value">${totalThisWeek}</div>
          <div class="stat-card-sub">total meetings</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-label">Next Meeting</div>
          <div class="stat-card-value" style="font-size:15px;color:var(--gold)">${nextMeeting ? nextMeeting.time : '—'}</div>
          <div class="stat-card-sub">${nextMeeting ? nextMeeting.clientName : 'None scheduled'}</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-label">Total Scheduled</div>
          <div class="stat-card-value">${meetings.length}</div>
          <div class="stat-card-sub">all time</div>
        </div>
      </div>

      ${todayMeetings.length ? `
      <div class="panel" style="margin-bottom:20px">
        <div class="panel-title" style="margin-bottom:16px">${icon('calendar')} Today — ${new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})}</div>
        ${todayMeetings.map(m => zoomMeetingRow(m, now)).join('')}
      </div>` : `
      <div class="panel" style="margin-bottom:20px">
        <div style="padding:20px 0;text-align:center;color:var(--text-3);font-size:14px">No meetings scheduled for today.</div>
      </div>`}

      ${upcomingMeetings.length ? `
      <div class="panel" style="margin-bottom:20px">
        <div class="panel-title" style="margin-bottom:16px">${icon('calendar')} Upcoming</div>
        ${upcomingMeetings.map(m => zoomMeetingRow(m, now)).join('')}
      </div>` : ''}

      ${pastMeetings.length ? `
      <div class="panel">
        <div class="panel-title" style="margin-bottom:16px">Recent Past Meetings</div>
        ${pastMeetings.map(m => zoomMeetingRow(m, now)).join('')}
      </div>` : ''}

      ${!meetings.length ? `
      <div class="panel" style="margin-bottom:20px">
        <div class="empty-state" style="padding:50px 20px">
          <div class="empty-state-icon">${svgIcon('calendar')}</div>
          <h3>No meetings yet</h3>
          <p>Schedule your first Zoom meeting using the button above.</p>
          <button class="btn btn-gold" onclick="zoomToggleScheduleForm()">Schedule a Meeting</button>
        </div>
      </div>` : ''}

    </div>`;
}

function zoomHighlight(str, query) {
  if (!query) return escHtml(str);
  const i = str.toLowerCase().indexOf(query.toLowerCase());
  if (i < 0) return escHtml(str);
  return escHtml(str.slice(0,i)) +
    `<span style="color:var(--gold);font-weight:500">${escHtml(str.slice(i,i+query.length))}</span>` +
    escHtml(str.slice(i+query.length));
}

function zoomMeetingRow(m, now) {
  const meetingDateTime = new Date(`${m.date}T${m.time}`);
  const diffMin = (meetingDateTime - now) / 60000;
  let status, statusStyle, actionBtn;

  if (m.date < now.toISOString().split('T')[0]) {
    status = 'Done';
    statusStyle = `background:var(--surface-3);color:var(--text-3);border:1px solid var(--border-2)`;
    actionBtn = m.notes ? `<button class="btn btn-ghost btn-sm" onclick="zoomViewNotes('${m.id}')">View Notes</button>` : `<button class="btn btn-ghost btn-sm" onclick="zoomAddNotes('${m.id}')">Add Notes</button>`;
  } else if (diffMin >= 0 && diffMin <= 30) {
    status = '● Live Now';
    statusStyle = `background:var(--green-dim);color:var(--green);border:1px solid rgba(74,222,128,0.2)`;
    actionBtn = m.zoomLink ? `<a href="${escAttr(m.zoomLink)}" target="_blank" class="btn btn-gold btn-sm">${icon('calendar')} Join</a>` : `<button class="btn btn-gold btn-sm">Join</button>`;
  } else {
    status = 'Upcoming';
    statusStyle = `background:var(--blue-dim);color:var(--blue);border:1px solid rgba(96,165,250,0.2)`;
    actionBtn = m.zoomLink
      ? `<button class="btn btn-ghost btn-sm" onclick="zoomCopyLink('${m.id}')">Copy Link</button>`
      : `<button class="btn btn-ghost btn-sm" style="color:var(--yellow)">Pending Link</button>`;
  }

  const initials = (m.clientName || '??').split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase();
  const dateLabel = m.date === now.toISOString().split('T')[0] ? 'Today' : fmtDate(m.date);

  return `
    <div style="display:flex;align-items:center;gap:14px;padding:12px 0;border-bottom:1px solid var(--border-2)">
      <div style="width:34px;height:34px;border-radius:50%;background:var(--gold-dim);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:500;color:var(--gold);flex-shrink:0">${initials}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:13.5px;font-weight:500;color:var(--text)">${escHtml(m.clientName)}</div>
        <div style="font-size:12px;color:var(--text-3);margin-top:2px">${dateLabel} · ${m.time} · ${m.duration} min${m.topic ? ' · ' + escHtml(m.topic) : ''}</div>
        ${m.caseLabel ? `<div style="font-size:11px;color:var(--text-3);margin-top:1px">${escHtml(m.caseLabel)}</div>` : ''}
      </div>
      <span style="font-size:11px;padding:3px 10px;border-radius:10px;font-weight:500;flex-shrink:0;white-space:nowrap;${statusStyle}">${status}</span>
      <div style="display:flex;gap:6px;flex-shrink:0">
        ${actionBtn}
        <button class="btn btn-ghost btn-sm" onclick="zoomSendReminder('${m.id}')" title="Send reminder email">✉</button>
        <button class="btn btn-ghost btn-sm" style="color:var(--red)" onclick="zoomDeleteMeeting('${m.id}')" title="Delete">×</button>
      </div>
    </div>`;
}

function rerenderZoom() {
  const main = document.getElementById('main-content');
  if (main) main.innerHTML = renderZoomMeetings();
}

function zoomToggleScheduleForm() {
  State.zoom.showScheduleForm = !State.zoom.showScheduleForm;
  State.zoom.clientSearch = '';
  State.zoom.scheduleClient = null;
  State.zoom.scheduleTopic = '';
  State.zoom.scheduleDate = '';
  State.zoom.scheduleTime = '10:00';
  State.zoom.scheduleDuration = '45';
  rerenderZoom();
}

function zoomSelectClient(caseId) {
  const c = getCase(caseId);
  if (!c) return;
  State.zoom.scheduleClient = c;
  State.zoom.clientSearch = `${c.firstName} ${c.lastName}`;
  rerenderZoom();
}

function zoomCreateMeeting() {
  if (!State.zoom.scheduleClient) {
    toast('Please select a client first', 'warn'); return;
  }
  if (!State.zoom.scheduleDate) {
    toast('Please select a date', 'warn'); return;
  }
  const c = State.zoom.scheduleClient;

  // Check for scheduling conflicts
  const conflict = State.zoom.meetings.find(m =>
    m.date === State.zoom.scheduleDate &&
    m.time === State.zoom.scheduleTime
  );
  if (conflict) {
    toast(`Conflict: ${conflict.clientName} is already scheduled at this time`, 'warn');
    return;
  }

  const linkId = Math.random().toString(36).slice(2,11);
  const zoomConnected = !!sessionStorage.getItem('km_zoom_token');

  const meeting = {
    id: uuid(),
    clientId: c.id,
    clientName: `${c.firstName} ${c.lastName}`,
    clientEmail: c.email || '',
    caseLabel: `${c.visaType}`,
    date: State.zoom.scheduleDate,
    time: State.zoom.scheduleTime,
    duration: State.zoom.scheduleDuration,
    topic: State.zoom.scheduleTopic,
    zoomLink: zoomConnected ? `https://zoom.us/j/${linkId}` : '',
    status: zoomConnected ? 'confirmed' : 'pending',
    createdAt: new Date().toISOString(),
    notes: '',
  };

  State.zoom.meetings.push(meeting);
  zoomSaveMeetings();

  const confirmMsg = c.email
    ? `Meeting scheduled. ${zoomConnected ? `<br><small style="color:var(--gold)">Zoom link: zoom.us/j/${linkId}</small>` : '<br><small style="color:var(--yellow)">Connect Zoom in Settings to generate a real link.</small>'}`
    : `Meeting scheduled. <small style="color:var(--yellow)">No email on file — add one to send invitation.</small>`;

  State.zoom.showScheduleForm = false;
  State.zoom.scheduleClient = null;
  State.zoom.clientSearch = '';
  State.zoom.scheduleTopic = '';
  rerenderZoom();
  toast('Meeting created!');

  // Offer to send invitation email
  if (c.email) {
    setTimeout(() => {
      if (confirm(`Send Zoom invitation to ${c.email}?`)) {
        zoomSendInvitation(meeting);
      }
    }, 300);
  }
}

function zoomSendInvitation(meeting) {
  const subject = `Your Consultation with Kamkhadze PA — ${fmtDate(meeting.date)} at ${meeting.time}`;
  const body = `Dear ${meeting.clientName.split(' ')[0]},\n\nYour consultation with Kamkhadze PA has been scheduled.\n\nDate: ${fmtDate(meeting.date)}\nTime: ${meeting.time}\nDuration: ${meeting.duration} minutes\n${meeting.topic ? 'Topic: ' + meeting.topic + '\n' : ''}${meeting.zoomLink ? '\nZoom Link: ' + meeting.zoomLink + '\n' : '\nZoom link will be sent shortly.\n'}\nIf you need to reschedule, please reply to this email at least 24 hours in advance.\n\nBest regards,\nAna Kamkhadze, Esq. MBA\nKamkhadze PA\nanka@esq.mba | (786) 590-9400`;
  window.open(`mailto:${meeting.clientEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank');
  toast('Invitation email opened in mail app');
}

function zoomSendReminder(meetingId) {
  const m = State.zoom.meetings.find(x => x.id === meetingId);
  if (!m) return;
  if (!m.clientEmail) {
    toast('No email on file for this client — edit their case to add one', 'warn');
    return;
  }
  const subject = `Reminder: Your Consultation Tomorrow — ${fmtDate(m.date)} at ${m.time}`;
  const body = `Dear ${m.clientName.split(' ')[0]},\n\nThis is a friendly reminder of your upcoming consultation with Kamkhadze PA.\n\nDate: ${fmtDate(m.date)}\nTime: ${m.time}\nDuration: ${m.duration} minutes\n${m.zoomLink ? '\nZoom Link: ' + m.zoomLink + '\n' : ''}\nIf you need to reschedule, please reply at least 24 hours in advance.\n\nBest regards,\nAna Kamkhadze, Esq. MBA\nKamkhadze PA\nanka@esq.mba | (786) 590-9400`;
  window.open(`mailto:${m.clientEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank');
  toast('Reminder email opened in mail app');
}

function zoomCopyLink(meetingId) {
  const m = State.zoom.meetings.find(x => x.id === meetingId);
  if (!m || !m.zoomLink) return;
  navigator.clipboard.writeText(m.zoomLink).then(() => toast('Zoom link copied to clipboard'));
}

function zoomDeleteMeeting(meetingId) {
  if (!confirm('Delete this meeting?')) return;
  State.zoom.meetings = State.zoom.meetings.filter(m => m.id !== meetingId);
  zoomSaveMeetings();
  rerenderZoom();
  toast('Meeting deleted');
}

function zoomAddNotes(meetingId) {
  const m = State.zoom.meetings.find(x => x.id === meetingId);
  if (!m) return;
  showModal(`
    <div class="modal" style="max-width:520px">
      <div class="modal-header">
        <h3>Meeting Notes — ${escHtml(m.clientName)}</h3>
        <button class="modal-close" onclick="closeModal()">×</button>
      </div>
      <div class="modal-body">
        <p style="font-size:13px;color:var(--text-3);margin-bottom:12px">${fmtDate(m.date)} at ${m.time} · ${m.duration} min</p>
        <div class="field">
          <label>Notes / Summary</label>
          <textarea id="zm-notes" rows="8" placeholder="Key points discussed, action items, next steps…">${escHtml(m.notes||'')}</textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
        <button class="btn btn-gold" onclick="zoomSaveNotes('${meetingId}')">Save Notes</button>
      </div>
    </div>`);
}

function zoomViewNotes(meetingId) {
  zoomAddNotes(meetingId);
}

function zoomSaveNotes(meetingId) {
  const m = State.zoom.meetings.find(x => x.id === meetingId);
  if (!m) return;
  m.notes = document.getElementById('zm-notes')?.value || '';
  zoomSaveMeetings();
  closeModal();
  rerenderZoom();
  toast('Notes saved');
}

// ---- END Zoom Meetings Section ----

// ================================================================
// ---- Email Section ----
// ================================================================

function emailSave() {
  localStorage.setItem('km_email_inbox',     JSON.stringify(State.email.inbox));
  localStorage.setItem('km_email_sent',      JSON.stringify(State.email.sent));
  localStorage.setItem('km_email_drafts',    JSON.stringify(State.email.drafts));
  localStorage.setItem('km_email_notes',     JSON.stringify(State.email.notes));
  localStorage.setItem('km_email_templates', JSON.stringify(State.email.templates));
}

function emailGetActive() {
  const all = [...State.email.inbox, ...State.email.sent, ...State.email.drafts];
  return all.find(e => e.id === State.email.activeEmailId) || null;
}

function rerenderEmail() {
  const main = document.getElementById('main-content');
  if (!main) return;
  if (State.email.tab === 'new-template') { main.innerHTML = renderEmailNewTemplate(); return; }
  main.innerHTML = renderEmailSection();
}

function renderEmailSection() {
  const tab = State.email.tab;
  const outlookConnected = !!sessionStorage.getItem('km_outlook_token');
  const unread = (State.email.inbox||[]).filter(e=>e.unread).length;
  const tabs = [
    { id:'inbox',     label:'Inbox',     badge: unread },
    { id:'sent',      label:'Sent',      badge: 0 },
    { id:'drafts',    label:'Drafts',    badge: State.email.drafts.length },
    { id:'templates', label:'Templates', badge: 0 },
  ];
  return `
    <div class="topbar">
      <div class="topbar-title">Email</div>
      <div class="topbar-actions">
        ${outlookConnected
          ? `<span style="font-size:12px;color:var(--green);background:var(--green-dim);border:1px solid rgba(74,222,128,0.2);border-radius:20px;padding:4px 12px;">● Outlook connected</span>`
          : `<span style="font-size:12px;color:var(--text-3);background:var(--surface-2);border:1px solid var(--border-2);border-radius:20px;padding:4px 12px;">Not connected — <a href="#" onclick="navigate('settings')" style="color:var(--gold)">Settings →</a></span>`}
        <button class="btn btn-ghost btn-sm" onclick="emailSetTab('templates')">${icon('docs')} Templates</button>
        <button class="btn btn-gold" onclick="emailSetTab('compose')">${icon('edit')} Compose</button>
      </div>
    </div>
    <div style="display:flex;border-bottom:1px solid var(--border-2);flex-shrink:0;">
      ${tabs.map(t=>`
        <button onclick="emailSetTab('${t.id}')"
          style="padding:10px 18px;font-size:13px;font-weight:500;background:none;border:none;
                 border-bottom:2px solid ${tab===t.id?'var(--gold)':'transparent'};
                 color:${tab===t.id?'var(--gold-light)':'var(--text-3)'};cursor:pointer;display:flex;align-items:center;gap:6px;">
          ${t.label}
          ${t.badge?`<span style="font-size:10px;background:var(--gold-dim);color:var(--gold);border:1px solid var(--border);border-radius:10px;padding:1px 6px;">${t.badge}</span>`:''}
        </button>`).join('')}
    </div>
    <div style="display:flex;flex:1;overflow:hidden;min-height:0;">
      ${tab==='compose'   ? renderEmailCompose()   :
        tab==='templates' ? renderEmailTemplates() :
        renderEmailListLayout(tab)}
    </div>`;
}

function renderEmailListLayout(tab) {
  const list = State.email[tab] || [];
  const q = (State.email.search||'').toLowerCase();
  const filtered = q ? list.filter(e=>
    (e.from||'').toLowerCase().includes(q)||(e.subject||'').toLowerCase().includes(q)||(e.preview||'').toLowerCase().includes(q)
  ) : list;
  const active = emailGetActive();
  return `
    <div style="width:280px;border-right:1px solid var(--border-2);display:flex;flex-direction:column;flex-shrink:0;">
      <div style="padding:10px 12px;border-bottom:1px solid var(--border-2);">
        <div class="search-box">
          <span class="search-icon" style="width:14px;height:14px">${svgIcon('docs')}</span>
          <input type="text" placeholder="Search…" value="${escAttr(State.email.search||'')}"
            oninput="State.email.search=this.value;rerenderEmail()" style="width:100%" />
        </div>
      </div>
      <div style="flex:1;overflow-y:auto;">
        ${!filtered.length?`<div style="padding:40px 16px;text-align:center;color:var(--text-3);font-size:13px;">No emails</div>`:
          filtered.map(e=>`
            <div onclick="emailOpen('${e.id}')"
              style="padding:12px 14px;border-bottom:1px solid rgba(255,255,255,0.05);cursor:pointer;
                     background:${active&&active.id===e.id?'rgba(201,168,76,0.08)':'transparent'};
                     border-left:3px solid ${active&&active.id===e.id?'var(--gold)':'transparent'};">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px;">
                <span style="font-size:13px;font-weight:${e.unread?'600':'400'};color:${e.unread?'var(--text)':'var(--text-2)'};">${escHtml(e.from)}</span>
                <div style="display:flex;align-items:center;gap:5px;">
                  ${e.unread?`<div style="width:6px;height:6px;border-radius:50%;background:var(--gold);"></div>`:''}
                  <span style="font-size:11px;color:var(--text-3);">${escHtml(e.time||'')}</span>
                </div>
              </div>
              <div style="font-size:12px;color:${e.unread?'var(--text-2)':'var(--text-3)'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:2px;">${escHtml(e.subject||'')}</div>
              <div style="font-size:11px;color:var(--text-3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHtml(e.preview||'')}</div>
              ${e.caseTag?`<div style="margin-top:4px;"><span style="font-size:10px;background:var(--blue-dim,rgba(96,165,250,0.1));color:var(--blue,#60a5fa);border:1px solid rgba(96,165,250,0.2);border-radius:8px;padding:1px 7px;">${escHtml(e.caseTag)}</span></div>`:''}
            </div>`).join('')}
      </div>
    </div>
    <div style="flex:1;display:flex;flex-direction:column;overflow:hidden;min-width:0;">
      ${active ? `
        <div style="flex:1;overflow-y:auto;padding:24px;">
          <div style="display:flex;gap:8px;margin-bottom:18px;flex-wrap:wrap;">
            <button class="btn btn-ghost btn-sm" onclick="emailSetTab('compose','${escAttr(active.fromEmail||'')}','Re: ${escAttr(active.subject||'')}')">${icon('email')} Reply</button>
            <button class="btn btn-gold btn-sm" onclick="emailSetTab('compose')">${icon('edit')} New Email</button>
            ${active.caseTag?`<button class="btn btn-ghost btn-sm" onclick="navigate('cases')">${icon('cases')} View Case</button>`:''}
            <button class="btn btn-ghost btn-sm" style="margin-left:auto;color:var(--red);" onclick="emailDelete('${active.id}')">${icon('trash')}</button>
          </div>
          <div style="font-family:var(--font-serif,Georgia,serif);font-size:20px;font-weight:500;color:var(--gold-light,#e2c97e);margin-bottom:10px;">${escHtml(active.subject||'')}</div>
          <div style="font-size:14px;font-weight:500;color:var(--text);margin-bottom:2px;">${escHtml(active.from)} <span style="font-size:12px;color:var(--text-3);font-weight:400;">&lt;${escHtml(active.fromEmail||'')}&gt;</span></div>
          <div style="font-size:12px;color:var(--text-3);margin-bottom:20px;">${escHtml(active.date||'')} · to anka@esq.mba</div>
          <div style="font-size:14px;color:var(--text-2);line-height:1.8;white-space:pre-wrap;border-top:1px solid var(--border-2);padding-top:20px;">${escHtml(active.body||active.preview||'')}</div>
        </div>`
      : `<div style="flex:1;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:10px;color:var(--text-3);">
           <div style="opacity:.3;width:40px;height:40px;">${svgIcon('email')}</div>
           Select an email to read it
         </div>`}
    </div>
    <div style="width:230px;border-left:1px solid var(--border-2);display:flex;flex-direction:column;flex-shrink:0;">
      <div style="padding:12px 14px;border-bottom:1px solid var(--border-2);font-size:11px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--text-3);">
        Notes ${active?`<span style="font-weight:400;text-transform:none;letter-spacing:0;color:var(--text-3);font-size:10px;">· ${escHtml(active.from)}</span>`:''}
      </div>
      <div style="flex:1;overflow-y:auto;padding:12px 14px;">
        ${active?`
          <div style="font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--text-3);margin-bottom:6px;">My notes</div>
          <textarea id="enote-${active.id}"
            style="width:100%;background:var(--surface-2);border:1px solid var(--border-2);border-radius:var(--radius,6px);color:var(--text-2);font-size:12px;padding:10px;outline:none;resize:none;min-height:100px;line-height:1.6;font-family:var(--font-sans,inherit);"
            placeholder="Notes on this email…"
            onblur="emailSaveNote('${active.id}',this.value)"
            onfocus="this.style.borderColor='var(--gold)'"
            onblur="this.style.borderColor='var(--border-2)';emailSaveNote('${active.id}',this.value)"
          >${escHtml(State.email.notes[active.id]||'')}</textarea>
          <div style="height:1px;background:var(--border-2);margin:12px 0;"></div>
          <div style="font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--text-3);margin-bottom:8px;">Quick tags</div>
          <div style="display:flex;flex-direction:column;gap:5px;">
            ${['Follow up needed','Document requested','Payment discussed','Linked to case','Awaiting response'].map(tag=>`
              <button onclick="emailAddTag('${active.id}','${tag}')"
                style="text-align:left;padding:6px 10px;background:transparent;border:1px solid var(--border-2);border-radius:var(--radius,6px);color:var(--text-3);font-size:12px;cursor:pointer;"
                onmouseover="this.style.color='var(--gold-light,#e2c97e)';this.style.borderColor='var(--border)'"
                onmouseout="this.style.color='var(--text-3)';this.style.borderColor='var(--border-2)'">${escHtml(tag)}</button>`).join('')}
          </div>
          <div style="height:1px;background:var(--border-2);margin:12px 0;"></div>
          <div style="font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--text-3);margin-bottom:8px;">Send from here</div>
          <button class="btn btn-ghost btn-sm" style="width:100%;justify-content:center;margin-bottom:6px;" onclick="emailSetTab('compose','${escAttr(active.fromEmail||'')}','Re: ${escAttr(active.subject||'')}')">
            ${icon('email')} Reply to this email
          </button>
          <button class="btn btn-ghost btn-sm" style="width:100%;justify-content:center;" onclick="navigate('zoom')">
            ${icon('calendar')} Schedule Zoom call
          </button>`
        :`<div style="color:var(--text-3);font-size:13px;text-align:center;margin-top:30px;">Select an email to add notes</div>`}
      </div>
    </div>`;
}

function renderEmailCompose() {
  const d = State.email.composeData;
  const builtIn = [
    {id:'consultation-confirm',label:'Consultation confirmation'},
    {id:'intro-welcome',label:'Welcome email'},
    {id:'doc-request',label:'Document request'},
    {id:'bank-info',label:'Payment instructions'},
    {id:'status-update',label:'Status update'},
    {id:'rfe-received',label:'RFE notice'},
    {id:'approval',label:'Approval congratulations'},
  ];
  return `
    <div style="flex:1;display:flex;flex-direction:column;padding:24px;overflow-y:auto;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;">
        <div style="font-size:16px;font-weight:500;color:var(--text);">New message</div>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-ghost btn-sm" onclick="emailSaveDraft()">Save draft</button>
          <button class="btn btn-ghost btn-sm" onclick="emailSetTab('inbox')">Discard</button>
          <button class="btn btn-gold" onclick="emailSend()">${icon('email')} Send</button>
        </div>
      </div>
      <div style="background:var(--surface);border:1px solid var(--border-2);border-radius:var(--radius-lg,8px);overflow:hidden;display:flex;flex-direction:column;flex:1;">
        <div style="display:flex;align-items:center;gap:10px;padding:10px 16px;border-bottom:1px solid var(--border-2);">
          <span style="font-size:11px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--text-3);width:55px;">From</span>
          <span style="font-size:13px;color:var(--text-3);">anka@esq.mba</span>
        </div>
        <div style="display:flex;align-items:center;gap:10px;padding:10px 16px;border-bottom:1px solid var(--border-2);">
          <span style="font-size:11px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--text-3);width:55px;">To</span>
          <input id="compose-to" value="${escAttr(d.to||'')}" oninput="State.email.composeData.to=this.value"
            style="flex:1;background:none;border:none;color:var(--text);font-size:13px;outline:none;font-family:var(--font-sans,inherit);"
            placeholder="recipient@email.com" />
        </div>
        <div style="display:flex;align-items:center;gap:10px;padding:10px 16px;border-bottom:1px solid var(--border-2);">
          <span style="font-size:11px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--text-3);width:55px;">Subject</span>
          <input id="compose-subject" value="${escAttr(d.subject||'')}" oninput="State.email.composeData.subject=this.value"
            style="flex:1;background:none;border:none;color:var(--text);font-size:13px;outline:none;font-family:var(--font-sans,inherit);"
            placeholder="Subject…" />
        </div>
        <div style="padding:10px 16px;border-bottom:1px solid var(--border-2);">
          <div style="font-size:11px;color:var(--text-3);margin-bottom:7px;">Insert template:</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            ${builtIn.map(t=>`<button onclick="emailInsertBuiltIn('${t.id}')"
              style="font-size:11px;padding:4px 10px;background:var(--surface-2);border:1px solid var(--border-2);border-radius:20px;color:var(--text-3);cursor:pointer;"
              onmouseover="this.style.color='var(--gold-light,#e2c97e)'" onmouseout="this.style.color='var(--text-3)'">${escHtml(t.label)}</button>`).join('')}
            ${State.email.templates.map(t=>`<button onclick="emailInsertCustom('${escAttr(t.id)}')"
              style="font-size:11px;padding:4px 10px;background:var(--gold-dim);border:1px solid var(--border);border-radius:20px;color:var(--gold-light,#e2c97e);cursor:pointer;">★ ${escHtml(t.name)}</button>`).join('')}
          </div>
        </div>
        <textarea id="compose-body" oninput="State.email.composeData.body=this.value"
          style="flex:1;background:none;border:none;color:var(--text-2);font-size:14px;line-height:1.8;outline:none;resize:none;padding:16px;font-family:var(--font-sans,inherit);min-height:220px;"
          placeholder="Write your email…">${escHtml(d.body||'')}</textarea>
        <div style="padding:10px 16px;border-top:1px solid var(--border-2);display:flex;gap:8px;align-items:center;">
          <button class="btn btn-ghost btn-sm">${icon('docs')} Attach</button>
          <button class="btn btn-ghost btn-sm" onclick="navigate('dropbox')">${icon('dropbox')} From Dropbox</button>
          <span style="font-size:11px;color:var(--text-3);margin-left:auto;">via Outlook · anka@esq.mba</span>
        </div>
      </div>
    </div>
    <div style="width:230px;border-left:1px solid var(--border-2);padding:16px;overflow-y:auto;flex-shrink:0;">
      <div style="font-size:11px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--text-3);margin-bottom:10px;">Scratch notes</div>
      <textarea style="width:100%;background:var(--surface-2);border:1px solid var(--border-2);border-radius:var(--radius,6px);color:var(--text-2);font-size:12px;padding:10px;outline:none;resize:none;min-height:120px;line-height:1.6;font-family:var(--font-sans,inherit);"
        placeholder="Notes before sending…"></textarea>
      <div style="height:1px;background:var(--border-2);margin:12px 0;"></div>
      <div style="font-size:12px;color:var(--text-3);line-height:1.7;">
        Sends from <span style="color:var(--gold);">anka@esq.mba</span> via Outlook. Logged in Sent automatically.
      </div>
    </div>`;
}

function renderEmailTemplates() {
  const builtIn = [
    {id:'consultation-confirm',icon:'calendar',title:'Consultation confirmation',desc:'Confirm date, time, Zoom link'},
    {id:'intro-welcome',icon:'overview',title:'Welcome / introduction',desc:'First email after inquiry'},
    {id:'representation',icon:'petition',title:'Representation agreement',desc:'Send engagement letter'},
    {id:'bank-info',icon:'status',title:'Payment instructions',desc:'Retainer and banking details'},
    {id:'doc-request',icon:'docs',title:'Document upload request',desc:'Dropbox link + checklist'},
    {id:'status-update',icon:'email',title:'Case status update',desc:'Notify client of USCIS update'},
    {id:'rfe-received',icon:'edit',title:'RFE received notice',desc:'Inform client, outline response'},
    {id:'approval',icon:'check',title:'Approval congratulations',desc:'Case approved notification'},
  ];
  const custom = State.email.templates;
  return `
    <div style="flex:1;overflow-y:auto;padding:24px;">
      <div style="font-size:13px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--text-3);margin-bottom:14px;">Built-in templates</div>
      <div class="email-template-grid" style="margin-bottom:24px;">
        ${builtIn.map(t=>`
          <div class="email-card" onclick="emailUseBuiltIn('${t.id}')">
            <div class="email-card-icon">${svgIcon(t.icon)}</div>
            <h4>${escHtml(t.title)}</h4>
            <p>${escHtml(t.desc)}</p>
          </div>`).join('')}
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
        <div style="font-size:13px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--text-3);">My custom templates</div>
        <button class="btn btn-gold btn-sm" onclick="emailSetTab('new-template')">${icon('add')} New template</button>
      </div>
      ${custom.length?`
        <div style="display:flex;flex-direction:column;gap:10px;">
          ${custom.map(t=>`
            <div style="background:var(--surface);border:1px solid var(--border-2);border-radius:var(--radius-lg,8px);padding:14px;display:flex;align-items:center;justify-content:space-between;">
              <div>
                <div style="font-size:14px;font-weight:500;color:var(--text);margin-bottom:2px;">${escHtml(t.name)}</div>
                <div style="font-size:12px;color:var(--text-3);">${escHtml(t.subject)}</div>
              </div>
              <div style="display:flex;gap:8px;">
                <button class="btn btn-ghost btn-sm" onclick="emailUseCustom('${escAttr(t.id)}')">Use</button>
                <button class="btn btn-ghost btn-sm" style="color:var(--red);" onclick="emailDeleteTemplate('${escAttr(t.id)}')">${icon('trash')}</button>
              </div>
            </div>`).join('')}
        </div>`:`
        <div style="background:var(--surface);border:1px dashed var(--border-2);border-radius:var(--radius-lg,8px);padding:32px;text-align:center;color:var(--text-3);">
          <div style="margin-bottom:10px;">No custom templates yet</div>
          <button class="btn btn-ghost btn-sm" onclick="emailSetTab('new-template')">${icon('add')} Create your first template</button>
        </div>`}
    </div>
    <div style="width:230px;border-left:1px solid var(--border-2);padding:16px;flex-shrink:0;overflow-y:auto;">
      <div style="font-size:11px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--text-3);margin-bottom:12px;">Placeholders</div>
      <div style="font-size:12px;color:var(--text-3);line-height:1.8;">
        ${['{{firstName}}','{{lastName}}','{{visaType}}','{{date}}','{{zoomLink}}','{{dropboxLink}}','{{receiptNumber}}','{{retainerAmount}}'].map(p=>`
          <div style="font-family:monospace;font-size:11px;color:var(--gold);margin-bottom:4px;">${escHtml(p)}</div>`).join('')}
        <div style="margin-top:10px;line-height:1.6;">These auto-fill from the client's case record when sending.</div>
      </div>
    </div>`;
}

function renderEmailNewTemplate() {
  const t = State.email.newTpl;
  return `
    <div class="topbar">
      <div class="topbar-title">Email <em>· New Template</em></div>
      <div class="topbar-actions">
        <button class="btn btn-ghost btn-sm" onclick="emailSetTab('templates')">Cancel</button>
        <button class="btn btn-gold" onclick="emailSaveTemplate()">${icon('check')} Save template</button>
      </div>
    </div>
    <div style="display:flex;flex:1;overflow:hidden;min-height:0;">
      <div style="flex:1;padding:24px;overflow-y:auto;">
        <div class="panel">
          <div class="panel-title">Template details</div>
          <div class="field">
            <label>Template name</label>
            <input type="text" value="${escAttr(t.name)}" oninput="State.email.newTpl.name=this.value" placeholder="e.g. Welcome email — Georgian clients" />
          </div>
          <div class="field">
            <label>Subject line</label>
            <input type="text" value="${escAttr(t.subject)}" oninput="State.email.newTpl.subject=this.value" placeholder="e.g. Welcome to Kamkhadze PA — {{visaType}} Case" />
          </div>
          <div class="field">
            <label>Email body</label>
            <textarea rows="14" oninput="State.email.newTpl.body=this.value" placeholder="Dear {{firstName}},&#10;&#10;Write your email here…">${escHtml(t.body)}</textarea>
          </div>
        </div>
      </div>
      <div style="width:260px;border-left:1px solid var(--border-2);padding:20px;overflow-y:auto;flex-shrink:0;">
        <div style="font-size:11px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--text-3);margin-bottom:12px;">Placeholders</div>
        ${[['{{firstName}}','Client first name'],['{{lastName}}','Client last name'],['{{visaType}}','Visa type'],['{{date}}','Today\'s date'],['{{zoomLink}}','Zoom link'],['{{dropboxLink}}','Dropbox folder'],['{{receiptNumber}}','USCIS receipt #'],['{{retainerAmount}}','Retainer amount']].map(([ph,desc])=>`
          <div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:10px;">
            <div style="font-family:monospace;font-size:10px;color:var(--gold);background:var(--gold-dim);border:1px solid var(--border);border-radius:3px;padding:2px 5px;flex-shrink:0;">${escHtml(ph)}</div>
            <div style="font-size:12px;color:var(--text-3);">${escHtml(desc)}</div>
          </div>`).join('')}
      </div>
    </div>`;
}

// Email action functions
function emailSetTab(tab, to, subject) {
  State.email.tab = tab;
  State.email.search = '';
  if (tab==='compose') State.email.composeData = { to: to||'', subject: subject||'', body: '' };
  if (tab==='new-template') State.email.newTpl = { name:'', subject:'', body:'' };
  rerenderEmail();
}
function emailOpen(id) {
  State.email.activeEmailId = id;
  const all = [...State.email.inbox,...State.email.sent,...State.email.drafts];
  const e = all.find(x=>x.id===id);
  if (e) e.unread = false;
  emailSave();
  rerenderEmail();
}
function emailSaveNote(id, val) {
  State.email.notes[id] = val;
  emailSave();
}
function emailAddTag(emailId, tag) {
  const cur = State.email.notes[emailId] || '';
  State.email.notes[emailId] = cur ? cur + '\n[' + tag + ']' : '[' + tag + ']';
  emailSave();
  rerenderEmail();
}
function emailDelete(id) {
  ['inbox','sent','drafts'].forEach(k => { State.email[k] = State.email[k].filter(e=>e.id!==id); });
  State.email.activeEmailId = null;
  emailSave();
  rerenderEmail();
  toast('Email deleted');
}
function emailSend() {
  const d = State.email.composeData;
  if (!d.to)      { toast('Please enter a recipient','warn'); return; }
  if (!d.subject) { toast('Please enter a subject','warn');   return; }
  const sent = { id:uuid(), from:'You → '+d.to, fromEmail:d.to, subject:d.subject, preview:d.body.slice(0,80), body:d.body, time:new Date().toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'}), date:'Today', unread:false };
  State.email.sent.unshift(sent);
  emailSave();
  window.open(`mailto:${d.to}?subject=${encodeURIComponent(d.subject)}&body=${encodeURIComponent(d.body)}`,'_blank');
  toast('Email sent and logged in Sent');
  State.email.tab='sent';
  State.email.activeEmailId=sent.id;
  rerenderEmail();
}
function emailSaveDraft() {
  const d = State.email.composeData;
  State.email.drafts.unshift({ id:uuid(), from:'Draft — '+(d.to||'No recipient'), fromEmail:d.to, subject:d.subject||'(no subject)', preview:d.body.slice(0,80), body:d.body, time:'Now', date:'Today', unread:false });
  emailSave();
  toast('Draft saved');
  emailSetTab('drafts');
}
function emailSaveTemplate() {
  if (!State.email.newTpl.name) { toast('Template name required','warn'); return; }
  State.email.templates.push({ id:uuid(), ...State.email.newTpl });
  emailSave();
  toast('Template saved');
  emailSetTab('templates');
}
function emailDeleteTemplate(id) {
  State.email.templates = State.email.templates.filter(t=>t.id!==id);
  emailSave();
  rerenderEmail();
}
function emailUseBuiltIn(id) {
  State.email.tab='compose';
  State.email.composeData={ to:'', subject:'', body:'' };
  rerenderEmail();
  setTimeout(()=>emailInsertBuiltIn(id),80);
}
function emailUseCustom(id) {
  const t = State.email.templates.find(x=>x.id===id);
  if (!t) return;
  State.email.tab='compose';
  State.email.composeData={ to:'', subject:t.subject, body:t.body };
  rerenderEmail();
}
function emailInsertBuiltIn(templateId) {
  const c = State.cases[0];
  const draft = c ? buildEmailDraft(c, templateId) : { subject:'', body:'' };
  const body = document.getElementById('compose-body');
  const subj = document.getElementById('compose-subject');
  if (body) { body.value = draft.body||''; State.email.composeData.body = body.value; }
  if (subj && draft.subject) { subj.value = draft.subject; State.email.composeData.subject = subj.value; }
}
function emailInsertCustom(id) {
  const t = State.email.templates.find(x=>x.id===id);
  if (!t) return;
  const body = document.getElementById('compose-body');
  const subj = document.getElementById('compose-subject');
  if (body) { body.value=t.body; State.email.composeData.body=t.body; }
  if (subj) { subj.value=t.subject; State.email.composeData.subject=t.subject; }
}

// ================================================================
// ---- Dropbox Section ----
// ================================================================

function dropboxSave() {
  localStorage.setItem('km_dropbox_files', JSON.stringify(State.dropbox.files));
  localStorage.setItem('km_dropbox_notes', JSON.stringify(State.dropbox.notes));
}

function dropboxGetActive() {
  return State.dropbox.files.find(f=>f.id===State.dropbox.activeFileId)||null;
}

function rerenderDropbox() {
  const main = document.getElementById('main-content');
  if (main) main.innerHTML = renderDropboxSection();
}

const DROPBOX_FOLDERS = [
  '01_Personal_Documents',
  '02_Evidence',
  '03_Support_Letters',
  '04_Financial_Documents',
  '05_Correspondence',
  '06_Petition_Drafts',
  '07_USCIS_Notices',
];

function renderDropboxSection() {
  const dropboxConnected = !!sessionStorage.getItem('km_dropbox_token');
  const tab = State.dropbox.tab;
  const q = (State.dropbox.search||'').toLowerCase();
  const files = State.dropbox.files;
  const filtered = q ? files.filter(f=>(f.name||'').toLowerCase().includes(q)||(f.folder||'').toLowerCase().includes(q)||(f.clientName||'').toLowerCase().includes(q)) : files;
  const active = dropboxGetActive();

  // Group by folder
  const byFolder = {};
  DROPBOX_FOLDERS.forEach(f=>{ byFolder[f]=[]; });
  byFolder['Other'] = [];
  filtered.forEach(f=>{
    const key = DROPBOX_FOLDERS.includes(f.folder) ? f.folder : 'Other';
    byFolder[key].push(f);
  });

  const fileTypeIcon = (name) => {
    const ext = (name||'').split('.').pop().toLowerCase();
    if (['pdf'].includes(ext)) return '📄';
    if (['doc','docx'].includes(ext)) return '📝';
    if (['jpg','jpeg','png','gif','webp'].includes(ext)) return '🖼️';
    if (['xlsx','xls','csv'].includes(ext)) return '📊';
    if (['zip','rar'].includes(ext)) return '🗜️';
    return '📎';
  };

  const fmtSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return bytes+'B';
    if (bytes < 1024*1024) return (bytes/1024).toFixed(1)+'KB';
    return (bytes/(1024*1024)).toFixed(1)+'MB';
  };

  return `
    <div class="topbar">
      <div class="topbar-title">Dropbox Files</div>
      <div class="topbar-actions">
        ${dropboxConnected
          ? `<span style="font-size:12px;color:var(--green);background:var(--green-dim);border:1px solid rgba(74,222,128,0.2);border-radius:20px;padding:4px 12px;">● Dropbox connected</span>`
          : `<span style="font-size:12px;color:var(--text-3);background:var(--surface-2);border:1px solid var(--border-2);border-radius:20px;padding:4px 12px;">Not connected — <a href="#" onclick="navigate('settings')" style="color:var(--gold)">Settings →</a></span>`}
        <button class="btn btn-ghost btn-sm" onclick="dropboxUpload()">${icon('add')} Upload File</button>
        <input type="file" id="dropbox-file-input" multiple style="display:none" onchange="dropboxHandleUpload(this)" />
      </div>
    </div>

    <div style="display:flex;flex:1;overflow:hidden;min-height:0;">

      <div style="width:220px;border-right:1px solid var(--border-2);display:flex;flex-direction:column;flex-shrink:0;">
        <div style="padding:10px 12px;border-bottom:1px solid var(--border-2);">
          <div class="search-box">
            <span class="search-icon" style="width:14px;height:14px">${svgIcon('docs')}</span>
            <input type="text" placeholder="Search files…" value="${escAttr(State.dropbox.search||'')}"
              oninput="State.dropbox.search=this.value;rerenderDropbox()" style="width:100%" />
          </div>
        </div>
        <div style="flex:1;overflow-y:auto;padding:8px 0;">
          <div style="font-size:10px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--text-3);padding:8px 14px 4px;">Folders</div>
          ${[...DROPBOX_FOLDERS,'Other'].map(folder=>{
            const count = (byFolder[folder]||[]).length;
            return `<button onclick="State.dropbox.tab='folder:${folder}';rerenderDropbox()"
              style="display:flex;align-items:center;justify-content:space-between;width:100%;padding:7px 14px;background:${tab==='folder:'+folder?'rgba(201,168,76,0.08)':'transparent'};border:none;border-left:3px solid ${tab==='folder:'+folder?'var(--gold)':'transparent'};cursor:pointer;color:${tab==='folder:'+folder?'var(--text)':'var(--text-2)'};font-size:13px;text-align:left;">
              <span style="display:flex;align-items:center;gap:7px;">📁 ${escHtml(folder.replace(/_/g,' '))}</span>
              ${count?`<span style="font-size:10px;background:var(--surface-2);border:1px solid var(--border-2);border-radius:10px;padding:1px 6px;color:var(--text-3);">${count}</span>`:''}
            </button>`;}).join('')}
          <div style="height:1px;background:var(--border-2);margin:6px 0;"></div>
          <button onclick="State.dropbox.tab='all';State.dropbox.activeFileId=null;rerenderDropbox()"
            style="display:flex;align-items:center;width:100%;padding:7px 14px;background:${tab==='all'?'rgba(201,168,76,0.08)':'transparent'};border:none;border-left:3px solid ${tab==='all'?'var(--gold)':'transparent'};cursor:pointer;color:${tab==='all'?'var(--text)':'var(--text-2)'};font-size:13px;gap:7px;">
            📂 All files <span style="font-size:10px;background:var(--surface-2);border:1px solid var(--border-2);border-radius:10px;padding:1px 6px;color:var(--text-3);margin-left:auto;">${files.length}</span>
          </button>
          <div style="height:1px;background:var(--border-2);margin:6px 0;"></div>
          <div style="font-size:10px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--text-3);padding:8px 14px 4px;">By client</div>
          ${[...new Set(files.map(f=>f.clientName).filter(Boolean))].slice(0,8).map(name=>`
            <button onclick="State.dropbox.search='${escAttr(name)}';rerenderDropbox()"
              style="display:flex;align-items:center;width:100%;padding:6px 14px;background:transparent;border:none;cursor:pointer;color:var(--text-3);font-size:12px;gap:7px;text-align:left;"
              onmouseover="this.style.color='var(--text)'" onmouseout="this.style.color='var(--text-3)'">
              👤 ${escHtml(name)}
            </button>`).join('')}
        </div>
      </div>

      <div style="flex:1;display:flex;flex-direction:column;overflow:hidden;min-width:0;">
        ${active ? `
          <div style="flex:1;overflow-y:auto;padding:24px;">
            <div style="display:flex;gap:8px;margin-bottom:18px;flex-wrap:wrap;">
              <button class="btn btn-ghost btn-sm" onclick="State.dropbox.activeFileId=null;rerenderDropbox()">← Back</button>
              <button class="btn btn-gold btn-sm" onclick="dropboxOpenFile('${active.id}')">${icon('dropbox')} Open file</button>
              <button class="btn btn-ghost btn-sm" onclick="dropboxSendByEmail('${active.id}')">${icon('email')} Email to client</button>
              <button class="btn btn-ghost btn-sm" style="color:var(--red);margin-left:auto;" onclick="dropboxDeleteFile('${active.id}')">${icon('trash')} Delete</button>
            </div>
            <div style="font-size:22px;margin-bottom:8px;">${fileTypeIcon(active.name)}</div>
            <div style="font-family:var(--font-serif,Georgia,serif);font-size:20px;font-weight:500;color:var(--gold-light,#e2c97e);margin-bottom:6px;">${escHtml(active.name)}</div>
            <div style="font-size:12px;color:var(--text-3);margin-bottom:20px;">
              ${escHtml(active.folder||'Uncategorized')} · ${escHtml(active.clientName||'')} · ${fmtSize(active.size)} · ${fmtDate(active.uploadedAt||active.createdAt||new Date().toISOString())}
            </div>
            ${active.url?`<div style="background:var(--surface-2);border:1px solid var(--border-2);border-radius:var(--radius,6px);padding:12px 14px;margin-bottom:20px;">
              <div style="font-size:11px;color:var(--text-3);margin-bottom:4px;">File link</div>
              <div style="font-size:13px;color:var(--blue,#60a5fa);word-break:break-all;">${escHtml(active.url)}</div>
            </div>`:''}
            <div style="font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--text-3);margin-bottom:6px;">Status</div>
            <div style="display:flex;gap:8px;margin-bottom:20px;">
              ${['Uploaded','Under review','Approved','Missing'].map(s=>`
                <button onclick="dropboxSetStatus('${active.id}','${s}')"
                  style="font-size:12px;padding:5px 12px;border-radius:20px;cursor:pointer;border:1px solid ${active.status===s?'var(--gold)':'var(--border-2)'};background:${active.status===s?'var(--gold-dim)':'transparent'};color:${active.status===s?'var(--gold-light,#e2c97e)':'var(--text-3)'};">
                  ${s}</button>`).join('')}
            </div>
          </div>` : `
          <div style="flex:1;overflow-y:auto;padding:20px;">
            ${(tab.startsWith('folder:') ? (byFolder[tab.replace('folder:','')]||[]) : filtered).length ? `
              <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;">
                ${(tab.startsWith('folder:') ? (byFolder[tab.replace('folder:','')]||[]) : filtered).map(f=>`
                  <div onclick="State.dropbox.activeFileId='${f.id}';rerenderDropbox()"
                    style="background:var(--surface);border:1px solid var(--border-2);border-radius:var(--radius-lg,8px);padding:16px;cursor:pointer;transition:border-color .15s;"
                    onmouseover="this.style.borderColor='var(--gold)'" onmouseout="this.style.borderColor='var(--border-2)'">
                    <div style="font-size:28px;margin-bottom:10px;">${fileTypeIcon(f.name)}</div>
                    <div style="font-size:13px;font-weight:500;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:3px;">${escHtml(f.name)}</div>
                    <div style="font-size:11px;color:var(--text-3);margin-bottom:6px;">${escHtml(f.folder||'Uncategorized')}</div>
                    ${f.clientName?`<div style="font-size:11px;color:var(--text-3);">👤 ${escHtml(f.clientName)}</div>`:''}
                    ${f.status?`<div style="margin-top:6px;"><span style="font-size:10px;padding:2px 7px;border-radius:8px;background:var(--surface-2);border:1px solid var(--border-2);color:var(--text-3);">${escHtml(f.status)}</span></div>`:''}
                  </div>`).join('')}
              </div>` : `
              <div class="empty-state">
                <div class="empty-state-icon">${svgIcon('dropbox')}</div>
                <h3>${q||tab!=='all'?'No files found':'No files uploaded yet'}</h3>
                <p>${q||tab!=='all'?'Try a different search or folder':'Upload files manually or connect Dropbox in Settings'}</p>
                <button class="btn btn-gold" onclick="dropboxUpload()">${icon('add')} Upload File</button>
              </div>`}
          </div>`}
      </div>

      <div style="width:230px;border-left:1px solid var(--border-2);display:flex;flex-direction:column;flex-shrink:0;">
        <div style="padding:12px 14px;border-bottom:1px solid var(--border-2);font-size:11px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--text-3);">
          Notes ${active?`<span style="font-weight:400;text-transform:none;letter-spacing:0;font-size:10px;">· ${escHtml(active.name)}</span>`:''}
        </div>
        <div style="flex:1;overflow-y:auto;padding:12px 14px;">
          ${active?`
            <textarea id="dnote-${active.id}"
              style="width:100%;background:var(--surface-2);border:1px solid var(--border-2);border-radius:var(--radius,6px);color:var(--text-2);font-size:12px;padding:10px;outline:none;resize:none;min-height:110px;line-height:1.6;font-family:var(--font-sans,inherit);"
              placeholder="Notes on this file…"
              onblur="dropboxSaveNote('${active.id}',this.value)"
              onfocus="this.style.borderColor='var(--gold)'"
            >${escHtml(State.dropbox.notes[active.id]||'')}</textarea>
            <div style="height:1px;background:var(--border-2);margin:12px 0;"></div>
            <div style="font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--text-3);margin-bottom:8px;">Quick actions</div>
            <div style="display:flex;flex-direction:column;gap:5px;">
              <button class="btn btn-ghost btn-sm" style="justify-content:flex-start;" onclick="dropboxSendByEmail('${active.id}')">${icon('email')} Email file to client</button>
              <button class="btn btn-ghost btn-sm" style="justify-content:flex-start;" onclick="navigate('zoom')">${icon('calendar')} Schedule review call</button>
              <button class="btn btn-ghost btn-sm" style="justify-content:flex-start;" onclick="dropboxCopyLink('${active.id}')">${icon('docs')} Copy share link</button>
            </div>
            <div style="height:1px;background:var(--border-2);margin:12px 0;"></div>
            <div style="font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--text-3);margin-bottom:8px;">Move to folder</div>
            <select onchange="dropboxMoveFile('${active.id}',this.value)"
              style="width:100%;background:var(--surface-2);border:1px solid var(--border-2);border-radius:var(--radius,6px);color:var(--text-2);font-size:12px;padding:7px 10px;outline:none;">
              <option value="">Select folder…</option>
              ${DROPBOX_FOLDERS.map(f=>`<option value="${escAttr(f)}" ${active.folder===f?'selected':''}>${escHtml(f.replace(/_/g,' '))}</option>`).join('')}
            </select>`
          :`<div style="color:var(--text-3);font-size:13px;text-align:center;margin-top:30px;">Select a file to add notes</div>
            <div style="height:1px;background:var(--border-2);margin:16px 0;"></div>
            <div style="font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--text-3);margin-bottom:10px;">Upload a file</div>
            <button class="btn btn-ghost btn-sm" style="width:100%;justify-content:center;margin-bottom:8px;" onclick="dropboxUpload()">${icon('add')} Upload file</button>
            <div style="font-size:11px;color:var(--text-3);line-height:1.6;margin-top:8px;">Files are organized into folders and linked to client cases automatically.</div>`}
        </div>
      </div>

    </div>`;
}

// Dropbox action functions
function dropboxUpload() { document.getElementById('dropbox-file-input')?.click(); }

function dropboxHandleUpload(input) {
  const caseForClient = State.cases.find(c => c.dropboxLink);
  Array.from(input.files).forEach(file => {
    const folder = DROPBOX_FOLDERS[0];
    const fileObj = {
      id: uuid(),
      name: file.name,
      folder: folder,
      clientName: caseForClient ? `${caseForClient.firstName} ${caseForClient.lastName}` : '',
      clientId: caseForClient?.id || '',
      size: file.size,
      status: 'Uploaded',
      url: '',
      uploadedAt: new Date().toISOString(),
      uploadedBy: State.team[0]?.name || 'Ana Kamkhadze',
    };
    State.dropbox.files.unshift(fileObj);
  });
  dropboxSave();
  toast(`${input.files.length} file${input.files.length>1?'s':''} uploaded`);
  rerenderDropbox();
  input.value = '';
}

function dropboxSaveNote(id, val) {
  State.dropbox.notes[id] = val;
  dropboxSave();
}

function dropboxSetStatus(id, status) {
  const f = State.dropbox.files.find(x=>x.id===id);
  if (f) { f.status = status; dropboxSave(); rerenderDropbox(); }
}

function dropboxMoveFile(id, folder) {
  const f = State.dropbox.files.find(x=>x.id===id);
  if (f && folder) { f.folder=folder; dropboxSave(); toast('Moved to '+folder.replace(/_/g,' ')); rerenderDropbox(); }
}

function dropboxDeleteFile(id) {
  if (!confirm('Delete this file?')) return;
  State.dropbox.files = State.dropbox.files.filter(f=>f.id!==id);
  State.dropbox.activeFileId = null;
  dropboxSave();
  rerenderDropbox();
  toast('File deleted');
}

function dropboxCopyLink(id) {
  const f = State.dropbox.files.find(x=>x.id===id);
  if (f?.url) { navigator.clipboard.writeText(f.url).then(()=>toast('Link copied')); }
  else { toast('No link — connect Dropbox in Settings to generate share links','warn'); }
}

function dropboxSendByEmail(fileId) {
  const f = State.dropbox.files.find(x=>x.id===fileId);
  if (!f) return;
  const clientCase = f.clientId ? State.cases.find(c=>c.id===f.clientId) : null;
  const email = clientCase?.email || '';
  State.email.tab = 'compose';
  State.email.composeData = {
    to: email,
    subject: `Document: ${f.name}`,
    body: `Dear ${clientCase?.firstName||'Client'},\n\nPlease find the following document:\n\n${f.name}${f.url?'\n\nLink: '+f.url:''}\n\nPlease let me know if you have any questions.\n\nBest regards,\nAna Kamkhadze, Esq. MBA`,
  };
  navigate('email');
  toast('Email compose opened with file details');
}

// ================================================================
// ---- END Email & Dropbox Sections ----
// ================================================================




function renderMain() {
  switch (State.view) {
    case 'dashboard':   return renderDashboard();
    case 'cases':       return renderCasesList();
    case 'case-detail': return renderCaseDetail(State.selectedCaseId);
    case 'zoom':        return renderZoomMeetings();
    case 'email':       return renderEmailSection();
    case 'dropbox':     return renderDropboxSection();
    case 'settings':    return renderSettings();
    default:            return renderDashboard();
  }
}

function render() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="app-layout">
      ${renderSidebar()}
      <main class="main" id="main-content">
        ${renderMain()}
      </main>
    </div>`;
}

// Check for OAuth callback before boot
_checkOAuthCallback();

// ---- Boot (waits for Auth.ready, then loads encrypted data) ----
Auth.ready.then(async () => {
  await Storage.load();

  // No demo data — use Dashboard → Import to load cases from Excel

  render();
});
// ================================================================
// ---- PATCH: Fix search focus, zoom client search, timezones,
//             dropbox file open, cross-account uploads, chat ----
// ================================================================

// Override rerenderEmail with focus-preserving version
rerenderEmail = function(preserveFocus) {
  const main = document.getElementById('main-content');
  if (!main) return;
  if (State.email.tab === 'new-template') { main.innerHTML = renderEmailNewTemplate(); return; }
  const activeInput = document.activeElement;
  const wasSearchFocused = activeInput && activeInput.id === 'email-search-input';
  main.innerHTML = renderEmailSection();
  if (wasSearchFocused || preserveFocus) {
    const input = document.getElementById('email-search-input');
    if (input) { input.focus(); const len = input.value.length; input.setSelectionRange(len, len); }
  }
};

// Override rerenderDropbox with focus-preserving version
rerenderDropbox = function(preserveFocus) {
  const main = document.getElementById('main-content');
  if (!main) return;
  const activeInput = document.activeElement;
  const wasSearchFocused = activeInput && activeInput.id === 'dropbox-search-input';
  main.innerHTML = renderDropboxSection();
  if (wasSearchFocused || preserveFocus) {
    const input = document.getElementById('dropbox-search-input');
    if (input) { input.focus(); const len = input.value.length; input.setSelectionRange(len, len); }
  }
};

// Override rerenderZoom with focus-preserving version
rerenderZoom = function(preserveFocus) {
  const main = document.getElementById('main-content');
  if (!main) return;
  const activeInput = document.activeElement;
  const wasClientFocused = activeInput && activeInput.id === 'zoom-client-input';
  main.innerHTML = renderZoomMeetings();
  if (wasClientFocused || preserveFocus) {
    const input = document.getElementById('zoom-client-input');
    if (input) { input.focus(); const len = input.value.length; input.setSelectionRange(len, len); }
  }
};

// ---- Patch: add id to search inputs in rendered HTML ----
// We patch the renderEmailListLayout, renderDropboxSection, and renderZoomMeetings
// by post-processing: add IDs after render via MutationObserver approach.
// Instead, we override the inline oninput to use patched functions.

// Email search: debounced, focus-safe
function emailSearchInput(val) {
  State.email.search = val;
  // Only re-render the list, not the whole panel
  const listEl = document.getElementById('email-list-items');
  if (listEl) {
    listEl.innerHTML = renderEmailListItems(State.email.tab);
  }
}

function renderEmailListItems(tab) {
  const list = State.email[tab] || [];
  const q = (State.email.search||'').toLowerCase();
  const filtered = q ? list.filter(e=>
    (e.from||'').toLowerCase().includes(q)||(e.subject||'').toLowerCase().includes(q)||(e.preview||'').toLowerCase().includes(q)
  ) : list;
  const active = emailGetActive();
  if (!filtered.length) return `<div style="padding:40px 16px;text-align:center;color:var(--text-3);font-size:13px;">No emails</div>`;
  return filtered.map(e=>`
    <div onclick="emailOpen('${e.id}')"
      style="padding:12px 14px;border-bottom:1px solid rgba(255,255,255,0.05);cursor:pointer;
             background:${active&&active.id===e.id?'rgba(201,168,76,0.08)':'transparent'};
             border-left:3px solid ${active&&active.id===e.id?'var(--gold)':'transparent'};">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px;">
        <span style="font-size:13px;font-weight:${e.unread?'600':'400'};color:${e.unread?'var(--text)':'var(--text-2)'};">${escHtml(e.from)}</span>
        <div style="display:flex;align-items:center;gap:5px;">
          ${e.unread?`<div style="width:6px;height:6px;border-radius:50%;background:var(--gold);"></div>`:''}
          <span style="font-size:11px;color:var(--text-3);">${escHtml(e.time||'')}</span>
        </div>
      </div>
      <div style="font-size:12px;color:${e.unread?'var(--text-2)':'var(--text-3)'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:2px;">${escHtml(e.subject||'')}</div>
      <div style="font-size:11px;color:var(--text-3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHtml(e.preview||'')}</div>
      ${e.caseTag?`<div style="margin-top:4px;"><span style="font-size:10px;background:rgba(96,165,250,0.1);color:#60a5fa;border:1px solid rgba(96,165,250,0.2);border-radius:8px;padding:1px 7px;">${escHtml(e.caseTag)}</span></div>`:''}
    </div>`).join('');
}

// Dropbox search: debounced, focus-safe
function dropboxSearchInput(val) {
  State.dropbox.search = val;
  const gridEl = document.getElementById('dropbox-file-grid');
  if (gridEl) {
    gridEl.innerHTML = renderDropboxFileGrid();
  }
}

function renderDropboxFileGrid() {
  const q = (State.dropbox.search||'').toLowerCase();
  const tab = State.dropbox.tab;
  const files = State.dropbox.files;
  const filtered = q ? files.filter(f=>(f.name||'').toLowerCase().includes(q)||(f.folder||'').toLowerCase().includes(q)||(f.clientName||'').toLowerCase().includes(q)) : files;

  // Group by folder
  const byFolder = {};
  DROPBOX_FOLDERS.forEach(f=>{byFolder[f]=[];});
  byFolder['Other']=[];
  filtered.forEach(f=>{
    const key = DROPBOX_FOLDERS.includes(f.folder)?f.folder:'Other';
    byFolder[key].push(f);
  });

  const fileTypeIcon = (name) => {
    const ext=(name||'').split('.').pop().toLowerCase();
    if(ext==='pdf') return '📄';
    if(['doc','docx'].includes(ext)) return '📝';
    if(['jpg','jpeg','png','gif','webp'].includes(ext)) return '🖼️';
    if(['xlsx','xls','csv'].includes(ext)) return '📊';
    if(['zip','rar'].includes(ext)) return '🗜️';
    return '📎';
  };

  const showList = tab.startsWith('folder:') ? (byFolder[tab.replace('folder:','')]||[]) : filtered;

  if (!showList.length) return `
    <div class="empty-state">
      <div class="empty-state-icon">${svgIcon('dropbox')}</div>
      <h3>${q||tab!=='all'?'No files found':'No files uploaded yet'}</h3>
      <p>${q||tab!=='all'?'Try a different search or folder':'Upload files manually'}</p>
      <button class="btn btn-gold" onclick="dropboxUpload()">${icon('add')} Upload File</button>
    </div>`;

  return `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;">
    ${showList.map(f=>`
      <div onclick="State.dropbox.activeFileId='${f.id}';rerenderDropbox()"
        style="background:var(--surface);border:1px solid var(--border-2);border-radius:var(--radius-lg,8px);padding:16px;cursor:pointer;transition:border-color .15s;"
        onmouseover="this.style.borderColor='var(--gold)'" onmouseout="this.style.borderColor='var(--border-2)'">
        <div style="font-size:28px;margin-bottom:10px;">${fileTypeIcon(f.name)}</div>
        <div style="font-size:13px;font-weight:500;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:3px;">${escHtml(f.name)}</div>
        <div style="font-size:11px;color:var(--text-3);margin-bottom:4px;">${escHtml((f.folder||'Uncategorized').replace(/_/g,' '))}</div>
        ${f.clientName?`<div style="font-size:11px;color:var(--text-3);">👤 ${escHtml(f.clientName)}</div>`:''}
        ${f.uploadedBy?`<div style="font-size:10px;color:var(--text-3);margin-top:3px;">by ${escHtml(f.uploadedBy)}</div>`:''}
        ${f.uploadedAt?`<div style="font-size:10px;color:var(--text-3);">${fmtDate(f.uploadedAt)}</div>`:''}
        ${f.status?`<div style="margin-top:6px;"><span style="font-size:10px;padding:2px 7px;border-radius:8px;background:var(--surface-2);border:1px solid var(--border-2);color:var(--text-3);">${escHtml(f.status)}</span></div>`:''}
      </div>`).join('')}
  </div>`;
}

// ---- Zoom client search: pure DOM, no rerender ----
function zoomClientSearchInput(val) {
  State.zoom.clientSearch = val;
  State.zoom.scheduleClient = null;
  const box = document.getElementById('zoom-suggestions');
  if (!box) return;
  const q = val.toLowerCase().trim();
  if (!q) { box.style.display='none'; return; }
  const matches = State.cases.filter(c=>
    `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) ||
    (c.email||'').toLowerCase().includes(q)
  ).slice(0,8);
  if (!matches.length) { box.innerHTML='<div style="padding:12px 14px;font-size:13px;color:var(--text-3);">No clients found</div>'; box.style.display='block'; return; }
  box.innerHTML = matches.map(c=>`
    <div onmousedown="zoomSelectClientFromSearch('${c.id}')"
      style="padding:10px 14px;cursor:pointer;display:flex;align-items:center;gap:10px;font-size:13px;color:var(--text-2);"
      onmouseover="this.style.background='var(--surface-2)'" onmouseout="this.style.background=''">
      <div style="width:28px;height:28px;border-radius:50%;background:var(--gold-dim);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;color:var(--gold);flex-shrink:0;">
        ${escHtml((c.firstName[0]||'')+(c.lastName[0]||''))}
      </div>
      <div>
        <div style="color:var(--text);">${escHtml(zoomHighlightText(c.firstName+' '+c.lastName, q))}</div>
        <div style="font-size:11px;color:var(--text-3);">${escHtml(c.visaType||'')} · ${escHtml(c.email||'no email')}</div>
      </div>
    </div>`).join('');
  box.style.display='block';
}

function zoomHighlightText(str, query) {
  if(!query) return str;
  const i = str.toLowerCase().indexOf(query.toLowerCase());
  if(i<0) return str;
  return str.slice(0,i)+'【'+str.slice(i,i+query.length)+'】'+str.slice(i+query.length);
}

function zoomSelectClientFromSearch(caseId) {
  const c = State.cases.find(x=>x.id===caseId);
  if (!c) return;
  State.zoom.scheduleClient = c;
  State.zoom.clientSearch = `${c.firstName} ${c.lastName}`;
  const input = document.getElementById('zoom-client-input');
  if (input) input.value = `${c.firstName} ${c.lastName}`;
  const box = document.getElementById('zoom-suggestions');
  if (box) box.style.display='none';
  const confirm = document.getElementById('zoom-client-confirm');
  if (confirm) confirm.innerHTML = `<span style="font-size:12px;color:var(--green);">✓ ${escHtml(c.firstName+' '+c.lastName)} · ${escHtml(c.email||'no email')}</span>`;
  // Update case dropdown
  const sel = document.getElementById('zoom-case-select');
  if (sel) {
    sel.innerHTML = `<option value="">Select case…</option><option value="${escAttr(c.visaType)}" selected>${escHtml(c.visaType)} — ${escHtml(c.firstName+' '+c.lastName)}</option>`;
  }
}

// ---- Zoom: timezone support ----
const TIMEZONES = [
  { label:'Eastern Time (ET)',           tz:'America/New_York' },
  { label:'Central Time (CT)',           tz:'America/Chicago' },
  { label:'Mountain Time (MT)',          tz:'America/Denver' },
  { label:'Pacific Time (PT)',           tz:'America/Los_Angeles' },
  { label:'London (GMT/BST)',            tz:'Europe/London' },
  { label:'Paris / Berlin (CET)',        tz:'Europe/Paris' },
  { label:'Tbilisi (GET)',               tz:'Asia/Tbilisi' },
  { label:'Moscow (MSK)',                tz:'Europe/Moscow' },
  { label:'Dubai (GST)',                 tz:'Asia/Dubai' },
  { label:'Mumbai (IST)',                tz:'Asia/Kolkata' },
  { label:'Bangkok (ICT)',               tz:'Asia/Bangkok' },
  { label:'Singapore / KL (SGT)',        tz:'Asia/Singapore' },
  { label:'Tokyo / Seoul (JST/KST)',     tz:'Asia/Tokyo' },
  { label:'Sydney (AEST)',               tz:'Australia/Sydney' },
];

if (!State.zoom.timezone) State.zoom.timezone = 'America/New_York';

function zoomGetLocalTime(tz) {
  try {
    return new Date().toLocaleTimeString('en-US',{timeZone:tz,hour:'2-digit',minute:'2-digit',hour12:true});
  } catch(e) { return ''; }
}

// ---- Dropbox: file open with blob URL ----
// Store file blobs in memory (can't persist to localStorage)
if (!window._dropboxBlobs) window._dropboxBlobs = {};

function dropboxHandleUpload(input) {
  const currentUser = State.team[0]?.name || 'Ana Kamkhadze';
  const caseForClient = State.cases[0] || null;
  Array.from(input.files).forEach(file => {
    const id = uuid();
    const blobUrl = URL.createObjectURL(file);
    window._dropboxBlobs[id] = blobUrl;
    const fileObj = {
      id,
      name: file.name,
      folder: '01_Personal_Documents',
      clientName: caseForClient ? `${caseForClient.firstName} ${caseForClient.lastName}` : '',
      clientId: caseForClient?.id || '',
      size: file.size,
      type: file.type,
      status: 'Uploaded',
      url: blobUrl,
      uploadedAt: new Date().toISOString(),
      uploadedBy: currentUser,
    };
    State.dropbox.files.unshift(fileObj);
  });
  dropboxSave();
  toast(`${input.files.length} file${input.files.length>1?'s':''} uploaded`);
  rerenderDropbox();
  input.value='';
}

function dropboxOpenFile(id) {
  const f = State.dropbox.files.find(x=>x.id===id);
  if (!f) return;
  const blobUrl = window._dropboxBlobs[id] || f.url;
  if (blobUrl && blobUrl.startsWith('blob:')) {
    window.open(blobUrl,'_blank');
  } else if (blobUrl && blobUrl.startsWith('http')) {
    window.open(blobUrl,'_blank');
  } else {
    toast('File was uploaded in a previous session — please re-upload to open it','warn');
  }
}

// ================================================================
// ---- Chat Section ----
// ================================================================

if (!State.chat) {
  State.chat = {
    rooms: JSON.parse(localStorage.getItem('km_chat_rooms') || JSON.stringify([
      { id:'general', name:'# general', desc:'Team-wide updates', pinned:true },
      { id:'cases',   name:'# cases',   desc:'Case discussions',   pinned:true },
    ])),
    messages: JSON.parse(localStorage.getItem('km_chat_messages') || '{}'),
    activeRoom: 'general',
    draft: '',
    search: '',
  };
}

function chatSave() {
  localStorage.setItem('km_chat_rooms',    JSON.stringify(State.chat.rooms));
  localStorage.setItem('km_chat_messages', JSON.stringify(State.chat.messages));
}

function rerenderChat() {
  const main = document.getElementById('main-content');
  if (main) main.innerHTML = renderChatSection();
  // Scroll to bottom
  setTimeout(()=>{ const el=document.getElementById('chat-messages'); if(el) el.scrollTop=el.scrollHeight; },50);
}

function renderChatSection() {
  const rooms = State.chat.rooms;
  const activeRoom = rooms.find(r=>r.id===State.chat.activeRoom) || rooms[0];
  const messages = (State.chat.messages[State.chat.activeRoom]||[]);
  const currentUser = State.team[0]?.name || 'Ana Kamkhadze';

  return `
    <div class="topbar">
      <div class="topbar-title">Team Chat</div>
      <div class="topbar-actions">
        <button class="btn btn-gold" onclick="chatNewRoom()">${icon('add')} New channel</button>
      </div>
    </div>
    <div style="display:flex;flex:1;overflow:hidden;min-height:0;">

      <div style="width:210px;border-right:1px solid var(--border-2);display:flex;flex-direction:column;flex-shrink:0;">
        <div style="padding:10px 12px;border-bottom:1px solid var(--border-2);">
          <div class="search-box">
            <span class="search-icon" style="width:14px;height:14px;">${svgIcon('docs')}</span>
            <input type="text" placeholder="Search channels…" style="width:100%;"
              oninput="State.chat.search=this.value;rerenderChat()" value="${escAttr(State.chat.search||'')}"/>
          </div>
        </div>
        <div style="flex:1;overflow-y:auto;padding:8px 0;">
          <div style="font-size:10px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--text-3);padding:8px 14px 4px;">Channels</div>
          ${rooms.filter(r=>!State.chat.search||(r.name||'').toLowerCase().includes(State.chat.search.toLowerCase())).map(r=>{
            const msgCount = (State.chat.messages[r.id]||[]).length;
            const isActive = r.id===State.chat.activeRoom;
            return `<button onclick="State.chat.activeRoom='${r.id}';rerenderChat()"
              style="display:flex;align-items:center;justify-content:space-between;width:100%;padding:7px 14px;background:${isActive?'rgba(201,168,76,0.08)':'transparent'};border:none;border-left:3px solid ${isActive?'var(--gold)':'transparent'};cursor:pointer;color:${isActive?'var(--text)':'var(--text-2)'};font-size:13px;text-align:left;"
              onmouseover="if(${!isActive})this.style.background='var(--surface-2)'" onmouseout="if(${!isActive})this.style.background='transparent'">
              <span>${escHtml(r.name)}</span>
              ${msgCount?`<span style="font-size:10px;background:var(--surface-2);border:1px solid var(--border-2);border-radius:10px;padding:1px 5px;color:var(--text-3);">${msgCount}</span>`:''}
            </button>`;}).join('')}
          <div style="height:1px;background:var(--border-2);margin:6px 0;"></div>
          <div style="font-size:10px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--text-3);padding:8px 14px 4px;">Team</div>
          ${State.team.map(u=>`
            <div style="display:flex;align-items:center;gap:8px;padding:6px 14px;">
              <div style="width:8px;height:8px;border-radius:50%;background:var(--green);"></div>
              <div style="width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:600;flex-shrink:0;background:${u.color}22;color:${u.color};">${escHtml(u.initials)}</div>
              <span style="font-size:12px;color:var(--text-2);">${escHtml(u.name.split(' ')[0])}</span>
            </div>`).join('')}
        </div>
      </div>

      <div style="flex:1;display:flex;flex-direction:column;overflow:hidden;min-width:0;">
        <div style="padding:12px 20px;border-bottom:1px solid var(--border-2);display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">
          <div>
            <div style="font-size:15px;font-weight:500;color:var(--text);">${escHtml(activeRoom?.name||'')}</div>
            <div style="font-size:12px;color:var(--text-3);">${escHtml(activeRoom?.desc||'')} · ${messages.length} messages</div>
          </div>
          ${!activeRoom?.pinned?`<button class="btn btn-ghost btn-sm" style="color:var(--red);" onclick="chatDeleteRoom('${activeRoom?.id}')">${icon('trash')} Delete channel</button>`:''}
        </div>

        <div id="chat-messages" style="flex:1;overflow-y:auto;padding:16px 20px;display:flex;flex-direction:column;gap:2px;">
          ${!messages.length?`<div style="text-align:center;color:var(--text-3);font-size:13px;margin-top:40px;">No messages yet — say hello 👋</div>`:
          messages.map((m,i)=>{
            const showDate = i===0 || new Date(m.ts).toDateString() !== new Date(messages[i-1].ts).toDateString();
            const user = State.team.find(u=>u.name===m.user) || {initials:m.user?.slice(0,2)||'?',color:'#888'};
            const isMe = m.user === currentUser;
            const ts = new Date(m.ts);
            const timeStr = ts.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'});
            const dateStr = ts.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
            return `
              ${showDate?`<div style="text-align:center;margin:12px 0 4px;"><span style="font-size:11px;color:var(--text-3);background:var(--surface-2);border:1px solid var(--border-2);border-radius:10px;padding:2px 10px;">${dateStr}</span></div>`:''}
              <div style="display:flex;align-items:flex-start;gap:10px;padding:6px 0;${isMe?'flex-direction:row-reverse;':''}"
                onmouseover="const a=this.querySelector('.msg-actions');if(a)a.style.display='flex'"
                onmouseout="const a=this.querySelector('.msg-actions');if(a)a.style.display='none'">
                <div style="width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;flex-shrink:0;background:${user.color}22;color:${user.color};">${escHtml(user.initials)}</div>
                <div style="max-width:65%;${isMe?'align-items:flex-end;':''}display:flex;flex-direction:column;gap:2px;">
                  <div style="display:flex;align-items:center;gap:8px;${isMe?'flex-direction:row-reverse;':''}">
                    <span style="font-size:12px;font-weight:600;color:${user.color};">${escHtml(m.user)}</span>
                    <span style="font-size:10px;color:var(--text-3);">${timeStr}</span>
                  </div>
                  <div style="background:${isMe?'rgba(201,168,76,0.12)':'var(--surface-2)'};border:1px solid ${isMe?'rgba(201,168,76,0.2)':'var(--border-2)'};border-radius:${isMe?'12px 12px 4px 12px':'12px 12px 12px 4px'};padding:9px 14px;font-size:13px;color:var(--text);line-height:1.5;white-space:pre-wrap;">${escHtml(m.text)}</div>
                </div>
                <div class="msg-actions" style="display:none;align-items:center;gap:4px;align-self:center;">
                  <button onclick="chatDeleteMessage('${State.chat.activeRoom}',${i})"
                    style="background:transparent;border:1px solid var(--border-2);border-radius:4px;color:var(--text-3);font-size:11px;padding:2px 6px;cursor:pointer;">×</button>
                </div>
              </div>`;}).join('')}
        </div>

        <div style="padding:12px 20px;border-top:1px solid var(--border-2);flex-shrink:0;">
          <div style="display:flex;align-items:flex-end;gap:8px;background:var(--surface-2);border:1px solid var(--border-2);border-radius:8px;padding:8px 12px;"
            onfocusin="this.style.borderColor='var(--gold)'" onfocusout="this.style.borderColor='var(--border-2)'">
            <div style="width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:600;flex-shrink:0;background:${State.team[0]?.color||'#c9a84c'}22;color:${State.team[0]?.color||'#c9a84c'};">
              ${escHtml(State.team[0]?.initials||'AK')}
            </div>
            <textarea id="chat-input" rows="1"
              style="flex:1;background:none;border:none;color:var(--text);font-size:13px;outline:none;resize:none;line-height:1.5;font-family:var(--font-sans,inherit);max-height:100px;"
              placeholder="Message ${escAttr(activeRoom?.name||'')}"
              onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();chatSend();}"
              oninput="this.style.height='auto';this.style.height=Math.min(this.scrollHeight,100)+'px';"
            ></textarea>
            <button onclick="chatSend()" style="background:var(--gold);border:none;border-radius:6px;color:#000;padding:6px 12px;font-size:12px;font-weight:500;cursor:pointer;flex-shrink:0;">Send</button>
          </div>
          <div style="font-size:11px;color:var(--text-3);margin-top:5px;">Enter to send · Shift+Enter for new line</div>
        </div>
      </div>

    </div>`;
}

function chatSend() {
  const input = document.getElementById('chat-input');
  const text = (input?.value||State.chat.draft||'').trim();
  if (!text) return;
  const currentUser = State.team[0]?.name || 'Ana Kamkhadze';
  if (!State.chat.messages[State.chat.activeRoom]) State.chat.messages[State.chat.activeRoom] = [];
  State.chat.messages[State.chat.activeRoom].push({
    user: currentUser,
    text,
    ts: new Date().toISOString(),
  });
  chatSave();
  if (input) input.value='';
  State.chat.draft='';
  rerenderChat();
}

function chatNewRoom() {
  const name = prompt('Channel name (e.g. o1a-cases):');
  if (!name) return;
  const desc = prompt('Short description:') || '';
  const id = 'room_'+uuid().slice(0,8);
  State.chat.rooms.push({ id, name:'# '+name.replace(/^#/,''), desc, pinned:false });
  State.chat.activeRoom = id;
  chatSave();
  rerenderChat();
}

function chatDeleteRoom(id) {
  if (!confirm('Delete this channel?')) return;
  State.chat.rooms = State.chat.rooms.filter(r=>r.id!==id);
  delete State.chat.messages[id];
  State.chat.activeRoom = State.chat.rooms[0]?.id || 'general';
  chatSave();
  rerenderChat();
}

function chatDeleteMessage(roomId, idx) {
  if (!State.chat.messages[roomId]) return;
  State.chat.messages[roomId].splice(idx,1);
  chatSave();
  rerenderChat();
}

// ---- Patch navigate to support chat ----
const _origNavigate = navigate;
navigate = function(view, caseId) {
  if (view === 'chat') {
    State.view = 'chat';
    render();
    return;
  }
  _origNavigate(view, caseId);
};

// ---- Patch renderMain to support chat ----
const _origRenderMain = renderMain;
renderMain = function() {
  if (State.view === 'chat') return renderChatSection();
  if (State.view === 'dropbox') return renderDropboxSection();
  if (State.view === 'email') return renderEmailSection();
  return _origRenderMain();
};

// ---- Patch sidebar to show chat nav item ----
// We hook into render() to inject chat into sidebar after it renders
const _origRender = render;
render = function() {
  _origRender();
  // Inject chat nav item if not already there
  const sidebar = document.querySelector('.sidebar-nav, .sidebar');
  if (sidebar && !document.getElementById('nav-chat')) {
    const chatBtn = document.createElement('button');
    chatBtn.id = 'nav-chat';
    chatBtn.className = 'nav-item' + (State.view==='chat' ? ' active' : '');
    chatBtn.innerHTML = `<span class="nav-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 2H4a2 2 0 00-2 2v12a2 2 0 002 2h4l4 4 4-4h4a2 2 0 002-2V4a2 2 0 00-2-2z"/></svg></span> Team Chat`;
    chatBtn.onclick = () => navigate('chat');
    sidebar.appendChild(chatBtn);
  }
};

// ================================================================
// ---- Patch zoom schedule form to use new client search ----
// ================================================================
// Override the inline oninput in zoom client input after rerender
const _patchZoomInput = () => {
  const input = document.getElementById('zoom-client-input');
  if (input) {
    input.oninput = function() { zoomClientSearchInput(this.value); };
    input.onfocus = function() { if(this.value) zoomClientSearchInput(this.value); };
    input.onblur  = function() { setTimeout(()=>{ const b=document.getElementById('zoom-suggestions'); if(b)b.style.display='none'; },200); };
  }
  const tz = document.getElementById('zoom-tz-select');
  if (tz) {
    tz.onchange = function() { State.zoom.timezone=this.value; };
  }
};

// Patch renderZoomMeetings to add timezone select and new client search DOM
const _origRenderZoom = renderZoomMeetings;
renderZoomMeetings = function() {
  let html = _origRenderZoom();

  // Inject timezone select after the Time field
  html = html.replace(
    'onchange="State.zoom.scheduleTime=this.value" />',
    `onchange="State.zoom.scheduleTime=this.value" />
            </div>
            <div class="field">
              <label>Client timezone</label>
              <select id="zoom-tz-select" onchange="State.zoom.timezone=this.value" style="width:100%">
                ${TIMEZONES.map(tz=>`<option value="${escAttr(tz.tz)}" ${State.zoom.timezone===tz.tz?'selected':''}>${escHtml(tz.label)} — ${escHtml(zoomGetLocalTime(tz.tz))}</option>`).join('')}
              </select>
            </div>
            <div style="display:none"`
  );

  // Replace old oninput on client input with ID-based approach
  html = html.replace(
    'oninput="State.zoom.clientSearch=this.value; State.zoom.scheduleClient=null; rerenderZoom()"',
    'oninput="zoomClientSearchInput(this.value)"'
  );
  html = html.replace(
    'onfocus="if(!State.zoom.scheduleClient){rerenderZoom()}"',
    'onfocus="if(this.value)zoomClientSearchInput(this.value)" onblur="setTimeout(()=>{const b=document.getElementById(\'zoom-suggestions\');if(b)b.style.display=\'none\'},200)"'
  );

  // Replace suggestions div id
  html = html.replace(
    'style="position:absolute;top:100%;left:0;right:0;z-index:50;background:var(--surface);border:1px solid var(--gold);border-radius:6px;overflow:hidden;max-height:200px;overflow-y:auto;margin-top:2px"',
    'id="zoom-suggestions" style="position:absolute;top:100%;left:0;right:0;z-index:50;background:var(--surface);border:1px solid var(--gold);border-radius:6px;overflow:hidden;max-height:200px;overflow-y:auto;margin-top:2px"'
  );

  return html;
};

// Also patch renderEmailListLayout search input to use id and new handler
const _origRenderEmailListLayout = renderEmailListLayout;
renderEmailListLayout = function(tab) {
  let html = _origRenderEmailListLayout(tab);
  html = html.replace(
    'oninput="State.email.search=this.value;rerenderEmail()" style="width:100%"',
    'id="email-search-input" oninput="emailSearchInput(this.value)" style="width:100%"'
  );
  html = html.replace(
    '<div style="flex:1;overflow-y:auto;">',
    '<div id="email-list-items" style="flex:1;overflow-y:auto;">'
  );
  return html;
};

// Patch renderDropboxSection search input
const _origRenderDropbox = renderDropboxSection;
renderDropboxSection = function() {
  let html = _origRenderDropbox();
  html = html.replace(
    'oninput="State.dropbox.search=this.value;rerenderDropbox()" style="width:100%"',
    'id="dropbox-search-input" oninput="dropboxSearchInput(this.value)" style="width:100%"'
  );
  html = html.replace(
    '<div style="flex:1;overflow-y:auto;padding:20px;">',
    '<div id="dropbox-file-grid" style="flex:1;overflow-y:auto;padding:20px;">'
  );
  // Patch open file button
  html = html.replace(/onclick="State\.dropbox\.activeFileId='([^']+)';rerenderDropbox\(\)"/g,
    (m, id) => `onclick="State.dropbox.activeFileId='${id}';rerenderDropbox()"`
  );
  return html;
};

// Patch dropbox detail to add real open button
const _origDropboxDetail = renderDropboxSection;

// Patch Open file button to use dropboxOpenFile
document.addEventListener('click', function(e) {
  const btn = e.target.closest('[data-open-file]');
  if (btn) dropboxOpenFile(btn.dataset.openFile);
});

// ================================================================
// ---- END PATCH ----
// ================================================================

// ================================================================
// ---- PATCH 2: Upload modal with uploader + client + folder picker ----
// ================================================================

dropboxUpload = function() {
  // Show upload modal first
  showModal(`
    <div class="modal" style="max-width:480px">
      <div class="modal-header">
        <h3>${icon('dropbox')} Upload File</h3>
        <button class="modal-close" onclick="closeModal()">×</button>
      </div>
      <div class="modal-body">
        <div class="field">
          <label>Uploaded by</label>
          <select id="upload-by-select">
            ${State.team.map(u=>`<option value="${escAttr(u.name)}">${escHtml(u.name)} (${escHtml(u.role)})</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label>Client / Case</label>
          <select id="upload-client-select">
            <option value="">— No specific client —</option>
            ${State.cases.map(c=>`<option value="${escAttr(c.id)}">${escHtml(c.firstName+' '+c.lastName)} — ${escHtml(c.visaType)}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label>Folder</label>
          <select id="upload-folder-select">
            ${DROPBOX_FOLDERS.map(f=>`<option value="${escAttr(f)}">${escHtml(f.replace(/_/g,' '))}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label>Select files</label>
          <input type="file" id="upload-file-input" multiple
            style="background:var(--surface-2);border:1px solid var(--border-2);border-radius:var(--radius,6px);padding:8px;width:100%;color:var(--text);font-size:13px;" />
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
        <button class="btn btn-gold" onclick="dropboxDoUpload()">${icon('add')} Upload</button>
      </div>
    </div>`);
};

function dropboxDoUpload() {
  const input = document.getElementById('upload-file-input');
  const uploadedBy = document.getElementById('upload-by-select')?.value || State.team[0]?.name || 'Unknown';
  const clientId = document.getElementById('upload-client-select')?.value || '';
  const folder = document.getElementById('upload-folder-select')?.value || '01_Personal_Documents';
  const clientCase = clientId ? State.cases.find(c=>c.id===clientId) : null;

  if (!input?.files?.length) { toast('Please select at least one file','warn'); return; }

  Array.from(input.files).forEach(file => {
    const id = uuid();
    const blobUrl = URL.createObjectURL(file);
    window._dropboxBlobs[id] = blobUrl;
    State.dropbox.files.unshift({
      id,
      name: file.name,
      folder,
      clientName: clientCase ? `${clientCase.firstName} ${clientCase.lastName}` : '',
      clientId: clientCase?.id || '',
      size: file.size,
      type: file.type,
      status: 'Uploaded',
      url: blobUrl,
      uploadedAt: new Date().toISOString(),
      uploadedBy,
    });
  });

  dropboxSave();
  closeModal();
  toast(`${input.files.length} file${input.files.length>1?'s':''} uploaded by ${uploadedBy}`);
  rerenderDropbox();
}

// ================================================================
// ---- END PATCH 2 ----
// ================================================================
