# -*- coding: utf-8 -*-
"""本地录音转写：ffmpeg 解码为 16k 单声道，绕开 PyAV 版本兼容问题。"""
import os, time, wave, subprocess, tempfile

AUDIO = "D:/xwechat_files/wxid_4cpo95b3j2i822_e6c4/msg/file/2026-11/075536566587_20261104_144037.m4a"
MODEL_DIR = "C:/Users/26870/.cache/huggingface/hub/models--Systran--faster-whisper-small/snapshots/536b0662742c02347bc0e980a01041f333bce120"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "transcript.txt")

import numpy as np
from faster_whisper import WhisperModel

# 1) ffmpeg 解码成 16kHz 单声道 WAV
wav_path = os.path.join(tempfile.gettempdir(), "asr_input.wav")
subprocess.run(
    ["ffmpeg", "-y", "-loglevel", "error", "-i", AUDIO, "-ar", "16000", "-ac", "1", wav_path],
    check=True, capture_output=True,
)
with wave.open(wav_path, "rb") as w:
    raw = w.readframes(w.getnframes())
audio = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0
print("音频样本数 %d，约 %.1f 秒" % (audio.size, audio.size / 16000.0))

# 2) 转写
t0 = time.time()
model = WhisperModel(MODEL_DIR, device="cpu", compute_type="int8")
segments, info = model.transcribe(
    audio,
    language="zh",
    beam_size=5,
    vad_filter=True,
    initial_prompt="以下是普通话录音，内容涉及课程作业、文档撰写、活动报告。",
)
parts = []
for seg in segments:
    parts.append(seg.text.strip())
text = "".join(parts)
print("=== 用时 %.1fs / 片段 %d ===" % (time.time() - t0, len(parts)))
print(text)
with open(OUT, "w", encoding="utf-8") as f:
    f.write(text)
