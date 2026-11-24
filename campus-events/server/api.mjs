/**
 * api.mjs — 所有 /api/* 路由
 * 约定：成功返回 JSON，失败返回 { error: '给人看的一句话', errors?: {字段: 提示} }
 */
import { CATEGORIES, PUBLISHER_TYPES } from '../js/core.js';
import {
  buildActivityFromForm,
  buildComment,
  validateActivityForm,
  validateComment,
} from '../js/validation.js';
import {
  clearSessionCookie,
  hashPassword,
  makeSalt,
  newSessionToken,
  readSessionToken,
  sessionCookie,
  sessionExpiry,
  verifyPassword,
} from './auth.mjs';
import { nowIso, resetSampleData } from './db.mjs';

const JSON_LIMIT = 96 * 1024;
const MAX_ACTIVITY_ROWS = 500;

/* ---------------- 小工具 ---------------- */

function json(res, status, data, headers = {}) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers,
  });
  res.end(JSON.stringify(data));
}

function fail(res, status, message, extra = {}) {
  json(res, status, { error: message, ...extra });
}

async function readJson(req, limit = JSON_LIMIT) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw Object.assign(new Error('请求体太大'), { status: 413 });
    chunks.push(chunk);
  }
  if (chunks.length === 0) return {};
  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    throw Object.assign(new Error('请求体不是合法 JSON'), { status: 400 });
  }
}

const toUser = (row) => ({
  id: row.id,
  account: row.account,
  displayName: row.display_name,
  role: row.role,
  publisherType: row.publisher_type,
  publisherName: row.publisher_name,
});

const toActivity = (row, viewer) => ({
  id: row.id,
  title: row.title,
  category: row.category,
  publisherType: row.publisher_type,
  publisherName: row.publisher_name,
  audience: row.audience,
  startDate: row.start_date,
  endDate: row.end_date,
  signupDeadline: row.signup_deadline,
  description: row.description,
  link: row.link,
  isSample: Boolean(row.is_sample),
  hidden: Boolean(row.hidden),
  createdAt: row.created_at,
  // 谁能改删由后端算好，前端不重复实现一套权限判断
  canManage: Boolean(viewer && (viewer.role === 'admin' || (row.created_by && row.created_by === viewer.id))),
});

const toComment = (row) => ({
  id: row.id,
  activityId: row.activity_id,
  nickname: row.nickname,
  content: row.content,
  createdAt: row.created_at,
});

/** 从 Cookie 里解出当前登录用户 */
export function currentUser(db, req) {
  const token = readSessionToken(req);
  if (!token) return null;
  const row = db
    .prepare(
      `SELECT u.*, s.expires_at AS session_expires
         FROM sessions s JOIN users u ON u.id = s.user_id
        WHERE s.token = ?`
    )
    .get(token);
  if (!row) return null;
  if (new Date(row.session_expires).getTime() < Date.now()) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    return null;
  }
  return toUser(row);
}

function startSession(db, userId) {
  const token = newSessionToken();
  db.prepare(
    'INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)'
  ).run(token, userId, nowIso(), sessionExpiry());
  return token;
}

