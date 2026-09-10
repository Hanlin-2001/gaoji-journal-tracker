const KEY = 'gaoji-papers-v1';
const TERMINAL = new Set(['已接收', '已拒稿', '已撤稿']);
let papers = read();
let syncedPublishers = new Set();
const $ = (selector) => document.querySelector(selector);
const today = () => new Date().toLocaleDateString('en-CA');
const ignoredKey = (paper) => `${paper.publisher || 'Elsevier'}|${paper.journal || '未知期刊'}|${paper.number || paper.title}`.toLowerCase();

function ignored() {
  try {
    const value = JSON.parse(localStorage.getItem('gaoji-ignored-submissions-v1') || '[]');
    return new Set(Array.isArray(value) ? value : []);
  } catch { return new Set(); }
}
function read() {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(value) ? value : [];
  } catch { return []; }
}
function save() { localStorage.setItem(KEY, JSON.stringify(papers)); render(); }
function escapeHtml(value) {
  return String(value || '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
}
function normalize(raw) {
  const value = String(raw).toLowerCase();
  if (value.includes('accept')) return '已接收';
  if (value.includes('reject')) return '已拒稿';
  if (value.includes('withdraw')) return '已撤稿';
  if (value.includes('revision') || value.includes('revise')) return '需要返修';
  if (value.includes('decision')) return '等待决定';
  if (value.includes('review')) return '同行评审';
  if (value.includes('editor') || value.includes('administrator') || value.includes('processing')) return '编辑处理中';
  return '已投稿';
}
function toast(text) {
  const element = $('#toast');
  element.textContent = text;
  element.style.display = 'block';
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { element.style.display = 'none'; }, 3000);
}
function titleKey(value) {
  const normalized = String(value || '').normalize('NFKC').toLocaleLowerCase();
  return normalized.replace(/[\s\p{P}\p{S}]+/gu, '') || normalized;
}
function attemptDate(paper) { return paper.statusDate || paper.submitted || ''; }
function groupsFor(list) {
  const grouped = new Map();
  for (const paper of list) {
    const key = titleKey(paper.title) || `untitled-${paper.id}`;
    if (!grouped.has(key)) grouped.set(key, { title: paper.title || '未命名论文', attempts: [] });
    grouped.get(key).attempts.push(paper);
  }
  return [...grouped.values()].map((group) => {
    group.attempts.sort((a, b) => attemptDate(b).localeCompare(attemptDate(a)));
    group.active = group.attempts.some((paper) => !TERMINAL.has(paper.status));
    return group;
  }).sort((a, b) => attemptDate(b.attempts[0]).localeCompare(attemptDate(a.attempts[0])));
}
function statusClass(status) {
  if (status === '需要返修') return 'revision';
  if (TERMINAL.has(status)) return 'done';
  return '';
}
function renderEvents(paper) {
  const events = Array.isArray(paper.events) ? paper.events.filter((event) => event?.date && (event.raw || event.rawStatus)) : [];
  if (!events.length) return '';
  return `<div class="event-list">${events.map((event) => `<span class="event">${escapeHtml(event.date)} · ${escapeHtml(event.raw || event.rawStatus)}</span>`).join('')}</div>`;
}
function renderGroup(group) {
  const activeAttempts = group.attempts.filter((paper) => !TERMINAL.has(paper.status)).length;
  const stateText = group.active ? `${activeAttempts} 个进程进行中` : '投稿已结束';
  return `<article class="paper-card">
    <header class="paper-summary"><div><h4 class="paper-title">${escapeHtml(group.title)}</h4><div class="paper-subline">共 ${group.attempts.length} 次期刊投稿${group.attempts.length > 1 ? ' · 已合并为同一篇论文' : ''}</div></div><span class="group-state ${group.active ? '' : 'ended'}">${stateText}</span></header>
    <div class="attempts">${group.attempts.map((paper) => `<div class="attempt">
      <div><div class="attempt-journal">${escapeHtml(paper.journal || '未知期刊')}</div><div class="attempt-meta">${escapeHtml(paper.publisher || '其他出版社')} · ${escapeHtml(paper.number || '暂无稿件编号')}</div>${renderEvents(paper)}</div>
      <div class="attempt-status"><span class="badge ${statusClass(paper.status)}">${escapeHtml(paper.status)}</span><span class="raw">${escapeHtml(paper.raw || '')}</span><div class="attempt-dates"><span>初次投稿：${escapeHtml(paper.submitted || '官方未显示')}</span><span>状态更新：${escapeHtml(paper.statusDate || '官方未显示')}</span></div></div>
      <div class="attempt-actions"><button class="row-action" data-edit="${escapeHtml(paper.id)}">编辑</button><button class="row-action delete-link" data-delete="${escapeHtml(paper.id)}">删除</button></div>
    </div>`).join('')}</div>
  </article>`;
}
function renderGroupList(selector, groups, emptyText) {
  $(selector).innerHTML = groups.length ? groups.map(renderGroup).join('') : `<div class="section-empty">${emptyText}</div>`;
}
function render() {
  const query = $('#search').value.trim().toLocaleLowerCase();
  const list = papers.filter((paper) => `${paper.title} ${paper.journal} ${paper.number} ${paper.publisher}`.toLocaleLowerCase().includes(query));
  const allGroups = groupsFor(list);
  const activeGroups = allGroups.filter((group) => group.active);
  const inactiveGroups = allGroups.filter((group) => !group.active);
  $('#myCount').textContent = papers.length;
  $('#listCount').textContent = allGroups.length;
  $('#activeCount').textContent = `${activeGroups.length} 篇`;
  $('#inactiveCount').textContent = `${inactiveGroups.length} 篇`;
  const active = papers.filter((paper) => !TERMINAL.has(paper.status)).length;
  $('#stats').innerHTML = [
    ['在投稿件', active, '仍在流程中的投稿'],
    ['同行评审', papers.filter((paper) => paper.status === '同行评审').length, '等待审稿意见'],
    ['需要返修', papers.filter((paper) => paper.status === '需要返修').length, '关注返修截止日期'],
    ['自动接入', `${syncedPublishers.size} / 3`, '出版社投稿系统同步']
  ].map((item) => `<article class="stat"><span>${item[0]}</span><b>${item[1]}</b><span>${item[2]}</span></article>`).join('');
  renderGroupList('#activeGroups', activeGroups, '目前没有正在投稿的论文');
  renderGroupList('#inactiveGroups', inactiveGroups, '目前没有已结束的投稿');
  $('#activeSection').hidden = allGroups.length === 0;
  $('#inactiveSection').hidden = allGroups.length === 0;
  $('#empty').hidden = allGroups.length > 0;
  const revision = papers.find((paper) => paper.status === '需要返修');
  $('#nextTask').innerHTML = revision ? `<div class="task"><b>${escapeHtml(revision.title)}</b><span>需要返修，请查看 ${escapeHtml(revision.journal)} 投稿系统中的截止日期。</span></div>` : '<div class="task"><b>暂无紧急待办</b><span>打开投稿系统后可检查最新状态。</span></div>';
}
function openForm(item) {
  const form = $('#paperForm');
  form.reset();
  form.elements.id.value = item?.id || '';
  form.elements.title.value = item?.title || '';
  form.elements.journal.value = item?.journal || '';
  form.elements.publisher.value = item?.publisher || 'Elsevier';
  form.elements.number.value = item?.number || '';
  form.elements.submitted.value = item?.submitted || (item ? '' : today());
  form.elements.status.value = item?.status || '已投稿';
  form.elements.raw.value = item?.raw || '';
  form.elements.statusDate.value = item?.statusDate || '';
  form.elements.url.value = item?.url || '';
  $('#dialogTitle').textContent = item ? '编辑投稿记录' : '添加投稿';
  $('#paperDialog').showModal();
}

