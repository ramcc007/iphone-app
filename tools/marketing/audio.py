#!/usr/bin/env python3
"""Soundtrack for the NumFall short videos: original music bed, game-like sound effects and voice-over lines.

Everything except the voice is synthesised here, so there is nothing to license.
Voice: Kokoro (Apache-2.0) via tools/marketing/say.py.
Usage: python audio.py events.json out.wav
events.json: {"duration": s, "music": {"bpm": 124, "mood": "drive"|"tense"|"chill"}, "events": [{"at": s, "name": "drop", ...}], "vo": [{"at": s, "file": "x.wav"}]}
"""
import json
import sys

import numpy as np
import soundfile as sf

SR = 44100
rng = np.random.default_rng(7)


def t_axis(sec):
    return np.arange(int(sec * SR)) / SR


def env(n, a=0.002, d=0.1):
    t = np.arange(n) / SR
    e = np.minimum(1, t / max(a, 1e-4)) * np.exp(-t / d)
    return e


def note_hz(semis_from_a4):
    return 440.0 * 2 ** (semis_from_a4 / 12)


# ---- Sound effects -------------------------------------------------------------------------
def sfx_drop(step=0):
    # Soft whoosh, then a woody "thock" whose pitch rises with each correct drop in a row (satisfying scale).
    scale = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24]
    semi = scale[min(step, len(scale) - 1)]
    n = int(0.22 * SR)
    t = np.arange(n) / SR
    noise = rng.standard_normal(n) * np.exp(-((t - 0.05) ** 2) / 0.0012) * 0.12
    f = note_hz(semi + 3) * (1 + 0.6 * np.exp(-t / 0.01))
    thock = np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, 0.001, 0.07) * 0.55
    thock[: int(0.06 * SR)] *= np.linspace(0, 1, int(0.06 * SR)) ** 0.3
    out = np.zeros(n)
    out += noise
    out[int(0.06 * SR):] += thock[: n - int(0.06 * SR)]
    return out


def sfx_wrong():
    n = int(0.42 * SR)
    t = np.arange(n) / SR
    buzz = np.sign(np.sin(2 * np.pi * 130 * t)) * 0.18 + np.sign(np.sin(2 * np.pi * 137 * t)) * 0.12
    thud = np.sin(2 * np.pi * 70 * t) * np.exp(-t / 0.08) * 0.6
    return (buzz * env(n, 0.003, 0.18) + thud)


def sfx_chime(root=0):
    n = int(1.2 * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for i, s in enumerate([0, 4, 7, 12, 16]):
        start = int(i * 0.06 * SR)
        m = n - start
        tt = np.arange(m) / SR
        f = note_hz(root + s + 3)
        tone = (np.sin(2 * np.pi * f * tt) + 0.3 * np.sin(2 * np.pi * 2 * f * tt)) * np.exp(-tt / 0.45) * 0.22
        out[start:] += tone
    return out


def sfx_pop():
    n = int(0.25 * SR)
    t = np.arange(n) / SR
    f = 500 + 1600 * (1 - np.exp(-t / 0.03))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, 0.001, 0.06) * 0.35


def sfx_whoosh():
    n = int(0.45 * SR)
    t = np.arange(n) / SR
    noise = rng.standard_normal(n)
    # crude band sweep: mix of differently smoothed noise
    k = np.exp(-((t - 0.2) ** 2) / 0.01)
    smooth = np.convolve(noise, np.ones(8) / 8, mode="same")
    return (noise - smooth) * k * 0.25


def sfx_tick():
    n = int(0.05 * SR)
    t = np.arange(n) / SR
    return np.sin(2 * np.pi * 2200 * t) * np.exp(-t / 0.006) * 0.25


def sfx_heart():
    n = int(0.5 * SR)
    t = np.arange(n) / SR
    beat = lambda off: np.where(t >= off, np.sin(2 * np.pi * 55 * (t - off)) * np.exp(-(t - off) / 0.07), 0)
    return (beat(0) + 0.7 * beat(0.16)) * 0.9


def sfx_beep(high=False):
    n = int(0.18 * SR)
    t = np.arange(n) / SR
    f = 1320 if high else 880
    return np.sin(2 * np.pi * f * t) * env(n, 0.002, 0.08) * 0.3


def sfx_boom():
    n = int(1.0 * SR)
    t = np.arange(n) / SR
    f = 90 * np.exp(-t / 0.4) + 35
    sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.35) * 0.8
    crack = rng.standard_normal(n) * np.exp(-t / 0.05) * 0.25
    return sub + crack


SFX = {"drop": sfx_drop, "wrong": sfx_wrong, "chime": sfx_chime, "pop": sfx_pop, "whoosh": sfx_whoosh,
       "tick": sfx_tick, "heart": sfx_heart, "beep": sfx_beep, "boom": sfx_boom}


