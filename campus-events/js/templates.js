/**
 * templates.js — 渲染模板（纯函数）
 * 输入一个活动对象，输出 HTML 字符串。不碰 DOM，
 * 所以既能给页面用，也能在 Node 里跑测试，检查"该有的字段是不是都渲染了"。
 */
import {
  publisherInfo,
  statusOf,
  rangeLabel,
  formatDate,
  formatDateFull,
  formatDateTime,
  spanDays,
} from './core.js';
import { escapeHtml } from './util.js';

/** 列表页的一张卡片：任务书要求的 6 个字段都在这里 */
export function activityCardHtml(activity) {
  const pub = publisherInfo(activity.publisherType);
  const status = statusOf(activity);
  const span = spanDays(activity);
  const spanBadge = span > 1 ? `<em class="span-badge">共 ${span} 天</em>` : '';
  const note = status.note ? `<i>${status.note}</i>` : '';
  const href = `detail.html?id=${encodeURIComponent(activity.id)}`;

  return `
    <article class="card card--${pub.tone}" data-id="${escapeHtml(activity.id)}">
      <div class="card-top">
        <span class="chip chip--pub chip--${pub.tone}">${pub.label}</span>
        <span class="chip chip--cat">${escapeHtml(activity.category)}</span>
        <span class="pill pill--${status.key}">${status.label}${note}</span>
        ${activity.hidden ? '<span class="pill pill--hidden">已下架</span>' : ''}
      </div>

      <h2 class="card-title">
        <a href="${href}">${escapeHtml(activity.title)}</a>
      </h2>

      <p class="card-pub">
        ${escapeHtml(activity.publisherName)}<span class="dot">·</span>面向${escapeHtml(activity.audience)}
      </p>

      <dl class="card-meta">
        <div class="meta-row">
          <dt>活动时间</dt>
          <dd>${rangeLabel(activity)}${spanBadge}</dd>
        </div>
        <div class="meta-row">
          <dt>报名截止</dt>
          <dd>${formatDate(activity.signupDeadline)}</dd>
        </div>
      </dl>
    </article>
  `;
}

/** 列表页整块内容 */
export function activityGridHtml(activities) {
  if (!activities.length) {
    return `
      <div class="empty empty--wide">
        <h2>还没有活动</h2>
        <p>示例数据没有加载出来，试着刷新页面看看。</p>
      </div>`;
  }
  return activities.map(activityCardHtml).join('');
}

/**
 * 按状态分块：报名中 / 进行中 / 报名已截止 / 已结束
 * groups 由 core.js 的 groupByStatus() 算好，空组不会出现在这里。
 */
export function statusGroupsHtml(groups) {
  if (!groups || groups.length === 0) return activityGridHtml([]);

  return groups
    .map(
      (group) => `
    <section class="status-group status-group--${group.key}" id="group-${group.key}">
      <div class="status-head">
        <h2>
          <i class="status-dot" aria-hidden="true"></i>${escapeHtml(group.label)}
          <span class="status-count">${group.count}</span>
        </h2>
        <span class="status-hint">${escapeHtml(group.hint)}</span>
      </div>
      <div class="card-grid">${group.items.map(activityCardHtml).join('')}</div>
    </section>`
    )
    .join('');
}

