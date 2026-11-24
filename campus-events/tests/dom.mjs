/**
 * dom.mjs — 列表页脚本的"浏览器冒烟测试"
 *
 * 没有真浏览器，就用一个最小的 DOM 替身把 js/ui-list.js 原样跑一遍：
 * 真起一个服务当后端，fetch 也是真的，只有 DOM 是假的。
 * 这样能抓到"脚本跑到一半抛错、按钮没绑上"这类问题——纯 Node 测试抓不到。
 *
 * 用法：node tests/dom.mjs
 */
import { createApp } from '../server/server.mjs';

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

/* ---------------- 最小 DOM ---------------- */

function makeEl(tag = 'div', id = '') {
  const listeners = {};
  const classes = new Set();
  return {
    tagName: tag,
    id,
    innerHTML: '',
    textContent: '',
    className: '',
    value: '',
    hidden: false,
    disabled: false,
    href: '',
    dataset: {},
    style: {},
    listeners,
    classList: {
      add: (c) => classes.add(c),
      remove: (c) => classes.delete(c),
      contains: (c) => classes.has(c),
      toggle: (c, force) => {
        const on = force === undefined ? !classes.has(c) : Boolean(force);
        if (on) classes.add(c);
        else classes.delete(c);
        return on;
      },
    },
    addEventListener(type, fn) {
      (listeners[type] = listeners[type] || []).push(fn);
    },
    removeEventListener() {},
    // 元素级 querySelector 一律返回一个新的替身元素：真实页面里这些按钮都存在，
    // 返回 null 会让"绑定事件"那一步崩掉，那是替身的问题、不是页面的问题
    querySelector: () => makeEl('div'),
    querySelectorAll: () => [],
    closest: () => null,
    remove() {},
    focus() {},
    scrollIntoView() {},
    insertBefore() {},
    appendChild() {},
    setAttribute() {},
  };
}

const registry = new Map();
for (const id of ['activity-list', 'stats', 'q', 'category-chips', 'audience', 'page-alert', 'user-area']) {
  registry.set(id, makeEl('div', id));
}

const viewLinks = [makeEl('a'), makeEl('a')];
viewLinks[0].dataset.view = 'list';
viewLinks[1].dataset.view = 'timeline';

globalThis.document = {
  title: '',
  body: Object.assign(makeEl('body', 'body'), { firstChild: null }),
  getElementById: (id) => registry.get(id) || null,
  querySelector: () => null,
  querySelectorAll: (selector) => (selector === '#view-switch a' ? viewLinks : []),
  createElement: (tag) => makeEl(tag),
};

globalThis.window = {
  addEventListener() {},
  confirm: () => true,
  alert() {},
  location: { href: '' },
};
globalThis.history = { replaceState() {} };
globalThis.location = { search: '', href: 'http://localhost:8080/index.html' };

/* ---------------- 真后端 ---------------- */

const app = await createApp({ dbPath: ':memory:' });
await new Promise((resolve) => app.server.listen(0, resolve));
const base = `http://127.0.0.1:${app.server.address().port}`;

const realFetch = globalThis.fetch;
globalThis.fetch = (input, init) =>
  realFetch(typeof input === 'string' && input.startsWith('/') ? base + input : input, init);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/* ---------------- 跑一次列表页脚本 ---------------- */
console.log('\n[1] 列表页脚本能完整跑完');
let importError = null;
try {
  await import('../js/ui-list.js');
} catch (error) {
  importError = error;
}
check('模块导入没有抛错', importError === null, importError && importError.message);
if (importError) {
  console.log(`\n结果：${pass} 项通过，${fail} 项失败\n`);
  app.server.close();
  app.db.close();
  process.exit(1);
}

const listEl = registry.get('activity-list');
const statsEl = registry.get('stats');
const chipsEl = registry.get('category-chips');
const audienceEl = registry.get('audience');

