import { useMemo, useRef, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext.jsx';
import { patientRequest } from '../../../lib/patientApi.js';
import './patient-import.css';

const template = 'patient_number,surname,first_name,other_names,sex,date_of_birth,estimated_age_years,phone,address,emergency_name,emergency_phone,insurance_name,insurance_number,insurance_expiry\n,Mensah,Akua,,F,1995-04-12,,0240000000,Kumasi,,,,NHIS,NHIS-00001,2027-12-31\n';
function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '"' && quoted && text[i + 1] === '"') { cell += '"'; i += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) { row.push(cell.trim()); cell = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      row.push(cell.trim()); cell = '';
      if (row.some(Boolean)) rows.push(row);
      row = [];
    } else cell += char;
  }
  if (cell || row.length) { row.push(cell.trim()); if (row.some(Boolean)) rows.push(row); }
  if (rows.length < 2) return [];
  const headers = rows[0].map((header) => header.replace(/^\uFEFF/, '').trim().toLowerCase().replace(/[\s-]+/g, '_'));
  return rows.slice(1).map((values, index) => {
    const result = Object.fromEntries(headers.map((header, column) => [header, values[column] || '']));
    return { ...result, __row: index + 2 };
  });
}
async function parseXlsx(file) {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('This browser cannot read compressed Excel workbooks. Export the sheet as CSV UTF-8 instead.');
  }
  const buffer = await file.arrayBuffer();
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  const decoder = new TextDecoder('utf-8');
  const u16 = (offset) => view.getUint16(offset, true);
  const u32 = (offset) => view.getUint32(offset, true);
  let eocd = -1;
  for (let offset = Math.max(0, bytes.length - 65557); offset <= bytes.length - 22; offset += 1) {
    if (u32(offset) === 0x06054b50) eocd = offset;
  }
  if (eocd < 0) throw new Error('The selected file is not a supported .xlsx workbook.');
  const entryCount = u16(eocd + 10);
  let centralOffset = u32(eocd + 16);
  const entries = new Map();
  for (let index = 0; index < entryCount; index += 1) {
    if (u32(centralOffset) !== 0x02014b50) throw new Error('The Excel workbook ZIP directory is invalid.');
    const method = u16(centralOffset + 10);
    const compressedSize = u32(centralOffset + 20);
    const nameLength = u16(centralOffset + 28);
    const extraLength = u16(centralOffset + 30);
    const commentLength = u16(centralOffset + 32);
    const localOffset = u32(centralOffset + 42);
    const name = decoder.decode(bytes.slice(centralOffset + 46, centralOffset + 46 + nameLength));
    if (u32(localOffset) !== 0x04034b50) throw new Error('The Excel workbook contains an invalid file entry.');
    const localNameLength = u16(localOffset + 26);
    const localExtraLength = u16(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = bytes.slice(dataStart, dataStart + compressedSize);
    let content;
    if (method === 0) content = compressed;
    else if (method === 8) {
      const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      content = new Uint8Array(await new Response(stream).arrayBuffer());
    } else {
      throw new Error('This Excel workbook uses an unsupported compression method.');
    }
    entries.set(name, decoder.decode(content));
    centralOffset += 46 + nameLength + extraLength + commentLength;
  }
  const parseXml = (name) => {
    const source = entries.get(name);
    if (!source) return null;
    const xml = new DOMParser().parseFromString(source, 'application/xml');
    if (xml.getElementsByTagName('parsererror').length) throw new Error(`Could not read Excel workbook file: ${name}`);
    return xml;
  };
  const workbook = parseXml('xl/workbook.xml');
  const relations = parseXml('xl/_rels/workbook.xml.rels');
  const firstSheet = workbook?.getElementsByTagNameNS('*', 'sheet')?.[0];
  if (!firstSheet || !relations) throw new Error('No worksheet was found in this Excel workbook.');
  const relationId = firstSheet.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') || firstSheet.getAttribute('r:id');
  const relation = [...relations.getElementsByTagNameNS('*', 'Relationship')].find((item) => item.getAttribute('Id') === relationId);
  if (!relation) throw new Error('The first worksheet could not be located.');
  const target = relation.getAttribute('Target') || '';
  const sheetPath = target.startsWith('/') ? target.slice(1) : target.startsWith('xl/') ? target : `xl/${target.replace(/^\.\//, '')}`;
  const sheet = parseXml(sheetPath);
  if (!sheet) throw new Error('The first worksheet could not be read.');
  const sharedXml = parseXml('xl/sharedStrings.xml');
  const sharedStrings = sharedXml
    ? [...sharedXml.getElementsByTagNameNS('*', 'si')].map((item) => [...item.getElementsByTagNameNS('*', 't')].map((part) => part.textContent || '').join(''))
    : [];
  const rows = [];
  const sheetData = sheet.getElementsByTagNameNS('*', 'sheetData')[0];
  for (const rowNode of [...(sheetData?.children || [])]) {
    if (rowNode.localName !== 'row') continue;
    const row = [];
    for (const cell of [...rowNode.children]) {
      if (cell.localName !== 'c') continue;
      const reference = cell.getAttribute('r') || '';
      const letters = reference.match(/^[A-Z]+/i)?.[0]?.toUpperCase() || '';
      let column = 0;
      for (const letter of letters) column = column * 26 + letter.charCodeAt(0) - 64;
      column -= 1;
      if (column < 0) continue;
      let value = cell.getElementsByTagNameNS('*', 'v')[0]?.textContent || '';
      const type = cell.getAttribute('t');
      if (type === 's') value = sharedStrings[Number(value)] || '';
      else if (type === 'inlineStr') value = [...cell.getElementsByTagNameNS('*', 't')].map((part) => part.textContent || '').join('');
      else if (type === 'b') value = value === '1' ? 'TRUE' : 'FALSE';
      row[column] = value;
    }
    rows.push(row.map((value) => value ?? ''));
  }
  if (rows.length < 2) throw new Error('The first worksheet contains no patient rows.');
  const headers = rows[0].map((header) => String(header || '').replace(/^\uFEFF/, '').trim().toLowerCase().replace(/[\s-]+/g, '_'));
  const parsed = rows.slice(1).map((values, index) => {
    const result = Object.fromEntries(headers.map((header, column) => [header, String(values[column] ?? '').trim()]));
    return { ...result, __row: index + 2 };
  });
  for (const row of parsed) {
    if (row.date_of_birth && /^\d+(?:\.\d+)?$/.test(row.date_of_birth)) {
      const serial = Number(row.date_of_birth);
      if (serial > 0 && serial < 100000) row.date_of_birth = new Date(Date.UTC(1899, 11, 30) + Math.floor(serial) * 86400000).toISOString().slice(0, 10);
    }
  }
  return parsed;
}

