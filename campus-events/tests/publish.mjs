/**
 * publish.mjs — 发布表单自测
 * 三部分：
 *   [1] 页面结构：任务书要求的字段是不是都在 HTML 里
 *   [2] 校验规则：三条硬规则 + 边界放行
 *   [3] 数据组装：校验通过后写进库里的对象长什么样
 * 用法：node tests/publish.mjs
 */
import { readFileSync } from 'node:fs';
import {
  buildActivityFromForm,
  firstErrorField,
  isRealDate,
  validateActivityForm,
} from '../js/validation.js';
import { CATEGORIES } from '../js/core.js';

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

/* ---------- [1] 页面结构 ---------- */
console.log('\n[1] 发布页字段齐全');
const html = readFileSync(new URL('../publish.html', import.meta.url), 'utf8');
const loginHtml = readFileSync(new URL('../login.html', import.meta.url), 'utf8');

const fieldNames = [
  'title',
  'category',
  'audienceScope',
  'audienceDetail',
  'startDate',
  'endDate',
  'signupDeadline',
  'description',
  'link',
];
const missingFields = fieldNames.filter((name) => !html.includes(`name="${name}"`));
check('9 个可填写控件都在 HTML 里', missingFields.length === 0, missingFields.join('、'));

check('发布者身份改成由账号带入的只读区', html.includes('id="publisher-identity"'));
check('未登录时有登录引导位', html.includes('id="login-gate"'));
check('登录页有身份选择容器', loginHtml.includes('id="publisher-type-options"'));
check(
  '登录页有登录名和密码',
  loginHtml.includes('name="account"') && loginHtml.includes('name="password"')
);

const missingCats = CATEGORIES.filter((c) => !html.includes(`value="${c}"`));
check('六种活动类型都可选', missingCats.length === 0, missingCats.join('、'));

check('用的是 novalidate（不然浏览器原生提示会盖掉我们的文案）', html.includes('novalidate'));
check('没有加 required 属性', !/\srequired[\s>]/.test(html));
check('含"面向全校"选项', html.includes('value="all"'));
check('含"指定学院 / 年级"选项', html.includes('value="college"'));

const dataFields = ['title', 'category', 'audience', 'startDate', 'endDate', 'signupDeadline', 'description', 'link'];
const missingWrappers = dataFields.filter((name) => !html.includes(`data-field="${name}"`));
check('每个字段都有放错误提示的容器', missingWrappers.length === 0, missingWrappers.join('、'));

/* ---------- [2] 校验规则 ---------- */
const baseForm = () => ({
  title: '寒假算法集训',
  category: '招新',
  publisherType: 'org',
  publisherName: 'ACM 集训队',
  audienceScope: 'all',
  audienceDetail: '',
  startDate: '2026-12-10',
  endDate: '2026-12-18',
  signupDeadline: '2026-12-05',
  description: '为期八天的集训，覆盖图论与动态规划。',
  link: '',
});

console.log('\n[2] 必填校验');
const empty = validateActivityForm({});
check('空表单不通过', empty.ok === false);
check('空表单报 8 处', Object.keys(empty.errors).length === 8, JSON.stringify(Object.keys(empty.errors)));
for (const name of ['title', 'category', 'publisherType', 'publisherName', 'startDate', 'endDate', 'signupDeadline', 'description']) {
  check(`空「${name}」有提示`, Boolean(empty.errors[name]));
}

const spaces = validateActivityForm({ ...baseForm(), title: '   ' });
check('只填空格也算没填', Boolean(spaces.errors.title), JSON.stringify(spaces.errors));

const good = validateActivityForm(baseForm());
check('完整表单通过', good.ok === true, JSON.stringify(good.errors));

console.log('\n[3] 时间先后校验');
const endBeforeStart = validateActivityForm({ ...baseForm(), startDate: '2026-12-18', endDate: '2026-12-10' });
check('结束早于开始 → 拦住', endBeforeStart.errors.endDate === '结束时间不能早于开始时间', JSON.stringify(endBeforeStart.errors.endDate));

const sameDay = validateActivityForm({ ...baseForm(), startDate: '2026-12-10', endDate: '2026-12-10', signupDeadline: '2026-12-08' });
check('单日活动（结束=开始）→ 放行', sameDay.ok === true, JSON.stringify(sameDay.errors));