/** 详情页 */
export function activityDetailHtml(activity, options = {}) {
  const a = activity;
  const pub = publisherInfo(a.publisherType);
  const status = statusOf(a);
  const span = spanDays(a);
  const createdBanner = options.justCreated
    ? `<div class="alert alert--success" role="status">发布成功，活动已经出现在列表和时间轴里了。<a href="index.html">去列表看看</a></div>`
    : '';

  const hiddenBanner = a.hidden
    ? '<div class="alert alert--error" role="status">这条活动已被管理员下架，普通同学在列表里看不到。</div>'
    : '';

  const actionButtons = [];
  if (options.canManage) {
    actionButtons.push(
      '<button type="button" class="btn-ghost btn-danger" data-action="delete-activity">删除活动</button>'
    );
  }
  if (options.isAdmin) {
    actionButtons.push(
      `<button type="button" class="btn-ghost" data-action="toggle-visibility">${a.hidden ? '恢复上架' : '下架活动'}</button>`
    );
  }
  const actionsHtml = actionButtons.length
    ? `<div class="detail-actions">${actionButtons.join('')}</div>`
    : '';
  const paragraphs = String(a.description || '')
    .split(/\n{2,}/)
    .map((text) => text.trim())
    .filter(Boolean)
    .map((text) => `<p>${escapeHtml(text)}</p>`)
    .join('');

  const linkSection = a.link
    ? `<a href="${escapeHtml(a.link)}" target="_blank" rel="noopener noreferrer">${escapeHtml(a.link)}</a>`
    : '<p>见活动介绍，或直接到现场参加。</p>';

  const sampleNote = a.isSample
    ? '<p class="notice notice--flush">本条为 <b>示例数据</b>，用于演示功能。</p>'
    : '';

  return `
    ${hiddenBanner}
    ${createdBanner}
    <a class="back" href="index.html">← 返回活动列表</a>

    <article class="detail" data-id="${escapeHtml(a.id)}">
      <div class="detail-head">
        <div class="card-top" style="margin-bottom: 4px">
          <span class="chip chip--pub chip--${pub.tone}">${pub.label}</span>
          <span class="chip chip--cat">${escapeHtml(a.category)}</span>
          <span class="pill pill--${status.key}">${status.label}${status.note ? `<i>${status.note}</i>` : ''}</span>
        </div>
        <h1>${escapeHtml(a.title)}</h1>
        <p class="detail-pub">
          发布者：${pub.label} · ${escapeHtml(a.publisherName)}<span class="dot">·</span>面向${escapeHtml(a.audience)}
        </p>
        ${actionsHtml}
      </div>

      <dl class="info-grid">
        <div class="info-item">
          <dt>开始时间</dt>
          <dd>${formatDateFull(a.startDate)}</dd>
        </div>
        <div class="info-item">
          <dt>结束时间</dt>
          <dd>${formatDateFull(a.endDate)}</dd>
        </div>
        <div class="info-item">
          <dt>报名截止</dt>
          <dd>${formatDateFull(a.signupDeadline)}</dd>
        </div>
        <div class="info-item">
          <dt>持续天数</dt>
          <dd>${span} 天</dd>
        </div>
      </dl>

      <section class="detail-section">
        <h2>活动介绍</h2>
        ${paragraphs || '<p>暂无介绍。</p>'}
      </section>

      <section class="detail-section">
        <h2>参与方式</h2>
        <div class="link-row">${linkSection}</div>
      </section>

      ${sampleNote}
    </article>
  `;
}

/** 筛完一条都不剩 */
export function emptyFilterHtml(hasFilters) {
  if (hasFilters) {
    return `
      <div class="empty empty--wide">
        <h2>没有符合条件的活动</h2>
        <p>换个关键词，或者把筛选条件放宽一点试试。</p>
        <button type="button" class="btn-primary" data-action="reset-filters">清除筛选条件</button>
      </div>`;
  }
  return `
    <div class="empty empty--wide">
      <h2>还没有活动</h2>
      <p>示例数据没有加载出来，试着刷新页面看看。</p>
    </div>`;
}

/**
 * 时间轴整块
 * model 由 timeline.js 的 buildTimeline() 算出，这里只负责拼 HTML。
 */
export function timelineHtml(model) {
  if (!model || !model.rows.length) {
    return `
      <div class="empty empty--wide">
        <h2>没有可以画在时间轴上的活动</h2>
        <p>等有活动数据后，这里会按日期把它们排开。</p>
      </div>`;
  }

  const { rows, months, ticks, totalDays, domainStart, domainEnd, todayLeft } = model;
  const p = (n) => `${n.toFixed(3)}%`;
  const todayLine =
    todayLeft == null ? '' : `<i class="tl-today" style="left:${p(todayLeft)}"></i>`;

  const monthsHtml = months
    .map(
      (m) =>
        `<div class="tl-month" style="left:${p(m.left)};width:${p(m.width)}">${escapeHtml(m.label)}</div>`
    )
    .join('');

  const ticksHtml = ticks
    .map(
      (t) =>
        `<div class="tl-tick" style="left:${p(t.left)}"><span${t.alignEnd ? ' class="is-end"' : ''}>${escapeHtml(t.label)}</span></div>`
    )
    .join('');

  const todayTick =
    todayLeft == null
      ? ''
      : `<div class="tl-today-tick" style="left:${p(todayLeft)}"></div>`;

  const rowsHtml = rows
    .map((row) => {
      const a = row.activity;
      return `
      <div class="tl-row" data-id="${escapeHtml(a.id)}">
        <div class="tl-label">
          <a class="tl-title" href="detail.html?id=${encodeURIComponent(a.id)}">${escapeHtml(a.title)}</a>
          <div class="tl-sub">
            <span class="chip chip--pub chip--${row.pub.tone}">${row.pub.label}</span>
            ${a.hidden ? '<span class="chip chip--hidden">已下架</span>' : ''}
            <span>${rangeLabel(a)} · ${row.span} 天</span>
          </div>
          <div class="tl-deadline-text"><i>▼</i>报名截止 ${formatDate(a.signupDeadline)}</div>
        </div>
        <div class="tl-track">
          ${todayLine}
          <i class="tl-bar is-${row.pub.tone} is-${row.status.key}" style="left:${p(row.left)};width:${p(row.width)}"></i>
          <i class="tl-marker" style="left:${p(row.deadlineLeft)}"></i>
        </div>
      </div>`;
    })
    .join('');

  return `
    <div class="tl-meta">
      <span>${formatDate(domainStart)} – ${formatDate(domainEnd)} · 共 ${totalDays} 天 · 每格 1 天</span>
      <span>${rows.length} 个活动</span>
    </div>

    <div class="tl-legend">
      <span><i class="lg lg-bar"></i>活动持续（条长＝天数）</span>
      <span><i class="lg lg-marker"></i>报名截止</span>
      <span><i class="lg lg-today"></i>今天</span>
      <span><i class="lg lg-grid"></i>每格 1 天</span>
    </div>

    <div class="timeline-scroll">
      <div class="timeline" style="--days:${totalDays}">
        <div class="tl-ruler">
          <div class="tl-corner">活动 / 发布者</div>
          <div class="tl-scale">
            ${monthsHtml}
            ${ticksHtml}
            ${todayTick}
          </div>
        </div>
        ${rowsHtml}
      </div>
    </div>
  `;
}

