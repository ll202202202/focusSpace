# Focus Space 技术设计文档

## 技术选型

- React 19 + TypeScript：组件化 UI 与静态类型。
- Vite：本地开发服务器与生产构建。
- Zustand：应用运行时状态管理。
- IndexedDB（通过 `idb` 封装）：本地优先的数据持久化。
- Vitest + React Testing Library：领域逻辑与关键 UI 行为测试。

## MVP 架构

浏览器中的 React 应用分为三层：UI 组件只负责展示和派发用户意图；Zustand store 协调运行状态；纯 TypeScript 领域模块处理番茄钟状态机与序列规则。IndexedDB 仓储负责持久化设置、会话与每日汇总，且不被组件直接访问。

```text
React UI → Zustand application store → Timer domain engine
                                  └→ Repository port → IndexedDB adapter
```

## 核心状态

- `TimerMode`：`focus`、`shortBreak`、`longBreak`。
- `TimerStatus`：`idle`、`running`、`paused`、`completed`。
- `endAt`：运行中唯一的时间真相（Unix 毫秒）。剩余秒数由 `endAt - now` 计算，避免后台节流导致漂移。
- `cycleIndex`：当前序列中已完成的专注轮次，范围 0–4。

## 数据持久化

| Store | 主键 | 内容 |
| --- | --- | --- |
| `settings` | `default` | 计时时长、序列、主题、声音和辅助功能偏好 |
| `sessions` | UUID | 一次计时的模式、状态、任务、开始/结束和实际时长 |
| `dailySummaries` | `YYYY-MM-DD` | 有效专注数、专注秒数、中断数 |

首次启动写入 PRD 的默认设置；设置变更后立即保存。计时中页面刷新时，应用读取 `endAt` 并据此恢复或完成会话。

## 领域边界与测试缝隙

1. `timerMachine`：输入命令与当前状态，输出下一状态和领域事件；使用 Vitest 做纯函数测试。
2. `sessionRepository`：通过仓储接口读写会话与设置；使用 fake repository 测试应用流程，不依赖浏览器实现细节。
3. `TimerScreen`：以用户可见的模式、时间、开始/暂停/重置和完成提示作为测试边界；使用 React Testing Library。

## 异常与权限

- 通知权限被拒绝或不支持时，显示非阻塞说明，不影响计时与音效。
- IndexedDB 不可用时，退化到内存会话并展示“本次数据不会保存”的状态提示。
- 音频播放被浏览器自动播放策略拦截时，仅在用户首次交互后尝试播放。

## 可访问性与性能

- 主操作使用原生按钮和可见文字；状态更新写入 `aria-live="polite"` 区域。
- 主题通过 CSS 变量实现；“减少动效”关闭非必要动画。
- store 只保存 `endAt`；显示层每秒刷新一次，页面重新获得焦点时立即校正。

## 演进策略

P0 只实现本地优先单机体验。P2 以 `SessionRepository` 与 `SettingsRepository` 接口为边界新增远程适配器；账号和同步不侵入计时领域模型。
