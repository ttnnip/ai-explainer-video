#!/bin/bash
cd "$(dirname "$0")"
ROOT="$(pwd)"
export SCRIPT_JSON="$ROOT/稿子.json"
export BUILD_DIR="$ROOT/程序文件/template/build"
PY="$ROOT/程序文件/.venv/bin/python"
fail() { echo; echo "出错了：稿子.json 格式不对、录音停顿太短，或其他报错。把上面的报错发给 AI 或发到群里问我。"; read -p "按回车关闭"; exit 1; }
[ -x "$PY" ] && [ -d "$ROOT/程序文件/node_modules" ] || { echo "请先运行「Mac-安装环境.command」"; read -p "按回车关闭"; exit 1; }

echo "== 第 1 步：声音 =="
REC=$(ls -t 我的录音/*.{m4a,mp3,wav,aac,flac} 2>/dev/null | head -1)
if [ -n "$REC" ]; then echo "用你的录音：$REC"; "$PY" 程序文件/template/voice.py --rec "$REC" || fail
else echo "「我的录音」里没有音频，使用 AI 配音（需要联网；音色在稿子.json 的 voice 里改）"; "$PY" 程序文件/template/voice.py || fail; fi

echo "== 第 2 步：生成画面（每 1 秒视频约 10-15 秒）=="
node 程序文件/template/render.js || fail

echo "== 第 3 步：混音合成 =="
export OUT_MP4="$ROOT/成片/成片-$(date +%Y%m%d-%H%M).mp4"
"$PY" 程序文件/template/mix.py || fail
echo; echo "完成！成片：$OUT_MP4"
open "$ROOT/成片"
read -p "按回车关闭"
