---
name: ai-explainer-video
description: 用代码自动生成“虚拟形象 + 手账风动画 + 关键词字幕”的横屏讲解视频（1920×1080）。用户给一段口播文稿（可附自己的录音），本技能负责拆分镜、处理声音、出静帧检查、渲染成片和混音。适用于知识讲解、AI 资讯、教程类短视频。
---

# AI 讲解视频流水线

你是这套流水线的执行助手。用户提供文稿（和可选的录音），你按下面的步骤把它做成成片。全程不需要剪辑软件。

## 带新手模式（用户说“带我做”或第一次使用时，按这个顺序走）
用户大多完全不懂编程。全程用中文、少用术语；每一步先用一句话说你要做什么，做完告诉他结果，再进入下一步。需要用户动手或确认的地方提前说清楚。

**项目根目录**：本文件所在“程序文件”文件夹的上一级。下面说的 `稿子.json`、`我的录音/`、`成片/` 都在根目录。

1. **装环境**
   - 检查 Node.js（18+）、Python（3.10+）、ffmpeg 是否可用。缺的话**先问用户同意**，再安装：Windows 用 `winget install -e --id OpenJS.NodeJS.LTS` / `Python.Python.3.12` / `Gyan.FFmpeg`；Mac 用 Homebrew（`brew install node python ffmpeg`，没有 Homebrew 就请用户先按清华镜像站的说明装）。装完新开终端再检查一次。
   - 在 `程序文件` 里运行 `npm install --registry=https://registry.npmmirror.com`；建虚拟环境 `python -m venv .venv`，再用它安装 `pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple`（国内镜像，速度快）。
2. **先出一条示例**：不改稿子，直接用内置 AI 配音出片（命令见下方“一条命令出片”）。告诉用户成片在 `成片/` 文件夹，让他打开看看。
3. **写稿**：问用户想讲什么主题、给谁看、大概多长。按这个结构写口播稿：前 10 秒必须有冲突（戳中常见错误做法 / 反常识结论 / 分级对号入座，三选一）→ 一句话讲原因 → 2–3 个能马上照做的步骤 → 结尾抛问题引导评论。口语化，每句不超过 20 字，不编造数据。**给用户看稿子，确认后**再按“第 1 步”的规则写进根目录的 `稿子.json`。
4. **选声音**：问用户用哪种：
   - 内置 AI 配音：运行 `python 程序文件/template/list_voices.py 根目录/AI音色列表.txt`，把列表给用户，让他挑一个，写进 `稿子.json` 的 `"voice"`（语速 `"rate"`）。不要替用户挑。
   - 其他配音工具（剪映文本朗读、豆包/火山引擎语音合成等）：告诉他按稿子顺序生成、每句之间加半秒停顿、导出后放进 `我的录音/`。
   - 自己录：手机就行，开头安静 1 秒，每句之间停半秒，放进 `我的录音/`。
5. **出片**：先出 3–4 张静帧自己检查（文字超框、遮挡、字幕、标黄），有问题改 `稿子.json` 重来；没问题再出整片。告诉用户成片的位置和时长。
6. **收尾**：告诉用户以后做新视频只要跟你说“用这个项目再做一期，主题是……”；还可以换成自己的卡通形象、加新画面（见下文）。

**一条命令出片**（在根目录运行；Windows 的 Python 是 `程序文件\.venv\Scripts\python.exe`，Mac 是 `程序文件/.venv/bin/python`）：
```
设置环境变量 SCRIPT_JSON=根目录/稿子.json，BUILD_DIR=根目录/程序文件/template/build，OUT_MP4=根目录/成片/成片-日期时间.mp4
python 程序文件/template/voice.py                 # 我的录音/ 里有音频时改为：voice.py --rec 音频路径
node   程序文件/template/render.js 2,6,10,14      # 先出静帧检查（生成在 BUILD_DIR）
node   程序文件/template/render.js                # 出整片画面
python 程序文件/template/mix.py                   # 混音，输出到 OUT_MP4
```
不要直接调用根目录的 `.bat` / `.command`，它们结尾会等待按键，适合用户自己双击，不适合你运行。

**更新项目**：用户说“更新”时，在根目录运行 `git pull`（是用压缩包下载的就请他重新下载），不要覆盖他的 `稿子.json`、`我的录音/`、`成片/`。

**规矩**：安装软件、联网下载前先说明并征得同意；报错先自己排查，三次还解决不了就把报错原文告诉用户；不确定用户意图时就问。

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
- 双击脚本是给不用 agent 的人准备的备用方案；你按上面“带新手模式”直接运行命令即可。

## 第 0 步：检查环境（只做一次）
1. 需要 Node.js 18+、Python 3.10+、ffmpeg（命令行能直接运行 `ffmpeg -version`）。安装方法见“带新手模式”第 1 步，装之前先征得用户同意。
2. 依赖装在 `程序文件` 里：`npm install`，以及 `.venv` 虚拟环境里的 `pip install -r requirements.txt`（国内用上面的镜像）。
3. 中文字体会自动找系统自带的（Windows 微软雅黑 / Mac 苹方）。找不到时，设置环境变量 `FONT_FILES`（字体文件路径，逗号分隔）和 `FONT_FAMILY`（字体名）。

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
