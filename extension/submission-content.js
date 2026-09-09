const GAOJI_STORAGE_KEY = 'gaojiPublisherSync';
const DATE_SOURCE = String.raw`\b(?:\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}|[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4})\b`;
const statusPatterns = [
  'Submissions with Required Reviews Complete',
  'Required Reviews Completed',
  'With Journal Administrator',
  'Awaiting Editor Decision',
  'Submission Being Processed',
  'Revision Submitted to Journal',
  'Editor Decision Started',
  'Reviewer(s) Invited',
  'Initial Quality Check',
  'Submission Complete',
  'Manuscript Submitted',
  'Submitted to Journal',
  'Decision in Process',
  'Reviews Completed',
  'Reviewers Assigned',
  'Awaiting Decision',
  'Technical Check',
  'Completed - Accept',
  'Completed - Reject',
  'Revision Required',
  'Editor Assigned',
  'In Peer Review',
  'Major Revision',
  'Minor Revision',
  'Under Review',
  'With Editor',
  'New Submission',
  'Accepted',
  'Rejected',
  'Withdrawn',
  'Revise',
].sort((a, b) => b.length - a.length);

function clean(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function statusIn(text) {
  const lower = text.toLowerCase();
  return statusPatterns.find((value) => lower.includes(value.toLowerCase())) || '';
}

function isoDate(raw) {
  const value = clean(raw).replace(',', '');
  let match = value.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (match) return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
  const months = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
  };
  match = value.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})$/);
  if (match) return `${match[3]}-${months[match[2].slice(0, 3).toLowerCase()]}-${match[1].padStart(2, '0')}`;
  match = value.match(/^([A-Za-z]{3,9})\s+(\d{1,2})\s+(\d{4})$/);
  if (match) return `${match[3]}-${months[match[1].slice(0, 3).toLowerCase()]}-${match[2].padStart(2, '0')}`;
  return value;
}

function firstDate(text) {
  const match = text.match(new RegExp(DATE_SOURCE, 'i'));
  return match ? isoDate(match[0]) : '';
}

function timelineFromText(text) {
  const matches = [...text.matchAll(new RegExp(DATE_SOURCE, 'gi'))];
  const events = [];
  for (let index = 0; index < matches.length; index += 1) {
    const current = matches[index];
    const start = current.index + current[0].length;
    const end = matches[index + 1]?.index ?? Math.min(text.length, start + 260);
    const rawStatus = statusIn(text.slice(start, end));
    if (rawStatus) events.push({ date: isoDate(current[0]), rawStatus });
  }
  return dedupeEvents(events);
}

