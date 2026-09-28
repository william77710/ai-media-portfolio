# MediaFlow 智能创作工作流（MediaLens × ShotFlow）

专为专业内容创作者、编导与产品团队打造的 **AI 智能创作双引擎工作台**。聚焦内容生产的两大核心阶段：

1. **媒眼 MediaLens**：智能选题策划与 10 维事实核查框架
2. **镜序 ShotFlow**：短视频视听分镜生成、锁定保真编辑与双版本 Diff 对比工作台

- 🌐 在线体验网址：[https://william77710.github.io/ai-media-portfolio/](https://william77710.github.io/ai-media-portfolio/)
- 💻 开源仓库：[https://github.com/william77710/ai-media-portfolio](https://github.com/william77710/ai-media-portfolio)

---

## 核心工作流功能矩阵

### 1. 媒眼 MediaLens（智能选题策划与事实框架）
- **10 维全景策划**：涵盖选题价值、目标受众、报道角度、多元信源、阶梯式采访提纲、已知事实、各方观点、待核实疑点、事实核查清单、跨媒介标题矩阵。
- **事实风控机制**：数据与事实类信息强制标注「待核实」，形成双信源交叉验证的核查 Checklist。
- **20 组垂直场景**：覆盖青年职场、科技与传媒、城市民生、生态环保、文化非遗、新消费业态等真实选题。
- **一键导出策划案**：支持导出标准 Markdown 采编审稿单与调研提纲。

### 2. 镜序 ShotFlow（短视频视听分镜工作台）
- **9 维专业视听参数**：景别（全/中/近/特）、机位运镜、画面描述、人物动作、旁白台词、字幕花字、音效配乐、转场方式、AI生图提示词。
- **锁定保真机制（Lock-Preserved）**：支持锁定满意镜头，全量重新生成或修改整体时长时，锁定镜头位置与参数保持绝对不变。
- **动态时长控制**：设定目标成片时长（≥15s 正整数），自动校验超限状态。
- **双版本 Diff 对比**：可视化对比两个历史版本的镜头变动（新增/删除/修改/未变）。
- **制作级资产导出**：一键导出拍摄场记单（Markdown）与标准制作级 CSV 分镜表。
- **20 组分镜场景**：涵盖人物纪实、科技评测、知识科普、文旅风光、微短剧等垂直场景。

---

## 运行模式与 API 配置

1. **默认模式（零门槛即开即用）**：
   - 内置 **40 组精编场景案例库**（媒眼 20 + 镜序 20），无需输入任何 API Key 即可完整体验所有交互。
2. **真实大模型直连模式（Live AI）**：
   - 点击右上角 **「API 设置」** 按钮；
   - 支持配置 DeepSeek、豆包、OpenAI、Kimi 等 API Key 与自定义 Base URL；
   - **安全机制**：API Key 仅保存在浏览器本地 `localStorage`，直接与大模型接口通信，不经过任何第三方服务器中转。

---

## 本地开发与构建

```bash
# 1. 克隆代码
git clone https://github.com/william77710/ai-media-portfolio.git
cd ai-media-portfolio

# 2. 安装依赖
npm install

# 3. 启动本地开发服务
npm run dev

# 4. 构建发布静态包
npm run build
```