function isValidIsoDate(value) {
  if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(String(value || ''))) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function normalizeSex(value) {
  const sex = String(value || '').trim().toLowerCase();
  if (['m', 'male'].includes(sex)) return 'male';
  if (['f', 'female'].includes(sex)) return 'female';
  return '';
}
function validateRows(rows, existing) {
  const phones = new Set(existing.map((p) => normalizePhone(p.phone)).filter(Boolean));
  const mrns = new Set(existing.map((p) => String(p.patient_number || p.mrn || '').trim().toLowerCase()).filter(Boolean));
  const seenPhones = new Set(); const seenMrns = new Set();
  return rows.map((row) => {
    const errors = []; const warnings = [];
    if (!row.surname?.trim()) errors.push('Surname is required');
    if (!row.first_name?.trim()) errors.push('First name is required');
    if (!normalizeSex(row.sex)) errors.push('Sex must be M, F, Male or Female');
    if (row.date_of_birth && (!/^\d{4}-\d{2}-\d{2}$/.test(row.date_of_birth) || new Date(`${row.date_of_birth}T00:00:00Z`).toISOString?.().slice(0, 10) !== row.date_of_birth)) errors.push('Date of birth must be a real date in YYYY-MM-DD format');
    if (!row.date_of_birth && String(row.estimated_age_years ?? '').trim() === '') errors.push('Date of birth or estimated age is required');
    if (!row.date_of_birth && String(row.estimated_age_years ?? '').trim() !== '') warnings.push('Age is estimated because date of birth is missing');
    if (row.estimated_age_years && (!Number.isInteger(Number(row.estimated_age_years)) || Number(row.estimated_age_years) < 0 || Number(row.estimated_age_years) > 130)) errors.push('Estimated age must be a whole number from 0 to 130');
    if (row.insurance_name || row.insurance_number || row.insurance_expiry) {
      if (!(row.insurance_name && row.insurance_number && row.insurance_expiry)) warnings.push('Incomplete insurance details will be omitted');
    }
    const phone = normalizePhone(row.phone);
    if (row.phone && !phone) errors.push('Phone must be a Ghanaian mobile number');
    if (phone && (phones.has(phone) || seenPhones.has(phone))) errors.push('Duplicate phone number');
    if (phone) seenPhones.add(phone);
    const mrn = String(row.patient_number || row.mrn || '').trim().toLowerCase();
    if (mrn && (mrns.has(mrn) || seenMrns.has(mrn))) errors.push('Duplicate patient number');
    if (mrn) seenMrns.add(mrn);
    if (row.phone && phone && row.phone !== phone) warnings.push('Phone will be normalized');
    return { ...row, normalizedPhone: phone, normalizedSex: normalizeSex(row.sex), errors, warnings, status: errors.length ? 'error' : warnings.length ? 'warning' : 'valid' };
  });
}
function normalizePhone(value) {
  const digits = String(value || '').replace(/[\s()-]/g, '');
  if (/^0[235]\d{8}$/.test(digits)) return digits;
  if (/^\+233[235]\d{8}$/.test(digits)) return `0${digits.slice(4)}`;
  if (/^233[235]\d{8}$/.test(digits)) return `0${digits.slice(3)}`;
  return '';
}
export default function PatientImportPage() {
  const { role } = useParams();
  const { profile, user } = useAuth();
  const inputRef = useRef(null);
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState([]);
  const [existing, setExisting] = useState([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [committing, setCommitting] = useState(false);
  const basePath = `/dashboard/${profile?.role || role}`;
  const canImport = profile?.role === 'reception';
  const validated = useMemo(() => validateRows(rows, existing), [rows, existing]);
  const validRows = validated.filter((row) => row.status !== 'error');
  const visibleRows = validated.filter((row) => filter === 'all' || (filter === 'errors' ? row.status === 'error' : row.status !== 'error'));
  const count = (status) => validated.filter((row) => row.status === status).length;

  async function readFile(file) {
    if (!file) return;
    setError(''); setNotice(''); setRows([]); setProgress(0);
    if (!/\.(csv|xlsx|xlsm)$/i.test(file.name)) {
      setError('Choose a CSV UTF-8 or Excel .xlsx/.xlsm workbook.');
      return;
    }
    setFileName(file.name); setLoading(true);
    try {
      const result = await patientRequest('list');
      setExisting(result.patients || []);
      const parsed = /\.(xlsx|xlsm)$/i.test(file.name) ? await parseXlsx(file) : parseCsv(await file.text());
      if (!parsed.length) throw new Error('The file has no patient rows or its CSV headers could not be read.');
      const chunkSize = 75; const processed = [];
      for (let start = 0; start < parsed.length; start += chunkSize) {
        processed.push(...parsed.slice(start, start + chunkSize));
        setProgress(Math.round(Math.min(processed.length, parsed.length) / parsed.length * 100));
        await new Promise((resolve) => window.requestAnimationFrame(() => resolve()));
      }
      setRows(processed);
    } catch (readError) {
      setError(readError.message || 'The file could not be analyzed.');
    } finally { setLoading(false); }
  }

  async function commitImport() {
    const ready = validRows;
    if (!ready.length) return;
    setCommitting(true); setError(''); setNotice('');
    let imported = 0; const failures = [];
    try {
      for (let i = 0; i < ready.length; i += 1) {
        const row = ready[i];
        const payload = {
          full_name: [row.first_name, row.other_names, row.surname].map((part) => String(part || '').trim()).filter(Boolean).join(' '),
          patient_number: row.patient_number || row.mrn || undefined,
          phone: row.normalizedPhone || null,
          sex: row.normalizedSex,
          date_of_birth: row.date_of_birth || null,
          age_at_registration: row.estimated_age_years !== undefined && row.estimated_age_years !== '' ? Number(row.estimated_age_years) : null,
          address: row.address || row.residence || '',
          residence: row.address || row.residence || '',
          emergency_contact_name: row.emergency_name || '',
          emergency_contact_phone: row.emergency_phone || '',
          insurance_enabled: Boolean(row.insurance_name && row.insurance_number && row.insurance_expiry),
          insurance_type: row.insurance_name && row.insurance_number && row.insurance_expiry ? (String(row.insurance_name).toLowerCase() === 'nhis' ? 'nhis' : 'other') : null,
          insurance_provider: row.insurance_name && row.insurance_number && row.insurance_expiry ? (String(row.insurance_name).toLowerCase() === 'nhis' ? 'NHIS' : row.insurance_name) : null,
          insurance_number: row.insurance_name && row.insurance_number && row.insurance_expiry ? row.insurance_number : null,
          insurance_expiry: row.insurance_name && row.insurance_number && row.insurance_expiry ? row.insurance_expiry : null,
        };
        try { await patientRequest('create', payload); imported += 1; }
        catch (rowError) { failures.push(`Row ${row.__row}: ${rowError.message}`); }
        setProgress(Math.round((i + 1) / ready.length * 100));
      }
      try {
        const audit = JSON.parse(window.localStorage.getItem('ascendhms.audit.v1') || '[]');
        audit.unshift({ id: crypto.randomUUID(), action: 'patient.bulk_import', detail: `${imported} imported from ${fileName}`, actor: profile?.full_name || user?.email || 'Current user', createdAt: new Date().toISOString() });
        window.localStorage.setItem('ascendhms.audit.v1', JSON.stringify(audit.slice(0, 500)));
      } catch { /* Import results remain visible even if local audit storage is unavailable. */ }
      setNotice(`${imported} patient record${imported === 1 ? '' : 's'} imported.${failures.length ? ` ${failures.length} rows failed to save.` : ''}`);
      if (failures.length) setError(failures.slice(0, 5).join(' '));
    } finally { setCommitting(false); }
  }

  if (!canImport) return <Navigate to={basePath} replace />;
  return <section className="patient-import-page">
    <header className="patients-page-heading"><div><span className="workspace-overline">RECEPTION WORKFLOW</span><h1>Bulk patient import</h1><p>Validate records before committing them to the patient directory.</p></div><Link className="staff-secondary-button" to={`${basePath}/patients`}>Back to patients</Link></header>
    {error && <p className="auth-notice auth-notice-error" role="alert">{error}</p>}{notice && <p className="settings-success" role="status">{notice}</p>}
    <section className="patient-import-upload"><div className="patient-import-drop" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); void readFile(event.dataTransfer.files?.[0]); }}><span className="patient-import-file-icon">↑</span><h2>Drop a patient spreadsheet here</h2><p>CSV UTF-8 or Excel .xlsx/.xlsm, one patient per row. Existing records are checked for duplicate phone numbers and MRNs.</p><button className="staff-primary-button" type="button" onClick={() => inputRef.current?.click()}>Choose file</button><input ref={inputRef} type="file" accept=".csv,.xlsx,.xlsm,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden onChange={(event) => void readFile(event.target.files?.[0])} /><small>{fileName || 'No file selected'}</small></div><div className="patient-import-template"><h3>Use the import template</h3><p>Headers: patient_number, surname, first_name, other_names, sex, date_of_birth, estimated_age_years, phone, address, emergency_name, emergency_phone, insurance_name, insurance_number, insurance_expiry.</p><button className="staff-secondary-button" type="button" onClick={() => { const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' }); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'patients_import_template.csv'; anchor.click(); URL.revokeObjectURL(url); }}>Download CSV template</button></div></section>
    {loading && <section className="patient-import-progress" aria-live="polite"><div><strong>Analyzing rows</strong><span>{progress}%</span></div><progress max="100" value={progress} /><p>Processed {Math.round(progress / 100 * rows.length)} rows of {rows.length || 'file'}.</p></section>}
    {validated.length > 0 && <><div className="patient-import-stats"><Metric label="Rows found" value={validated.length} /><Metric label="Ready to import" value={count('valid')} /><Metric label="Warnings" value={count('warning')} /><Metric label="Critical errors" value={count('error')} /></div><div className="patient-import-toolbar"><div><h2>Dry-run review</h2><p>No records are written until you confirm the import.</p></div><div className="patient-import-filters">{[['all','All'],['errors','Errors only'],['valid','Valid only']].map(([id,label]) => <button type="button" key={id} className={filter === id ? 'is-active' : ''} onClick={() => setFilter(id)}>{label}</button>)}</div></div><div className="staff-table-wrap patient-import-table-wrap"><table className="staff-table patient-import-table"><thead><tr><th>Row</th><th>Patient</th><th>Sex</th><th>DOB / age</th><th>Phone</th><th>MRN</th><th>Validation</th></tr></thead><tbody>{visibleRows.map((row) => <tr key={row.__row} className={`import-row-${row.status}`}><td>{row.__row}</td><td><strong>{row.first_name} {row.other_names} {row.surname}</strong></td><td>{row.normalizedSex || row.sex || 'Missing'}</td><td>{row.date_of_birth || row.estimated_age_years || 'Not recorded'}</td><td>{row.normalizedPhone || row.phone || 'Not recorded'}</td><td>{row.patient_number || row.mrn || 'Assigned on save'}</td><td>{row.errors.map((item) => <span className="import-validation-error" key={item}>{item}</span>)}{row.warnings.map((item) => <span className="import-validation-warning" key={item}>{item}</span>)}{!row.errors.length && !row.warnings.length && <span className="import-validation-valid">Ready</span>}</td></tr>)}</tbody></table></div><footer className="patient-import-footer"><span>{validRows.length} rows can be imported. {count('error')} rows with errors will be skipped.</span><button className="staff-primary-button" type="button" disabled={!validRows.length || committing} onClick={() => void commitImport()}>{committing ? 'Importing…' : `Import ${validRows.length} valid patients`}</button></footer></>}
  </section>;
}
function Metric({ label, value }) { return <article className="patient-import-stat"><small>{label}</small><strong>{value}</strong></article>; }