$('#search').addEventListener('input', render);
$('#addButton').addEventListener('click', () => openForm());
document.querySelectorAll('[data-close]').forEach((button) => button.addEventListener('click', () => $('#paperDialog').close()));
$('.paper-panel').addEventListener('click', (event) => {
  const edit = event.target.dataset.edit;
  if (edit) openForm(papers.find((paper) => paper.id === edit));
  const remove = event.target.dataset.delete;
  if (!remove) return;
  const item = papers.find((paper) => paper.id === remove);
  if (item && confirm(`删除这次向“${item.journal || '未知期刊'}”的投稿记录？`)) {
    if (item.synced) {
      const hidden = ignored();
      hidden.add(item.syncIdentity || ignoredKey(item));
      localStorage.setItem('gaoji-ignored-submissions-v1', JSON.stringify([...hidden]));
    }
    papers = papers.filter((paper) => paper.id !== remove);
    save();
    toast('投稿记录已删除');
  }
});
$('#paperForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.currentTarget));
  if (data.url) {
    try {
      const url = new URL(data.url);
      if (!['https:', 'http:'].includes(url.protocol)) throw new Error();
    } catch { toast('请填写有效的 http 或 https 投稿网址'); return; }
  }
  const prior = papers.find((paper) => paper.id === data.id);
  const item = {
    ...data,
    id: data.id || crypto.randomUUID(),
    raw: data.raw || data.status,
    synced: prior?.synced,
    syncIdentity: prior?.syncIdentity,
    metadataLocked: Boolean(prior),
    manualSubmitted: Boolean(prior && prior.submitted !== data.submitted),
    manualStatusDate: Boolean(prior && prior.statusDate !== data.statusDate),
    events: prior?.events || []
  };
  const index = papers.findIndex((paper) => paper.id === item.id);
  if (index >= 0) papers[index] = item; else papers.push(item);
  save();
  $('#paperDialog').close();
  toast(index >= 0 ? '投稿信息已更新' : '投稿已添加');
});