function dedupeEvents(events) {
  const seen = new Set();
  return events.filter((event) => {
    const key = `${event.date}|${event.rawStatus}`.toLowerCase();
    if (!event.date || !event.rawStatus || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function publisher() {
  const host = location.hostname.toLowerCase();
  const sample = clean(document.body?.innerText).slice(0, 15000).toLowerCase();
  if (host.includes('tandfonline') || host.includes('manuscriptcentral') || sample.includes('taylor & francis')) return 'Taylor & Francis';
  if (host.includes('springernature') || host.includes('nature.com') || sample.includes('springer nature')) return 'Springer Nature';
  if (host.includes('elsevier') || location.pathname.toLowerCase().includes('/omega') || sample.includes('elsevier')) return 'Elsevier';
  return 'Editorial Manager';
}

function journal() {
  const meta = document.querySelector('meta[name="citation_journal_title"],meta[property="og:site_name"]')?.content;
  if (clean(meta)) return clean(meta).slice(0, 160);
  const heading = [...document.querySelectorAll('h1,.journal-title,[class*="journalTitle"],[class*="journal-title"]')]
    .map((element) => clean(element.textContent))
    .find((value) => value.length > 2 && value.length < 160);
  if (heading) return heading;
  return clean(document.title).replace(/\s*[|–—-]\s*(Editorial Manager|ScholarOne Manuscripts|Submission Portal|Springer Nature).*$/i, '').slice(0, 160) || '投稿系统';
}

function manuscriptNumber(text) {
  const labeled = text.match(/(?:Manuscript|Submission)\s*(?:ID|Number|No\.?|#)?\s*[:#]?\s*([A-Z0-9][A-Z0-9._/-]{4,50})/i);
  if (labeled) return labeled[1].replace(/[),;:]$/, '');
  const patterns = [/\b[A-Z][A-Z0-9]{1,15}(?:-[A-Z0-9]{1,12}){2,8}(?:\.R\d+)?\b/i, /\b[A-Z]{2,12}[-/]\d{2,4}[-/]\d{2,10}(?:\.R\d+)?\b/i];
  for (const pattern of patterns) {
    const hit = text.match(pattern);
    if (hit) return hit[0];
  }
  return '';
}

function hash(value) {
  let result = 2166136261;
  for (const character of value) {
    result ^= character.charCodeAt(0);
    result = Math.imul(result, 16777619);
  }
  return (result >>> 0).toString(36).toUpperCase();
}

function collectEditorialManager() {
  const found = [];
  for (const table of document.querySelectorAll('table,[role="table"]')) {
    const headerCells = [...table.querySelectorAll('thead th,[role="columnheader"]')];
    const headers = headerCells.map((cell) => clean(cell.textContent).toLowerCase());
    const indexOf = (label) => headers.findIndex((header) => header.includes(label));
    const numberIndex = indexOf('manuscript number');
    const titleIndex = indexOf('title');
    const initialIndex = indexOf('initial date submitted');
    const statusDateIndex = indexOf('status date');
    const statusIndex = indexOf('current status');
    if (numberIndex < 0 || titleIndex < 0 || statusIndex < 0) continue;
    for (const row of table.querySelectorAll('tbody tr,[role="row"]')) {
      const cells = [...row.querySelectorAll('td,[role="cell"]')];
      if (cells.length <= Math.max(numberIndex, titleIndex, statusIndex)) continue;
      const number = clean(cells[numberIndex]?.textContent);
      const title = clean(cells[titleIndex]?.textContent);
      const rawStatus = clean(cells[statusIndex]?.textContent);
      if (!number || !title || !rawStatus || !statusIn(rawStatus)) continue;
      const initialSubmitted = initialIndex >= 0 ? firstDate(clean(cells[initialIndex]?.textContent)) : '';
      const statusDate = statusDateIndex >= 0 ? firstDate(clean(cells[statusDateIndex]?.textContent)) : '';
      const events = [];
      if (initialSubmitted) events.push({ date: initialSubmitted, rawStatus: 'Initial submission' });
      if (statusDate) events.push({ date: statusDate, rawStatus });
      found.push({ publisher: publisher(), journal: journal(), number, title, rawStatus, initialSubmitted, statusDate, events: dedupeEvents(events), pageUrl: location.href });
    }
  }
  return found;
}

function collectTaylorPortal() {
  if (!location.hostname.toLowerCase().includes('tandfonline')) return [];
  const candidates = [...document.querySelectorAll('article,[class*="article"],[class*="submission"],[class*="manuscript"]')];
  const found = new Map();
  for (const root of candidates) {
    const text = clean(root.textContent);
    if (!/\bSUBMISSION\b/i.test(text) || !/\bTITLE\b/i.test(text) || !/\bJOURNAL\b/i.test(text) || !/\bSTATUS\b/i.test(text)) continue;
    const number = text.match(/\bSUBMISSION\s+([A-Z0-9][A-Z0-9._/-]{4,50})\b/i)?.[1] || manuscriptNumber(text);
    const title = text.match(/\bTITLE\s+(.+?)\s+JOURNAL\b/i)?.[1] || '';
    const journalName = text.match(/\bJOURNAL\s+(.+?)\s+STATUS\b/i)?.[1] || journal();
    const rawStatus = statusIn(text.match(/\bSTATUS\s+(.+?)(?:\s+CHARGES\b|\s+SUBMISSION\b|$)/i)?.[1] || text);
    if (!number || !title || !rawStatus) continue;
    const events = timelineFromText(text);
    const item = { publisher: 'Taylor & Francis', journal: clean(journalName).slice(0, 160), number, title: clean(title).slice(0, 500), rawStatus, initialSubmitted: events[0]?.date || '', statusDate: events.at(-1)?.date || '', events, pageUrl: location.href };
    const prior = found.get(number);
    if (!prior || item.events.length > prior.events.length) found.set(number, item);
  }
  return [...found.values()];
}

function collectGeneric() {
  const pub = publisher();
  const journalName = journal();
  const nodes = [...document.querySelectorAll('tr,[role="row"],[class*="manuscript"],[class*="submission"],article')];
  const found = new Map();
  for (const row of nodes) {
    const text = clean(row.textContent);
    if (text.length < 15 || text.length > 3000) continue;
    const rawStatus = statusIn(text);
    if (!rawStatus) continue;
    let number = manuscriptNumber(text);
    const candidates = [...row.querySelectorAll('td,[role="cell"],h2,h3,h4,[class*="title"],[data-testid*="title"]')]
      .map((element) => clean(element.getAttribute('title') || element.textContent))
      .filter((value) => value.length >= 8 && value.length <= 500 && !value.includes(number) && !value.toLowerCase().includes(rawStatus.toLowerCase()))
      .sort((a, b) => b.length - a.length);
    const title = candidates[0] || '';
    if (!number && !title) continue;
    if (!number) number = `AUTO-${hash(`${journalName}|${title}`)}`;
    const events = timelineFromText(text);
    const initialSubmitted = events[0]?.date || firstDate(text);
    const statusDate = events.at(-1)?.date || firstDate(text);
    const key = `${pub}|${journalName}|${number}`.toLowerCase();
    found.set(key, { publisher: pub, journal: journalName, number, title: title || `${journalName} 稿件 ${number}`, rawStatus, initialSubmitted, statusDate, events, pageUrl: location.href });
  }
  return [...found.values()];
}

function collect() {
  const exact = [...collectEditorialManager(), ...collectTaylorPortal()];
  if (exact.length) return exact;
  return collectGeneric();
}

function expandTaylorTimelines() {
  if (!location.hostname.toLowerCase().includes('tandfonline')) return;
  for (const control of document.querySelectorAll(
    'button[aria-expanded="false"],[role="button"][aria-expanded="false"]',
  )) {
    const label = clean(
      `${control.textContent || ''} ${control.getAttribute('aria-label') || ''}`,
    );
    if (/submission|peer review|decision/i.test(label)) control.click();
  }
}

function notice(count) {
  document.getElementById('gaoji-sync-notice')?.remove();
  const element = document.createElement('div');
  element.id = 'gaoji-sync-notice';
  element.textContent = `稿迹已自动记录 ${count} 篇稿件及页面中的阶段日期。`;
  Object.assign(element.style, { position: 'fixed', right: '20px', bottom: '20px', zIndex: '2147483647', padding: '12px 16px', borderRadius: '8px', background: '#18345d', color: '#fff', font: '14px/1.5 Arial,sans-serif', boxShadow: '0 8px 28px rgba(20,45,80,.25)' });
  document.body.appendChild(element);
  setTimeout(() => element.remove(), 5000);
}

let last = '';
let timer;
async function scan() {
  expandTaylorTimelines();
  const incoming = collect();
  if (!incoming.length) return;
  const fingerprint = JSON.stringify(incoming);
  if (fingerprint === last) return;
  last = fingerprint;
  const prior = await chrome.storage.local.get(GAOJI_STORAGE_KEY);
  const payload = prior[GAOJI_STORAGE_KEY] || { source: 'gaoji-publisher-extension', version: 3, manuscripts: [] };
  const merged = new Map((payload.manuscripts || []).map((item) => [`${item.publisher}|${item.journal}|${item.number}`.toLowerCase(), item]));
  for (const item of incoming) {
    const key = `${item.publisher}|${item.journal}|${item.number}`.toLowerCase();
    const existing = merged.get(key);
    item.events = dedupeEvents([...(existing?.events || []), ...(item.events || [])]);
    merged.set(key, { ...existing, ...item });
  }
  await chrome.storage.local.set({ [GAOJI_STORAGE_KEY]: { source: 'gaoji-publisher-extension', version: 3, syncedAt: new Date().toISOString(), manuscripts: [...merged.values()] } });
  notice(incoming.length);
}

function schedule() {
  clearTimeout(timer);
  timer = setTimeout(scan, 800);
}

schedule();
new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
