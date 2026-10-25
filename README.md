# ECutAuto（演示版）

参考 ECutAuto 界面用 **Vue 3 + TypeScript + Vite + Pinia + Vue Router** 实现的 AI 视频自动化工具前端演示。

## 功能（11 个分类均已接入独立工作台）

| 分类 | 说明 |
|------|------|
| AI 智能混剪 / 视频混剪 | 三栏编辑器 + TTS / 字幕 / 批量数量 |
| 视频效果处理 | 视频列表 + 裂变 / 水印 / AI 分割 |
| 分类混剪 | 多文件夹排序 + 随机/顺序抽取 |
| 文案改写 | 三栏：原文 / 提示词 / 改写结果 |
| 视频内容提炼 | 切片列表 + AI / 手动模式 |
| 短剧混剪 | 全集文件夹 + 剧情精剪 / 高光 |
| 效率工具 ×4 | 批量裁剪、音频提取、字幕擦除、MD5 差异化 |

## 桌面版（推荐）

已集成 **Electron + FFmpeg（ffmpeg-static）**，11 个模块均可 **真实导出** 到本地目录（混剪/切片/效果/效率工具等）。

```bash
npm install
npm run dev
```

浏览器打开终端里显示的地址（一般为 `http://127.0.0.1:5173/`）。**不要**在 dev 崩溃后访问旧端口（会出现 Connection Reset）。

**桌面完整功能（导入/导出/FFmpeg）：**

```bash
npm run dev:app
```

会先起 Vite，再自动打开 Electron 窗口。

若 Electron 仍无法启动，可先构建再启动：

```bash
npm run build
npm run start
```

打包构建：

```bash
npm run build
npm run start
```

Windows 安装包（NSIS）：

```bash
npm run pack:win
```

输出目录：`release/`。

### 混剪增强（A / B）

- **TTS**：使用 Edge 在线语音（`node-edge-tts`），需联网；按句合成并混入成片。
- **字幕**：按句生成 SRT 并尝试烧录到导出视频。
- **预览**：桌面版中间播放器通过 `eauto://` 协议播放本地素材。
- **AI 选片**：
  - **本地模型**：文件名 / 关键词启发式匹配；
  - **云端模型**：首页 **全局设置** 填写 OpenAI API Key（或环境变量 `OPENAI_API_KEY`），使用嵌入语义选片。
- **文案改写**：配置 Key 后调用 `gpt-4o-mini` 真实改写并导出 txt。
- **BGM**：混剪设置中可选择 mp3/wav，导出时自动混入。
- **素材预览**：展开文件夹内视频列表，点击即可在中间播放器预览。

## 构建

```bash
npm run build
npm run preview
```

## 项目结构

- `src/views/HomeView.vue` — 首页
- `src/views/WorkspaceView.vue` — 功能工作台
- `src/data/features.ts` — 功能卡片数据
- `src/stores/workspace.ts` — 工作台 Pinia 状态
