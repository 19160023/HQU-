/**
 * util.js — 与业务无关的小工具
 */

/** 把字符串转义后再插进 HTML，避免内容里的 < > & 把结构破坏掉 */
export function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** document.querySelector 的简写 */
export function qs(selector, scope = document) {
  return scope.querySelector(selector);
}

/** 读取地址栏参数 */
export function param(name) {
  return new URLSearchParams(location.search).get(name);
}
