# OpsPilot · 运维副驾驶

一个本地可自托管的现代化 Web 小助手，用来可视化地维护 **项目 → 环境 → 接口**，并通过 **编排（Flow）** 把多个接口串起来做典型的运维操作：登录取 token → 查列表 → 删除 → 校验，全程 UI 完成，告别手搓 curl / Postman 的反复来回。

## 特性

- 🎛 **项目 + 多环境**：同一项目可以有 dev / test / prod 等多个 baseUrl、公共 header、公共变量
- 🧰 **接口模板**：Method / Path / Query / Headers / Body 全覆盖，支持 `{{var}}` 占位
- 🔁 **变量提取**：通过 JSONPath 从响应中提取值（如 token），回写到环境变量池，后续接口自动引用
- 🧩 **编排运行**：把多个接口顺序串起来，上一步响应作为下一步入参
- 📜 **历史记录**：所有调用留痕，方便复现
- ✨ **现代化 UI**：React + Tailwind + Framer Motion，带过渡动效与深色主题
- 🐳 **一键部署**：单镜像 Docker Compose，数据挂载到本地卷
- 🗄 **零依赖存储**：SQLite 文件持久化

## 目录结构

```
ops-pilot/
├── server/     # Fastify + Prisma + SQLite
├── web/        # Vite + React + TS + Tailwind
├── Dockerfile
├── docker-compose.yml
└── README.md
```

## 本地开发

前置条件：Node 20+、npm 9+

```bash
# 初始化
npm run install:all

# 生成 prisma client + 建表
npm --prefix server run prisma:generate
npm --prefix server run prisma:push

# 启动前后端（前端 5173 / 后端 5174）
npm run dev
```

打开 http://localhost:5173 即可看到界面。

## 生产部署（Docker）

```bash
docker compose up -d --build
# 之后访问 http://服务器IP:5174
```

数据文件位于宿主机的 `./data/ops-pilot.db`，挂载到容器 `/app/data/`。升级镜像数据不会丢。

## 使用流程速查

1. 在 **项目** 创建项目 → 添加环境（baseUrl + 公共 header + 公共变量）
2. 顶部切换 **项目 / 环境**
3. 在 **接口** 里新建接口模板：
   - 在 Path / Query / Headers / Body 中用 `{{token}}`、`{{userId}}` 这种占位
   - 在「变量提取」里填 `token = $.body.data.token`，登录成功后会自动把 token 写回当前环境
4. 点接口详情的 **执行**，即可看到状态码 / 耗时 / 响应体 / 提取值
5. 去 **编排** 串接多个接口，一键跑完整条链路

## 版本管理

项目使用 git 管理。改动前先 `git status`，有疑问就 `git stash` 或建分支，避免代码丢失。

## 技术栈

- **后端**：Fastify 5 · Prisma · SQLite · undici · jsonpath-plus · zod
- **前端**：React 18 · TypeScript · Vite · Tailwind CSS · Framer Motion · TanStack Query · Zustand · Monaco Editor · lucide-react · sonner
