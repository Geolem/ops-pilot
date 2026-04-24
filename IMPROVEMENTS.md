# OpsPilot 优化任务清单

> 从产品经理 + UI 交互设计师双视角整理的改进项，按执行批次排列。
> 每批次独立可交付，建议 Claude Code 按批次逐个实现。

---

## 批次一：基础体验修复（🔴 P0，建议 1 次对话完成）

### 1.1 响应面板固定分栏

**涉及文件：** `src/pages/Endpoints.tsx` → `EndpointDetail` 组件部分，`src/components/RequestRunner.tsx`

**目标：** 接口详情页改为上下固定分栏布局

```
┌──────────────────────────────┐
│  参数概览区域（可滚动）         │
│  Method / Path / Headers /... │
├──────────────────────────────┤
│  响应面板（固定高度，不可折叠）    │
│  ┌─┬──────┬──────┬──────┬─┐  │
│  │ │ Body │ Head │ Vars │...│  │
│  └─┴──────┴──────┴──────┴─┘  │
└──────────────────────────────┘
```

**具体要求：**
- 移除 `AnimatePresence` 包裹响应区的折叠/展开动效
- 改用 `grid grid-rows-[1fr_auto]` 或 `flex` + `min-h-0` 实现固定分栏
- 响应面板内置多 Tab：Body | Headers | 提取变量 | 请求日志
- 只在有请求结果时才显示响应面板（用 `data.status !== undefined` 判断）
- 面板高度默认为 `35vh`，可通过拖动分隔条调整（可选，可以用 `resize: vertical` 过渡方案）

### 1.2 编辑器退出确认内嵌化

**涉及文件：** `src/pages/Endpoints.tsx` → `EndpointEditor` 部分，`src/components/Modal.tsx`

**目标：** 将 `confirm()` 原生对话框替换为内嵌确认卡片

**具体要求：**
- 在 `EndpointEditor` 状态中增加 `confirmClose: boolean`
- 点击关闭/Escape/背景遮罩时，如果有未保存修改 → `confirmClose = true`
- 编辑器内容替换/遮挡为确认卡片，而非在浏览器弹窗
- 卡片样式：居中半透明遮罩 + 白底/暗色卡片，文案"有未保存的修改，确定放弃？" + "放弃"（红色）/ "继续编辑" 按钮
- 如果无修改，直接关闭

**额外细节：**
- `Modal.tsx` 的 `disableBackdropClose` 逻辑保留，但加上脏检查
- Editor 内加一个 `isDirty` 状态，通过比较 `form` 和初始值实现（`JSON.stringify` 浅比较）

---

## 批次二：日常效率提升（🟠 P1，建议 1-2 次对话完成）

### 2.1 接口快速串联（"后续动作"）

**涉及文件：** 新建 `src/components/NextStep.tsx`，修改 `src/pages/Endpoints.tsx`

**目标：** 在接口运行器下方可配置"下一步"动作，支持串联调用

**数据结构（后端需配合）：**
```typescript
interface NextStep {
  endpointId: string;           // 下一个调哪个接口
  variableMapping: Record<string, string>;  // 当前响应 → 下一步参数
  condition?: string;           // 可选：仅满足条件才执行（如 status === 200）
}
```

**示例流程：**
```
[POST /auth/login]
  ↓ 提取 token
[GET /users?page=1]    ← 选中当前项目的另一个接口
  ↓ 有条件
[GET /users/{{userId}}] ← 条件为 response.status === 200
```

**前端的重点交互：**
- 在接口运行器（Runner）下方加 "⚡ 后续动作" 区域
- 点击"添加后续" → 弹出下拉选接口（同项目的接口列表）
- 选中后展示参数映射表：左列=选择响应字段名，右列=输入 `{{变量名}}`
- 运行当前接口成功后，自动触发后续
- 后续接口执行结果在当前面板级联展示（缩进或不同颜色标记链式关系）

