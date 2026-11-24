/**
 * site.js — 所有页面共用：页头用户区、退出登录、管理员恢复示例数据
 */
import { api, getMe, logout, reseed } from './api.js';

// 任何未捕获的脚本错误都直接在页面顶部显示出来。
// 没有这条，出一处错就是"白屏 + 点了没反应"，很难查。
window.addEventListener('error', (event) => reportFatal(event.error || event.message));
window.addEventListener('unhandledrejection', (event) => reportFatal(event.reason));

const PUBLISHER_LABEL = { college: '学院', org: '学生组织', personal: '个人' };

let currentUser = null;

/** 拉一次当前用户并缓存，页面里其他地方直接 getCurrentUser() 取 */
export async function loadCurrentUser() {
  currentUser = await getMe();
  return currentUser;
}

export function getCurrentUser() {
  return currentUser;
}

export async function setupSiteChrome() {
  await loadCurrentUser();
  renderUserArea();
  wireFooterReset();
}

function renderUserArea() {
  const box = document.getElementById('user-area');
  if (!box) return;

  if (!currentUser) {
    box.innerHTML = '<a class="btn-login" href="login.html">登录 / 注册</a>';
    return;
  }

  const roleLabel = currentUser.role === 'admin' ? '管理员' : PUBLISHER_LABEL[currentUser.publisherType] || '用户';
  box.innerHTML = `
    <span class="user-name" title="${currentUser.account}">${escapeText(currentUser.displayName)}</span>
    <span class="user-role">${roleLabel}</span>
    <button type="button" class="link-btn" data-action="logout">退出</button>
  `;

  box.querySelector('[data-action="logout"]').addEventListener('click', async () => {
    await logout().catch(() => {});
    location.href = 'index.html';
  });
}

function wireFooterReset() {
  const button = document.querySelector('[data-action="reset-store"]');
  if (!button) return;

  // 恢复示例数据现在是数据库操作，只给管理员用
  if (currentUser?.role !== 'admin') {
    button.remove();
    return;
  }

  button.addEventListener('click', async () => {
    const ok = window.confirm('会把数据库里的活动和留言清空，重新灌入示例数据。账号会保留。确定吗？');
    if (!ok) return;
    try {
      await reseed();
      location.href = 'index.html?restored=1';
    } catch (error) {
      window.alert(error.message || '恢复失败');
    }
  });
}

function escapeText(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function reportFatal(error) {
  console.error('[页面脚本出错]', error);
  if (!document.body) return;
  const message = error && error.message ? error.message : String(error || '未知错误');
  let box = document.getElementById('fatal-error');
  if (!box) {
    box = document.createElement('div');
    box.id = 'fatal-error';
    box.className = 'alert alert--error';
    box.setAttribute('role', 'alert');
    box.style.maxWidth = '1080px';
    box.style.margin = '16px auto';
    document.body.insertBefore(box, document.body.firstChild);
  }
  box.textContent = `页面脚本出错了：${message}。把这段文字截图发给我就能定位。`;
}

/** 有些页面需要在用户登录态变化后重画，暴露出去 */
export function refreshUserArea() {
  renderUserArea();
}
