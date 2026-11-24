/**
 * api.mjs 测试 — 后端接口与权限
 * 起一个真实的 HTTP 服务（内存数据库），用 fetch 当真实客户端打接口。
 * 用法：node tests/api.mjs
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

const app = await createApp({ dbPath: ':memory:' });
await new Promise((resolve) => app.server.listen(0, resolve));
const base = `http://127.0.0.1:${app.server.address().port}`;

async function call(path, { method = 'GET', body, cookie } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (cookie) headers.Cookie = cookie;
  const res = await fetch(base + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  const setCookie = res.headers.getSetCookie?.()?.[0] || res.headers.get('set-cookie');
  return { status: res.status, data, cookie: setCookie ? setCookie.split(';')[0] : null };
}

const titles = (items) => items.map((a) => a.title).join('、');

/* ---------------- 初始数据 ---------------- */
console.log('\n[1] 初始数据');
const list0 = await call('/api/activities');
check('列表接口 200', list0.status === 200);
check('有 17 条示例活动', list0.data.items.length === 17, String(list0.data.items.length));
check('字段转成了前端要的驼峰', Boolean(list0.data.items[0].startDate && list0.data.items[0].publisherType));
check('游客看到的活动都不可管理', list0.data.items.every((a) => a.canManage === false));

const me0 = await call('/api/auth/me');
check('未登录时 me 返回 null', me0.data.user === null);

const meta = await call('/api/meta');
check('meta 返回 6 种类型', meta.data.categories.length === 6);
check('meta 里「全校」排第一', meta.data.audiences[0] === '全校', meta.data.audiences.join(','));

/* ---------------- 服务端搜索与筛选 ---------------- */
console.log('\n[2] 服务端搜索与筛选');
const q1 = await call('/api/activities?q=' + encodeURIComponent('数学建模'));
check('按标题搜到 1 条', q1.data.items.length === 1, titles(q1.data.items));
const q2 = await call('/api/activities?q=' + encodeURIComponent('摄影协会'));
check('按发布者搜到 1 条', q2.data.items.length === 1, titles(q2.data.items));
const q3 = await call('/api/activities?q=' + encodeURIComponent('国赛一等奖'));
check('按介绍搜到 1 条', q3.data.items.length === 1, titles(q3.data.items));
const cat = await call('/api/activities?category=' + encodeURIComponent('学科竞赛'));
check('按类型筛出 4 条', cat.data.items.length === 4, titles(cat.data.items));
const aud = await call('/api/activities?audience=' + encodeURIComponent('电子工程学院'));
check('按面向对象筛出 1 条', aud.data.items.length === 1);
const both = await call(
  '/api/activities?q=' + encodeURIComponent('挑战杯') + '&category=' + encodeURIComponent('学科竞赛')
);
check('关键词 + 类型叠加后 1 条', both.data.items.length === 1);
const none = await call('/api/activities?q=zzzz');
check('搜不到时返回空数组', none.data.items.length === 0);
const wildcard = await call('/api/activities?q=' + encodeURIComponent('%'));
check('LIKE 的 % 被转义（不会匹配全部）', wildcard.data.items.length === 0, String(wildcard.data.items.length));

/* ---------------- 留言 ---------------- */
console.log('\n[3] 留言');
const c0 = await call('/api/activities/a01/comments');
check('a01 有 3 条示例留言', c0.data.items.length === 3, String(c0.data.items.length));
check('留言按时间倒序', String(c0.data.items[0].createdAt) >= String(c0.data.items[1].createdAt));

const c1 = await call('/api/activities/a01/comments', {
  method: 'POST',
  body: { nickname: '', content: '接口测试留言' },
});
check('游客也能留言', c1.status === 201);
check('昵称留空落成默认值', c1.data.comment.nickname === '匿名同学', c1.data.comment.nickname);

const c2 = await call('/api/activities/a01/comments', { method: 'POST', body: { content: '   ' } });
check('空内容被拒绝 422', c2.status === 422);
check('错误挂在 content 上', Boolean(c2.data.errors?.content));

const c3 = await call('/api/activities/a01/comments');
check('留言数变成 4', c3.data.items.length === 4);

