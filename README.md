# OB Architecture Studio

OB Architecture Studio 是一个 OceanBase 架构学习、交互式拓扑分析与 OBCP 题库练习平台。

项目通过可交互架构拓扑、组件知识说明、在线刷题和学习诊断，辅助用户理解 OceanBase 架构关系并进行 OBCP 知识练习。当前版本为纯前端应用，用户学习数据保存在浏览器 localStorage 中。

## 当前核心功能

### 架构分析

- 展示三副本集群、OBProxy 访问架构、租户资源隔离、LS / Tablet 日志复制、主备租户灾备和 OCP 纳管架构。
- 支持拓扑节点点击、拖拽和单节点高亮。
- 拖拽节点后，相关链路、箭头和标签实时更新。
- 支持画布缩放、缩放重置、节点布局恢复和数据流暂停。
- 节点位置按架构模型保存到 localStorage。
- 展示组件概览、关键概念、常用 SQL 命令和故障排查说明。

### OBCP 题库

- 支持单选题、多选题和判断题。
- 内置四个章节共 32 道示例题，每道题包含解析、常见误区、复习建议、考试关注点和关联架构组件。
- 支持顺序练习、随机练习、收藏题练习、错题重做和模拟考试。
- 支持按题干、章节、知识点和标签搜索。
- 支持导入自定义 JSON 题库，并与内置题目合并用于搜索、练习和模拟考试。
- 支持导出完整题库、下载题库模板和查看题库分类统计。
- 支持收藏、错题本和“我不理解”标记。
- 支持题号导航，以及按未答、已答、收藏和“不理解”状态筛选题号。
- 切换题目时保留当前会话答案，支持回跳修改和重新提交。
- 模拟考试交卷前不显示答案，存在未答题时提示具体题号。

### 结果与复盘

- 普通练习完成后展示总题数、已答数、正确数、错误数和正确率。
- 普通练习和模拟考试均提供错题复盘列表。
- 错题复盘展示用户答案、正确答案、知识点、常见误区和复习建议。
- 支持返回原题查看和重做本次错题。
- 根据本次答题情况提供简单的下一步学习建议。

### 学习诊断

- 统计累计刷题数、正确率、错题数、收藏数和平均答题耗时。
- 统计章节、知识点、难度和题型掌握情况。
- 展示薄弱知识点、已掌握知识点、高频错题和最近七天练习趋势。
- 提供网页内学习诊断报告。
- 支持导出 Markdown 学习诊断和 JSON 结构化数据。
- 支持复制学习诊断和分析提示词，供大模型进一步分析。

### 题目与架构联动

- 题目、错题复盘和学习诊断中的关联架构组件以标签展示。
- 点击组件标签可切换到架构分析模块，并自动选择相关架构模型。
- 支持定位 Zone、OBServer、Tenant、Unit、LS、Tablet、RootService、OBProxy 和 OCP 等组件。
- 匹配成功时自动选中并高亮相关拓扑节点，同时在右侧展示组件详情。
- 无法精确匹配时展示建议查看的组件提示。
- 当前联动仅用于组件定位和学习提示，不包含架构图内的自动讲解或题目状态同步。

### DBA 故障案例

- 提供独立的 DBA Case Lab，用于查看数据库和监控平台故障案例。
- 支持按数据库类型、故障类型、严重等级和关键词筛选。
- 案例详情包含故障现象、影响、排查步骤、关键命令、根因、处理方案、验证方法和经验总结。
- 支持复制关键命令、导出案例 Markdown，以及复制完整案例供大模型辅助分析。
- 当前内置 5 个通用示例案例，案例数据保存在前端静态数据文件中。

## 技术栈

- React
- TypeScript
- Vite
- Tailwind CSS
- localStorage

项目同时使用 Framer Motion 处理界面动效，使用 Lucide React 提供图标。当前拓扑为自定义伪 3D 画布，尚未使用真实 Three.js 模型。

## 本地运行

需要预先安装 Node.js 和 npm。

```bash
npm install
npm run dev
```

生产构建：

```bash
npm run build
```

构建产物输出到 `dist/` 目录。

## 项目目录

```text
ob-architecture-studio/
├─ scripts/                     # 构建准备和验收辅助脚本
├─ src/
│  ├─ app/                     # 应用模块配置与架构导航映射
│  ├─ components/
│  │  ├─ obcp/                 # 答题、题号导航、复盘和诊断组件
│  │  └─ *.tsx                 # 架构画布、详情面板等通用组件
│  ├─ data/
│  │  ├─ models.ts             # 架构模型与拓扑数据
│  │  ├─ components.ts         # 架构组件说明
│  │  ├─ scenarios.ts          # 架构原理卡片
│  │  ├─ obcpQuestions.ts      # OBCP 示例题目
│  │  ├─ obcpQuestionAdditions.ts # OBCP 扩展示例题目
│  │  ├─ troubleshootingCases.ts # DBA 故障案例数据
│  │  ├─ troubleshootingTypes.ts # 故障案例类型定义
│  │  └─ obcpTypes.ts          # OBCP 类型定义
│  ├─ features/
│  │  ├─ architecture/         # 拓扑布局持久化和连线计算
│  │  └─ question-bank/        # OBCP 题库首页
│  ├─ pages/
│  │  ├─ ArchitecturePage.tsx  # 架构分析页面
│  │  └─ QuestionBankPage.tsx  # OBCP 题库页面
│  ├─ utils/
│  │  ├─ obcpAnalytics.ts      # 学习统计与诊断计算
│  │  ├─ obcpExport.ts         # Markdown / JSON 导出
│  │  ├─ obcpQuestionImportExport.ts # 题库校验、导入、导出与模板
│  │  ├─ troubleshootingExport.ts # 故障案例 Markdown 与复制
│  │  └─ obcpStorage.ts        # localStorage 数据持久化
│  ├─ App.tsx                  # 模块切换与跨模块联动
│  └─ main.tsx                 # 应用入口
├─ package.json
└─ README.md
```

## 数据说明

- 当前没有后端服务和用户账号系统。
- 刷题记录、收藏、错题本和“不理解”标记保存在浏览器 localStorage。
- 拓扑节点布局使用独立的 localStorage key 保存，不与题库数据混用。
- 导入题目使用 `ob-architecture-studio:obcp-custom-questions` 保存。
- 清理浏览器站点数据会同时清除本地学习记录和自定义拓扑布局。

## 后续规划

- 扩充 OBCP 题库数据和知识点覆盖范围。
- 支持标准化题库导入与导出。
- 接入多用户后端和服务端学习记录。
- 接入 AI 服务生成自动学习诊断与复习计划。
- 部署到 GitHub Pages 或 Vercel。

以上项目属于后续规划，当前版本尚未实现。