# ---- Music bed -----------------------------------------------------------------------------
def music(duration, bpm=124, mood="drive"):
    beat = 60 / bpm
    total = np.zeros(int(duration * SR) + SR)
    chords = {"drive": [(-12, [0, 3, 7]), (-16, [0, 4, 7]), (-9, [0, 4, 7]), (-14, [0, 4, 7])],   # Am F C G
              "tense": [(-12, [0, 3, 7]), (-12, [0, 3, 8]), (-13, [0, 4, 7]), (-12, [0, 3, 7])],
              "chill": [(-7, [0, 4, 7, 11]), (-10, [0, 3, 7, 10]), (-12, [0, 4, 7, 11]), (-14, [0, 4, 7, 10])]}[mood]
    def place(sig, at):
        i = int(at * SR)
        if i >= len(total):
            return
        m = min(len(sig), len(total) - i)
        total[i:i + m] += sig[:m]
    steps = int(duration / (beat / 4)) + 1
    for k in range(steps):
        at = k * beat / 4
        bar = int(at / (beat * 4)) % 4
        root, triad = chords[bar]
        sixteenth = k % 16
        if mood != "chill" and sixteenth % 4 == 0:        # kick on every beat
            n = int(0.3 * SR); t = np.arange(n) / SR
            f = 50 + 120 * np.exp(-t / 0.03)
            place(np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.12) * 0.55, at)
        if mood != "chill" and sixteenth in (4, 12):      # clap
            n = int(0.18 * SR); t = np.arange(n) / SR
            place(rng.standard_normal(n) * np.exp(-t / 0.04) * 0.16, at)
        if sixteenth % 2 == 1:                            # hats
            n = int(0.05 * SR); t = np.arange(n) / SR
            hp = rng.standard_normal(n); hp = hp - np.convolve(hp, np.ones(4) / 4, mode="same")
            place(hp * np.exp(-t / 0.012) * (0.07 if mood != "chill" else 0.04), at)
        if sixteenth % 4 == 2 or (mood == "drive" and sixteenth % 8 == 7):   # bass
            n = int(beat / 2 * SR); t = np.arange(n) / SR
            f = note_hz(root - 12)
            saw = 2 * ((f * t) % 1) - 1
            place(np.tanh(saw * 1.5) * env(n, 0.005, 0.18) * 0.16, at)
        # pluck arpeggio
        if mood == "tense" and sixteenth % 2 == 1:
            continue
        s = triad[(k // (1 if mood != "chill" else 2)) % len(triad)] + root + 24
        n = int(0.28 * SR); t = np.arange(n) / SR
        f = note_hz(s)
        pl = (np.sin(2 * np.pi * f * t) + 0.5 * np.sin(2 * np.pi * 2 * f * t + 0.3)) * np.exp(-t / 0.09) * 0.07
        place(pl, at)
    return total[: int(duration * SR)]


def main():
    spec = json.load(open(sys.argv[1]))
    dur = spec["duration"]
    n = int(dur * SR)
    fx = np.zeros(n + SR * 2)
    for ev in spec["events"]:
        sig = SFX[ev["name"]](**{k: v for k, v in ev.items() if k not in ("at", "name", "gain")})
        i = int(ev["at"] * SR)
        m = min(len(sig), len(fx) - i)
        if m > 0:
            fx[i:i + m] += sig[:m] * ev.get("gain", 1.0)
    vo = np.zeros(n + SR * 6)
    for line in spec.get("vo", []):
        sig, sr = sf.read(line["file"])
        if sig.ndim > 1:
            sig = sig.mean(axis=1)
        if sr != SR:
            idx = np.arange(0, len(sig), sr / SR)
            sig = np.interp(idx, np.arange(len(sig)), sig)
        i = int(line["at"] * SR)
        m = min(len(sig), len(vo) - i)
        vo[i:i + m] += sig[:m] * line.get("gain", 1.0)
    vo = vo[:n]
    mus = music(dur, **spec.get("music", {})) if spec.get("music") else np.zeros(n)
    # Duck music under the voice.
    level = np.convolve(np.abs(vo), np.ones(int(0.15 * SR)) / int(0.15 * SR), mode="same")
    duck = 1 - 0.6 * np.clip(level * 20, 0, 1)
    # Fade music in/out.
    fade = np.ones(n)
    fi, fo = int(0.15 * SR), int(0.8 * SR)
    fade[:fi] = np.linspace(0, 1, fi)
    fade[-fo:] = np.linspace(1, 0, fo)
    mix = mus * duck * fade * 0.9 + fx[:n] * 0.85 + vo * 1.25
    peak = np.max(np.abs(mix)) or 1
    mix = np.tanh(mix / peak * 1.2) * 0.89   # gentle limiter
    sf.write(sys.argv[2], np.stack([mix, mix], axis=1), SR)


if __name__ == "__main__":
    main()