const deadlineAfterEnd = validateActivityForm({ ...baseForm(), signupDeadline: '2026-12-20' });
check('报名截止晚于活动结束 → 拦住', deadlineAfterEnd.errors.signupDeadline === '报名截止不能晚于活动结束时间', JSON.stringify(deadlineAfterEnd.errors));

const deadlineOnEnd = validateActivityForm({ ...baseForm(), signupDeadline: '2026-12-18' });
check('报名截止=活动结束当天 → 放行', deadlineOnEnd.ok === true, JSON.stringify(deadlineOnEnd.errors));

const deadlineBeforeStart = validateActivityForm({ ...baseForm(), signupDeadline: '2026-11-01' });
check('报名截止早于活动开始 → 放行（正常情况）', deadlineBeforeStart.ok === true, JSON.stringify(deadlineBeforeStart.errors));

console.log('\n[4] 日期合法性');
check('2026-02-31 不是真日期', isRealDate('2026-02-31') === false);
check('2026-11-28 是真日期', isRealDate('2026-11-28') === true);
check('2026-13-01 不合法', isRealDate('2026-13-01') === false);
check('11/28 这种格式不合法', isRealDate('11/28') === false);
const badDate = validateActivityForm({ ...baseForm(), startDate: '2026-02-31' });
check('假日期被拦住', Boolean(badDate.errors.startDate), JSON.stringify(badDate.errors));

console.log('\n[5] 面向对象');
const collegeNoDetail = validateActivityForm({ ...baseForm(), audienceScope: 'college', audienceDetail: '' });
check('选"指定学院"却没填 → 拦住', Boolean(collegeNoDetail.errors.audience));
const collegeWithDetail = validateActivityForm({ ...baseForm(), audienceScope: 'college', audienceDetail: ' 计算机学院 ' });
check('填了学院 → 通过', collegeWithDetail.ok === true);
check('去掉首尾空格后存为 audience', collegeWithDetail.values.audience === '计算机学院', collegeWithDetail.values.audience);
const allScope = validateActivityForm({ ...baseForm(), audienceScope: 'all', audienceDetail: '随便写的' });
check('选"全校"时 audience 固定为「全校」', allScope.values.audience === '全校', allScope.values.audience);

console.log('\n[6] 链接格式');
check('空链接放行', validateActivityForm({ ...baseForm(), link: '' }).ok === true);
check('https 链接放行', validateActivityForm({ ...baseForm(), link: 'https://example.com/a' }).ok === true);
check('http 链接放行', validateActivityForm({ ...baseForm(), link: 'http://example.com' }).ok === true);
check('没协议的链接拦住', Boolean(validateActivityForm({ ...baseForm(), link: 'example.com' }).errors.link));
check('javascript: 拦住', Boolean(validateActivityForm({ ...baseForm(), link: 'javascript:alert(1)' }).errors.link));

console.log('\n[7] 错误顺序（决定聚焦到哪个字段）');
check('第一个错误是 title', firstErrorField(validateActivityForm({}).errors) === 'title');
check('只有日期错时聚焦 startDate', firstErrorField({ startDate: 'x' }) === 'startDate');
check('没有错误时返回 null', firstErrorField({}) === null);

console.log('\n[8] 组装成活动记录');
const built = buildActivityFromForm(good.values, { now: 1764000000000, random: () => 0.123456 });
check('id 以 a_ 开头', built.id.startsWith('a_'), built.id);
check('id 可重复生成不同值', buildActivityFromForm(good.values).id !== buildActivityFromForm(good.values).id);
check('标记为非示例数据', built.isSample === false);
check('createdAt 是 ISO 字符串', /^\d{4}-\d{2}-\d{2}T/.test(built.createdAt), built.createdAt);
check('面向对象落成字符串', built.audience === '全校');
check('九个业务字段一个不少', ['title', 'category', 'publisherType', 'publisherName', 'audience', 'startDate', 'endDate', 'signupDeadline', 'description'].every((k) => Boolean(built[k])));
check('链接留空存空字符串', built.link === '');
check('不残留 audienceScope / audienceDetail', !('audienceScope' in built) && !('audienceDetail' in built));


console.log(`\n结果：${pass} 项通过，${fail} 项失败\n`);
process.exit(fail === 0 ? 0 : 1);
