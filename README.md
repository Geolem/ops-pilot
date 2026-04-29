# OpsPilot · 运维副驾驶

OpsPilot 是一个本地可自托管的可视化运维工作台，用来维护 **项目 -> 环境 -> 接口 -> 编排流**。它适合把日常 HTTP 运维动作沉淀成可复用模板，例如登录取 token、查列表、触发任务、轮询状态、校验结果，而不是在 curl、Postman 和脚本之间来回切。

## 主要能力

- **项目与多环境**：按项目隔离接口、环境、公共请求头和变量，支持 dev / test / prod 等多个 baseUrl。
- **接口模板管理**：维护 Method、Path、Query、Headers、Body、标签、前置脚本、后置脚本和变量提取规则。
- **变量占位与回写**：请求中可使用 `{{token}}`、`{{userId}}` 等变量；响应中提取到的值可回写到当前环境。
- **curl 导入**：粘贴 curl 命令即可快速生成接口草稿，减少手动录入。
- **即时调试**：接口详情页可直接执行请求，查看状态码、耗时、响应头、响应体、提取变量和运行日志。
- **响应表格视图**：数组或嵌套数组响应可切换为表格，并支持从选中行映射字段继续调用下一接口。
- **编排流**：通过可视化画布串联多个接口，支持条件边和顺序执行，适合固化常见运维链路。
- **执行历史**：记录每次调用，可重放、导出 curl，并支持两条历史响应比对。
- **备份与迁移**：设置页支持导出/导入 JSON 快照，便于迁移项目、环境、接口和编排流。
- **本地优先**：默认使用 SQLite 文件持久化，适合个人、本地内网或轻量自托管部署。
- **现代化 UI**：React + Tailwind + Framer Motion，支持深色/浅色主题、移动端底部导航和全局命令搜索。

## 技术栈

- **后端**：Fastify 5、Prisma 6、SQLite、undici、jsonpath-plus、zod、TypeScript 6
- **前端**：React 19、React Router 7、Vite 8、Tailwind CSS 4、TanStack Query 5、Zustand、Framer Motion、React Flow、Monaco Editor、lucide-react、sonner
- **部署**：Node 24 Alpine 多阶段 Docker 构建，单容器同时服务 API 与前端静态资源

## 目录结构

```text
ops-pilot/
├── server/                 # Fastify + Prisma + SQLite API 服务
│   ├── prisma/schema.prisma
│   └── src/
├── web/                    # Vite + React + TypeScript 前端
│   └── src/
├── Dockerfile              # 生产镜像构建
├── docker-compose.yml      # 自托管运行配置
├── deploy.sh               # 构建并推送镜像脚本
└── README.md
```

## 本地开发

前置条件：

- Node.js 20+，推荐 Node.js 24
- npm 9+

安装依赖并初始化数据库：

```bash
npm run install:all
npm --prefix server run prisma:generate
npm --prefix server run prisma:push
```

启动开发环境：

```bash
npm run dev
```

默认端口：

- 前端开发服务：http://127.0.0.1:5173
- 后端 API 服务：http://127.0.0.1:5174

开发模式下，Vite 会把 `/api` 代理到后端服务。

## 常用命令

```bash
# 前后端一起构建
npm run build

# 只构建后端
npm --prefix server run build

# 只构建前端
npm --prefix web run build

# 启动生产后端，需先构建
npm run start

# 推送 Prisma schema 到 SQLite
npm --prefix server run prisma:push
```

## Docker 部署

当前 `docker-compose.yml` 默认使用已发布镜像：

```bash
docker compose up -d
```

访问：

```text
http://服务器IP:5174
```

数据文件默认挂载到宿主机：

```text
./server/data/ops-pilot.db
```

容器内路径：

```text
/app/server/data/ops-pilot.db
```

升级镜像时保留 `./server/data` 目录即可保留数据。

## 构建并推送镜像

`deploy.sh` 会构建 linux/amd64 镜像并推送到：

```text
registry.cn-shenzhen.aliyuncs.com/huazhiy/ops-pilot:latest
```

执行：

```bash
./deploy.sh
```

服务器更新：

```bash
docker compose pull
docker compose up -d --force-recreate
```

## 使用流程

1. 在 **项目** 页创建项目。
2. 为项目添加环境，填写 `baseUrl`、公共请求头和公共变量。
3. 在顶部栏选择当前项目和环境。
4. 在 **接口** 页新建接口，或使用 curl 导入。
5. 在 Path、Query、Headers、Body 中使用 `{{变量名}}` 引用环境变量。
6. 配置变量提取规则，把响应中的 token、任务 ID 等回写到环境变量。
7. 在接口详情页执行请求，查看响应体、表格视图、日志和提取结果。
8. 在 **编排** 页把多个接口串成流程，一键运行完整链路。
9. 在 **历史** 页重放请求、导出 curl 或比对两次响应。
10. 在 **设置** 页导出 JSON 快照，用于备份或迁移。

## 环境变量

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `PORT` | `5174` | API 与生产静态站点服务端口 |
| `HOST` | `0.0.0.0` | 服务监听地址 |
| `DATABASE_URL` | `file:/app/server/data/ops-pilot.db` | Prisma SQLite 数据库地址 |
| `NODE_OPTIONS` | `--max-old-space-size=256` | 生产容器 Node 内存参数 |

## 数据备份

有两种方式：

- 在 **设置 -> 数据备份 & 迁移** 中导出 JSON，再在新实例导入。
- 直接备份 SQLite 文件 `./server/data/ops-pilot.db`。

建议生产升级前至少保留一份 JSON 快照或 SQLite 文件副本。

## API 入口

常用接口：

- `GET /api/health`
- `GET /api/projects`
- `GET /api/environments?projectId=...`
- `GET /api/endpoints?projectId=...`
- `POST /api/run`
- `GET /api/history`
- `POST /api/history/:id/replay`
- `GET /api/flows?projectId=...`
- `POST /api/flows/run`
- `GET /api/export`
- `POST /api/import`

## 注意事项

- OpsPilot 默认面向可信内网或本地使用；如果暴露到公网，请在反向代理层增加认证、HTTPS 和访问控制。
- 环境变量和请求头可能包含 token、Cookie 等敏感信息，请谨慎导出、分享或提交数据文件。
- 编排流会真实执行 HTTP 请求，请在生产环境使用前确认目标环境与参数。
