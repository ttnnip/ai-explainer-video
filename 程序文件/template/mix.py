"""混音：人声 + 合成音效（pop/whoosh/ding）+ 低音量背景音乐 → 成片
用法：python mix.py [背景音乐路径]
"""
import json, os, subprocess, sys, wave
import numpy as np

SR = 48000
HERE = os.path.dirname(os.path.abspath(__file__)); B = os.environ.get("BUILD_DIR") or os.path.join(HERE, "build")
rng = np.random.default_rng(1)


def env(n, k):
    return np.exp(-np.arange(n) / SR * k)


def pop():
    n = int(0.12 * SR); t = np.arange(n) / SR
    f = 950 - 450 * t / 0.12
    return 0.35 * np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, 38)


def whoosh():
    n = int(0.38 * SR); x = rng.standard_normal(n)
    # 简单低通 + 包络起伏
    y = np.convolve(x, np.ones(24) / 24, mode="same")
    shape = np.sin(np.pi * np.arange(n) / n) ** 2
    return 0.22 * y * shape


def ding():
    n = int(0.7 * SR); t = np.arange(n) / SR
    return 0.22 * (np.sin(2 * np.pi * 1318 * t) + 0.6 * np.sin(2 * np.pi * 1976 * t)) * env(n, 7)


def scribble(d=0.6):
    """笔尖在纸上划写：带通沙沙声 + 按笔画起伏的音量"""
    n = int(d * SR); t = np.arange(n) / SR
    x = rng.standard_normal(n)
    hp = x - np.convolve(x, np.ones(6) / 6, mode="same")        # 去低频
    y = np.convolve(hp, np.ones(3) / 3, mode="same")           # 去最刺耳的高频
    stroke = 0.55 + 0.45 * np.abs(np.sin(2 * np.pi * 7.5 * t + rng.uniform(0, 3)))  # 每秒约 15 笔
    fade = np.minimum(1, np.minimum(t / 0.03, (d - t) / 0.06))
    return 0.09 * y * stroke * fade


SND = {"pop": pop(), "whoosh": whoosh(), "ding": ding()}

with wave.open(os.path.join(B, "voice.wav")) as w:
    voice = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768
fx = np.zeros_like(voice)
for e in json.load(open(os.path.join(B, "sfx.json"), encoding="utf-8")):
    s = scribble(e.get("d", 0.6)) if e["kind"] == "scribble" else SND[e["kind"]]; i = int(max(e["t"] - (0.12 if e["kind"] == "whoosh" else 0), 0) * SR)
    j = min(i + len(s), len(fx)); fx[i:j] += s[: j - i]
with wave.open(os.path.join(B, "sfx.wav"), "wb") as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((np.clip(fx, -1, 1) * 32767).astype(np.int16).tobytes())

dur = len(voice) / SR
bgm = sys.argv[1] if len(sys.argv) > 1 else None
inputs = ["-i", os.path.join(B, "video_noaudio.mp4"), "-i", os.path.join(B, "voice.wav"), "-i", os.path.join(B, "sfx.wav")]
fc = "[1]loudnorm=I=-16:TP=-1.5,aresample=48000[v];[2]volume=0.9[s];"
if bgm:
    inputs += ["-i", bgm]
    fc += f"[3]atrim=0:{dur},loudnorm=I=-16,volume=0.12,afade=t=in:d=0.5,afade=t=out:st={dur-1.2}:d=1.2[m];[v][s][m]amix=inputs=3:normalize=0[a]"
else:
    fc += "[v][s]amix=inputs=2:normalize=0[a]"
out = os.environ.get("OUT_MP4") or os.path.join(B, "样片.mp4")
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *inputs, "-filter_complex", fc, "-map", "0:v", "-map", "[a]",
                "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", out], check=True)
print("done", round(dur, 2), "s")
