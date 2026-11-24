/**
 * seed.js — 示例数据
 * 全部为虚构内容，日期按"今天"相对计算，这样任何时候打开都对得上。
 */
import { addDays, todayISO } from './core.js';

const BASE = todayISO();
/** 相对今天偏移 n 天的日期 */
const d = (n) => addDays(BASE, n);

/**
 * 挑这些例子是为了覆盖各种边界：
 * 10 天超长活动、8 天集训、5 天志愿、3 天外拍、2 天连演、单日活动、
 * 跨今天的进行中活动、报名已截止但活动未开始、活动已结束。
 */
const RAW = [
  {
    title: '第十九届"挑战杯"校内选拔赛',
    category: '学科竞赛',
    publisherType: 'college',
    publisherName: '计算机学院',
    audience: '全校',
    startDate: d(7), endDate: d(16), signupDeadline: d(2),
    description:
      '面向全校本科与研究生学生的课外学术科技作品选拔，分自然科学、科技发明、哲学社科三类。校内初评通过后进入省赛培育环节，学院会配指导老师。\n\n报名需要提交作品摘要（500 字内）与团队成员信息，完整材料清单见下方链接。',
    link: 'https://example.com/challenge-cup',
  },
  {
    title: '大模型与智能体：人工智能前沿讲座',
    category: '讲座报告',
    publisherType: 'college',
    publisherName: '计算机学院',
    audience: '全校',
    startDate: d(0), endDate: d(0), signupDeadline: d(0),
    description:
      '邀请校外研究员讲大模型在校园场景里的落地经验，以及智能体编排的基本思路，含 20 分钟自由问答。\n\n无需报名，直接到第一报告厅入座，座位先到先得。',
    link: '',
  },
  {
    title: '2026 冬季校园马拉松',
    category: '其他',
    publisherType: 'org',
    publisherName: '校学生会体育部',
    audience: '全校',
    startDate: d(3), endDate: d(3), signupDeadline: d(-2),
    description:
      '5 公里健康跑，起点在体育场东门，完赛发放纪念奖牌与补给包。\n\n报名已截止。已报名的同学凭短信通知在起点领取号码布，建议提前 30 分钟到场热身。',
    link: '',
  },
  {
    title: '摄影协会秋季外拍：老街光影',
    category: '社团活动',
    publisherType: 'org',
    publisherName: '摄影协会',
    audience: '全校',
    startDate: d(2), endDate: d(4), signupDeadline: d(1),
    description:
      '三天两夜外拍采风，路线覆盖老城区三处历史街区，协会提供基础器材借用与后期指导。\n\n需自备相机或手机，交通与住宿费用 AA。行前会上会讲安全须知与拍摄主题。',
    link: 'https://example.com/photo-trip',
  },
  {
    title: '数学建模竞赛经验分享会',
    category: '讲座报告',
    publisherType: 'personal',
    publisherName: '李思远（数学学院 2023 级）',
    audience: '全校',
    startDate: d(6), endDate: d(6), signupDeadline: d(6),
    description:
      '国赛一等奖得主复盘选题、建模与论文写作的节奏安排，现场带一份获奖论文逐段讲解，重点讲三人分工怎么配合。\n\n教室容量有限，今天截止报名，报名后会收到教室号。',
    link: '',
  },
  {
    title: '"芯火"电子设计竞赛校内赛',
    category: '学科竞赛',
    publisherType: 'college',
    publisherName: '电子工程学院',
    audience: '电子工程学院',
    startDate: d(10), endDate: d(12), signupDeadline: d(5),
    description:
      '三人一组，题目现场公布，48 小时内完成硬件搭建、调试与测试报告，评审看功能完成度与报告规范。\n\n学院提供实验台与常用元器件，特殊器件自备。赛前有一场规则说明会。',
    link: 'https://example.com/edc-2026',
  },
  {
    title: '话剧社年度大戏《雷雨》',
    category: '社团活动',
    publisherType: 'org',
    publisherName: '话剧社',
    audience: '全校',
    startDate: d(1), endDate: d(2), signupDeadline: d(-3),
    description:
      '两场连演，凭票入场，票已发放完毕。\n\n演出当晚 18:30 开放入场，迟到观众需等幕间再进场。演出约 100 分钟，中场休息 10 分钟。',
    link: '',
  },
  {
    title: 'ACM 集训队寒假集训营招募',
    category: '招新',
    publisherType: 'org',
    publisherName: 'ACM 集训队',
    audience: '全校',
    startDate: d(20), endDate: d(27), signupDeadline: d(12),
    description:
      '为期八天的算法集训，覆盖图论、动态规划与计算几何，结营有内部排位赛，成绩作为春季校队选拔参考。\n\n零基础可报基础班，需自备笔记本电脑，机房座位按报名顺序分配。',
    link: 'https://example.com/acm-camp',
  },
  {
    title: '图书馆志愿讲解员招募',
    category: '志愿服务',
    publisherType: 'personal',
    publisherName: '王沐（外国语学院 2024 级）',
    audience: '全校',
    startDate: d(5), endDate: d(9), signupDeadline: d(4),
    description:
      '招募新生入馆导览志愿者，服务时段为每天 14:00–17:00，可自选其中两天，计入志愿时长。\n\n面试十分钟，主要看表达是否清楚、对新馆布局是否熟悉。报名后会在群里发培训材料。',
    link: '',
  },
  {
    title: '新生运动会',
    category: '其他',
    publisherType: 'college',
    publisherName: '机械工程学院',
    audience: '机械工程学院',
    startDate: d(-5), endDate: d(2), signupDeadline: d(-8),
    description:
      '学院传统赛事，含田径项目与趣味项目，以班级为单位统一报名，报名通道早已关闭。\n\n赛事正在进行中，非参赛同学可在看台观赛，注意不要横穿跑道。',
    link: '',
  },
  {
    title: '英语角：每周三晚的口语练习',
    category: '其他',
    publisherType: 'personal',
    publisherName: '陈可（英语协会）',
    audience: '全校',
    startDate: d(-10), endDate: d(-3), signupDeadline: d(-12),
    description:
      '每周固定话题的自由讨论，外教轮值主持，本期话题是"校园里的浪费"。\n\n本期已结束，下期时间与话题会在协会公告里更新，无需报名直接参加。',
    link: '',
  },
  {
    title: '国家奖学金获得者经验分享',
    category: '讲座报告',
    publisherType: 'college',
    publisherName: '经济管理学院',
    audience: '经济管理学院',
    startDate: d(-14), endDate: d(-14), signupDeadline: d(-15),
    description:
      '四位国奖获得者分享学习方法、竞赛与实习的时间安排，以及申请材料的准备思路。\n\n活动已结束，回放视频与讲义可在学院公众号查看。',
    link: 'https://example.com/ns-scholarship',
  },
  {
    title: '秋冬心理健康工作坊',
    category: '其他',
    publisherType: 'org',
    publisherName: '心理协会',
    audience: '全校',
    startDate: d(4), endDate: d(6), signupDeadline: d(3),
    description:
      '三天小规模团体活动，主题依次为压力识别、睡眠管理、情绪表达，每组限 12 人。\n\n需要全程参与，缺席视为放弃名额，名额会顺延给候补同学。带领者持心理咨询相关资质。',
    link: '',
  },
  {
    title: '"互联网+"创新创业大赛宣讲会',
    category: '学科竞赛',
    publisherType: 'college',
    publisherName: '创新创业学院',
    audience: '创新创业学院',
    startDate: d(8), endDate: d(8), signupDeadline: d(7),
    description:
      '介绍赛道设置、评审标准与历届金奖项目的共性问题，现场安排自由组队对接环节。\n\n建议自带一页纸的项目想法，方便现场交流。宣讲后有 30 分钟一对一咨询。',
    link: 'https://example.com/internet-plus',
  },
  {
    title: '街舞社迎新专场',
    category: '社团活动',
    publisherType: 'org',
    publisherName: '街舞社',
    audience: '全校',
    startDate: d(2), endDate: d(2), signupDeadline: d(-1),
    description:
      '迎新专场演出，含四个舞种节目与新社员展示环节，中间穿插互动教学。\n\n无需门票，自由入场，建议提前 15 分钟占位。',
    link: '',
  },
  {
    title: '全国大学生数学竞赛校内选拔',
    category: '学科竞赛',
    publisherType: 'college',
    publisherName: '数学学院',
    audience: '数学学院',
    startDate: d(5), endDate: d(6), signupDeadline: d(-3),
    description:
      '校内选拔分两天进行，第一天笔试、第二天面试答辩，选拔结果作为省赛报名依据。\n\n报名已截止，名单已在学院公告栏公示。参加笔试请携带学生证与黑色签字笔。',
    link: '',
  },
  {
    title: '校园二手教材流转角',
    category: '其他',
    publisherType: 'personal',
    publisherName: '周予安（材料学院 2022 级）',
    audience: '全校',
    startDate: d(-2), endDate: d(6), signupDeadline: d(1),
    description:
      '长期开放的教材交换角，登记后即可取用或投放，目前覆盖高等数学与几门专业基础课。\n\n仅限校内同学参与，不收费用，也不接受商业倒卖。地点在图书馆一层西侧走廊。',
    link: '',
  },
];

