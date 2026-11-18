#!/bin/bash
# Mac 用户：右键本文件 → 打开（第一次需要这样，之后双击即可）
cd "$(dirname "$0")"
echo
echo "== 第 1 步：检查 Node.js、Python、ffmpeg =="
missing=""
command -v node >/dev/null 2>&1 || missing="$missing node"
command -v python3 >/dev/null 2>&1 || missing="$missing python"
command -v ffmpeg >/dev/null 2>&1 || missing="$missing ffmpeg"
if [ -n "$missing" ]; then
  echo "还缺：$missing"
  if command -v brew >/dev/null 2>&1; then
    echo "用 Homebrew 安装（国内镜像）..."
    export HOMEBREW_BOTTLE_DOMAIN=https://mirrors.tuna.tsinghua.edu.cn/homebrew-bottles
    brew install $missing || { echo "安装失败，把报错发给 AI 或发到群里问我"; read -p "按回车关闭"; exit 1; }
  else
    echo "这台 Mac 还没有 Homebrew。请先按「0-先看我-完整教程.html」第 2 步安装 Homebrew，再重新运行本文件。"
    read -p "按回车关闭"; exit 1
  fi
fi
echo
echo "== 第 2 步：安装依赖（国内镜像）=="
cd 程序文件
npm install --registry=https://registry.npmmirror.com || { echo "npm 安装失败"; read -p "按回车关闭"; exit 1; }
[ -d .venv ] || python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple || { echo "pip 安装失败"; read -p "按回车关闭"; exit 1; }
echo
echo "安装完成！下一步：右键「Mac-出片.command」→ 打开，先做一条示例视频。"
read -p "按回车关闭"
