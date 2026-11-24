/**
 * render.mjs — 渲染自测
 * 检查卡片模板和详情模板是不是真的把该显示的字段都显示出来了。
 * 用法：node tests/render.mjs
 */
import { buildSeed } from '../js/seed.js';
import { activityCardHtml, activityDetailHtml, activityGridHtml, statusGroupsHtml, timelineHtml } from '../js/templates.js';
import { buildTimeline } from '../js/timeline.js';
import { publisherInfo, formatDate, rangeLabel, spanDays, statusOf, groupByStatus } from '../js/core.js';
import { escapeHtml } from '../js/util.js';

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

console.log('\n[1] 卡片包含 6 个必填字段');
let missing = [];
for (const a of list) {
  const html = activityCardHtml(a);
  const wanted = [
    escapeHtml(a.title), // 活动名称
    escapeHtml(a.category), // 类型
    publisherInfo(a.publisherType).label, // 发布者类型
    escapeHtml(a.publisherName), // 发布者名称
    rangeLabel(a), // 开始 + 结束时间
    formatDate(a.signupDeadline), // 报名截止
  ];
  const lost = wanted.filter((text) => !html.includes(text));
  if (lost.length) missing.push(`${a.title} 缺 ${lost.join('/')}`);
}
check('全部 17 张卡片字段完整', missing.length === 0, missing.join('；'));

console.log('\n[2] 卡片没有渲染出空值');
const broken = list
  .map((a) => activityCardHtml(a))
  .filter((html) => /undefined|NaN|\[object Object\]/.test(html));
check('无 undefined / NaN 泄漏', broken.length === 0, `${broken.length} 张有脏值`);

console.log('\n[3] 三类发布者有各自的样式类');
for (const type of ['college', 'org', 'personal']) {
  const sample = list.find((a) => a.publisherType === type);
  const html = activityCardHtml(sample);
  check(
    `${publisherInfo(type).label} 用 chip--${type} 与 card--${type}`,
    html.includes(`chip--${type}`) && html.includes(`card--${type}`)
  );
}

console.log('\n[4] 多日活动显示天数，单日不显示');
const multi = list.find((a) => spanDays(a) > 1);
const single = list.find((a) => spanDays(a) === 1);
check(`多日活动（${multi.title}）带「共 ${spanDays(multi)} 天」`, activityCardHtml(multi).includes(`共 ${spanDays(multi)} 天`));
check('单日活动不显示天数徽标', !activityCardHtml(single).includes('span-badge'));

console.log('\n[5] 状态标签');
const keys = new Set(list.map((a) => statusOf(a).key));
check('四种状态都出现', keys.size === 4, [...keys].join(','));

console.log('\n[6] 详情页');
const detail = activityDetailHtml(list[0]);
for (const label of ['开始时间', '结束时间', '报名截止', '活动介绍', '参与方式', '发布者']) {
  check(`详情含「${label}」`, detail.includes(label));
}
check('详情含发布者名称', detail.includes(list[0].publisherName));
check('详情含面向对象', detail.includes(list[0].audience));

console.log('\n[7] 空数据与非法 id');
check('空数组给出空状态', activityGridHtml([]).includes('还没有活动'));
check('示例数据带标记', activityGridHtml(list.slice(0, 1)).includes('card'));

console.log('\n[8] 转义与安全');
const evil = {
  ...list[0],
  id: 'x1',
  title: '<img src=x onerror=alert(1)>',
  description: '第一段\n\n第二段带 <b>标签</b>',
  publisherName: 'a & b',
};
const evilCard = activityCardHtml(evil);
check('标题里的尖括号被转义', !evilCard.includes('<img src=x'), evilCard.slice(0, 80));
check('发布者里的 & 被转义', evilCard.includes('a &amp; b'));
const evilDetail = activityDetailHtml(evil);
check('描述按空行分段', (evilDetail.match(/<p>/g) || []).length >= 2);
check('描述里的标签被转义', evilDetail.includes('&lt;b&gt;标签&lt;/b&gt;'));

console.log('\n[9] 时间轴 HTML');
const tlModel = buildTimeline(list);
const tlHtml = timelineHtml(tlModel);
check('画布带 --days 变量', tlHtml.includes(`--days:${tlModel.totalDays}`), `--days:${tlModel.totalDays}`);
check('行数 = 17', (tlHtml.match(/class="tl-row"/g) || []).length === 17);
check('活动条 17 根', (tlHtml.match(/class="tl-bar /g) || []).length === 17);
check('截止标记 17 个', (tlHtml.match(/class="tl-marker"/g) || []).length === 17);
check('有月份刻度', tlHtml.includes('tl-month'));
check('有日期刻度', tlHtml.includes('tl-tick'));
check('有图例', tlHtml.includes('tl-legend'));
check('有时间范围说明', tlHtml.includes('每格 1 天'));
check('无 undefined / NaN', !/undefined|NaN/.test(tlHtml));
check('空模型给空状态', timelineHtml(null).includes('没有可以画在时间轴上的活动'));

console.log('\n[10] 发布成功的提示');
check('带 created 时显示成功横幅', activityDetailHtml(list[0], { justCreated: true }).includes('发布成功'));
check('默认不显示成功横幅', !activityDetailHtml(list[0]).includes('发布成功'));
check('新发布的活动不标"示例数据"', !activityDetailHtml({ ...list[0], isSample: false }).includes('示例数据'));

console.log('\n[11] 按状态分组渲染');
const statusGroups = groupByStatus(list);
const groupsHtml = statusGroupsHtml(statusGroups);
const groupCount = (html) => (html.match(/class="status-group /g) || []).length;
check('渲染出 4 个分组', groupCount(groupsHtml) === 4, String(groupCount(groupsHtml)));
check(
  '四个标题都在',
  ['报名中', '进行中', '报名已截止', '已结束'].every((label) => groupsHtml.includes(label))
);
check('每组带数量徽标', groupsHtml.includes('class="status-count"'));
check('每组有锚点 id', groupsHtml.includes('id="group-open"') && groupsHtml.includes('id="group-ended"'));
check('卡片总数还是 17', (groupsHtml.match(/class="card card--/g) || []).length === 17, String((groupsHtml.match(/class="card card--/g) || []).length));
check('空数组给空状态', statusGroupsHtml([]).includes('还没有活动'));
check('只有一组时只渲染一块', groupCount(statusGroupsHtml([statusGroups[0]])) === 1);

console.log('\n[12] 已下架分组');
const withHiddenList = list.map((a) => (a.id === 'a02' ? { ...a, hidden: true } : a));
const hiddenHtml = statusGroupsHtml(groupByStatus(withHiddenList));
check('渲染出 5 个分组', groupCount(hiddenHtml) === 5, String(groupCount(hiddenHtml)));
check('「已下架」组排在最后', hiddenHtml.lastIndexOf('status-group--hidden') > hiddenHtml.lastIndexOf('status-group--ended'));
check('组标题写着「已下架」', hiddenHtml.includes('已下架'));
check('该组有 1 条', hiddenHtml.includes('<span class="status-count">1</span>'));
check('卡片上也有已下架标记', hiddenHtml.includes('pill--hidden'));

console.log(`\n结果：${pass} 项通过，${fail} 项失败\n`);
process.exit(fail === 0 ? 0 : 1);
