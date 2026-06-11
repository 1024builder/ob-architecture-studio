import type { KnowledgeCard } from './types'

export const scenarioCards: Record<string, KnowledgeCard[]> = {
  replicas: [
    { title: '多数派写入', body: '三副本模型中一次提交需要多数派确认。单副本或单 Zone 故障时，只要多数派仍可达，事务可继续提交。', tags: ['Paxos', 'RPO=0'] },
    { title: 'Leader 就近', body: 'Primary Zone 会影响 Leader 优先分布。把业务入口、Proxy 和 Leader 放近，可以降低事务 RT。', tags: ['Primary Zone', 'RT'] },
    { title: '故障域设计', body: 'Zone 应映射独立电力、网络或机架域。把多个副本放进同一故障域会削弱容灾收益。', tags: ['Zone', '容灾'] },
  ],
  proxy: [
    { title: '租户识别', body: 'OBProxy 根据用户名中的租户和集群信息识别目标，再结合路由表把连接转发到合适 OBServer。', tags: ['OBProxy', '连接串'] },
    { title: '路由刷新', body: '后端 Leader 迁移或扩缩容后，Proxy 需要及时刷新路由缓存，避免请求命中过期位置。', tags: ['路由', '缓存'] },
    { title: '连接复用', body: 'Proxy 维护前后端连接关系。业务连接池、Proxy 连接上限和后端租户资源要一起规划。', tags: ['连接池', '容量'] },
  ],
  tenant: [
    { title: '资源池到 Unit', body: '租户通过资源池获得多个 Unit，每个 Unit 落在指定 Zone 的 OBServer 上，形成资源隔离边界。', tags: ['Unit', '资源池'] },
    { title: '弹性扩缩容', body: '调整 Unit Config 或资源池可以改变租户资源，但迁移和负载均衡过程需要观察任务状态。', tags: ['扩缩容', '迁移'] },
    { title: '噪声隔离', body: '租户间隔离依赖 CPU、内存、IO、日志盘等多维资源配置，单看 CPU 不够。', tags: ['隔离', '水位'] },
  ],
  lsTablet: [
    { title: 'Tablet 隶属 LS', body: 'Tablet 的数据变更通过所属 LS 复制。排查分区问题时，要同时看 Tablet 副本和 LS 位置。', tags: ['Tablet', 'LS'] },
    { title: '日志先行', body: '事务提交以日志复制为准，存储数据随后通过转储和合并组织为可查询结构。', tags: ['Palf', '存储'] },
    { title: 'Leader 抖动', body: '如果 LS Leader 频繁切换，通常需要排查网络、日志盘延迟和副本健康状态。', tags: ['Leader', '诊断'] },
  ],
  standby: [
    { title: 'RPO 观察', body: '灾备链路要持续观察归档和同步延迟。延迟扩大时，切换后的数据恢复点会变旧。', tags: ['RPO', '归档'] },
    { title: '切换前检查', body: '计划内切换应确认主备角色、日志追平状态、业务写入冻结窗口和回切方案。', tags: ['Switchover', 'Runbook'] },
    { title: '恢复介质', body: '对象存储或 NFS 的权限、吞吐和生命周期策略会直接影响备份恢复可靠性。', tags: ['备份', '恢复'] },
  ],
  ocp: [
    { title: '控制面纳管', body: 'OCP 通过 Agent 和凭据纳管集群。Agent 离线时，监控、任务和告警都会失去完整上下文。', tags: ['Agent', '纳管'] },
    { title: '任务编排', body: '扩容、升级、备份等动作会拆成多步任务。失败时优先定位卡住步骤和对应主机日志。', tags: ['任务', '日志'] },
    { title: '巡检闭环', body: '巡检规则把容量、水位、参数和拓扑健康聚合成运营视图，适合作为日常值班入口。', tags: ['巡检', '告警'] },
  ],
}