/** 生成初始数据：补上 id、示例标记与创建时间 */
export function buildSeed() {
  const now = Date.now();
  return RAW.map((item, index) => ({
    id: `a${String(index + 1).padStart(2, '0')}`,
    isSample: true,
    createdAt: new Date(now - (RAW.length - index) * 36e5).toISOString(),
    ...item,
  }));
}

/**
 * 示例评论：挂在几条示例活动下面，让评论区一进去就有内容可看。
 * 同样全是虚构的。
 */
export function buildSeedComments() {
  const now = Date.now();
  const hoursAgo = (h) => new Date(now - h * 36e5).toISOString();

  return [
    {
      id: 'c01',
      activityId: 'a01',
      nickname: '去年拿过奖的学长',
      content:
        '摘要 500 字是硬上限，超了会被直接打回，建议提前一周把摘要给指导老师看一遍。\n\n校内初评只看材料不答辩，别把时间全花在 PPT 上。',
      createdAt: hoursAgo(52),
      isSample: true,
    },
    {
      id: 'c02',
      activityId: 'a01',
      nickname: '匿名同学',
      content: '想问一下跨学院组队可以吗？我们组三个人分属两个学院。',
      createdAt: hoursAgo(20),
      isSample: true,
    },
    {
      id: 'c03',
      activityId: 'a01',
      nickname: '计算机学院教务',
      content: '可以跨学院组队，报名时把队长所在学院填对就行。',
      createdAt: hoursAgo(18),
      isSample: true,
    },
    {
      id: 'c04',
      activityId: 'a04',
      nickname: '摄影协会老成员',
      content:
        '三天两夜，记得带充电宝和备用存储卡，老街那边夜里补光很弱。\n\n住宿是标间，费用最后统一 AA。',
      createdAt: hoursAgo(30),
      isSample: true,
    },
    {
      id: 'c05',
      activityId: 'a04',
      nickname: '大二路过的',
      content: '去年去过一次，早上六点的巷子光线最好，起得来的别错过。',
      createdAt: hoursAgo(6),
      isSample: true,
    },
    {
      id: 'c06',
      activityId: 'a13',
      nickname: '心理协会',
      content: '每组限 12 人，报名后如果来不了请提前一天在群里说一声，名额会顺延给候补的同学。',
      createdAt: hoursAgo(9),
      isSample: true,
    },
  ];
}