const countCards = (html) => (html.match(/class="card card--/g) || []).length;

console.log('\n[2] 首屏渲染');
check('渲染出 17 张卡片', countCards(listEl.innerHTML) === 17, String(countCards(listEl.innerHTML)));
check('卡片里有活动标题', listEl.innerHTML.includes('挑战杯'));
check('统计行有数字', statsEl.innerHTML.includes('17'), statsEl.innerHTML.slice(0, 60));
check('类型胶囊渲染出来了', chipsEl.innerHTML.includes('学科竞赛') && chipsEl.innerHTML.includes('全部'));
check('面向对象下拉有选项', audienceEl.innerHTML.includes('全校'), audienceEl.innerHTML.slice(0, 60));

const groupCount = (html) => (html.match(/class="status-group /g) || []).length;
check('按状态分成 4 块', groupCount(listEl.innerHTML) === 4, String(groupCount(listEl.innerHTML)));
const order = ['报名中', '进行中', '报名已截止', '已结束'].map((t) => listEl.innerHTML.indexOf(t));
check('分块顺序是 报名中→进行中→报名已截止→已结束', order.every((v, i) => v > 0 && (i === 0 || v > order[i - 1])), order.join(','));
check('统计行显示四种状态的数量', statsEl.innerHTML.includes('已结束'), statsEl.innerHTML.slice(0, 120));

console.log('\n[3] 事件真的绑上了');
check('搜索框绑了 input 事件', (registry.get('q').listeners.input || []).length === 1);
check('类型胶囊绑了 click 事件', (chipsEl.listeners.click || []).length === 1);
check('面向对象下拉绑了 change 事件', (audienceEl.listeners.change || []).length === 1);
check('列表容器绑了委托 click 事件', (listEl.listeners.click || []).length === 1);

console.log('\n[4] 点类型胶囊能筛出结果');
chipsEl.listeners.click[0]({
  target: { closest: (sel) => (sel === '[data-category]' ? { dataset: { category: '学科竞赛' } } : null) },
});
await sleep(300);
check('只剩 4 张卡（学科竞赛）', countCards(listEl.innerHTML) === 4, String(countCards(listEl.innerHTML)));
check('结果里都是学科竞赛', !listEl.innerHTML.includes('摄影协会秋季外拍'));
check('分组跟着变少（学科竞赛只有 2 种状态）', groupCount(listEl.innerHTML) === 2, String(groupCount(listEl.innerHTML)));

console.log('\n[5] 关键词与类型叠加');
const searchEl = registry.get('q');
searchEl.value = '国赛一等奖';
searchEl.listeners.input[0]({});
await sleep(400); // 等 220ms 防抖 + 请求
check('类型还锁在「学科竞赛」时搜不到（说明是叠加而不是覆盖）', countCards(listEl.innerHTML) === 0, String(countCards(listEl.innerHTML)));
check('给的是空状态', listEl.innerHTML.includes('没有符合条件的活动'));

chipsEl.listeners.click[0]({
  target: { closest: (sel) => (sel === '[data-category]' ? { dataset: { category: '' } } : null) },
});
await sleep(300);
check('解除类型筛选后搜到 1 条', countCards(listEl.innerHTML) === 1, String(countCards(listEl.innerHTML)));
check('命中的是数模分享那条', listEl.innerHTML.includes('数学建模'));

console.log('\n[6] 搜不到时给空状态');
searchEl.value = 'zzzz不存在的词';
searchEl.listeners.input[0]({});
await sleep(400);
check('显示空状态而不是白屏', listEl.innerHTML.includes('没有符合条件的活动'), listEl.innerHTML.slice(0, 40));
check('空状态带清除按钮', listEl.innerHTML.includes('清除筛选条件'));

console.log('\n[7] 清除筛选能恢复');
listEl.listeners.click[0]({
  target: { closest: (sel) => (sel === '[data-action="reset-filters"]' ? {} : null) },
});
await sleep(300);
check('恢复到 17 张卡', countCards(listEl.innerHTML) === 17, String(countCards(listEl.innerHTML)));
check('搜索框被清空', searchEl.value === '');

/* ---------------- 登录后：详情页与发布页 ---------------- */

console.log('\n[8] 登录一个账号，详情页能渲染出内容和留言');
let cookie = '';
const realFetch2 = globalThis.fetch;
globalThis.fetch = (input, init = {}) => {
  const url = typeof input === 'string' && input.startsWith('/') ? base + input : input;
  const headers = { ...(init.headers || {}) };
  if (cookie) headers.Cookie = cookie;
  return realFetch2(url, { ...init, headers }).then((res) => {
    const sc = res.headers.getSetCookie?.()?.[0];
    if (sc) cookie = sc.split(';')[0];
    return res;
  });
};

const loginRes = await globalThis.fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ account: 'student01', password: 'student2026' }),
});
check('登录接口通了', loginRes.status === 200, String(loginRes.status));

