"""配音 + 时间轴。
用法：
  python -I voice.py                 # AI 配音（免费，需联网）。音色/语速在稿子里的 "voice"、"rate" 设置
  python -I voice.py --rec 录音.m4a   # 用你自己的录音（整段读完 script.json 的句子，句间停顿半秒以上）
录音处理：降噪 → 去低频嗡声 → 去齿音 → 压缩 → 响度统一，再按停顿自动切成句子。
输出 build/voice.wav + build/timeline.json（每句起止时间、每帧音量）
"""
import asyncio, json, subprocess, sys, wave, os
import numpy as np

FPS = 30
GAP = 0.4          # AI 配音时的句间停顿（秒）
LEAD = 0.4          # 开头留白
TAIL = 1.5          # 结尾留白
SR = 48000
HERE = os.path.dirname(os.path.abspath(__file__))
B = os.environ.get("BUILD_DIR") or os.path.join(HERE, "build")
os.makedirs(B, exist_ok=True)
script = json.load(open(os.environ.get("SCRIPT_JSON") or os.path.join(HERE, "script.json"), encoding="utf-8-sig"))
NL = len(script["lines"])

# 人声处理链：80Hz 高通去嗡声 / FFT 降噪（先用开头 0.5 秒学习底噪）/ 去齿音 / 轻压缩 / 增加一点清晰度
CLEAN = ("highpass=f=80,"
         "afftdn=nr=18:nf=-40:tn=1,"
         "deesser=i=0.4,"
         "acompressor=threshold=-20dB:ratio=3:attack=8:release=120:makeup=2,"
         "equalizer=f=3500:t=q:w=1.2:g=2,"
         "loudnorm=I=-16:TP=-1.5:LRA=9")


def ffmpeg(*args):
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *args], check=True)


def read_wav(p):
    with wave.open(p) as w:
        return np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768


def write_wav(p, a):
    with wave.open(p, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.clip(a, -1, 1) * 32767).astype(np.int16).tobytes())


async def tts_parts():
    import edge_tts
    parts = []
    for i, ln in enumerate(script["lines"]):
        mp3 = os.path.join(B, f"l{i}.mp3"); wav = os.path.join(B, f"l{i}.wav")
        voice = ln.get("voice") or script.get("voice") or "zh-CN-YunxiNeural"   # 音色：稿子.json 里的 "voice"（每句也可单独写）
        rate = ln.get("rate") or script.get("rate") or "+0%"                   # 语速：如 "+10%" 更快，"-10%" 更慢
        await edge_tts.Communicate(ln["text"], voice, rate=rate).save(mp3)
        ffmpeg("-i", mp3, "-ac", "1", "-ar", str(SR), wav)
        a = read_wav(wav)
        idx = np.where(np.abs(a) > 0.01)[0]
        parts.append(a[max(idx[0] - 800, 0): idx[-1] + 1600])
    return parts


def split_recording(path):
    """降噪处理后，按最长的 NL-1 段停顿把整段录音切成 NL 句。"""
    clean = os.path.join(B, "rec_clean.wav")
    ffmpeg("-i", path, "-ac", "1", "-ar", str(SR), "-af", CLEAN, clean)
    a = read_wav(clean)
    hop = SR // 100                                   # 10ms 一格
    n = len(a) // hop
    e = np.sqrt(np.mean(a[: n * hop].reshape(n, hop) ** 2, axis=1))
    thr = max(np.percentile(e, 20) * 3, e.max() * 0.04)
    voiced = e > thr
    # 连续的说话区段（小于 0.18s 的空隙并进去）
    segs, start, gap = [], None, 0
    for i, v in enumerate(voiced):
        if v:
            if start is None: start = i
            gap = 0
        elif start is not None:
            gap += 1
            if gap > 18:
                segs.append([start, i - gap + 1]); start, gap = None, 0
    if start is not None: segs.append([start, n])
    segs = [s for s in segs if s[1] - s[0] > 15]       # 去掉 0.15 秒以下的杂音
    if len(segs) < NL:
        sys.exit(f"只检测到 {len(segs)} 段话，但稿子有 {NL} 句。请在句子之间停顿半秒以上再录。")
    # 取最长的 NL-1 个停顿作为句子分界
    gaps = sorted(range(len(segs) - 1), key=lambda k: segs[k + 1][0] - segs[k][1], reverse=True)[: NL - 1]
    cuts = sorted(gaps)
    lines, s0 = [], 0
    for k in cuts + [len(segs) - 1]:
        lines.append([segs[s0][0], segs[k][1]]); s0 = k + 1
    parts = [a[max(s * hop - 1600, 0): min(t * hop + 2400, len(a))] for s, t in lines]
    return parts


def main():
    rec = sys.argv[sys.argv.index("--rec") + 1] if "--rec" in sys.argv else None
    parts = split_recording(rec) if rec else asyncio.run(tts_parts())
    gap = 0.18 if rec else GAP                          # 真声自带呼吸停顿，拼接时少留一点
    out, spans, t = [np.zeros(int(LEAD * SR), np.float32)], [], LEAD
    for p in parts:
        spans.append([round(t, 3), round(t + len(p) / SR, 3)])
        out += [p, np.zeros(int(gap * SR), np.float32)]
        t += len(p) / SR + gap
    out.append(np.zeros(int(TAIL * SR), np.float32))
    audio = np.concatenate(out)
    write_wav(os.path.join(B, "voice.wav"), audio)
    hop = SR // FPS
    n = len(audio) // hop
    rms = np.sqrt(np.mean(audio[: n * hop].reshape(n, hop) ** 2, axis=1))
    level = (rms / (rms.max() + 1e-9)).round(3).tolist()
    json.dump({"fps": FPS, "duration": round(len(audio) / SR, 3), "spans": spans, "level": level, "source": "rec" if rec else "tts"},
              open(os.path.join(B, "timeline.json"), "w", encoding="utf-8", newline="\n"))
    print("source", "rec" if rec else "tts", "duration", round(len(audio) / SR, 2), "spans", spans)


main()
