# 系统研习：Agent / Harness 与 AI Infra

**240 道分层学习题与完整解答，配套可安装到 iPhone 主屏幕的离线 App。**

适合已经有编程与大模型基础，但遇到原理、实现和系统设计追问时容易说不清的读者。题目按概念、原理、实现、诊断、设计逐步深入；每题包含展开解释、具体例子和已作答的追问，相关题目附有公式或代码。

**[直接阅读完整学习手册 →](docs/handbook.md)**

## 内容范围

| 模块 | 内容 |
| --- | --- |
| 01—06 基础 | 编程与并发、操作系统与网络、分布式系统、数学与性能度量、Transformer、训练与 PyTorch |
| 07—14 Agent 工程 | Harness 架构、工具与 MCP、上下文与记忆、RAG、长任务恢复、沙箱与权限、评测、多 Agent 协作 |
| 15—20 推理系统 | GPU 与 CUDA、Kernel 与 Attention、编译与执行、KV Cache、调度与 SLO、量化与投机解码 |
| 21—24 平台与训练 | 分布式训练、集合通信、RL 与 Agent Training Infra、GPU 平台与成本 |
| 补充内容 | 12 个深度案例、20 项实作、易混概念、学习路径、公式速查与参考资料 |

每个核心模块有 10 题：L1 概念 3 题、L2 原理 3 题、L3 实现 2 题、L4 诊断 1 题、L5 设计 1 题。建议先独立复述，再对照完整答案，最后用算例或实验验证理解。

本题库根据公开面经考点和工程资料整理、扩展，**不代表每道题都被某家公司实际问过**，也不宣称穷尽全网面经。候选人自述与一手参考资料在手册末尾单独列出；技术结论需要结合具体框架、硬件和版本理解。算例为教学假设，并非实测成绩。

## 离线 App 能做什么

- 逐题阅读完整答案，自动记住上次题目与阅读位置。
- 搜索题号、问题与答案全文，按模块、难度和学习状态筛选。
- 收藏题目、标记已读、自评 0—4 分。
- 调整字号、浅色 / 深色 / 跟随系统。
- 导出、导入学习记录；兼容电脑版手册的自评分 JSON。
- 首次保存完成后，断网查看全部题目、案例与实作。

进度、书签和自评分保存在当前设备，不会自动上传或跨设备同步。应用运行时没有第三方 JavaScript、字体或分析服务依赖；外部参考链接仍需联网。

## 本地运行

需要 Node.js 22 或更高版本。项目没有 npm 依赖，无需执行 `npm install`。

```bash
git clone https://github.com/device-kunkun/agent-infra-study.git
cd agent-infra-study
npm run build
npm test
npm run dev
```

最后一条命令会打印电脑本机的预览地址。访问该地址即可使用；预览进程按 `Ctrl+C` 停止。

## 部署与 iPhone 安装

将 `npm run build` 生成的 **`dist/` 全部内容**部署到支持静态文件的 HTTPS 主机。不要只上传 `index.html`，也不要修改已经构建的文件；资源更新后应重新运行构建并一起部署。

本仓库提供源码和手册，**仓库首页本身不是 App 安装地址**。可以把构建结果放到 GitHub Pages 或其他 HTTPS 静态托管服务。应用使用相对路径，支持 `/agent-infra-study/` 这样的项目子路径；不同部署路径的离线缓存相互隔离。

在 iPhone 上：

1. 用 Safari 打开你部署后的 HTTPS 地址。
2. 点分享 → 添加到主屏幕；如有“作为网页 App 打开”，保持开启。
3. 从主屏幕新图标打开，保持联网，等右上角显示 **“离线已就绪”**。
4. 关闭 Wi-Fi 和蜂窝网络，关闭 App 后重新打开，确认题目、完整答案和搜索均可用。

手机安装不能使用电脑的 `localhost`、普通局域网 HTTP 或 `file://` 地址。Safari 与主屏幕 App 的存储可能独立，请以主屏幕 App 内的就绪状态为准。系统清理网站数据后需要重新下载；清理数据或更换设备前，应在设置中导出学习记录。[Apple 主屏幕安装说明](https://support.apple.com/guide/iphone/iphea86e5236/ios)，[WebKit 存储说明](https://webkit.org/blog/14403/updates-to-storage-policy/)。

## 项目结构与修改

```text
docs/handbook.md       完整中文学习手册，可直接在 GitHub 阅读
web/content.js        手机 App 使用的完整结构化题库
web/app.js            阅读、搜索、进度与书签
web/app.css           手机布局、字号与显示模式
web/index.html        App 入口
web/manifest.webmanifest  主屏幕安装信息
sw-template.js        离线缓存与完整性校验
build.mjs             生成 dist/ 与版本化 Service Worker
serve.mjs             电脑本地静态预览
tests/offline.mjs     离线核心逻辑测试
```

修改内容时，当前需要同步更新 `docs/handbook.md` 和 `web/content.js` 中对应题目的 `html`、`text` 字段。`html` 用于阅读，`text` 用于全文搜索。修改完成后重新构建并运行测试。纠错建议见 [贡献说明](CONTRIBUTING.md)。

离线资源按 SHA-256 校验，缺失、损坏、登录重定向或版本不符的文件不会被认定为完整下载。旧页面仍打开时不强制切换新缓存；关闭所有旧页面后再打开，才会接管已下载的新版本。

测试覆盖 240 道题完整性、全部核心资源断网读取、损坏内容拒绝、缓存补全及不同路径的缓存隔离。测试在 Node 中模拟 Service Worker 环境，**不能替代真实 iPhone 的安装和断网冷启动验证**。