// 详情页需要的容器
for (const id of ['detail-root', 'comments-root', 'comment-form', 'comment-list', 'comment-count', 'comment-status']) {
  registry.set(id, makeEl('div', id));
}
const fakeForm = registry.get('comment-form');
fakeForm.elements = { content: makeEl('textarea', 'content'), nickname: makeEl('input', 'nickname') };
fakeForm.querySelector = (sel) => (sel === '[data-comment-error]' ? makeEl('p') : null);

globalThis.location.search = '?id=a01';

const before = Object.keys(globalThis).length;
let detailError = null;
try {
  await import('../js/ui-detail.js');
} catch (error) {
  detailError = error;
}
check('详情页脚本没抛错', detailError === null, detailError && detailError.message);

const detailHtml = registry.get('detail-root').innerHTML;
const commentsHtml = registry.get('comments-root').innerHTML;
check('详情渲染出活动标题', detailHtml.includes('挑战杯'), detailHtml.slice(0, 60));
check('详情有活动介绍与参与方式', detailHtml.includes('活动介绍') && detailHtml.includes('参与方式'));
check('详情有报名截止时间', detailHtml.includes('报名截止'));
check('评论区渲染出来了', commentsHtml.includes('留言与注意事项'));
check('a01 有 3 条留言', (commentsHtml.match(/class="comment"/g) || []).length === 3, String((commentsHtml.match(/class="comment"/g) || []).length));
check('游客/学生没有删除按钮', !detailHtml.includes('delete-activity'));
void before;

console.log('\n[9] 发布页按账号身份渲染');
for (const id of ['publish-form', 'form-status', 'login-gate', 'publisher-identity', 'audience-hint']) {
  registry.set(id, makeEl('div', id));
}
for (const id of ['f-title', 'f-category', 'f-audience-scope', 'f-audience-detail', 'f-startDate', 'f-endDate', 'f-signupDeadline', 'f-description', 'f-link']) {
  registry.set(id, makeEl('input', id));
}
const pubForm = registry.get('publish-form');
const scopeEl2 = makeEl('select', 'f-audience-scope');
scopeEl2.value = 'all';
const detailEl2 = makeEl('input', 'f-audience-detail');
detailEl2.hidden = true;
pubForm.elements = { audienceScope: scopeEl2, audienceDetail: detailEl2 };
pubForm.hidden = true;
pubForm.querySelector = () => null;

globalThis.location.search = '';

let publishError = null;
try {
  await import('../js/ui-publish.js');
} catch (error) {
  publishError = error;
}
check('发布页脚本没抛错', publishError === null, publishError && publishError.message);
check('身份区显示账号的发布者名称', registry.get('publisher-identity').innerHTML.includes('李思远'), registry.get('publisher-identity').innerHTML);
check('身份区显示「个人」', registry.get('publisher-identity').innerHTML.includes('个人'));
check('登录后表单显示出来', pubForm.hidden === false);
check('登录引导隐藏了', registry.get('login-gate').hidden === true);

console.log('\n[10] 管理员视角：已下架单独成组排最后');
const adminLogin = await globalThis.fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ account: 'admin', password: 'admin2026' }),
});
check('管理员登录成功', adminLogin.status === 200);

const hideRes = await globalThis.fetch('/api/activities/a02/visibility', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ hidden: true }),
});
check('管理员下架一条活动', hideRes.status === 200);

globalThis.location.search = '';
// 换个 URL 再导入一次，等于"重新打开一次列表页"
await import('../js/ui-list.js?reload=admin');

const adminHtml = listEl.innerHTML;
check('管理员列表出现 5 个分组', groupCount(adminHtml) === 5, String(groupCount(adminHtml)));
check('「已下架」排在其他四组之后', adminHtml.lastIndexOf('status-group--hidden') > adminHtml.lastIndexOf('status-group--ended'));
const hiddenTail = adminHtml.slice(adminHtml.indexOf('status-group--hidden'));
check('已下架组里只有 1 张卡', (hiddenTail.match(/class="card card--/g) || []).length === 1, String((hiddenTail.match(/class="card card--/g) || []).length));
check('统计行显示「已下架」', statsEl.innerHTML.includes('已下架'), statsEl.innerHTML.slice(0, 140));

app.server.close();
app.db.close();

console.log(`\n结果：${pass} 项通过，${fail} 项失败\n`);
process.exit(fail === 0 ? 0 : 1);
