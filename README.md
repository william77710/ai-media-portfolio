# AI × 融媒体内容生产作品集 · GitHub Portable Edition

> 河海大学 2027 届广播电视学专业毕业生 — 投递 AI 产品经理 / AIGC 产品经理 / 内容产品经理 / 智能创作工具产品经理岗位的公开作品集。

这是作品集应用的开源可移植版本，基于 Vite + React + TypeScript + Tailwind CSS v4 构建，可本地运行、可静态部署、适配 GitHub Pages。

## 项目一览

| 项目 | 类型 | 说明 |
|---|---|---|
| 作品集主页 | 导航页 | 个人定位、能力证据链、5 个项目入口 |
| 媒眼 MediaLens | AI 工具 | 融媒体选题策划与事实框架助手 |
| 镜序 ShotFlow | AI 工具 | 短视频脚本与分镜工作台（主项目） |
| 声迹 QuoteCut | AI 工具 | 带时间码的采访检索、金句提取与粗剪 |
| 《河流边的青春切片》 | 内容作品 | 互动微纪录片（待采访验证） |
| 《一份素材，三种叙事》 | 内容作品 | 跨平台叙事对比实验（待补充） |

## 快速开始

```bash
npm install
npm run dev
```

构建生产版本：

```bash
npm run build
```

## GitHub Pages

仓库已内置 `.github/workflows/deploy.yml`。在 Settings → Pages 中选择 GitHub Actions 后，推送 `main` 分支即可自动部署。

## AI 模式

默认使用 Demo 模式，不需要密钥。真实 AI 必须通过自行部署的可信后端代理接入：

```bash
VITE_AI_PROVIDER=proxy
VITE_AI_PROXY_URL=https://your-proxy.example.com/api/chat/completions
```

前端不保存、不读取、不传输 API Key。任何 `VITE_` 环境变量都会进入客户端构建，绝对不要在其中配置密钥、Token 或其他凭证。

## 隐私与真实性边界

- 项目数据默认保存在浏览器 localStorage。
- 内容作品页均标注“待采访后补充”，不虚构人物、事实或数据。
- AI 生成事实类内容标记为“待核实”。
- 姓名、简历和联系方式保持“待补充”。
- 保留已确认信息：河海大学、广播电视学、2027 届。

## 已知限制

1. 音频播放器为演示版，不包含真实音频文件。
2. 真实 AI 调用需要安全后端代理。
3. GitHub Pages 使用 HashRouter，URL 带 `#` 前缀。

## License

MIT
