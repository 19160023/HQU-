/**
 * ui-detail.js — 详情页 + 评论区 + 作者/管理员的删除与下架
 */
import {
  activityDetailHtml,
  commentsListHtml,
  commentsShellHtml,
  missingActivityHtml,
} from './templates.js';
import { validateComment } from './validation.js';
import { escapeHtml, param } from './util.js';
import {
  deleteActivity,
  fetchActivity,
  fetchComments,
  postComment,
  setVisibility,
} from './api.js';
import { getCurrentUser, setupSiteChrome } from './site.js';

const detailRoot = document.getElementById('detail-root');
const commentsRoot = document.getElementById('comments-root');
const id = param('id');
const justCreated = param('created') === '1';

await setupSiteChrome();
const user = getCurrentUser();

let activity = null;
try {
  activity = (await fetchActivity(id)).activity;
} catch (error) {
  detailRoot.innerHTML =
    error.status === 404 ? missingActivityHtml() : connectionErrorHtml(error.message);
  document.title = '活动不存在 · 校园活动汇';
}

if (activity) {
  document.title = `${activity.title} · 校园活动汇`;
  detailRoot.innerHTML = activityDetailHtml(activity, {
    justCreated,
    isAdmin: user?.role === 'admin',
    canManage: activity.canManage,
  });
  bindActions(activity);

  const comments = await fetchComments(id)
    .then((data) => data.items)
    .catch(() => []);

  commentsRoot.innerHTML = commentsShellHtml(comments, { defaultNickname: user?.displayName || '' });
  bindCommentForm(activity);
}

/* ---------------- 删除 / 下架 ---------------- */

function bindActions(activity) {
  const deleteBtn = detailRoot.querySelector('[data-action="delete-activity"]');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', async () => {
      const ok = window.confirm(`确定删除「${activity.title}」吗？它下面的留言也会一起删掉，且不能恢复。`);
      if (!ok) return;
      deleteBtn.disabled = true;
      try {
        await deleteActivity(activity.id);
        location.href = 'index.html?deleted=1';
      } catch (error) {
        deleteBtn.disabled = false;
        window.alert(error.message || '删除失败');
      }
    });
  }

  const hideBtn = detailRoot.querySelector('[data-action="toggle-visibility"]');
  if (hideBtn) {
    hideBtn.addEventListener('click', async () => {
      hideBtn.disabled = true;
      try {
        await setVisibility(activity.id, !activity.hidden);
        location.reload();
      } catch (error) {
        hideBtn.disabled = false;
        window.alert(error.message || '操作失败');
      }
    });
  }
}

/* ---------------- 留言 ---------------- */

function bindCommentForm(activity) {
  const form = document.getElementById('comment-form');
  const listEl = document.getElementById('comment-list');
  const countEl = document.getElementById('comment-count');
  const statusEl = document.getElementById('comment-status');
  const errorEl = form.querySelector('[data-comment-error]');
  const contentEl = form.elements.content;
  const nicknameEl = form.elements.nickname;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const checked = validateComment({ nickname: nicknameEl.value, content: contentEl.value });
    errorEl.textContent = '';
    statusEl.textContent = '';

    if (!checked.ok) {
      errorEl.textContent = checked.errors.content || checked.errors.nickname || '内容填写有误';
      contentEl.focus();
      return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;

    try {
      const { comment } = await postComment(activity.id, {
        nickname: nicknameEl.value,
        content: contentEl.value,
      });

      const items = await fetchComments(activity.id).then((data) => data.items);
      listEl.innerHTML = commentsListHtml(items, { highlightId: comment.id });
      countEl.textContent = `${items.length} 条`;
      contentEl.value = '';
      statusEl.textContent = '留言已发表';
      contentEl.focus();
    } catch (error) {
      if (error.status === 404) {
        errorEl.textContent = '这条活动已经不能留言了（可能被下架或删除）。';
      } else if (error.payload?.errors?.content) {
        errorEl.textContent = error.payload.errors.content;
      } else {
        errorEl.textContent = error.message || '留言没发出去，稍后再试。';
      }
    } finally {
      submitBtn.disabled = false;
    }
  });
}

/* ---------------- 连不上服务器 ---------------- */

function connectionErrorHtml(message) {
  return `
    <a class="back" href="index.html">← 返回活动列表</a>
    <div class="empty">
      <h1>没连上服务器</h1>
      <p>${escapeHtml(message)}。确认本地服务还在运行，然后刷新页面。</p>
      <a class="btn" href="index.html">回到活动列表</a>
    </div>`;
}
