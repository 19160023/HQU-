/**
 * ui-publish.js — 发布页
 * 发布需要登录：发布者身份由账号带入，前端不能伪造。
 * 前端先校验一遍拿即时反馈，后端会用同一套规则再校验一次（以服务端为准）。
 */
import { PUBLISHER_TYPES } from './core.js';
import { firstErrorField, validateActivityForm } from './validation.js';
import { createActivity } from './api.js';
import { escapeHtml } from './util.js';
import { getCurrentUser, setupSiteChrome } from './site.js';

await setupSiteChrome();
const user = getCurrentUser();

const form = document.getElementById('publish-form');
const statusEl = document.getElementById('form-status');
const gateEl = document.getElementById('login-gate');
const identityEl = document.getElementById('publisher-identity');
const scopeEl = form.elements.audienceScope;
const detailEl = form.elements.audienceDetail;
const audienceHint = document.getElementById('audience-hint');

if (!user) {
  showLoginGate();
} else {
  gateEl.hidden = true;
  form.hidden = false;
  renderIdentity(user);
  syncAudience();
  bindForm();
  form.addEventListener('change', (event) => {
    if (event.target.name === 'audienceScope') syncAudience();
  });
}

/* ---------------- 未登录 ---------------- */

function showLoginGate() {
  form.hidden = true;
  gateEl.hidden = false;
  gateEl.innerHTML = `
    <div class="empty">
      <h2>登录后才能发布活动</h2>
      <p>发布者身份由账号决定，这样别人就没法冒充学院或学生组织发活动。</p>
      <a class="btn" href="login.html?next=publish.html">去登录 / 注册</a>
    </div>`;
}

/* ---------------- 已登录 ---------------- */

function renderIdentity(me) {
  const info = PUBLISHER_TYPES[me.publisherType] || { label: '个人', tone: 'personal' };
  identityEl.innerHTML = `
    <span class="chip chip--pub chip--${info.tone}">${info.label}</span>
    <span class="identity-name">${escapeHtml(me.publisherName)}</span>
    <span class="identity-account">来自账号 ${escapeHtml(me.account)}</span>
  `;
}

function syncAudience() {
  const isCollege = scopeEl.value === 'college';
  detailEl.hidden = !isCollege;
  const row = detailEl.closest('.form-row');
  if (row) row.classList.toggle('is-single', !isCollege);
  audienceHint.textContent = isCollege
    ? '填学院名或年级，例如「计算机学院」「2025 级」。'
    : '所有同学都能看到。';
}

function bindForm() {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const raw = {};
    for (const [key, value] of new FormData(form).entries()) raw[key] = value;

    // 前端校验（身份用账号的，跟后端保持一致）
    const checked = validateActivityForm({
      ...raw,
      publisherType: user.publisherType,
      publisherName: user.publisherName,
    });
    clearErrors();
    if (!checked.ok) {
      showErrors(checked.errors);
      return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = '发布中…';

    try {
      // 注意：这里不传 publisherType / publisherName，后端会用登录账号的身份覆盖
      const { activity } = await createActivity(raw);
      location.href = `detail.html?id=${encodeURIComponent(activity.id)}&created=1`;
    } catch (error) {
      if (error.status === 401) {
        location.href = 'login.html?next=publish.html';
        return;
      }
      if (error.status === 422 && error.payload?.errors) {
        showErrors(error.payload.errors);
        statusEl.innerHTML =
          '<div class="alert alert--error" role="alert">服务器校验没通过，已经标在下面的字段上。</div>';
        return;
      }
      statusEl.innerHTML = `<div class="alert alert--error" role="alert">${escapeHtml(error.message)}</div>`;
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = '发布活动';
    }
  });

  form.addEventListener('input', (event) => {
    const field = event.target.closest('.field');
    if (!field) return;
    field.classList.remove('has-error');
    const message = field.querySelector('.field-error');
    if (message) message.textContent = '';
    if (!form.querySelector('.field.has-error')) statusEl.innerHTML = '';
  });
}

function showErrors(errors) {
  const names = Object.keys(errors);

  for (const name of names) {
    const field = form.querySelector(`[data-field="${name}"]`);
    if (!field) continue;
    field.classList.add('has-error');
    const message = field.querySelector('.field-error');
    if (message) message.textContent = errors[name];
  }

  statusEl.innerHTML = `<div class="alert alert--error" role="alert">还有 ${names.length} 处需要修改，已经标在下面对应的字段上。</div>`;

  const first = firstErrorField(errors);
  const target = first ? form.querySelector(`[data-field="${first}"]`) : null;
  if (!target) return;
  target.scrollIntoView({ block: 'center', behavior: 'smooth' });
  const control = target.querySelector('input, select, textarea');
  if (control) control.focus({ preventScroll: true });
}

function clearErrors() {
  statusEl.innerHTML = '';
  form.querySelectorAll('.field.has-error').forEach((field) => {
    field.classList.remove('has-error');
    const message = field.querySelector('.field-error');
    if (message) message.textContent = '';
  });
}
