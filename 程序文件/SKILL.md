---
name: ai-explainer-video
description: 用代码自动生成“虚拟形象 + 手账风动画 + 关键词字幕”的横屏讲解视频（1920×1080）。用户给一段口播文稿（可附自己的录音），本技能负责拆分镜、处理声音、出静帧检查、渲染成片和混音。适用于知识讲解、AI 资讯、教程类短视频。
---

# AI 讲解视频流水线

你是这套流水线的执行助手。用户提供文稿（和可选的录音），你按下面的步骤把它做成成片。全程不需要剪辑软件。

## 目录结构
```
avatar/avatar.js     虚拟形象（矢量绘制，含表情、口型、眨眼）
avatar/export.js     导出形象的透明底 PNG 素材（可选）
template/script.json 本期稿子：每句的文字、高亮词、表情、场景和画面数据
template/voice.py    配音 + 时间轴（AI 配音，或处理用户自己的录音）
template/render.js   逐帧渲染画面（场景库在 SCENES 里）
template/hand.js     手账动效：手绘描边、笔尖、荧光笔、胶带、便利贴
template/mix.py      混音：人声 + 自动合成音效 + 背景音乐
```

## 用户拿到的整包结构（本文件在“程序文件”里）
```
上一级/0-先看我-完整教程.html   给人看的完整教程
上一级/1-双击安装环境.bat、2-双击出片.bat（Mac 为 .command）  一键安装 / 一键出片
上一级/稿子.json      用户真正在改的稿子（格式同 template/script.json）
上一级/我的录音/      用户的录音放这里
上一级/成片/          成片输出
```
- 如果上一级有 `稿子.json`，**以它为准**：运行脚本前设置环境变量 `SCRIPT_JSON=上一级/稿子.json`，成片路径用 `OUT_MP4=上一级/成片/xxx.mp4`。
- 一键脚本用的 Python 在 `程序文件/.venv` 里（Windows：`.venv\Scripts\python.exe`，Mac：`.venv/bin/python`），直接调用它，不要另装依赖到系统 Python。
- 用户只是想出片时，直接让他双击 `2-双击出片`；需要改形象、加场景时才按下面的步骤动代码。

## 第 0 步：检查环境（只做一次）
1. 需要 Node.js 18+、Python 3.10+、ffmpeg（命令行能直接运行 `ffmpeg -version`）。缺哪个就告诉用户去装，不要替用户改系统设置。
2. 在项目根目录运行 `npm install`，再运行 `pip install -r requirements.txt`。
3. 中文字体会自动找系统自带的（Windows 微软雅黑 / Mac 苹方）。找不到时，让用户设置环境变量 `FONT_FILES`（字体文件路径，逗号分隔）和 `FONT_FAMILY`（字体名）。

## 第 1 步：把文稿写成 script.json
- 一句话一个对象。每句 **3–5 秒**最合适，太长就拆成两句。
- 字段：
  - `text`：这句的原话（字幕显示的就是它，必须和录音一致）
  - `hl`：要标黄的关键词（必须是 `text` 里出现的原词）
  - `expr`：形象表情，可选 `normal` / `happy` / `surprised` / `thinking` / `question`。多用 happy、surprised，少用 normal
  - `scene`：画面类型（见下表）
  - `chapter`：可选，左上角的章节标签，如 `["一", "是什么"]`
  - `data`：该场景需要的文字
- 场景库：

| scene | 适合 | data 字段 | 字数建议 |
|---|---|---|---|
| `hook` | 开场抛出关键词 | `sub` 小标题，`big` 大关键词 | sub ≤ 16 字，big ≤ 6 字 |
| `define` | 定义一个概念 | `term` 术语，`cover` 书封面字，`prefix` 前缀，`def` 定义 | def ≤ 6 字 |
| `list` | 2–3 个要点 | `title`，`items[{label, icon}]` | label ≤ 5 字 |
| `compare` | 前后/有无对比 | `left{title,note}`，`right{title,note}`，`key` 结论关键词 | note ≤ 7 字 |

  `icon` 可选：`target` `steps` `check` `idea` `chat` `code`。
