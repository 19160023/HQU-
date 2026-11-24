/**
 * core.js — 纯函数层
 * 这里不碰 DOM、不碰 localStorage，只做数据计算。
 * 好处：可以直接用 Node 跑测试，也方便讲清"日期怎么算的"。
 */

export const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

/** 补零：8 -> "08" */
export function pad2(n) {
  return String(n).padStart(2, '0');
}

/**
 * "YYYY-MM-DD" -> UTC 时间戳（当天 00:00）。
 * 统一用 UTC 而不是本地时区，是为了避开夏令时/时区导致的"差一天"问题。
 */
export function toStamp(dateStr) {
  const [y, m, d] = String(dateStr).split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

/** UTC 时间戳 -> "YYYY-MM-DD" */
export function fromStamp(stamp) {
  const d = new Date(stamp);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

/** 今天（本地日期）的 "YYYY-MM-DD" */
export function todayISO() {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

/** 日期加减天数 */
export function addDays(dateStr, n) {
  return fromStamp(toStamp(dateStr) + n * DAY_MS);
}

/** b - a 的天数差（b 在后为正） */
export function diffDays(a, b) {
  return Math.round((toStamp(b) - toStamp(a)) / DAY_MS);
}

/** "2026-11-28" -> "11月28日" */
export function formatDate(dateStr) {
  const d = new Date(toStamp(dateStr));
  return `${d.getUTCMonth() + 1}月${d.getUTCDate()}日`;
}

/** "2026-11-28" -> "2026年11月28日 周六" */
export function formatDateFull(dateStr) {
  const d = new Date(toStamp(dateStr));
  return `${d.getUTCFullYear()}年${formatDate(dateStr)} ${WEEKDAYS[d.getUTCDay()]}`;
}

/** ISO 时间串 -> "11月23日 20:45"（按本地时区显示；跨年时带上年份） */
export function formatDateTime(isoString) {
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const datePart =
    d.getFullYear() === now.getFullYear()
      ? `${d.getMonth() + 1}月${d.getDate()}日`
      : `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
  return `${datePart} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** 活动持续天数（含首尾，单日活动为 1） */
export function spanDays(activity) {
  return diffDays(activity.startDate, activity.endDate) + 1;
}

/** 活动时间的中文表述："11月28日 – 12月06日" / 单日活动只写一个日期 */
export function rangeLabel(activity) {
  return activity.startDate === activity.endDate
    ? formatDate(activity.startDate)
    : `${formatDate(activity.startDate)} – ${formatDate(activity.endDate)}`;
}

/** 发布者类型 */
export const PUBLISHER_TYPES = {
  college: { label: '学院', tone: 'college' },
  org: { label: '学生组织', tone: 'org' },
  personal: { label: '个人', tone: 'personal' },
};

export function publisherInfo(type) {
  return PUBLISHER_TYPES[type] || { label: '未知', tone: 'personal' };
}

/** 活动类型 */
export const CATEGORIES = ['学科竞赛', '讲座报告', '社团活动', '招新', '志愿服务', '其他'];

/**
 * 活动状态（派生字段，不存库，每次按"今天"实时算）
 * 优先级：已结束 > 进行中 > 报名已截止 > 报名中
 */
export function statusOf(activity, refISO = todayISO()) {
  const today = toStamp(refISO);
  const start = toStamp(activity.startDate);
  const end = toStamp(activity.endDate);
  const deadline = toStamp(activity.signupDeadline);

  if (today > end) return { key: 'ended', label: '已结束' };
  if (today >= start) return { key: 'ongoing', label: '进行中' };
  if (today > deadline) return { key: 'closed', label: '报名已截止' };
  if (today === deadline) return { key: 'open', label: '报名中', note: '今天截止' };
  return { key: 'open', label: '报名中' };
}

/* ---------------- 按状态分类 ---------------- */

/** 展示顺序：还能报的放最前，下架的放最后 */
export const STATUS_ORDER = ['open', 'ongoing', 'closed', 'ended', 'hidden'];

export const STATUS_META = {
  open: { label: '报名中', hint: '还能报名' },
  ongoing: { label: '进行中', hint: '正在举办' },
  closed: { label: '报名已截止', hint: '等开场' },
  ended: { label: '已结束', hint: '往期活动' },
  hidden: { label: '已下架', hint: '只有管理员能看到' },
};

/**
 * 展示用的状态：被管理员下架的活动优先归到「已下架」，
 * 不再按日期算它本来属于报名中还是已结束。
 */
export function displayStatusOf(activity, refISO = todayISO()) {
  if (activity && activity.hidden) return 'hidden';
  return statusOf(activity, refISO).key;
}

/** 同一状态内部也有各自的顺序，不是随便排的 */
function sortWithinStatus(key, items) {
  const byStart = (a, b) => toStamp(a.startDate) - toStamp(b.startDate);
  const byDeadline = (a, b) => toStamp(a.signupDeadline) - toStamp(b.signupDeadline);
  const byEnd = (a, b) => toStamp(a.endDate) - toStamp(b.endDate);
  const copy = [...items];

  if (key === 'open') return copy.sort((a, b) => byDeadline(a, b) || byStart(a, b)); // 快截止的在前
  if (key === 'ongoing') return copy.sort((a, b) => byEnd(a, b) || byStart(a, b)); // 快结束的在前
  if (key === 'ended') return copy.sort((a, b) => byEnd(b, a) || byStart(b, a)); // 最近结束的在前
  if (key === 'hidden') return copy.sort((a, b) => byStart(b, a)); // 下架的：最近的活动在前
  return copy.sort(byStart); // 报名已截止：按要开始的时间先后
}

/**
 * 按状态分组，空组直接不返回，顺序按 STATUS_ORDER。
 * @returns {Array<{key, label, hint, count, items}>}
 */
export function groupByStatus(activities, refISO = todayISO()) {
  const buckets = new Map(STATUS_ORDER.map((key) => [key, []]));
  for (const item of activities) {
    const key = displayStatusOf(item, refISO);
    if (buckets.has(key)) buckets.get(key).push(item);
  }

  return STATUS_ORDER.map((key) => {
    const items = buckets.get(key) || [];
    if (items.length === 0) return null;
    return {
      key,
      label: STATUS_META[key].label,
      hint: STATUS_META[key].hint,
      count: items.length,
      items: sortWithinStatus(key, items),
    };
  }).filter(Boolean);
}

/** 每种状态各有多少条，没出现的也返回 0 */
export function countsByStatus(activities, refISO = todayISO()) {
  const result = { open: 0, ongoing: 0, closed: 0, ended: 0, hidden: 0 };
  for (const item of activities) {
    const key = displayStatusOf(item, refISO);
    if (key in result) result[key] += 1;
  }
  return result;
}

/** 统计：总数 / 报名中 / 进行中 */
export function summaryOf(activities, refISO = todayISO()) {
  const result = { total: activities.length, open: 0, ongoing: 0 };
  for (const item of activities) {
    const key = statusOf(item, refISO).key;
    if (key === 'open') result.open += 1;
    if (key === 'ongoing') result.ongoing += 1;
  }
  return result;
}