**存储：** 在 `endpoint` 实体上加一个 `nextStep` 字段（JSON），或独立 `flow_step` 表

### 2.2 接口详情页导出 curl 命令

**涉及文件：** `src/pages/Endpoints.tsx`（EndpointDetail 部分）

**目标：** 接口详情页加"复制为 curl"按钮

**具体要求：**
- 在详情页操作栏（编辑/删除旁边）加一个 `<Copy />` 按钮 + "复制 curl"
- 调用 `lib/curl.ts` 中的 `buildCurl()` 函数
- 当前环境已选 → 替换 host 使用 environment 的 baseUrl
- 未选环境 → 显示原始 path
- 复制成功 toast 提示"curl 命令已复制"

### 2.3 历史记录响应比对

**涉及文件：** `src/pages/History.tsx`，新建 `src/components/ResponseDiff.tsx`

**目标：** 历史记录支持选中两条记录进行 JSON diff 比对

**具体要求：**
- 每条历史记录加一个复选框（多选模式）
- 选中两条后，顶部出现 "比对" 按钮
- 点击后弹出一个 Modal，左右分栏展示两条响应 body
- 使用 Monaco Editor 的 diff 模式 (`language="json"` 的 diff editor)
- 响应体过于庞大时只展示截断版本（5KB）
- 高亮差异字段（Monaco diff editor 自带）

**预处理：** 如果两条响应 JSON 结构不同，先做 key 对齐再展示 diff

**数据源：** 假设历史记录接口 `/api/history` 返回每条记录的 `responseBody` 字段

---

## 批次三：Dashboard 首页重构（🔵 P2，建议 1 次对话完成）

### 3.1 首页功能增强

**涉及文件：** `src/pages/Dashboard.tsx`

**目标：** 将当前简单的静态卡片替换为有实际信息量的运营面板

**版面布局建议：**

```
┌─────────────────────────────────────────┐
│  OpsPilot · 运维副驾驶                    │
├──────────┬──────────┬───────────────────┤
│  项目概况  │  近7天运行  │  可考虑加：       │
│  · 3项目   │  · ✅ 12  │  · 快速跳转链接    │
│  · 24接口  │  · ❌ 3   │  · 常用接口列表   │
│  · 4环境   │  · ⏱ avg │                    │
│           │    230ms  │                    │
├──────────┴──────────┴───────────────────┤
│  最近执行（最后5条历史记录）              │
│  [POST] /auth/login  ✅ 200 12ms 2分钟前  │
│  [GET]  /users       ✅ 200 8ms  5分钟前  │
│  [GET]  /unknown/... ❌ 404 0ms  1h前     │
├─────────────────────────────────────────┤
│  项目健康状态（最近一次 Flow 执行摘要）     │
│  · my-api ✅ 全部通过                     │
│  · my-service ⚠️ 1个步骤失败（查看详情）   │
└─────────────────────────────────────────┘
```

**具体实现要求：**
- 新增统计接口：`/api/dashboard/stats` 返回统计数据（项目数、接口数、环境数、近 7 天成功/失败数、平均耗时）
- 最近执行列表：复用 `/api/history` 接口，取最近的 5-10 条
- 项目健康状态：复用 Flow 执行记录，每项目取最近一次 Flow 执行结果
- 失败时红色高亮 + 可点击跳转到对应历史记录

**数据接口（后端需配合）：**
```typescript
// GET /api/dashboard/stats
{
  projectCount: number;
  endpointCount: number;
  environmentCount: number;
  recentRuns: {
    total: number;
    success: number;
    failed: number;
    avgDuration: number;
  };
}

// GET /api/dashboard/recent-history?limit=5
// → 复用现有 history 接口或加端点

// GET /api/dashboard/project-health
// → 每个项目的最近一次 flow 执行结果摘要
```

---

## 批次四：交互细节打磨（🔵 P2，建议 1-2 次对话完成）

### 4.1 变量引用补全

**涉及文件：** `src/components/KeyValueEditor.tsx`、`src/components/JsonEditor.tsx`

