/**
 * auth.mjs — 密码与会话
 * 只用 Node 内置 crypto：不引第三方库，也不自己造密码学。
 */
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const KEY_LEN = 64;
const SESSION_DAYS = 7;

export function makeSalt() {
  return randomBytes(16).toString('hex');
}

/** scrypt 派生，返回十六进制串 */
export function hashPassword(password, salt) {
  return scryptSync(password, salt, KEY_LEN).toString('hex');
}

/** 定长比较，避免通过响应时间猜密码 */
export function verifyPassword(password, salt, expectedHash) {
  const candidate = Buffer.from(hashPassword(password, salt), 'hex');
  const expected = Buffer.from(String(expectedHash), 'hex');
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}

export function newSessionToken() {
  return randomBytes(32).toString('hex');
}

export function sessionExpiry(now = Date.now()) {
  return new Date(now + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

/** 从 Cookie 头里取会话 token */
export function readSessionToken(req) {
  const header = req.headers.cookie || '';
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === 'sid') return decodeURIComponent(rest.join('='));
  }
  return null;
}

/** 生成 Set-Cookie 头 */
export function sessionCookie(token, maxAgeDays = SESSION_DAYS) {
  const maxAge = maxAgeDays * 24 * 60 * 60;
  return `sid=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}

export function clearSessionCookie() {
  return 'sid=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0';
}
