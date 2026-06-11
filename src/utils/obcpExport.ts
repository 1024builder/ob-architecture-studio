import type { ObcpAnalytics } from '../data/obcpTypes'

export function generateDiagnosisMarkdown(analytics: ObcpAnalytics) {
  const { userSummary } = analytics
  const chapterRows = analytics.chapterStats.map((item) =>
    `| ${item.name} | ${item.completedQuestions} | ${item.totalQuestions} | ${item.correctRate}% | ${item.mastery} | ${item.suggestedAction} |`,
  )
  const weakRows = analytics.weakPoints.length
    ? analytics.weakPoints.map((item) => `- ${item.name}：正确率 ${item.correctRate}%，平均耗时 ${item.averageDurationSeconds} 秒，作答 ${item.answeredCount} 次`)
    : ['- 暂无达到诊断样本量的薄弱知识点']
  const strongRows = analytics.strongPoints.length
    ? analytics.strongPoints.map((item) => `- ${item.name}：正确率 ${item.correctRate}%，作答 ${item.answeredCount} 次`)
    : ['- 暂无达到诊断样本量的已掌握知识点']
  const insufficientRows = analytics.insufficientPoints.length
    ? analytics.insufficientPoints.map((item) => `- ${item.name}：当前仅作答 ${item.answeredCount} 次，需要继续刷题验证`)
    : ['- 暂无']
  const wrongRows = analytics.frequentWrongQuestions.length
    ? analytics.frequentWrongQuestions.map((item) =>
      `| ${item.questionId} | ${truncate(item.stem, 36)} | ${item.chapter} | ${item.knowledgePoints.join('、')} | ${item.wrongCount} | ${formatDate(item.latestWrongAt)} |`,
    )
    : ['| 暂无 | 暂无错误题目 | - | - | 0 | - |']
  const diagnosisRows = analytics.weakPointDiagnoses.length
    ? analytics.weakPointDiagnoses.flatMap((item) => [
      `### ${item.name}`,
      `- 数据表现：正确率 ${item.correctRate}%，平均耗时 ${item.averageDurationSeconds} 秒，作答 ${item.answeredCount} 次`,
      `- 原因推测：${item.reasons.join('；')}`,
      `- 关联架构组件：${item.relatedComponents.join('、') || '暂无明确关联组件'}`,
      `- 建议动作：${item.suggestion}`,
      '',
    ])
    : ['- 当前有效样本不足，建议先完成各章节基础练习，再生成诊断。', '']

  return [
    '# OBCP 用户学习诊断 Skill',
    '',
    '## 数据说明',
    '- 当前数据来源：本地刷题记录 localStorage',
    '- 统计口径：基于已提交答案的题目记录',
    '- 注意：样本量较小时，诊断结果仅供参考',
    '',
    '## 1. 用户刷题概况',
    `- 用户 ID：${userSummary.userId}`,
    `- 累计刷题：${userSummary.totalAnswered}`,
    `- 已覆盖题目：${userSummary.uniqueAnswered}`,
    `- 当前正确率：${userSummary.correctRate}%`,
    `- 错题数量：${userSummary.wrongCount}`,
    `- 收藏题目：${userSummary.favoriteCount}`,
    `- 平均答题耗时：${userSummary.averageDurationSeconds} 秒`,
    `- 最近练习：${userSummary.recentPractice ?? '暂无'}`,
    `- 最近练习时间：${formatDate(userSummary.recentPracticeAt)}`,
    '',
    '## 2. 章节掌握情况',
    '| 章节 | 已完成题数 | 总题数 | 正确率 | 掌握状态 | 建议动作 |',
    '| --- | ---: | ---: | ---: | --- | --- |',
    ...chapterRows,
    '',
    '## 3. 知识点掌握情况',
    '### 薄弱知识点',
    ...weakRows,
    '',
    '### 已掌握知识点',
    ...strongRows,
    '',
    '### 样本不足知识点',
    ...insufficientRows,
    '',
    '## 4. 高频错题与重复错误',
    '| 题目 ID | 题干摘要 | 所属章节 | 知识点 | 错误次数 | 最近错误时间 |',
    '| --- | --- | --- | --- | ---: | --- |',
    ...wrongRows,
    '',
    '## 5. 薄弱点诊断',
    ...diagnosisRows,
    '## 6. 给大模型的分析提示词',
    analytics.llmPrompt,
    '',
  ].join('\n')
}

export function generateDiagnosisJson(analytics: ObcpAnalytics) {
  return JSON.stringify({
    userSummary: analytics.userSummary,
    chapterStats: analytics.chapterStats,
    knowledgePointStats: analytics.knowledgePointStats,
    difficultyStats: analytics.difficultyStats,
    questionTypeStats: analytics.questionTypeStats,
    weakPoints: analytics.weakPoints,
    strongPoints: analytics.strongPoints,
    insufficientPoints: analytics.insufficientPoints,
    weakPointDiagnoses: analytics.weakPointDiagnoses,
    frequentWrongQuestions: analytics.frequentWrongQuestions,
    repeatedWrongQuestions: analytics.repeatedWrongQuestions,
    recentPracticeTrend: analytics.recentPracticeTrend,
    llmPrompt: analytics.llmPrompt,
  }, null, 2)
}

export function downloadTextFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

function truncate(value: string, length: number) {
  return value.length > length ? `${value.slice(0, length)}...` : value
}

function formatDate(value?: string) {
  return value ? new Date(value).toLocaleString('zh-CN') : '暂无'
}
