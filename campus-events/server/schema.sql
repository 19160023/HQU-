-- 校园活动汇 · 数据库结构与初始数据
-- 引擎：SQLite（Node 内置 node:sqlite，零依赖）
-- 说明：字段一律用下划线命名，接口层再转成前端用的驼峰，避免前端直接依赖表结构。

PRAGMA foreign_keys = ON;

-- ---------- 用户 ----------
CREATE TABLE IF NOT EXISTS users (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  account        TEXT    NOT NULL UNIQUE,              -- 登录名
  display_name   TEXT    NOT NULL,                     -- 显示名（页头、留言默认昵称）
  password_hash  TEXT    NOT NULL,                     -- scrypt 派生值（十六进制）
  salt           TEXT    NOT NULL,                     -- 每个用户独立盐
  role           TEXT    NOT NULL DEFAULT 'user'
                         CHECK (role IN ('user', 'admin')),
  publisher_type TEXT    NOT NULL DEFAULT 'personal'
                         CHECK (publisher_type IN ('college', 'org', 'personal')),
  publisher_name TEXT    NOT NULL,                     -- 发布活动时默认填的发布者名称
  created_at     TEXT    NOT NULL
);

-- ---------- 会话 ----------
CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT    PRIMARY KEY,                      -- 随机 32 字节，存在 HttpOnly Cookie 里
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT    NOT NULL,
  expires_at TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- ---------- 活动 ----------
CREATE TABLE IF NOT EXISTS activities (
  id              TEXT    PRIMARY KEY,                 -- a_ 开头，前端直接用
  title           TEXT    NOT NULL,
  category        TEXT    NOT NULL,
  publisher_type  TEXT    NOT NULL
                          CHECK (publisher_type IN ('college', 'org', 'personal')),
  publisher_name  TEXT    NOT NULL,
  audience        TEXT    NOT NULL,                    -- "全校" 或具体学院/年级
  start_date      TEXT    NOT NULL,                    -- YYYY-MM-DD
  end_date        TEXT    NOT NULL,
  signup_deadline TEXT    NOT NULL,
  description     TEXT    NOT NULL,
  link            TEXT    NOT NULL DEFAULT '',
  is_sample       INTEGER NOT NULL DEFAULT 0 CHECK (is_sample IN (0, 1)),
  hidden          INTEGER NOT NULL DEFAULT 0 CHECK (hidden IN (0, 1)),  -- 管理员下架
  created_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at      TEXT    NOT NULL,
  updated_at      TEXT    NOT NULL,

  -- 把"结束不早于开始""报名截止不晚于结束"也写进数据库，接口层再校验一次
  CHECK (end_date >= start_date),
  CHECK (signup_deadline <= end_date)
);

CREATE INDEX IF NOT EXISTS idx_activities_start    ON activities(start_date);
CREATE INDEX IF NOT EXISTS idx_activities_category ON activities(category);
CREATE INDEX IF NOT EXISTS idx_activities_audience ON activities(audience);
CREATE INDEX IF NOT EXISTS idx_activities_hidden   ON activities(hidden);

-- ---------- 留言 ----------
CREATE TABLE IF NOT EXISTS comments (
  id          TEXT    PRIMARY KEY,
  activity_id TEXT    NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  nickname    TEXT    NOT NULL,
  content     TEXT    NOT NULL,
  created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at  TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_comments_activity ON comments(activity_id, created_at DESC);
