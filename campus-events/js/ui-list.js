/**
 * ui-list.js — 列表 / 时间轴
 * 数据从后端接口取，筛选也在后端做（SQL），前端只负责渲染和交互。
 */
import { countsByStatus, groupByStatus } from './core.js';
import { statusGroupsHtml, emptyFilterHtml, timelineHtml } from './templates.js';
import { buildTimeline } from './timeline.js';
import { escapeHtml, param } from './util.js';
import { fetchActivities, fetchMeta } from './api.js';
import { setupSiteChrome } from './site.js';

const state = {
  view: param('view') === 'timeline' ? 'timeline' : 'list',
  q: param('q') || '',
  category: param('cat') || '',
  audience: param('aud') || '',
};

const listEl = document.getElementById('activity-list');
const statsEl = document.getElementById('stats');
const searchEl = document.getElementById('q');
const chipsEl = document.getElementById('category-chips');
const audienceEl = document.getElementById('audience');
const pageAlert = document.getElementById('page-alert');

// 请求序号：打字很快时用它丢弃过期响应。注意必须声明在第一次 await 之前，
// 否则 refresh() 在 await 之后调用会撞上暂时性死区（TDZ），整页脚本停摆。
let requestSeq = 0;

await setupSiteChrome();

if (param('restored') === '1') showBanner('已恢复成初始的示例数据。');
if (param('deleted') === '1') showBanner('活动已删除。');

const meta = await fetchMeta().catch(() => ({ categories: [], audiences: [] }));

searchEl.value = state.q;
renderChips();
renderAudienceOptions();
bindEvents(); // 先绑事件再拉数据：网络慢的时候点按钮也有反应
await refresh();

/* ---------------- 渲染 ---------------- */

async function refresh() {
  const seq = ++requestSeq;

  try {
    listEl.dataset.loading = '1';
    const data = await fetchActivities({
      q: state.q,
      category: state.category,
      audience: state.audience,
    });
    if (seq !== requestSeq) return; // 打字太快时，丢掉过期的响应
    renderItems(data.items);
  } catch (error) {
    if (seq !== requestSeq) return;
    listEl.className = 'view-body';
    listEl.innerHTML = `
      <div class="empty empty--wide">
        <h2>没连上服务器</h2>
        <p>${escapeHtml(error.message)}。确认本地服务还在运行，然后刷新页面。</p>
      </div>`;
  } finally {
    if (seq === requestSeq) delete listEl.dataset.loading;
  }
}

function renderItems(items) {
  renderStats(items);

  if (items.length === 0) {
    listEl.className = 'view-body';
    listEl.innerHTML = emptyFilterHtml(hasFilters());
  } else if (state.view === 'timeline') {
    listEl.className = 'view-body';
    listEl.innerHTML = timelineHtml(buildTimeline(items));
  } else {
    // 列表视图按状态分块：报名中 / 进行中 / 报名已截止 / 已结束
    listEl.className = 'view-body';
    listEl.innerHTML = statusGroupsHtml(groupByStatus(items));
  }

  syncUrl();
  syncViewSwitch();
}

function renderStats(items) {
  const counts = countsByStatus(items);
  const label = hasFilters() ? `<b>${items.length}</b> 个结果` : `<b>${items.length}</b> 个活动`;
  // 已下架只有管理员看得到，没下架过就不显示这一项
  const hidden = counts.hidden > 0 ? `<span class="stat-hidden"><b>${counts.hidden}</b> 已下架</span>` : '';
  statsEl.innerHTML = `
    <span>${label}</span>
    <span class="stat-open"><b>${counts.open}</b> 报名中</span>
    <span class="stat-ongoing"><b>${counts.ongoing}</b> 进行中</span>
    <span class="stat-closed"><b>${counts.closed}</b> 报名已截止</span>
    <span class="stat-ended"><b>${counts.ended}</b> 已结束</span>
    ${hidden}
  `;
}

function renderChips() {
  const options = [{ value: '', label: '全部' }, ...meta.categories.map((c) => ({ value: c, label: c }))];
  chipsEl.innerHTML = options
    .map(
      (item) =>
        `<button type="button" class="chip-btn${state.category === item.value ? ' is-active' : ''}" data-category="${escapeHtml(item.value)}" aria-pressed="${state.category === item.value}">${escapeHtml(item.label)}</button>`
    )
    .join('');
}

function renderAudienceOptions() {
  audienceEl.innerHTML = ['<option value="">全部面向对象</option>']
    .concat(
      meta.audiences.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`)
    )
    .join('');
  audienceEl.value = state.audience;
}

function showBanner(text) {
  pageAlert.innerHTML = `<div class="alert alert--success" role="status">${escapeHtml(text)}</div>`;
}

/* ---------------- 状态同步 ---------------- */

function hasFilters() {
  return Boolean(state.q || state.category || state.audience);
}

function syncUrl() {
  const query = buildQuery();
  history.replaceState(null, '', query ? `index.html?${query}` : 'index.html');
}

function buildQuery(forceTimeline) {
  const params = new URLSearchParams();
  const wantTimeline = forceTimeline === undefined ? state.view === 'timeline' : Boolean(forceTimeline);
  if (wantTimeline) params.set('view', 'timeline');
  if (state.q) params.set('q', state.q);
  if (state.category) params.set('cat', state.category);
  if (state.audience) params.set('aud', state.audience);
  return params.toString();
}

function syncViewSwitch() {
  document.querySelectorAll('#view-switch a').forEach((link) => {
    const isTimeline = link.dataset.view === 'timeline';
    const query = buildQuery(isTimeline);
    link.href = query ? `index.html?${query}` : 'index.html';
    link.classList.toggle('is-active', isTimeline === (state.view === 'timeline'));
  });
  document.title = state.view === 'timeline' ? '时间轴 · 校园活动汇' : '活动列表 · 校园活动汇';
}

/* ---------------- 事件 ---------------- */

function bindEvents() {
  let timer = null;
  searchEl.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      state.q = searchEl.value;
      refresh();
    }, 220);
  });

  chipsEl.addEventListener('click', (event) => {
    const button = event.target.closest('[data-category]');
    if (!button) return;
    state.category = button.dataset.category;
    renderChips();
    refresh();
  });

  audienceEl.addEventListener('change', () => {
    state.audience = audienceEl.value;
    refresh();
  });

  listEl.addEventListener('click', (event) => {
    if (!event.target.closest('[data-action="reset-filters"]')) return;
    state.q = '';
    state.category = '';
    state.audience = '';
    searchEl.value = '';
    audienceEl.value = '';
    renderChips();
    refresh();
    searchEl.focus();
  });
}
