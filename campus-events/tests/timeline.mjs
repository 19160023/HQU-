/**
 * timeline.mjs — 时间轴坐标自测
 * 重点验三件事：
 *   1. 条长是不是真的等于天数
 *   2. 条和刻度是不是同一套坐标（不错格）
 *   3. 报名截止和活动举办是不是两个独立位置
 * 用法：node tests/timeline.mjs
 */
import { buildTimeline, formatShort } from '../js/timeline.js';
import { buildSeed } from '../js/seed.js';
import { diffDays, toStamp, spanDays, todayISO } from '../js/core.js';

let pass = 0;
let fail = 0;
const EPS = 1e-6;

function check(name, condition, detail = '') {
  if (condition) {
    pass += 1;
    console.log(`  ✅ ${name}`);
  } else {
    fail += 1;
    console.log(`  ❌ ${name}${detail ? `  → ${detail}` : ''}`);
  }
}

const near = (a, b) => Math.abs(a - b) < EPS;

/* ---------- 用真实示例数据跑 ---------- */
const list = buildSeed();
const model = buildTimeline(list);

console.log('\n[1] 画布范围');
const minStamp = Math.min(
  ...list.map((a) => Math.min(toStamp(a.startDate), toStamp(a.signupDeadline)))
);
const maxStamp = Math.max(...list.map((a) => toStamp(a.endDate)));
check('起点 = 最早日期前 2 天', diffDays(model.domainStart, new Date(minStamp - 2 * 864e5).toISOString().slice(0, 10)) === 0);
check('终点 = 最晚日期后 2 天', diffDays(new Date(maxStamp + 2 * 864e5).toISOString().slice(0, 10), model.domainEnd) === 0);
check('总天数 = 首尾差 + 1', model.totalDays === diffDays(model.domainStart, model.domainEnd) + 1, String(model.totalDays));

console.log('\n[2] 每一行都在画布内');
check('17 行', model.rows.length === 17, String(model.rows.length));
const outside = model.rows.filter(
  (r) => r.left < -EPS || r.width <= 0 || r.left + r.width > 100 + EPS
);
check('没有条越界', outside.length === 0, outside.map((r) => r.activity.title).join('；'));
const badDeadline = model.rows.filter((r) => r.deadlineLeft < -EPS || r.deadlineLeft > 100 + EPS);
check('报名截止标记都在画布内', badDeadline.length === 0);
check('按开始时间升序', model.rows.every((r, i) => i === 0 || toStamp(model.rows[i - 1].activity.startDate) <= toStamp(r.activity.startDate)));

console.log('\n[3] 条长 = 天数');
const widthMismatch = model.rows.filter((r) => !near(r.width, (r.span / model.totalDays) * 100));
check(
  '每行的宽度都等于「天数 / 总天数」',
  widthMismatch.length === 0,
  widthMismatch.map((r) => `${r.activity.title} 宽${r.width.toFixed(2)} 应为${((r.span / model.totalDays) * 100).toFixed(2)}`).join('；')
);
const single = model.rows.find((r) => r.span === 1);
check('单日活动宽度 = 1 格', near(single.width, 100 / model.totalDays), `${single.width}`);
const longOne = model.rows.find((r) => r.span === 10);
check('10 天活动宽度 = 10 格', near(longOne.width, (10 / model.totalDays) * 100), `${longOne.width}`);
check('长条明显比单日宽', longOne.width > single.width * 9);

console.log('\n[4] 条与刻度同一套坐标');
// 条右边缘 = (开始日序号 + 天数) / 总天数
const edgeBad = model.rows.filter((r) => {
  const rightEdge = r.left + r.width;
  const expect = (diffDays(model.domainStart, r.activity.startDate) + r.span) / model.totalDays * 100;
  return !near(rightEdge, expect);
});
check('条右边缘与日期刻度对齐', edgeBad.length === 0, edgeBad.map((r) => r.activity.title).join('；'));
const tickBad = model.ticks.filter((t) => t.left < -EPS || t.left >= 100 || !/^\d+\/\d+$/.test(t.label));
check('刻度位置和文案合法', tickBad.length === 0);
check('刻度数量不超过 11 个', model.ticks.length <= 11, String(model.ticks.length));
check('刻度从左到右递增', model.ticks.every((t, i) => i === 0 || t.left > model.ticks[i - 1].left));
check('每个刻度标签 = 该格起始日', near(model.ticks[0].left, 0) && model.ticks[0].label === formatShort(model.domainStart), `${model.ticks[0].label} vs ${formatShort(model.domainStart)}`);

console.log('\n[5] 月份分段');
const monthSum = model.months.reduce((sum, m) => sum + m.width, 0);
check('月份宽度加起来 = 100%', near(monthSum, 100), monthSum.toFixed(4));
check('月份从 0 开始', near(model.months[0].left, 0), String(model.months[0].left));
check(
  '月份首尾相接，没有缝隙',
  model.months.every((m, i) => i === 0 || near(m.left, model.months[i - 1].left + model.months[i - 1].width))
);
check('月份标签都有内容', model.months.every((m) => m.label.length > 0));

console.log('\n[6] 今天那条线');
check('今天在画布范围内', model.todayLeft !== null);
check(
  '今天位置 = 距起点天数 / 总天数',
  near(model.todayLeft, (diffDays(model.domainStart, todayISO()) / model.totalDays) * 100),
  String(model.todayLeft)
);

console.log('\n[7] 任务书原例：10/20 截止报名，11/15–16 举行');
const taskbookExample = {
  id: 'demo',
  title: '竞赛示例',
  category: '学科竞赛',
  publisherType: 'college',
  publisherName: '某学院',
  audience: '全校',
  startDate: '2026-11-15',
  endDate: '2026-11-16',
  signupDeadline: '2026-10-20',
  description: '',
  link: '',
  isSample: true,
  createdAt: '2026-10-01T00:00:00.000Z',
};
const demo = buildTimeline([taskbookExample], '2026-11-10');
const demoRow = demo.rows[0];
check('画布从 10/18 开始', demo.domainStart === '2026-10-18', demo.domainStart);
check('画布到 11/18 结束', demo.domainEnd === '2026-11-18', demo.domainEnd);
check('活动条跨 2 天', demoRow.span === 2, String(demoRow.span));
check('报名截止在活动条左边，两者不重叠', demoRow.deadlineLeft < demoRow.left, `截止${demoRow.deadlineLeft.toFixed(2)}% / 活动${demoRow.left.toFixed(2)}%`);
check('两个位置相距超过画布 50%', demoRow.left - demoRow.deadlineLeft > 50);
check('截止标记 = 10/20 那一格', near(demoRow.deadlineLeft, (2 / demo.totalDays) * 100));
check('活动条 = 11/15 那一格起', near(demoRow.left, (28 / demo.totalDays) * 100));
check('10 月与 11 月两段', demo.months.length === 2 && demo.months[1].label === '11月', JSON.stringify(demo.months.map((m) => m.label)));

console.log('\n[8] 边界');
check('空列表返回 null', buildTimeline([]) === null);
check('undefined 返回 null', buildTimeline(undefined) === null);
const oneDay = buildTimeline([{ ...taskbookExample, startDate: '2026-11-15', endDate: '2026-11-15', signupDeadline: '2026-11-10' }], '2026-11-10');
check('单日活动宽度 = 1 格', near(oneDay.rows[0].width, 100 / oneDay.totalDays));
check('formatshort 正确', formatShort('2026-11-08') === '11/8', formatShort('2026-11-08'));

console.log(`\n结果：${pass} 项通过，${fail} 项失败\n`);
process.exit(fail === 0 ? 0 : 1);
