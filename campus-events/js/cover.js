/**
 * cover.js — 封面页
 * 只做两件事：决定「进入」按钮往哪去、支持按回车进入。
 * 按钮本身是 <a href>，即使脚本没加载也能点（只是会去登录页）。
 */
import { getMe } from './api.js';

/** 纯函数，方便单测：登录过就直接进列表，没登录先去登录页 */
export function entryDestination(user) {
  return user ? 'index.html' : 'login.html?next=index.html';
}

const enter = typeof document === 'undefined' ? null : document.getElementById('cover-enter');
const tip = typeof document === 'undefined' ? null : document.getElementById('cover-tip');

if (enter) {
  getMe()
    .then((user) => {
      enter.href = entryDestination(user);
      if (tip) tip.textContent = user ? '已登录，直接进入活动列表' : '点上面的按钮，或直接按回车';
    })
    .catch(() => {
      /* 连不上服务就保持默认跳转，登录页会给提示 */
    });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    if (event.defaultPrevented) return;
    event.preventDefault();
    enter.click();
  });
}