**目标：** 在输入 `{{` 时弹出环境变量候选列表

**具体要求：**
- 对 KeyValueEditor 值输入框添加 `onChange` 监听
- 检测输入是否包含 `{{` → 截取当前上下文文本，匹配已有变量池
- 弹出下拉列表（环境变量名 + 已配置的提取变量名）
- 选中后自动补齐 `{{varName}}`
- 需要获取变量列表的途径：从当前项目的环境变量（envs）中提取 `variables` 字段
- 补充：在变量输入框周围做一个 `{{...}}` 的正则高亮（浅色背景标记）

### 4.2 标签管理面板

**涉及文件：** `src/pages/Settings.tsx` 或新建 `src/components/TagManager.tsx`

**目标：** 设置页中新增标签管理区域

**具体要求：**
- 在 Settings 页新增"标签管理" Tab
- 展示所有标签列表，每项包含：标签名、关联接口数、操作按钮
- 支持操作：
  - 改标签名（重命名 → 更新所有关联接口的 `endpoint.tags`）
  - 合并标签（A → B，所有接口的 A 标签改为 B）
  - 删除标签（移除所有接口中的该标签）
- 显示各标签对应的接口数（从 `/api/endpoints` 中计算，或后端提供 `/api/tags`）
- 提供搜索过滤：快速找到目标标签

**后端接口（需配合）：**
```typescript
// GET /api/tags?projectId=xxx
{
  tags: Array<{ name: string; count: number }>;
}

// PATCH /api/tags/rename
body: { oldName: string; newName: string; projectId: string }

// PATCH /api/tags/merge
body: { from: string; to: string; projectId: string }

// DELETE /api/tags
body: { name: string; projectId: string }
```

### 4.3 接口星标收藏

**涉及文件：** `src/pages/Endpoints.tsx`、`src/lib/api.ts`

**目标：** 接口可收藏，星标列表顶部置顶

**具体要求：**
- `Endpoint` 类型增加 `starred: boolean` 字段（后端 `endpoint` 表加列）
- 接口列表每一项左侧加星标按钮（☆/★）
- 列表排序：星标接口排最前（按星标时间倒序），再按标签/名称排序
- Command Palette 搜索结果中星标接口置顶
- 星标状态可快速切换（小星星图标点击 toggle，无需进入编辑）
- 数据持久化：点击星标后调后端 `PATCH /api/endpoints/:id` 更新

### 4.4 标签筛选区域可折叠

**涉及文件：** `src/pages/Endpoints.tsx`

**目标：** 标签多时不占满横向空间

**具体要求：**
- 标签区域包裹 `max-h-[100px] overflow-y-auto`
- 标签超过 15 个或者两行后，底部出现渐变遮罩 + "展开全部标签"按钮
- 点击后展开全部（max-h 解除限制），按钮变为"收起"
- 使用 `motion` 做平滑展开收起动效

### 4.5 搜索框 ⌘F 聚焦

**涉及文件：** `src/pages/Endpoints.tsx`

**目标：** 按 ⌘F 或 Ctrl+F 时自动聚焦搜索框（而非浏览器默认查找）

**具体要求：**
- 加 `useShortcut("f", focusSearch, { cmdOrCtrl: true })`
- `focusSearch` 找到搜索框 ref，调用 `ref.current.focus()`
- 注意：空状态时如果没有搜索框则不处理
- 确保和浏览器默认 `Cmd+F` 不冲突（可选方案：改为仅当焦点已在列表区时才拦截）

---

## 批次五：Flow 编排增强（🔵 P2，建议 1-2 次对话完成）

### 5.1 Flow 执行结果面板

**涉及文件：** `src/pages/Flows.tsx`、`src/components/flow/FlowCanvas.tsx`

**目标：** Flow 执行后展示路径摘要面板

