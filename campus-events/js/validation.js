/**
 * validation.js — 发布表单的校验与数据组装（纯函数）
 *
 * 校验规则来自任务书 二.3：
 *   1. 必填项不能为空
 *   2. 结束时间不能早于开始时间
 *   3. 报名截止时间要合理（不晚于活动结束时间）
 * 另外补了两条常识性规则：日期必须是真实存在的日期、链接得是 http(s) 开头。
 *
 * 全部是纯函数，所以能在 Node 里直接跑测试。
 */
import { CATEGORIES, PUBLISHER_TYPES, diffDays, fromStamp, toStamp } from './core.js';

/** 表单里出现错误的字段，按此顺序找第一个来聚焦 */
export const FIELD_ORDER = [
  'title',
  'category',
  'publisherType',
  'publisherName',
  'audience',
  'startDate',
  'endDate',
  'signupDeadline',
  'description',
  'link',
];

const DATE_KEYS = ['startDate', 'endDate', 'signupDeadline'];

/** "2026-11-28" 这种格式，而且要真实存在（2026-02-31 不算） */
export function isRealDate(str) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
  return fromStamp(toStamp(str)) === str;
}

/** 把表单原始值（全是字符串）规整成校验用的对象 */
export function normalize(raw) {
  const text = (key) => String(raw[key] == null ? '' : raw[key]).trim();
  return {
    title: text('title'),
    category: text('category'),
    publisherType: text('publisherType'),
    publisherName: text('publisherName'),
    audienceScope: raw.audienceScope === 'college' ? 'college' : 'all',
    audienceDetail: text('audienceDetail'),
    startDate: text('startDate'),
    endDate: text('endDate'),
    signupDeadline: text('signupDeadline'),
    description: text('description'),
    link: text('link'),
  };
}

/**
 * @returns {{ ok: boolean, errors: Record<string,string>, values: object }}
 *   errors 的 key 对应表单字段名，value 是给用户看的一句话。
 */
export function validateActivityForm(raw) {
  const values = normalize(raw);
  const errors = {};

  // —— 规则 1：必填 ——
  if (!values.title) errors.title = '请填写活动名称';
  if (!values.category) errors.category = '请选择活动类型';
  if (!values.publisherType) errors.publisherType = '请选择发布者身份';
  if (!values.publisherName) errors.publisherName = '请填写发布者名称';
  if (values.audienceScope === 'college' && !values.audienceDetail) {
    errors.audience = '请填写面向的学院或年级';
  }
  if (!values.startDate) errors.startDate = '请选择开始时间';
  if (!values.endDate) errors.endDate = '请选择结束时间';
  if (!values.signupDeadline) errors.signupDeadline = '请选择报名截止时间';
  if (!values.description) errors.description = '请填写活动介绍';

  // —— 规则 2：日期得能解析 ——
  for (const key of DATE_KEYS) {
    if (values[key] && !errors[key] && !isRealDate(values[key])) {
      errors[key] = '日期不合法，格式应为 2026-11-28';
    }
  }

  // —— 规则 2b：类型和身份必须是已知值（防止绕过下拉框塞任意字符串）——
  if (values.category && !errors.category && !CATEGORIES.includes(values.category)) {
    errors.category = '活动类型不在可选范围内';
  }
  if (values.publisherType && !errors.publisherType && !PUBLISHER_TYPES[values.publisherType]) {
    errors.publisherType = '发布者身份不在可选范围内';
  }

  // —— 规则 3：结束不早于开始（相等允许，单日活动）——
  if (!errors.startDate && !errors.endDate && values.startDate && values.endDate) {
    if (diffDays(values.startDate, values.endDate) < 0) {
      errors.endDate = '结束时间不能早于开始时间';
    }
  }

  // —— 规则 4：报名截止不晚于活动结束（相等允许，当天截止）——
  if (!errors.endDate && !errors.signupDeadline && values.signupDeadline) {
    if (diffDays(values.endDate, values.signupDeadline) > 0) {
      errors.signupDeadline = '报名截止不能晚于活动结束时间';
    }
  }

  // —— 规则 5：链接格式（选填，填了才查）——
  if (values.link && !/^https?:\/\/\S+$/i.test(values.link)) {
    errors.link = '链接要以 http:// 或 https:// 开头';
  }

  // 面向对象最终落成一个字符串，存库时只存这一个字段
  const audience =
    values.audienceScope === 'all' ? '全校' : values.audienceDetail;

  return {
    ok: Object.keys(errors).length === 0,
    errors,
    values: { ...values, audience },
  };
}

/** 按 FIELD_ORDER 找第一个出错的字段名，用于聚焦 */
export function firstErrorField(errors) {
  return FIELD_ORDER.find((key) => errors[key]) || null;
}

/** 校验通过的值 → 一条可存库的活动记录 */
export function buildActivityFromForm(values, { now = Date.now(), random = Math.random } = {}) {
  return {
    id: `a_${now.toString(36)}${random().toString(36).slice(2, 6)}`,
    title: values.title,
    category: values.category,
    publisherType: values.publisherType,
    publisherName: values.publisherName,
    audience: values.audience,
    startDate: values.startDate,
    endDate: values.endDate,
    signupDeadline: values.signupDeadline,
    description: values.description,
    link: values.link,
    isSample: false,
    createdAt: new Date(now).toISOString(),
  };
}

/* ===================== 评论 ===================== */

export const DEFAULT_NICKNAME = '匿名同学';
export const COMMENT_MAX = 500;
export const NICKNAME_MAX = 20;

/**
 * 评论校验：任务书只要求"内容不能为空"。
 * 昵称留空不报错，直接给默认值。
 */
export function validateComment(raw) {
  const nickname = String(raw.nickname == null ? '' : raw.nickname).trim();
  const content = String(raw.content == null ? '' : raw.content).trim();
  const errors = {};

  if (!content) errors.content = '说点什么再发表吧';
  if (content.length > COMMENT_MAX) errors.content = `留言最多 ${COMMENT_MAX} 个字`;
  if (nickname.length > NICKNAME_MAX) errors.nickname = `昵称最多 ${NICKNAME_MAX} 个字`;

  return {
    ok: Object.keys(errors).length === 0,
    errors,
    values: {
      nickname: nickname || DEFAULT_NICKNAME,
      content,
    },
  };
}

/** 校验通过的值 → 一条可存库的评论 */
export function buildComment(activityId, values, { now = Date.now(), random = Math.random } = {}) {
  return {
    id: `c_${now.toString(36)}${random().toString(36).slice(2, 6)}`,
    activityId,
    nickname: values.nickname || DEFAULT_NICKNAME,
    content: values.content,
    createdAt: new Date(now).toISOString(),
  };
}