/* ---------------- 注册与登录 ---------------- */
console.log('\n[4] 注册与登录');
const reg = await call('/api/auth/register', {
  method: 'POST',
  body: {
    account: 'test_user',
    password: 'secret123',
    displayName: '测试同学',
    publisherType: 'personal',
    publisherName: '测试同学（软件学院）',
  },
});
check('注册成功 201', reg.status === 201, JSON.stringify(reg.data));
check('返回了会话 Cookie', Boolean(reg.cookie && reg.cookie.startsWith('sid=')), String(reg.cookie));
check('新账号角色是普通用户', reg.data.user.role === 'user');
const userCookie = reg.cookie;

const dup = await call('/api/auth/register', {
  method: 'POST',
  body: { account: 'test_user', password: 'secret123', displayName: 'x', publisherType: 'personal' },
});
check('重复登录名 409', dup.status === 409, String(dup.status));

const badAccount = await call('/api/auth/register', {
  method: 'POST',
  body: { account: 'a b', password: 'secret123', displayName: 'x', publisherType: 'personal' },
});
check('登录名格式不对 422', badAccount.status === 422 && Boolean(badAccount.data.errors.account));

const shortPwd = await call('/api/auth/register', {
  method: 'POST',
  body: { account: 'newbie', password: '123', displayName: 'x', publisherType: 'personal' },
});
check('密码太短 422', shortPwd.status === 422 && Boolean(shortPwd.data.errors.password));

const wrongLogin = await call('/api/auth/login', {
  method: 'POST',
  body: { account: 'test_user', password: 'wrongpass' },
});
check('密码错 401', wrongLogin.status === 401);
check('不泄露"账号是否存在"', wrongLogin.data.error === '账号或密码不对', wrongLogin.data.error);

const login = await call('/api/auth/login', {
  method: 'POST',
  body: { account: 'test_user', password: 'secret123' },
});
check('登录成功', login.status === 200 && Boolean(login.cookie));

const me1 = await call('/api/auth/me', { cookie: userCookie });
check('带 Cookie 能拿到当前用户', me1.data.user?.account === 'test_user');

/* ---------------- 发布与权限 ---------------- */
console.log('\n[5] 发布活动与权限');
const anonPublish = await call('/api/activities', { method: 'POST', body: {} });
check('未登录不能发布 401', anonPublish.status === 401);

const badPublish = await call('/api/activities', {
  method: 'POST',
  cookie: userCookie,
  body: {
    title: '时间写反的活动',
    category: '讲座报告',
    audienceScope: 'all',
    startDate: '2026-12-10',
    endDate: '2026-12-01',
    signupDeadline: '2026-11-30',
    description: 'x',
  },
});
check('结束早于开始 422', badPublish.status === 422);
check('错误挂到 endDate 字段上', Boolean(badPublish.data.errors?.endDate), JSON.stringify(badPublish.data.errors));

const publish = await call('/api/activities', {
  method: 'POST',
  cookie: userCookie,
  body: {
    title: '接口测试发布的活动',
    category: '讲座报告',
    audienceScope: 'college',
    audienceDetail: '软件学院',
    startDate: '2026-12-20',
    endDate: '2026-12-21',
    signupDeadline: '2026-12-15',
    description: '这是一条通过接口发布的活动。',
    link: 'https://example.com/api-test',
    publisherType: 'org',
    publisherName: '伪造的身份',
  },
});
check('登录用户能发布 201', publish.status === 201, JSON.stringify(publish.data));
check('发布者身份取账号的，不认前端传的', publish.data.activity.publisherName === '测试同学（软件学院）', publish.data.activity.publisherName);
check('作者能看到 canManage=true', publish.data.activity.canManage === true);
check('面向对象存成了「软件学院」', publish.data.activity.audience === '软件学院');
const createdId = publish.data.activity.id;

const listAfter = await call('/api/activities');
check('列表变成 18 条', listAfter.data.items.length === 18, String(listAfter.data.items.length));

/* ---------------- 删除权限 ---------------- */
console.log('\n[6] 删除权限');
const anonDelete = await call(`/api/activities/${createdId}`, { method: 'DELETE' });
check('未登录删除 401', anonDelete.status === 401);

