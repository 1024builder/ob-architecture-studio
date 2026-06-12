import type { ReviewCenterData } from '../services/reviewCenterService'
import { downloadTextFile } from './obcpExport'

export function generateReviewMarkdown(
  data: ReviewCenterData,
  account: string,
) {
  const weakChapters = data.chapters.filter((chapter) =>
    chapter.correctRate < 60,
  )
  return [
    '# OBCP 学习复盘报告',
    '',
    `- 当前账号：${account}`,
    `- 导出时间：${new Date().toLocaleString('zh-CN')}`,
    `- 总答题数：${data.analytics.userSummary.totalAnswered}`,
    `- 当前正确率：${data.analytics.userSummary.correctRate}%`,
    `- 今日建议复习：${data.todaySuggestedCount} 题`,
    '',
    '## 1. 薄弱章节',
    ...(weakChapters.length
      ? weakChapters.map((item) =>
        `- ${item.name}：正确率 ${item.correctRate}%，已完成 ${item.completedQuestions}/${item.totalQuestions}，建议 ${item.suggestedAction}`,
      )
      : ['- 暂无低于 60% 的薄弱章节。']),
    '',
    '## 2. 最近错题',
    ...questionLines(data.wrongQuestions),
    '',
    '## 3. 收藏题',
    ...questionLines(data.favoriteQuestions),
    '',
    '## 4. 我不理解题',
    ...questionLines(data.notUnderstoodQuestions),
    '',
    '## 5. 推荐复习路径',
    `1. 优先复习章节：${data.recommendedChapter ?? '从基础章节开始'}`,
    `2. 重做最近错题：${data.wrongQuestions.length} 题`,
    `3. 回看不理解题：${data.notUnderstoodQuestions.length} 题`,
    `4. 复习架构模型：${data.architectureRecommendations.map((item) => item.title).join('、') || '暂无明确推荐'}`,
    '',
    '## 6. 推荐搜索关键词',
    data.recentSearches.length
      ? `- ${data.recentSearches.join('、')}`
      : '- 暂无最近搜索关键词。',
    '',
    '## 7. 推荐故障案例',
    ...(data.caseRecommendations.length
      ? data.caseRecommendations.map((item) => `- ${item.title}（${item.reason}）`)
      : ['- 暂无明确关联案例。']),
    '',
  ].join('\n')
}

export function generateReviewLlmText(
  data: ReviewCenterData,
  account: string,
) {
  return [
    generateReviewMarkdown(data, account),
    '## 给大模型的分析任务',
    '',
    '请基于以上学习复盘数据输出：',
    '1. 当前学习薄弱点分析，并区分数据证据和推测；',
    '2. 未来 7 天复习计划；',
    '3. 每日复习任务与建议题量；',
    '4. 对薄弱章节和“我不理解”题涉及的重点知识点进行解释；',
    '5. 建议优先回看的架构模型、故障案例和搜索关键词。',
    '',
  ].join('\n')
}

export function downloadReviewMarkdown(
  data: ReviewCenterData,
  account: string,
) {
  downloadTextFile(
    'obcp-learning-review.md',
    generateReviewMarkdown(data, account),
    'text/markdown;charset=utf-8',
  )
}

function questionLines(items: ReviewCenterData['wrongQuestions']) {
  return items.length
    ? items.slice(0, 12).map((item) =>
      `- [${item.source}] ${item.questionId} · ${item.chapter} · ${item.stem}${item.wrongCount ? `（错误 ${item.wrongCount} 次）` : ''}`,
    )
    : ['- 暂无。']
}
