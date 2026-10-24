#!/usr/bin/env python3
"""Speak one line with Kokoro (Apache-2.0). Usage: say.py <voice> <speed> <out.wav> <text>
Needs kokoro-onnx, soundfile and the model files kokoro-v1.0.onnx + voices-v1.0.bin in $KOKORO_DIR
(download from https://github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.0)."""
import os
import sys, soundfile as sf
from kokoro_onnx import Kokoro
D = os.environ.get("KOKORO_DIR", ".")
k = Kokoro(os.path.join(D, "kokoro-v1.0.onnx"), os.path.join(D, "voices-v1.0.bin"))
voice, speed, out, text = sys.argv[1], float(sys.argv[2]), sys.argv[3], sys.argv[4]
samples, sr = k.create(text, voice=voice, speed=speed, lang="en-us")
sf.write(out, samples, sr)
print(out, round(len(samples)/sr, 2), "s")