/* ===================== 评论 ===================== */

/** 一条评论：昵称 + 时间 + 内容 */
export function commentItemHtml(comment, options = {}) {
  const nickname = comment.nickname || '匿名同学';
  const avatar = nickname.slice(0, 1);
  // 先转义再换行，防止内容里的标签被执行
  const text = escapeHtml(comment.content).replace(/\n/g, '<br>');

  return `
    <article class="comment${options.isNew ? ' is-new' : ''}">
      <div class="comment-avatar" aria-hidden="true">${escapeHtml(avatar)}</div>
      <div class="comment-main">
        <div class="comment-meta">
          <span class="comment-nick">${escapeHtml(nickname)}</span>
          <time class="comment-time" datetime="${escapeHtml(comment.createdAt)}">${escapeHtml(formatDateTime(comment.createdAt))}</time>
        </div>
        <p class="comment-text">${text}</p>
      </div>
    </article>`;
}

/** 评论列表（新的在前） */
export function commentsListHtml(comments, options = {}) {
  if (!comments.length) {
    return '<p class="comment-empty">还没有人留言。知道点什么？来补一条报名经验或注意事项。</p>';
  }
  return comments
    .map((comment, index) => {
      const isNew = options.highlightId
        ? comment.id === options.highlightId
        : Boolean(options.highlightFirst && index === 0);
      return commentItemHtml(comment, { isNew });
    })
    .join('');
}

/** 评论区外壳：标题 + 发表表单 + 列表。表单只渲染一次，提交后只重画列表 */
export function commentsShellHtml(comments, options = {}) {
  const nickname = escapeHtml(options.defaultNickname || '');
  return `
    <section class="comments">
      <div class="comments-head">
        <h2>留言与注意事项</h2>
        <span class="comment-count" id="comment-count">${comments.length} 条</span>
      </div>
      <p class="comments-sub">补充报名经验、材料要求、现场注意事项。留言保存在服务器数据库里。</p>

      <form class="comment-form" id="comment-form" novalidate>
        <input class="input comment-nick-input" name="nickname" maxlength="20" autocomplete="off" value="${nickname}" placeholder="昵称（可留空，默认匿名同学）">
        <textarea class="textarea" name="content" rows="3" maxlength="500" placeholder="说点有用的：报名要准备什么、现场注意什么…"></textarea>
        <p class="comment-error" data-comment-error></p>
        <div class="comment-actions">
          <span class="comment-status" id="comment-status" role="status"></span>
          <button type="submit" class="btn-primary">发表留言</button>
        </div>
      </form>

      <div class="comment-list" id="comment-list">${commentsListHtml(comments)}</div>
    </section>`;
}

/** 活动不存在 */
export function missingActivityHtml() {  return `
    <a class="back" href="index.html">← 返回活动列表</a>
    <div class="empty">
      <h1>没找到这个活动</h1>
      <p>链接里的活动编号不存在，可能是地址不完整或活动已被删除。</p>
      <a class="btn" href="index.html">回到活动列表</a>
    </div>
  `;
}
