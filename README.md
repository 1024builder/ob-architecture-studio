# OB Architecture Studio

OB Architecture Studio 是一个面向 OceanBase 学习与实践的前端应用，聚焦架构原理学习、交互式拓扑分析和 OBCP 题库练习。

项目不是传统的静态文档页面，而是通过可交互拓扑、组件详情、刷题记录和学习诊断，帮助用户理解 OceanBase 架构关系并进行认证知识练习。

## 技术栈

- React
- Vite
- TypeScript
- Tailwind CSS
- Framer Motion
- Lucide React

当前版本使用自定义伪 3D 拓扑画布，尚未接入真实 Three.js 模型。

## 核心功能

### 架构分析

- 支持三副本集群、OBProxy 访问架构、租户资源隔离、LS / Tablet 日志复制、主备租户灾备和 OCP 纳管架构等模型。
- 点击拓扑节点可查看对应组件说明。
- 支持拓扑节点拖拽和链路实时跟随。
- 节点布局按架构模型保存到 localStorage，刷新后仍可恢复。
- 支持画布缩放、缩放重置、节点布局恢复和数据流暂停。
- 展示节点状态、链路类型和模型指标概览。
- 组件详情提供概览、常用 SQL 命令和故障排查内容。

### OBCP 题库

- 支持单选题、多选题和判断题。
- 支持顺序练习、随机练习、收藏练习、错题重做和模拟考试。
- 支持按题干、章节、知识点和标签搜索题目。
- 支持收藏、错题本和“我不理解”标记。
- 答题记录、收藏状态和错题状态保存在 localStorage。

### 答题与复盘

- 题号导航支持快速跳转和答案回跳修改。
- 题号可按全部、未答、已答、收藏和“我不理解”筛选。
- 普通练习提交后即时显示答案、解析、常见误区和复习建议。
- 模拟考试在交卷前不显示正确答案和解析。
- 模拟考试存在未答题时，会在交卷前提示具体题号。
- 普通练习完成后展示本次练习结果总结。
- 普通练习和模拟考试结果页均提供错题复盘列表。
- 支持从结果页返回原题查看、重做错题或查看学习诊断。

### 学习诊断

- 根据本地刷题记录统计累计做题数、正确率、错题数和平均耗时。
- 统计章节、知识点、难度和题型掌握情况。
- 展示薄弱知识点、已掌握知识点、高频错题和最近练习趋势。
- 提供网页内学习诊断报告。
- 支持导出 Markdown 格式的学习诊断 Skill。
- 支持导出 JSON 格式的结构化诊断数据。
- 支持复制诊断内容和分析提示词，供大模型进一步分析。

当前学习数据仅保存在浏览器 localStorage 中，不包含账号系统或服务端数据同步。

## 本地运行

需要先安装 Node.js 和 npm。

```bash
npm install
npm run dev
```

开发服务器默认由 Vite 启动，终端会显示本地访问地址。

生产构建：

```bash
npm run build
```

构建产物输出到 `dist/` 目录。

代码检查：

```bash
npm run lint
```

## 项目目录

```text
ob-architecture-studio/
├─ scripts/                     # 构建准备和验收辅助脚本
├─ src/
│  ├─ app/                     # 应用级配置
│  ├─ components/
│  │  └─ obcp/                 # OBCP 答题、题号导航和诊断组件
│  ├─ data/
│  │  ├─ components.ts         # 架构组件说明数据
│  │  ├─ models.ts             # 架构模型数据
│  │  ├─ scenarios.ts          # 架构场景数据
│  │  ├─ obcpQuestions.ts      # OBCP 示例题库
│  │  └─ obcpTypes.ts          # OBCP 类型定义
│  ├─ features/
│  │  ├─ architecture/         # 拓扑画布、布局存储和架构交互
│  │  └─ question-bank/        # 题库首页
│  ├─ pages/
│  │  ├─ ArchitecturePage.tsx  # 架构分析页面
│  │  └─ QuestionBankPage.tsx  # OBCP 题库页面
│  ├─ utils/
│  │  ├─ obcpAnalytics.ts      # 学习统计与诊断计算
│  │  ├─ obcpExport.ts         # Markdown / JSON 导出
│  │  └─ obcpStorage.ts        # 本地刷题数据持久化
│  ├─ App.tsx                  # 模块导航与页面切换
│  └─ main.tsx                 # 应用入口
├─ package.json
└─ README.md
```

## 后续规划

- 建立架构图与题库之间的联动。
- 支持从题目和错题诊断跳转到相关架构组件。
- 接入后端账号体系和多用户学习数据。
- 接入大模型服务，自动生成个性化学习诊断与复习计划。

以上内容属于后续规划，当前版本尚未实现。