**具体要求：**
- 在画布右上角浮出一个"执行结果"面板（`absolute right-4 top-4`）
- 面板内容按执行链路顺序展示（BFS/DFS 遍历 graph）
- 每步显示：步骤名、状态图标（✅/❌/⏳）、HTTP 状态码、耗时
- 如果有条件分支，标注分支条件结果（如 `status === 200 → true`）
- 面板可收起/展开
- 折叠时只在右上角展示一个简约状态条（总步骤/成功/失败）
- 点击面板中某一步 → 画布自动 pan 到对应节点

### 5.2 执行路径高亮

**涉及文件：** `src/components/flow/FlowCanvas.tsx`、`src/components/flow/ConditionEdge.tsx`

**目标：** Flow 执行完成后，被触发的路径（节点 + 边）高亮

**具体要求：**
- 每个节点/边有一个 `traversed: boolean` 状态
- 执行写完后，标记被执行的节点为 `traversed: true`
- 高亮样式：节点边框 bright ring，边线加粗+高亮颜色
- 未遍历的节点/边变淡（`opacity-30`）
- 重置执行后高亮清除

### 5.3 全局错误提示

**涉及文件：** `src/pages/Flows.tsx`

**目标：** Flow 执行失败时给全局通知，而非仅靠节点颜色

**具体要求：**
- 使用 `sonner` toast 展示失败信息
- 错误 toast 内带"查看详情"按钮 → 展开执行结果面板
- 多个步骤失败时只 toast 一条汇总信息（"3/5 步骤失败"），细节在结果面板看

---

## 批次六：锦上添花（🟢 P3，可选）

### 6.1 上次运行状态持久化

**涉及文件：** 后端 `endpoint` 表 + `/api/endpoints` 接口，前端 `src/pages/Endpoints.tsx`

**目标：** 接口列表的绿色/红色状态指示器在页面刷新后保留

**具体要求：**
- 后端 `endpoint` 表加字段：`lastRunStatus int`（HTTP 状态码或 0=失败）、`lastRunAt timestamp`
- 每次接口执行后，调后端 `PATCH /api/endpoints/:id` 更新这两个字段
- 列表侧读取时使用持久化字段，而非内存中的 `endpointRunStatus`（后者作为实时覆盖）
- 列表加载时优先展示持久化状态，实时执行时展示实时状态覆盖

### 6.2 设置页的配置面板

**涉及文件：** `src/pages/Settings.tsx`

**目标：** 设置页补充更多实用配置项

**可加内容：**
- 默认请求超时时间设置
- 响应体截断大小设置（默认 50KB）
- 是否自动在请求后复制 curl
- 主题相关：默认主题、是否跟随系统
- 数据导入/导出增强：导入时支持映射旧环境变量到新环境

### 6.3 接口文档自动生成

**涉及文件：** 新建页面或改 `src/pages/Settings.tsx`

**目标：** 一键生成 Markdown 格式的接口文档

**具体要求：**
- 基于项目所有接口信息（方法、路径、参数、响应示例）生成文档
- 格式为 Markdown，可直接粘贴到 README.md
- 响应示例从最近一次成功响应中自动捕获
- 提供"复制"和"下载"按钮

---

## 执行建议

| 批次 | 名称 | 预估总工时 | 优先级 | 建议顺序 |
|------|------|-----------|--------|---------|
| 1 | 基础体验修复 | 3h | 🔴 P0 | 第一 |
| 2 | 日常效率提升 | 8h | 🟠 P1 | 第二 |
| 3 | Dashboard 首页重构 | 4h | 🔵 P2 | 第三 |
| 4 | 交互细节打磨 | 6h | 🔵 P2 | 第四 |
| 5 | Flow 编排增强 | 5h | 🔵 P2 | 第五 |
| 6 | 锦上添花 | 4h | 🟢 P3 | 可选 |

**建议每次只喂给 Claude Code 1 个批次**，避免上下文太长导致实现质量下降。

---

*最后更新：2026-04-23*
*来源：龙儿 OpsPilot Code Review*
