/**
 * ui-auth.js — 登录 / 注册页
 */
import { PUBLISHER_TYPES } from './core.js';
import { login, register } from './api.js';
import { escapeHtml, param } from './util.js';
import { getCurrentUser, setupSiteChrome } from './site.js';

await setupSiteChrome();

const currentUser = getCurrentUser();
const next = param('next') || 'index.html';
const alertEl = document.getElementById('auth-alert');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const tabs = document.querySelectorAll('[data-tab]');

tabs.forEach((tab) => {
  tab.addEventListener('click', () => switchTab(tab.dataset.tab));
});

switchTab(param('tab') === 'register' ? 'register' : 'login');
if (currentUser) {
  showLoggedIn(currentUser);
} else if (param('next')) {
  showHint('登录后会回到你刚才要去的页面。');
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const account = loginForm.elements.account.value.trim();
  const password = loginForm.elements.password.value;

  if (!account || !password) {
    showError('登录名和密码都要填');
    return;
  }

  setBusy(loginForm, true);
  try {
    await login(account, password);
    location.href = next;
  } catch (error) {
    showError(error.message || '登录失败');
  } finally {
    setBusy(loginForm, false);
  }
});

registerForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(registerForm).entries());

  setBusy(registerForm, true);
  try {
    await register({
      account: String(data.account || '').trim(),
      password: String(data.password || ''),
      displayName: String(data.displayName || '').trim(),
      publisherType: String(data.publisherType || ''),
      publisherName: String(data.publisherName || '').trim(),
    });
    location.href = next;
  } catch (error) {
    const first = error.payload?.errors;
    if (first) {
      showError(Object.values(first).join('；'));
    } else {
      showError(error.message || '注册失败');
    }
  } finally {
    setBusy(registerForm, false);
  }
});

/** 注册表单里的三种身份选项由 core.js 生成，避免和别处写死的不一致 */
const radioBox = document.getElementById('publisher-type-options');
if (radioBox) {
  radioBox.innerHTML = Object.entries(PUBLISHER_TYPES)
    .map(
      ([value, info]) =>
        `<label class="radio"><input type="radio" name="publisherType" value="${value}"${value === 'personal' ? ' checked' : ''} required><span>${escapeHtml(info.label)}</span></label>`
    )
    .join('');
}

function switchTab(name) {
  const isRegister = name === 'register';
  tabs.forEach((tab) => tab.classList.toggle('is-active', tab.dataset.tab === name));
  loginForm.hidden = isRegister;
  registerForm.hidden = !isRegister;
  clearAlert();
}

function showError(message) {
  alertEl.innerHTML = `<div class="alert alert--error" role="alert">${escapeHtml(message)}</div>`;
}

function showHint(message) {
  alertEl.innerHTML = `<div class="alert alert--info" role="status">${escapeHtml(message)}</div>`;
}

/** 已经登录过的人（比如从封面点进来）不用再登一次 */
function showLoggedIn(user) {
  alertEl.innerHTML = `
    <div class="alert alert--info" role="status">
      你已经登录为「${escapeHtml(user.displayName)}」。<a href="${escapeHtml(next)}">继续进入 →</a>
    </div>`;
}

function clearAlert() {
  alertEl.innerHTML = '';
}

function setBusy(form, busy) {
  const button = form.querySelector('button[type="submit"]');
  if (!button) return;
  button.disabled = busy;
  button.textContent = busy ? '请稍等…' : button.dataset.label || button.textContent;
}

document.querySelectorAll('button[type="submit"]').forEach((button) => {
  button.dataset.label = button.textContent;
});
