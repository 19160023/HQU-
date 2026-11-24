/**
 * comments.mjs — 评论功能自测
 * 用法：node tests/comments.mjs
 */
import { buildComment, validateComment } from '../js/validation.js';
import {
  commentItemHtml,
  commentsListHtml,
  commentsShellHtml,
} from '../js/templates.js';
import { formatDateTime } from '../js/core.js';

let pass = 0;
let fail = 0;

function check(name, condition, detail = '') {
  if (condition) {
    pass += 1;
    console.log(`  ✅ ${name}`);
  } else {
    fail += 1;
    console.log(`  ❌ ${name}${detail ? `  → ${detail}` : ''}`);
  }
}

console.log('\n[1] 内容不能为空');
const emptyContent = validateComment({ nickname: '', content: '' });
check('空内容不通过', emptyContent.ok === false);
check('提示挂在 content 上', Boolean(emptyContent.errors.content), JSON.stringify(emptyContent.errors));
check('提示文案是给人看的', emptyContent.errors.content === '说点什么再发表吧');

const spaces = validateComment({ nickname: '小明', content: '    ' });
check('只填空格也不通过', spaces.ok === false);

const ok = validateComment({ nickname: '小明', content: '报名要带学生证' });
check('正常内容通过', ok.ok === true, JSON.stringify(ok.errors));

console.log('\n[2] 昵称留空的处理');
const noNick = validateComment({ nickname: '', content: '第一条' });
check('昵称留空也能通过', noNick.ok === true);
check('留空时补默认昵称', noNick.values.nickname === '匿名同学', noNick.values.nickname);
const blankNick = validateComment({ nickname: '   ', content: '第一条' });
check('昵称只有空格也补默认值', blankNick.values.nickname === '匿名同学');
const spacedNick = validateComment({ nickname: '  小明  ', content: '第一条' });
check('昵称去掉首尾空格', spacedNick.values.nickname === '小明', `"${spacedNick.values.nickname}"`);

console.log('\n[3] 长度上限');
const longContent = validateComment({ content: '啊'.repeat(501) });
check('超过 500 字被拦住', longContent.ok === false);
check('刚好 500 字放行', validateComment({ content: '啊'.repeat(500) }).ok === true);
check('昵称超过 20 字被拦住', validateComment({ nickname: '名'.repeat(21), content: 'x' }).ok === false);

console.log('\n[4] 组装成评论记录');
const built = buildComment('a01', noNick.values, { now: 1764000000000, random: () => 0.5 });
check('id 以 c_ 开头', built.id.startsWith('c_'), built.id);
check('挂在正确的活动下', built.activityId === 'a01');
check('createdAt 是 ISO 字符串', /^\d{4}-\d{2}-\d{2}T/.test(built.createdAt), built.createdAt);
check('两次生成 id 不同', buildComment('a01', noNick.values).id !== buildComment('a01', noNick.values).id);

console.log('\n[5] 时间显示');
check('同一年只显示月日', /^\d{1,2}月\d{1,2}日 \d{2}:\d{2}$/.test(formatDateTime(new Date().toISOString())), formatDateTime(new Date().toISOString()));
check('非法时间返回空串', formatDateTime('not-a-date') === '');

console.log('\n[6] 评论列表渲染');
const sample = [
  { id: 'c1', nickname: '匿名同学', content: '第一行\n第二行', createdAt: '2026-11-23T12:30:00.000Z' },
  { id: 'c2', nickname: '小明', content: '简单一句', createdAt: '2026-11-23T10:00:00.000Z' },
];
const listHtml = commentsListHtml(sample);
check('昵称渲染出来了', listHtml.includes('匿名同学') && listHtml.includes('小明'));
check('时间渲染出来了', listHtml.includes(formatDateTime(sample[0].createdAt)));
check('内容渲染出来了', listHtml.includes('简单一句'));
check('换行变成 <br>', listHtml.includes('第一行<br>第二行'));
check('两条评论都在', (listHtml.match(/class="comment"/g) || []).length === 2);
check('默认不高亮', !listHtml.includes('is-new'));

const highlighted = commentsListHtml(sample, { highlightFirst: true });
check('发表后只高亮第一条', (highlighted.match(/is-new/g) || []).length === 1);

console.log('\n[7] 空列表与转义');
check('没有评论时给引导语', commentsListHtml([]).includes('还没有人留言'));
const evil = commentItemHtml({ nickname: '<b>坏人</b>', content: '<script>alert(1)</script>', createdAt: '2026-11-23T12:00:00.000Z' });
check('昵称里的标签被转义', !evil.includes('<b>坏人</b>') && evil.includes('&lt;b&gt;'));
check('内容里的脚本被转义', !evil.includes('<script>') && evil.includes('&lt;script&gt;'));

console.log('\n[8] 评论区外壳');
const shell = commentsShellHtml(sample);
check('有标题', shell.includes('留言与注意事项'));
check('有条数', shell.includes('2 条'));
check('有昵称输入框', shell.includes('name="nickname"'));
check('有内容输入框', shell.includes('name="content"'));
check('内容框限 500 字', shell.includes('maxlength="500"'));
check('有发表按钮', shell.includes('发表留言'));
check('有 aria-live 状态区', shell.includes('role="status"'));

console.log(`\n结果：${pass} 项通过，${fail} 项失败\n`);
process.exit(fail === 0 ? 0 : 1);