/** LIKE 里的 % 和 _ 要转义，不然用户搜 "50%" 会把它们当通配符 */
function likePattern(text) {
  return `%${String(text).replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
}

function findVisibleActivity(db, id, user) {
  const row = db.prepare('SELECT * FROM activities WHERE id = ?').get(id);
  if (!row) return null;
  if (row.hidden && user?.role !== 'admin') return null;
  return row;
}

/* ---------------- 路由 ---------------- */

/**
 * @returns {Promise<boolean>} 是否已经处理了这个请求
 */
export async function handleApi(req, res, { db }) {
  const url = new URL(req.url, 'http://localhost');
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const method = req.method || 'GET';
  const user = currentUser(db, req);

  /* ---- 元信息：筛选下拉用的选项 ---- */
  if (path === '/api/meta' && method === 'GET') {
    const audiences = db
      .prepare('SELECT DISTINCT audience FROM activities WHERE hidden = 0 ORDER BY audience')
      .all()
      .map((row) => row.audience)
      .sort((a, b) => (a === '全校' ? -1 : b === '全校' ? 1 : a.localeCompare(b, 'zh-CN')));
    json(res, 200, {
      categories: CATEGORIES,
      publisherTypes: Object.entries(PUBLISHER_TYPES).map(([value, info]) => ({
        value,
        label: info.label,
      })),
      audiences,
    });
    return true;
  }

  /* ---- 认证 ---- */
  if (path === '/api/auth/register' && method === 'POST') {
    const body = await readJson(req);
    const account = String(body.account || '').trim();
    const password = String(body.password || '');
    const displayName = String(body.displayName || '').trim();
    const publisherType = String(body.publisherType || '').trim();
    const publisherName = String(body.publisherName || '').trim() || displayName;

    const errors = {};
    if (!/^[a-zA-Z0-9_]{4,20}$/.test(account)) errors.account = '登录名要 4–20 位字母、数字或下划线';
    if (password.length < 6) errors.password = '密码至少 6 位';
    if (!displayName) errors.displayName = '请填写显示名';
    if (displayName.length > 20) errors.displayName = '显示名最多 20 个字';
    if (!PUBLISHER_TYPES[publisherType]) errors.publisherType = '请选择发布者身份';
    if (publisherName.length > 30) errors.publisherName = '发布者名称最多 30 个字';
    if (Object.keys(errors).length) return json(res, 422, { error: '注册信息有误', errors }), true;

    const exists = db.prepare('SELECT id FROM users WHERE account = ?').get(account);
    if (exists) return json(res, 409, { error: '这个登录名已经被用了' }), true;

    const salt = makeSalt();
    const info = db
      .prepare(
        `INSERT INTO users (account, display_name, password_hash, salt, role, publisher_type, publisher_name, created_at)
         VALUES (?, ?, ?, ?, 'user', ?, ?, ?)`
      )
      .run(account, displayName, hashPassword(password, salt), salt, publisherType, publisherName, nowIso());

    const token = startSession(db, Number(info.lastInsertRowid));
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(info.lastInsertRowid));
    json(res, 201, { user: toUser(row) }, { 'Set-Cookie': sessionCookie(token) });
    return true;
  }

  if (path === '/api/auth/login' && method === 'POST') {
    const body = await readJson(req);
    const account = String(body.account || '').trim();
    const password = String(body.password || '');
    const row = db.prepare('SELECT * FROM users WHERE account = ?').get(account);
    if (!row || !verifyPassword(password, row.salt, row.password_hash)) {
      // 统一提示，不告诉对方"是账号不存在还是密码错"
      fail(res, 401, '账号或密码不对');
      return true;
    }
    const token = startSession(db, row.id);
    json(res, 200, { user: toUser(row) }, { 'Set-Cookie': sessionCookie(token) });
    return true;
  }

  if (path === '/api/auth/logout' && method === 'POST') {
    const token = readSessionToken(req);
    if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    json(res, 200, { ok: true }, { 'Set-Cookie': clearSessionCookie() });
    return true;
  }

  if (path === '/api/auth/me' && method === 'GET') {
    json(res, 200, { user });
    return true;
  }

  /* ---- 活动列表 ---- */
  if (path === '/api/activities' && method === 'GET') {
    const q = (url.searchParams.get('q') || '').trim();
    const category = (url.searchParams.get('category') || '').trim();
    const audience = (url.searchParams.get('audience') || '').trim();

    const where = [];
    const params = [];
    if (!user || user.role !== 'admin') where.push('hidden = 0');
    if (category) {
      where.push('category = ?');
      params.push(category);
    }
    if (audience) {
      where.push('audience = ?');
      params.push(audience);
    }
    if (q) {
      where.push("(title LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\' OR publisher_name LIKE ? ESCAPE '\\')");
      const like = likePattern(q);
      params.push(like, like, like);
    }

    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const rows = db
      .prepare(`SELECT * FROM activities ${clause} ORDER BY start_date ASC, title ASC LIMIT ?`)
      .all(...params, MAX_ACTIVITY_ROWS);

    json(res, 200, { items: rows.map((row) => toActivity(row, user)), total: rows.length });
    return true;
  }

  /* ---- 发布活动 ---- */
  if (path === '/api/activities' && method === 'POST') {
    if (!user) {
      fail(res, 401, '请先登录再发布活动');
      return true;
    }
    const body = await readJson(req);
    // 身份一律取登录账号的，不信前端传上来的
    const result = validateActivityForm({
      ...body,
      publisherType: user.publisherType,
      publisherName: user.publisherName,
    });
    if (!result.ok) {
      json(res, 422, { error: '表单校验没通过', errors: result.errors });
      return true;
    }

    const activity = buildActivityFromForm(result.values);
    const stamp = nowIso();
    db.prepare(
      `INSERT INTO activities
         (id, title, category, publisher_type, publisher_name, audience,
          start_date, end_date, signup_deadline, description, link,
          is_sample, hidden, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?)`
    ).run(
      activity.id,
      activity.title,
      activity.category,
      activity.publisherType,
      activity.publisherName,
      activity.audience,
      activity.startDate,
      activity.endDate,
      activity.signupDeadline,
      activity.description,
      activity.link,
      user.id,
      stamp,
      stamp
    );

    const row = db.prepare('SELECT * FROM activities WHERE id = ?').get(activity.id);
    json(res, 201, { activity: toActivity(row, user) });
    return true;
  }

  /* ---- 单个活动 ---- */
  const activityMatch = path.match(/^\/api\/activities\/([^/]+)$/);
  if (activityMatch) {
    const id = decodeURIComponent(activityMatch[1]);
    const row = findVisibleActivity(db, id, user);
    if (!row) {
      fail(res, 404, '活动不存在或已下架');
      return true;
    }

    if (method === 'GET') {
      json(res, 200, { activity: toActivity(row, user) });
      return true;
    }

    if (method === 'DELETE') {
      if (!user) return fail(res, 401, '请先登录'), true;
      if (!(user.role === 'admin' || row.created_by === user.id)) {
        fail(res, 403, '只能删除自己发布的活动');
        return true;
      }
      db.prepare('DELETE FROM activities WHERE id = ?').run(id);
      json(res, 200, { ok: true });
      return true;
    }
  }

  /* ---- 管理员：下架 / 恢复 ---- */
  const visibilityMatch = path.match(/^\/api\/activities\/([^/]+)\/visibility$/);
  if (visibilityMatch && method === 'POST') {
    if (!user || user.role !== 'admin') {
      fail(res, 403, '只有管理员能上下架活动');
      return true;
    }
    const id = decodeURIComponent(visibilityMatch[1]);
    const row = db.prepare('SELECT * FROM activities WHERE id = ?').get(id);
    if (!row) {
      fail(res, 404, '活动不存在');
      return true;
    }
    const body = await readJson(req);
    const hidden = body.hidden ? 1 : 0;
    db.prepare('UPDATE activities SET hidden = ?, updated_at = ? WHERE id = ?').run(hidden, nowIso(), id);
    const updated = db.prepare('SELECT * FROM activities WHERE id = ?').get(id);
    json(res, 200, { activity: toActivity(updated, user) });
    return true;
  }

  /* ---- 留言 ---- */
  const commentsMatch = path.match(/^\/api\/activities\/([^/]+)\/comments$/);
  if (commentsMatch) {
    const id = decodeURIComponent(commentsMatch[1]);
    const activity = findVisibleActivity(db, id, user);
    if (!activity) {
      fail(res, 404, '活动不存在或已下架');
      return true;
    }

    if (method === 'GET') {
      const rows = db
        .prepare('SELECT * FROM comments WHERE activity_id = ? ORDER BY created_at DESC')
        .all(id);
      json(res, 200, { items: rows.map(toComment), total: rows.length });
      return true;
    }

    if (method === 'POST') {
      const body = await readJson(req);
      const result = validateComment({ nickname: body.nickname, content: body.content });
      if (!result.ok) {
        json(res, 422, { error: '留言没发出去', errors: result.errors });
        return true;
      }
      const comment = buildComment(id, result.values);
      db.prepare(
        'INSERT INTO comments (id, activity_id, nickname, content, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(comment.id, id, comment.nickname, comment.content, user ? user.id : null, comment.createdAt);
      const row = db.prepare('SELECT * FROM comments WHERE id = ?').get(comment.id);
      json(res, 201, { comment: toComment(row) });
      return true;
    }
  }

  /* ---- 管理员：恢复示例数据 ---- */
  if (path === '/api/admin/reseed' && method === 'POST') {
    if (!user || user.role !== 'admin') {
      fail(res, 403, '只有管理员能恢复示例数据');
      return true;
    }
    resetSampleData(db);
    const row = db.prepare('SELECT COUNT(*) AS count FROM activities').get();
    json(res, 200, { ok: true, activities: Number(row.count) });
    return true;
  }

  fail(res, 404, `没有这个接口：${method} ${path}`);
  return true;
}
