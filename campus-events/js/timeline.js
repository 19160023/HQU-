/**
 * timeline.js — 时间轴坐标计算（纯函数）
 *
 * 一块画布，横轴是日期。所有活动共用同一个"日期 → 百分比"的映射：
 *
 *   domain = [最早的开始/截止 - 2 天 , 最晚的结束 + 2 天]
 *   left%  = 开始日距 domain 起点的天数 / 总天数 * 100
 *   width% = 持续天数 / 总天数 * 100
 *
 * 活动条和顶部刻度都用同一个 pct()，所以不会出现"条和刻度错格"。
 */
import {
  DAY_MS,
  diffDays,
  fromStamp,
  toStamp,
  todayISO,
  statusOf,
  publisherInfo,
} from './core.js';

/** "2026-11-28" -> "11/28"，刻度用 */
export function formatShort(dateStr) {
  const d = new Date(toStamp(dateStr));
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}

/**
 * @param {Array} activities 活动列表
 * @param {string} refISO 参照日期，默认今天（测试时可传固定日期）
 * @returns {object|null} 传空数组时返回 null，由调用方渲染空状态
 */
export function buildTimeline(activities, refISO = todayISO()) {
  if (!Array.isArray(activities) || activities.length === 0) return null;

  // 1. 求时间范围：报名截止可能早于开始日，也算进来
  let minStamp = Infinity;
  let maxStamp = -Infinity;
  for (const a of activities) {
    minStamp = Math.min(minStamp, toStamp(a.startDate), toStamp(a.signupDeadline));
    maxStamp = Math.max(maxStamp, toStamp(a.endDate));
  }

  const domainStart = fromStamp(minStamp - 2 * DAY_MS);
  const domainEnd = fromStamp(maxStamp + 2 * DAY_MS);
  const totalDays = diffDays(domainStart, domainEnd) + 1;

  /** 天数 → 百分比 */
  const pct = (days) => (days / totalDays) * 100;

  // 2. 每个活动一行：条的位置与长度
  const rows = [...activities]
    .sort(
      (a, b) =>
        toStamp(a.startDate) - toStamp(b.startDate) || a.title.localeCompare(b.title, 'zh-CN')
    )
    .map((activity) => {
      const startIndex = diffDays(domainStart, activity.startDate);
      const endIndex = diffDays(domainStart, activity.endDate);
      const span = endIndex - startIndex + 1;
      return {
        activity,
        left: pct(startIndex),
        width: pct(span),
        deadlineLeft: pct(diffDays(domainStart, activity.signupDeadline)),
        span,
        status: statusOf(activity, refISO),
        pub: publisherInfo(activity.publisherType),
      };
    });

  // 3. 月份分段（画每个月的小标题）
  const months = buildMonths(domainStart, domainEnd, pct);

  // 4. 日期刻度
  const ticks = buildTicks(domainStart, totalDays, pct);

  // 5. 今天的位置（不在范围内就是 null，不画线）
  const todayIndex = diffDays(domainStart, refISO);
  const todayLeft = todayIndex >= 0 && todayIndex < totalDays ? pct(todayIndex) : null;

  return {
    domainStart,
    domainEnd,
    totalDays,
    months,
    ticks,
    todayLeft,
    rows,
    dayWidthPct: 100 / totalDays,
  };
}

function buildMonths(domainStart, domainEnd, pct) {
  const months = [];
  const startYear = new Date(toStamp(domainStart)).getUTCFullYear();
  const endStamp = toStamp(domainEnd);
  let cursor = domainStart;

  for (let guard = 0; guard < 60; guard += 1) {
    const cursorStamp = toStamp(cursor);
    if (cursorStamp > endStamp) break;

    const d = new Date(cursorStamp);
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth();

    // 本段 = 本月与 domain 的交集
    const segStart = Math.max(cursorStamp, Date.UTC(year, month, 1));
    const segEnd = Math.min(endStamp, Date.UTC(year, month + 1, 0));

    const leftDays = diffDays(domainStart, fromStamp(segStart));
    const spanDays = diffDays(fromStamp(segStart), fromStamp(segEnd)) + 1;

    months.push({
      label: year === startYear ? `${month + 1}月` : `${year}年${month + 1}月`,
      left: pct(leftDays),
      width: pct(spanDays),
    });

    cursor = fromStamp(segEnd + DAY_MS);
  }

  return months;
}

function buildTicks(domainStart, totalDays, pct) {
  // 刻度太密会糊，按总天数挑一个步长，保证最多 11 个刻度
  const steps = [1, 2, 3, 5, 7, 10, 14, 30];
  const step = steps.find((s) => totalDays / s <= 11) || 30;

  const ticks = [];
  for (let i = 0; i < totalDays; i += step) {
    const left = pct(i);
    if (left > 92) break; // 太靠右的标签会溢出，直接不画
    ticks.push({
      left,
      label: formatShort(fromStamp(toStamp(domainStart) + i * DAY_MS)),
      alignEnd: left > 78,
    });
  }
  return ticks;
}