const other = await call('/api/auth/register', {
  method: 'POST',
  body: { account: 'other_user', password: 'secret123', displayName: '另一个同学', publisherType: 'org' },
});
const otherCookie = other.cookie;
const otherDelete = await call(`/api/activities/${createdId}`, { method: 'DELETE', cookie: otherCookie });
check('别人删除 403', otherDelete.status === 403, String(otherDelete.status));
check('提示写清楚原因', otherDelete.data.error.includes('只能删除自己'), otherDelete.data.error);

const ownDelete = await call(`/api/activities/${createdId}`, { method: 'DELETE', cookie: userCookie });
check('作者自己删除 200', ownDelete.status === 200);
const listBack = await call('/api/activities');
check('删完回到 17 条', listBack.data.items.length === 17, String(listBack.data.items.length));

/* ---------------- 管理员 ---------------- */
console.log('\n[7] 管理员权限');
const adminLogin = await call('/api/auth/login', {
  method: 'POST',
  body: { account: 'admin', password: 'admin2026' },
});
check('管理员能登录', adminLogin.status === 200);
const adminCookie = adminLogin.cookie;

const userHide = await call('/api/activities/a02/visibility', {
  method: 'POST',
  cookie: userCookie,
  body: { hidden: true },
});
check('普通用户不能下架 403', userHide.status === 403);

const adminHide = await call('/api/activities/a02/visibility', {
  method: 'POST',
  cookie: adminCookie,
  body: { hidden: true },
});
check('管理员能下架 200', adminHide.status === 200 && adminHide.data.activity.hidden === true);

const afterHide = await call('/api/activities');
check('下架后列表少一条', afterHide.data.items.length === 16, String(afterHide.data.items.length));
const hiddenDetail = await call('/api/activities/a02');
check('下架后游客打不开详情 404', hiddenDetail.status === 404);
const hiddenDetailAdmin = await call('/api/activities/a02', { cookie: adminCookie });
check('管理员仍能打开', hiddenDetailAdmin.status === 200);

const adminList = await call('/api/activities', { cookie: adminCookie });
check('管理员的列表里还能看到它', adminList.data.items.length === 17, String(adminList.data.items.length));
check('管理员对别人的活动也能 canManage', adminList.data.items.every((a) => a.canManage === true));

const hiddenComment = await call('/api/activities/a02/comments', {
  method: 'POST',
  body: { content: '给下架活动留言' },
});
check('下架活动不能留言 404', hiddenComment.status === 404);

await call('/api/activities/a02/visibility', {
  method: 'POST',
  cookie: adminCookie,
  body: { hidden: false },
});
const restoreList = await call('/api/activities');
check('恢复上架后回到 17 条', restoreList.data.items.length === 17, String(restoreList.data.items.length));

/* ---------------- 会话与恢复 ---------------- */
console.log('\n[8] 退出登录与恢复示例数据');
const logout = await call('/api/auth/logout', { method: 'POST', cookie: userCookie });
check('退出成功', logout.status === 200);
const afterLogout = await call('/api/auth/me', { cookie: userCookie });
check('退出后 Cookie 失效', afterLogout.data.user === null);

const userReseed = await call('/api/admin/reseed', { method: 'POST', cookie: userCookie });
check('普通用户不能恢复示例数据 403', userReseed.status === 403);
const adminReseed = await call('/api/admin/reseed', { method: 'POST', cookie: adminCookie });
check('管理员可以恢复 200', adminReseed.status === 200);
check('恢复后还是 17 条', adminReseed.data.activities === 17, String(adminReseed.data.activities));

/* ---------------- 静态资源与 404 ---------------- */
console.log('\n[9] 静态资源与错误处理');
const home = await fetch(base + '/');
check('首页能打开 200', home.status === 200);
check('首页是 HTML', (home.headers.get('content-type') || '').includes('text/html'));
const noApi = await call('/api/not-exist');
check('不存在的接口返回 JSON 404', noApi.status === 404 && Boolean(noApi.data.error));
const blocked = await fetch(base + '/data/campus-events.db');
check('数据库文件不对外提供', blocked.status === 404);

app.server.close();
app.db.close();

console.log(`\n结果：${pass} 项通过，${fail} 项失败\n`);
process.exit(fail === 0 ? 0 : 1);
