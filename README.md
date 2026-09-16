# AI Content Director

AI Content Director 是一个面向 AI 短视频创作者、编导与小型内容团队的内容决策 MVP。它把零散脑洞转化为可比较、可解释、可继续开发的项目，覆盖账号 DNA、选题池、100 分评分、优化版本、正式立项、Beat Sheet、脚本与归档。

## 本地运行

需要 Node.js 18 或更高版本。首次运行先安装依赖：

```powershell
npm install
npm start
```

浏览器访问 `http://localhost:4173`。

运行自动化测试：

```powershell
npm test
```

## MVP 能力

- 保存账号定位、受众、三轴内容偏好、商业方向与制作能力
- 按 DNA 和生成条件批量生成 10 条结构化选题
- 手动录入、筛选、排序和管理选题状态
- 用 10 个公开维度完成可解释的 100 分评分
- 应用优化方向、重新评分、对比分数并保留版本历史
- 将 80 分以上选题一键转为项目
- 推荐 T1—T4 时长、A/B/C 制作等级与五类叙事结构
- 生成和编辑 5—8 个 Beat，实时统计时长并提示超时
- 仅在确认 Beat Sheet 后生成正式脚本
- 自动保存项目，支持文本导出与归档

## 实现说明

当前版本包含本地 Node.js 后端、SQLite 数据库和国内大模型官方 API 集成。默认接入 DeepSeek 官方 OpenAI 兼容接口，并可通过环境变量切换到其他兼容服务。账号、选题、评分、项目、Beat、脚本和埋点会写入 `data/ai-content-director.db`。浏览器 `localStorage` 保留为后端不可用时的安全降级。

### 配置真实大模型

复制环境变量示例：

```powershell
Copy-Item .env.example .env
```

在 [DeepSeek 开放平台](https://platform.deepseek.com/api_keys) 创建 API Key，然后编辑 `.env`：

```dotenv
AI_PROVIDER=deepseek
AI_API_KEY=你的_DeepSeek_API_Key
AI_BASE_URL=https://api.deepseek.com
AI_MODEL=deepseek-v4-flash
```

`.env` 已被 Git 忽略，不会进入提交。请不要把 API Key 写进前端代码、截图或聊天记录。模型请求只从本地 Node.js 后端发出，密钥不会发送给浏览器。

如需切换其他国内厂商的官方 OpenAI 兼容接口，只需修改 `AI_PROVIDER`、`AI_BASE_URL`、`AI_MODEL` 和 `AI_API_KEY`。接口需支持 `/chat/completions` 与 `response_format: { "type": "json_object" }`。

未配置密钥、网络不可用或模型调用失败时，系统自动使用 `src/domain.js` 中的本地可解释引擎，完整工作流仍可继续。

### 后端接口

- `GET /api/health`：数据库与大模型配置状态
- `GET /api/state`：读取完整工作区
- `PUT /api/state`：事务式保存完整工作区
- `POST /api/ai/:task`：结构化大模型任务

默认数据库路径可用 `DATABASE_PATH` 修改；模型供应商、地址和模型名分别使用 `AI_PROVIDER`、`AI_BASE_URL` 与 `AI_MODEL` 修改。

## 数据与隐私

内容默认保存在本机 SQLite 数据库，不会跨用户展示。API 请求仅在用户主动执行生成、评分、优化、立项、Beat 或脚本操作时发送到配置的模型服务。项目页仍支持文本导出留档。
