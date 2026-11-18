#!/bin/bash
cd "$(dirname "$0")"
PY="$(pwd)/程序文件/.venv/bin/python"
[ -x "$PY" ] || { echo "请先运行「Mac-安装环境.command」"; read -p "按回车关闭"; exit 1; }
echo "正在获取全部中文音色（需要联网）..."
"$PY" 程序文件/template/list_voices.py "$(pwd)/AI音色列表.txt" || { echo "获取失败，请检查网络"; read -p "按回车关闭"; exit 1; }
open -e "$(pwd)/AI音色列表.txt"
