/**
 * db.mjs — 打开数据库、建表、灌初始数据
 * 用 Node 24 内置的 node:sqlite，不需要安装任何依赖。
 */
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { buildSeed, buildSeedComments } from '../js/seed.js';
import { hashPassword, makeSalt } from './auth.mjs';

const SCHEMA_SQL = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');

export function nowIso() {
  return new Date().toISOString();
}

/**
 * 演示账号。仅用于本地演示，正式使用请改密码或删掉。
 * 第一个是管理员，其余三个分别对应学院 / 学生组织 / 个人三种发布者身份。
 */
export const DEMO_ACCOUNTS = [
  {
    account: 'admin',
    password: 'admin2026',
    displayName: '管理员',
    role: 'admin',
    publisherType: 'college',
    publisherName: '桑梓实验室',
  },
  {
    account: 'college01',
    password: 'college2026',
    displayName: '计算机学院教务',
    role: 'user',
    publisherType: 'college',
    publisherName: '计算机学院',
  },
  {
    account: 'org01',
    password: 'org2026',
    displayName: '摄影协会',
    role: 'user',
    publisherType: 'org',
    publisherName: '摄影协会',
  },
  {
    account: 'student01',
    password: 'student2026',
    displayName: '李思远',
    role: 'user',
    publisherType: 'personal',
    publisherName: '李思远（数学学院 2023 级）',
  },
];

/** 打开（或新建）数据库，并保证表结构存在 */
export function openDb(dbPath) {
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA foreign_keys = ON');
  if (dbPath !== ':memory:') {
    db.exec('PRAGMA journal_mode = WAL');
  }
  db.exec(SCHEMA_SQL);
  return db;
}

/** 空库时灌入示例数据。返回是否真的灌了 */
export function seedIfEmpty(db) {
  const row = db.prepare('SELECT COUNT(*) AS count FROM activities').get();
  if (Number(row.count) > 0) return false;
  insertDemoUsers(db);
  insertSampleData(db);
  return true;
}

/** 管理员点"恢复示例数据"时用：清掉活动和留言，重新灌一遍，但保留用户账号与登录状态 */
export function resetSampleData(db) {
  db.exec('DELETE FROM activities'); // 留言由外键 ON DELETE CASCADE 一并清掉
  insertSampleData(db);
}

function insertDemoUsers(db) {
  const insert = db.prepare(
    `INSERT INTO users (account, display_name, password_hash, salt, role, publisher_type, publisher_name, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  for (const demo of DEMO_ACCOUNTS) {
    const salt = makeSalt();
    insert.run(
      demo.account,
      demo.displayName,
      hashPassword(demo.password, salt),
      salt,
      demo.role,
      demo.publisherType,
      demo.publisherName,
      nowIso()
    );
  }
}

function insertSampleData(db) {
  const insertActivity = db.prepare(
    `INSERT INTO activities
       (id, title, category, publisher_type, publisher_name, audience,
        start_date, end_date, signup_deadline, description, link,
        is_sample, hidden, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, ?, ?)`
  );

  for (const item of buildSeed()) {
    insertActivity.run(
      item.id,
      item.title,
      item.category,
      item.publisherType,
      item.publisherName,
      item.audience,
      item.startDate,
      item.endDate,
      item.signupDeadline,
      item.description,
      item.link || '',
      1,
      item.createdAt,
      item.createdAt
    );
  }

  const insertComment = db.prepare(
    `INSERT INTO comments (id, activity_id, nickname, content, created_by, created_at)
     VALUES (?, ?, ?, ?, NULL, ?)`
  );

  for (const comment of buildSeedComments()) {
    insertComment.run(comment.id, comment.activityId, comment.nickname, comment.content, comment.createdAt);
  }
}