function receiveExtension() {
  const encoded = document.documentElement.getAttribute('data-gaoji-extension-sync');
  if (!encoded) return;
  try {
    const payload = JSON.parse(decodeURIComponent(encoded));
    if (!['gaoji-publisher-extension', 'gaoji-omega-extension'].includes(payload.source) || !Array.isArray(payload.manuscripts)) return;
    const hidden = ignored();
    const visible = payload.manuscripts.filter((item) => !hidden.has(ignoredKey(item)));
    syncedPublishers = new Set(visible.map((item) => item.publisher || 'Elsevier').filter((name) => ['Elsevier', 'Taylor & Francis', 'Springer Nature'].includes(name)));
    $('#syncDot').classList.add('connected');
    $('#syncText').textContent = `已连接 ${syncedPublishers.size || 1} 家出版社`;
    let count = 0;
    for (const manuscript of visible) {
      if (!manuscript || typeof manuscript.number !== 'string' || typeof manuscript.rawStatus !== 'string') continue;
      const publisher = String(manuscript.publisher || 'Elsevier').slice(0, 80);
      const journal = String(manuscript.journal || '未知期刊').slice(0, 160);
      const syncIdentity = ignoredKey(manuscript);
      const officialEvents = Array.isArray(manuscript.events) ? manuscript.events
        .filter((event) => event?.date && (event.rawStatus || event.raw))
        .map((event) => ({ date: event.date, raw: event.rawStatus || event.raw, status: normalize(event.rawStatus || event.raw) })) : [];
      if (manuscript.initialSubmitted && officialEvents.length === 0) officialEvents.push({ date: manuscript.initialSubmitted, raw: 'Initial submission', status: '已投稿' });
      const currentDate = manuscript.statusDate || officialEvents.at(-1)?.date || '';
      if (currentDate && !officialEvents.some((item) => item.date === currentDate && item.raw === manuscript.rawStatus)) officialEvents.push({ date: currentDate, raw: manuscript.rawStatus, status: normalize(manuscript.rawStatus) });
      const incoming = {
        id: crypto.randomUUID(),
        title: String(manuscript.title || `${journal} 稿件 ${manuscript.number}`).slice(0, 500),
        journal,
        publisher,
        number: manuscript.number.slice(0, 80),
        submitted: String(manuscript.initialSubmitted || officialEvents[0]?.date || ''),
        statusDate: String(currentDate),
        status: normalize(manuscript.rawStatus),
        raw: manuscript.rawStatus.slice(0, 120),
        url: String(manuscript.pageUrl || '').startsWith('https://') ? String(manuscript.pageUrl) : '',
        events: officialEvents,
        synced: true,
        syncIdentity
      };
      const index = papers.findIndex((paper) => paper.syncIdentity === syncIdentity || (paper.publisher === publisher && String(paper.number).toUpperCase() === incoming.number.toUpperCase()) || (paper.journal === journal && paper.title === incoming.title));
      if (index >= 0) {
        const prior = papers[index];
        const locked = prior.metadataLocked;
        const eventMap = new Map(officialEvents.map((item) => [`${item.date}|${item.raw}`.toLowerCase(), item]));
        papers[index] = {
          ...prior, ...incoming, id: prior.id,
          submitted: prior.manualSubmitted ? prior.submitted : incoming.submitted,
          statusDate: prior.manualStatusDate ? prior.statusDate : incoming.statusDate,
          title: locked ? prior.title : incoming.title,
          journal: locked ? prior.journal : incoming.journal,
          publisher: locked ? prior.publisher : incoming.publisher,
          number: locked ? prior.number : incoming.number,
          events: [...eventMap.values()].sort((a, b) => String(a.date).localeCompare(String(b.date))),
          metadataLocked: locked,
          manualSubmitted: prior.manualSubmitted,
          manualStatusDate: prior.manualStatusDate
        };
      } else papers.push(incoming);
      count += 1;
    }
    save();
    toast(`已从投稿系统同步 ${count} 篇稿件`);
  } catch { toast('投稿系统同步数据无法读取'); }
}

document.addEventListener('gaoji-extension-sync', receiveExtension);
setTimeout(() => document.dispatchEvent(new Event('gaoji-extension-request')), 100);
render();
