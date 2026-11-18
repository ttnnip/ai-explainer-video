"""列出内置 AI 配音能用的全部中文音色，写进 AI音色列表.txt
用法：python list_voices.py <输出文件>
"""
import asyncio, sys
import edge_tts

out = sys.argv[1] if len(sys.argv) > 1 else "AI音色列表.txt"


async def main():
    vs = await edge_tts.list_voices()
    zh = [v for v in vs if v["Locale"].startswith("zh-")]
    zh.sort(key=lambda v: (v["Locale"], v["ShortName"]))
    gender = {"Male": "男声", "Female": "女声"}
    cn = {"Warm": "温暖", "Lively": "活泼", "Passion": "激情", "Sunshine": "阳光", "Cute": "可爱",
          "Professional": "专业", "Reliable": "稳重", "Humorous": "幽默", "Bright": "明亮",
          "Friendly": "友好", "Positive": "积极", "Considerate": "体贴", "Comfort": "舒适",
          "Pleasant": "亲切", "Gentle": "温柔", "Calm": "沉稳", "Cheerful": "开朗",
          "Confident": "自信", "Authoritative": "权威", "Clear": "清晰", "Rational": "理性"}
    lines = [
        "内置 AI 配音可用的中文音色（共 %d 个）" % len(zh),
        "",
        "怎么换：用记事本打开「稿子.json」，把第 3 行 \"voice\" 后面引号里的名字，换成下面任意一个，保存后双击出片就能听到。",
        "例如：\"voice\": \"zh-CN-XiaoxiaoNeural\"",
        "语速：改 \"rate\"，比如 \"+10%\" 更快，\"-10%\" 更慢。",
        "",
        "zh-CN = 普通话，zh-TW = 台湾，zh-HK = 粤语，zh-CN-liaoning / shaanxi 等 = 方言",
        "",
    ]
    for v in zh:
        tag = v.get("VoiceTag", {}) or {}
        pers = "、".join(cn.get(p, p) for p in (tag.get("VoicePersonalities", []) or []))
        lines.append(f"{v['ShortName']:<34}{gender.get(v['Gender'], v['Gender'])}  {pers}")
    open(out, "w", encoding="utf-8-sig", newline="\r\n").write("\n".join(lines) + "\n")
    print("voices", len(zh))


asyncio.run(main())