- 画面元素出现的时间点，按“关键词在这句话里的位置”自动估算，所以 `big`、`def`、`label`、`key` 最好就是原话里的词。
- 字太长会自动缩小，但缩太多会看不清：宁可拆句子，也不要硬塞。

## 第 2 步：声音（三选一）
- **内置 AI 配音（默认，免费，需要联网）**：`python template/voice.py`。
  - 音色：稿子顶层的 `"voice"`（如 `"zh-CN-YunxiNeural"`），语速：`"rate"`（如 `"+10%"`）。某一句要换声音，在那一句里单独写 `"voice"` / `"rate"`。
  - 全部可用中文音色：`python template/list_voices.py 输出文件.txt`，或让用户双击 `3-查看AI音色`。不要替用户挑音色，把列表给他选。
- **其他配音工具生成的音频**（剪映文本朗读、豆包/火山引擎语音合成等，可复刻用户声音）或 **用户自己录音**：都走同一条路：
  `python template/voice.py --rec 音频文件路径`
  音频必须按稿子顺序、**句与句之间停顿半秒以上**（配音工具里每句换行或插入停顿；自己录时开头先安静 1 秒）。会自动降噪、去齿音、压缩、统一响度，并按停顿切成句子。报“只检测到 X 段”就是停顿不够。
- 输出：`template/build/voice.wav` 和 `template/build/timeline.json`。

## 第 3 步：先出静帧检查，再出整片
1. `node template/render.js 2,6,10,14`（逗号后是秒数），会在 `template/build/` 生成 still_秒.png。
2. **逐张看图**：字有没有超出卡片、有没有被形象挡住、字幕是否完整、关键词标黄是否正确。有问题改 script.json 再出静帧。
3. 没问题再运行 `node template/render.js` 出整片画面（每秒成片大约需要 10–15 秒渲染）。

## 第 4 步：混音出片
`python template/mix.py [背景音乐文件]`
- 背景音乐可省略。用的话必须是用户有版权或免版税的音乐。
- 成片：`template/build/样片.mp4`。最后抽 3–5 帧看一遍，并告诉用户时长和响度（可用 `ffmpeg -i 样片.mp4 -af ebur128 -f null -` 查看，正常在 -14 到 -18 LUFS）。

## 换成用户自己的形象
`avatar/avatar.js` 里是一个示例小机器人“小方”，**只作示例**。用户要做自己的形象：
1. 让用户提供 2–3 张正脸清晰的照片，说明想要的风格（如 Q 版、日系）和固定配饰（如耳机、眼镜）。
2. 只改 `renderAvatar` 里画身体和头部的部分（目前是身体、天线、耳朵、头壳、脸屏，换成头发、脸型、衣服、配饰），以及眉眼样式（`EYE_STYLES`）和配色；保留 `${eyes}`、眉毛、`${m}`（嘴）这几处插入点、`renderAvatar` 的参数和 `lipSync` 口型函数，这样表情、口型和视频模板都不用动。眼睛和嘴的位置在 `EX`、`EY` 和 `MOUTH` 里，脸的位置要和它们对齐。
3. 每改一版运行 `node avatar/export.js`，看 `avatar/output/总览.png`，**一次给用户 3–4 个版本对比**，比一版一版改快得多。

## 新增场景
在 `template/render.js` 的 `SCENES` 里照着现有场景加一个函数 `(t, i, d) => svg字符串`：
- 用 `kwTime(i, 关键词)` 拿到关键词被说出的时间，元素在那一刻出现。
- 动效从 `hand.js` 取：`writeOn` 手写出现、`drawOn` 手绘线条、`drawArrow` 箭头、`marker` 荧光笔、`tape` 胶带、`sticky` 便利贴；`pop`/`rise` 弹出和上滑。
- 用 `addSfx(时间, 'pop' | 'whoosh' | 'ding' | 'scribble', 时长)` 配音效。
- 内容区在画面左侧 x 120–1400，右下角留给形象，底部 y > 930 留给字幕。

## 注意
- 字幕就是 `text` 原文，改了录音就要同步改 `text`。
- 不要编造数据。稿子里有数字、结论时，确认来源。
- 渲染、混音的每一步都把实际结果（时长、报错、检查图）告诉用户，没检查的就说没检查。
