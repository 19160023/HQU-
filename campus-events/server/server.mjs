/**
 * server.mjs — HTTP 服务：/api/* 交给 api.mjs，其余按静态文件返回
 *
 * 为什么静态资源和接口放在同一个进程：
 *   本机演示时省掉跨端口 CORS 和 Cookie 的麻烦。接口本身是完全独立的 JSON API，
 *   可以用 curl / Postman 单独调用（见 docs/接口说明.md）。
 */
import http from 'node:http';
import { createReadStream } from 'node:fs';
import { mkdirSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const DEFAULT_DB = path.join(ROOT, 'data', 'campus-events.db');
const DEFAULT_PORT = Number(process.env.PORT || 8080);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
};

/** 这些目录不对外提供静态访问（源码和数据库文件没必要暴露） */
const BLOCKED_PREFIXES = ['/server/', '/data/', '/tests/', '/node_modules/'];

function isBlocked(urlPath) {
  return BLOCKED_PREFIXES.some((prefix) => urlPath.startsWith(prefix));
}

async function serveStatic(req, res) {
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  if (isBlocked(urlPath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 找不到文件');
    return;
  }

  const relative = path.normalize(urlPath).replace(/^([/\\]|\.\.)+/, '');
  // 根路径给封面页，活动列表在 /index.html
  const target = path.join(ROOT, relative || 'cover.html');
  if (!target.startsWith(ROOT)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('403 越界访问');
    return;
  }

  let info = await stat(target).catch(() => null);
  let filePath = target;
  if (info && info.isDirectory()) {
    filePath = path.join(target, 'index.html');
    info = await stat(filePath).catch(() => null);
  }
  if (!info || !info.isFile()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(`404 找不到：${urlPath}`);
    return;
  }

  res.writeHead(200, {
    'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
    'Cache-Control': 'no-cache',
  });
  createReadStream(filePath).pipe(res);
}

/** 内置 node:sqlite 需要 Node 22.5+，先检查再加载数据库模块，好给出人话提示 */
export function assertNodeVersion() {
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (major < 22 || (major === 22 && minor < 5)) {
    throw new Error(
      `需要 Node.js 22.5 及以上（用到内置的 node:sqlite），当前是 ${process.versions.node}。`
    );
  }
}

/**
 * 建一个应用实例（便于测试里直接 import 起服务）
 * @returns {Promise<{ server: http.Server, db: object, seeded: boolean }>}
 */
export async function createApp({ dbPath = DEFAULT_DB } = {}) {
  assertNodeVersion();
  const { openDb, seedIfEmpty } = await import('./db.mjs');
  const { handleApi } = await import('./api.mjs');

  if (dbPath !== ':memory:') mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = openDb(dbPath);
  const seeded = seedIfEmpty(db);

  const server = http.createServer((req, res) => {
    const pathname = (req.url || '/').split('?')[0];
    const task = pathname.startsWith('/api/') ? handleApi(req, res, { db }) : serveStatic(req, res);

    Promise.resolve(task).catch((err) => {
      if (res.headersSent) return;
      const status = err?.status || 500;
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: err?.status ? err.message : '服务器内部错误' }));
      if (!err?.status) console.error('[500]', err);
    });
  });

  return { server, db, seeded };
}

export async function startServer({ port = DEFAULT_PORT, dbPath = DEFAULT_DB } = {}) {
  const app = await createApp({ dbPath });
  app.server.listen(port, () => {
    const actual = app.server.address().port;
    console.log(`校园活动汇已启动： http://localhost:${actual}`);
    if (app.seeded) {
      console.log('数据库是新建的，已灌入示例数据。');
    }
    import('./db.mjs').then(({ DEMO_ACCOUNTS }) => {
      console.log('演示账号：');
      for (const demo of DEMO_ACCOUNTS) {
        console.log(
          `  ${demo.account.padEnd(10)} / ${demo.password.padEnd(12)} ${demo.role === 'admin' ? '（管理员）' : ''}`
        );
      }
    });
    console.log('按 Ctrl+C 停止。');
  });
  return app;
}

const isMain = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  const port = Number(process.argv[2] || process.env.PORT || DEFAULT_PORT);
  try {
    const { server, db } = await startServer({ port });
    const shutdown = () => {
      server.close();
      try {
        db.close();
      } catch {
        /* 忽略关闭错误 */
      }
      process.exit(0);
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (error) {
    console.error('启动失败：' + error.message);
    process.exit(1);
  }
}
