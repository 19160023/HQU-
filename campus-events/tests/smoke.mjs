/**
 * smoke.mjs — 冒烟自测
 * 只测纯函数与示例数据，不依赖浏览器（Node 直接跑）。
 * 用法：node tests/smoke.mjs
 * 这是 F6/D1「测试记录」的雏形，后面会扩充成正式用例。
 */
import { buildSeed } from '../js/seed.js';
import { entryDestination } from '../js/cover.js';
import {
  statusOf,
  spanDays,
  groupByStatus,
  countsByStatus,
  displayStatusOf,
  summaryOf,
  formatDateFull,
  diffDays,
  toStamp,
} from '../js/core.js';

let pass = 0;
let fail = 0;

function check(name, condition, detail = '') {
  if (condition) {
    pass += 1;
    console.log(`  ✅ ${name}`);
  } else {
    fail += 1;
    console.log(`  ❌ ${name}${detail ? `  → ${detail}` : ''}`);
  }
}

const list = buildSeed();

console.log('\n[1] 数据完整性');
check('活动数量为 17', list.length === 17, `实际 ${list.length}`);
check('id 不重复', new Set(list.map((a) => a.id)).size === list.length);
check('全部标记为示例数据', list.every((a) => a.isSample === true));
check(
  '结束日期都不早于开始日期',
  list.every((a) => a.endDate >= a.startDate),
  list.filter((a) => a.endDate < a.startDate).map((a) => a.title).join('、')
);
check(
  '报名截止都不晚于活动结束',
  list.every((a) => a.signupDeadline <= a.endDate),
  list.filter((a) => a.signupDeadline > a.endDate).map((a) => a.title).join('、')
);
check(
  '三类发布者齐全',
  new Set(list.map((a) => a.publisherType)).size === 3
);

console.log('\n[2] 状态派生');
const counts = { open: 0, ongoing: 0, closed: 0, ended: 0 };
for (const a of list) counts[statusOf(a).key] += 1;
const summary = summaryOf(list);
check('报名中 8 个', summary.open === 8, `实际 ${summary.open}`);
check('进行中 3 个', summary.ongoing === 3, `实际 ${summary.ongoing}`);
check('已结束 2 个', counts.ended === 2, `实际 ${counts.ended}`);
check('报名已截止 4 个', counts.closed === 4, `实际 ${counts.closed}`);

console.log('\n[3] 时间跨度');
const spans = list.map(spanDays).sort((a, b) => a - b);
check('包含单日活动', spans.includes(1));
check('包含 2 天活动', spans.includes(2));
check('包含 3 天活动', spans.includes(3));
check('包含 5 天活动', spans.includes(5));
check('包含 8 天活动', spans.includes(8));
check('包含 10 天活动', spans.includes(10));
check('单日活动跨度为 1', spanDays({ startDate: '2026-11-28', endDate: '2026-11-28' }) === 1);
check(
  '11/28–12/06 应算 9 天',
  diffDays('2026-11-28', '2026-12-06') + 1 === 9,
  String(diffDays('2026-11-28', '2026-12-06') + 1)
);

console.log('\n[4] 按状态分组');
const groups = groupByStatus(list);
check('分成 4 组', groups.length === 4, String(groups.length));
check(
  '顺序是 报名中 → 进行中 → 报名已截止 → 已结束',
  groups.map((g) => g.key).join(',') === 'open,ongoing,closed,ended',
  groups.map((g) => g.key).join(',')
);
check('每组数量与状态分布一致', groups.map((g) => g.count).join(',') === '8,3,4,2', groups.map((g) => g.count).join(','));
const flat = groups.flatMap((g) => g.items);
check('每个活动恰好出现一次', flat.length === list.length && new Set(flat.map((a) => a.id)).size === list.length);
check('没有空组', groups.every((g) => g.count > 0));

const openGroup = groups.find((g) => g.key === 'open');
check('报名中按报名截止升序（快截止的在前）', openGroup.items.every((a, i) => i === 0 || toStamp(openGroup.items[i - 1].signupDeadline) <= toStamp(a.signupDeadline)));
const endedGroup = groups.find((g) => g.key === 'ended');
check('已结束按结束时间倒序（最近结束的在前）', endedGroup.items.every((a, i) => i === 0 || toStamp(endedGroup.items[i - 1].endDate) >= toStamp(a.endDate)));

const counts2 = countsByStatus(list);
check('countsByStatus 四种状态都对', counts2.open === 8 && counts2.ongoing === 3 && counts2.closed === 4 && counts2.ended === 2, JSON.stringify(counts2));
check('空数组分成 0 组', groupByStatus([]).length === 0);

console.log('\n[4b] 已下架单独成组');
const withHidden = list.map((a) => (a.id === 'a02' ? { ...a, hidden: true } : a));
const groups5 = groupByStatus(withHidden);
check('变成 5 组', groups5.length === 5, String(groups5.length));
check('最后一组是已下架', groups5.at(-1).key === 'hidden', groups5.at(-1).key);
check('已下架组里 1 条', groups5.at(-1).count === 1);
check('它不再算进「进行中」', groups5.find((g) => g.key === 'ongoing').count === 2, String(groups5.find((g) => g.key === 'ongoing').count));
const counts3 = countsByStatus(withHidden);
check('countsByStatus 把下架的单独计数', counts3.hidden === 1 && counts3.ongoing === 2, JSON.stringify(counts3));
check('displayStatusOf 优先返回 hidden', displayStatusOf({ ...list[0], hidden: true }) === 'hidden');
check('没下架的仍按日期算状态', displayStatusOf(list[0]) === statusOf(list[0]).key);

console.log('\n[5] 日期格式');
check('格式化为「2026年11月28日 周六」', formatDateFull('2026-11-28') === '2026年11月28日 周六', formatDateFull('2026-11-28'));

console.log('\n[6] 封面入口去向');
check('没登录 → 先去登录页', entryDestination(null) === 'login.html?next=index.html', entryDestination(null));
check('登录过 → 直接进活动列表', entryDestination({ id: 1 }) === 'index.html', entryDestination({ id: 1 }));
check('退出后回到封面逻辑不变', entryDestination(undefined) === 'login.html?next=index.html');

console.log('\n—— 示例数据预览 ——');
const preview = [...list].sort((a, b) => toStamp(a.startDate) - toStamp(b.startDate));
for (const a of preview) {
  const s = statusOf(a);
  console.log(
    `  ${a.id} ${s.label.padEnd(6, '　')} ${String(spanDays(a)).padStart(2)}天  ` +
      `${a.publisherType.padEnd(8)} ${a.startDate}→${a.endDate}  截止 ${a.signupDeadline}  ${a.title}`
  );
}

console.log(`\n结果：${pass} 项通过，${fail} 项失败\n`);
process.exit(fail === 0 ? 0 : 1);
