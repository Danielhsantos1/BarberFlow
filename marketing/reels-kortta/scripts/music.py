"""Trilha sintetizada do Reels do Kortta (38 s, 120 BPM), sincronizada com os cortes do vídeo.

Uso: python3 scripts/music.py out.wav
"""
import sys
import wave

import numpy as np

SR = 44100
DUR = 38.0
BPM = 120
BEAT = 60 / BPM
N = int(SR * DUR)
rng = np.random.default_rng(7)

L = np.zeros(N)
R = np.zeros(N)


def add(sig, t0, gain=1.0, pan=0.0):
    i0 = int(t0 * SR)
    if i0 >= N:
        return
    sig = sig[: N - i0] * gain
    L[i0:i0 + len(sig)] += sig * np.sqrt(0.5 * (1 - pan))
    R[i0:i0 + len(sig)] += sig * np.sqrt(0.5 * (1 + pan))


def env(n, a=0.005, d=0.2, curve=4.0):
    t = np.arange(n) / SR
    e = np.exp(-t / d * curve / 4)
    na = max(1, int(a * SR))
    e[:na] *= np.linspace(0, 1, na)
    return e


def mtof(m):
    return 440 * 2 ** ((m - 69) / 12)


def lowpass(x, cutoff):
    # one-pole lowpass, cutoff may be array
    cutoff = np.broadcast_to(cutoff, x.shape)
    a = np.exp(-2 * np.pi * cutoff / SR)
    y = np.zeros_like(x)
    acc = 0.0
    for i in range(len(x)):
        acc = (1 - a[i]) * x[i] + a[i] * acc
        y[i] = acc
    return y


def lp_fast(x, cutoff):
    a = np.exp(-2 * np.pi * cutoff / SR)
    from scipy.signal import lfilter  # noqa
    return lfilter([1 - a], [1, -a], x)


try:
    import scipy  # noqa: F401
    LP = lp_fast
except ImportError:  # pragma: no cover
    LP = lambda x, c: lowpass(x, c)  # noqa: E731

# ---------------- instrumentos ----------------

def kick(gain=1.0):
    n = int(0.45 * SR)
    t = np.arange(n) / SR
    f = 48 + 110 * np.exp(-t * 28)
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(ph) * np.exp(-t * 7)
    click = rng.standard_normal(n) * np.exp(-t * 300) * 0.25
    return np.tanh((s + click) * 1.6) * gain


def clap():
    n = int(0.35 * SR)
    t = np.arange(n) / SR
    no = rng.standard_normal(n)
    e = np.exp(-t * 18)
    for off in (0.0, 0.011, 0.022):
        k = int(off * SR)
        e[k:] += np.exp(-np.arange(n - k) / SR * 90) * 0.6
    s = no * e
    s = s - LP(s, 900)  # highpass-ish
    return LP(s, 7000) * 0.5


def hat(open_=False):
    n = int((0.22 if open_ else 0.06) * SR)
    t = np.arange(n) / SR
    s = rng.standard_normal(n)
    s = s - LP(s, 7000)
    return s * np.exp(-t * (14 if open_ else 70)) * 0.35


def tick():
    n = int(0.03 * SR)
    t = np.arange(n) / SR
    return np.sin(2 * np.pi * 3200 * t) * np.exp(-t * 220) * 0.35


def saw(freq, n, detune=0.0):
    t = np.arange(n) / SR
    out = np.zeros(n)
    for d in (-detune, 0, detune):
        out += 2 * ((t * freq * (1 + d)) % 1) - 1
    return out / 3


def pad(notes, dur, cutoff=1800, gain=0.12):
    n = int(dur * SR)
    s = np.zeros(n)
    for m in notes:
        s += saw(mtof(m), n, 0.004)
    s = LP(LP(s, cutoff), cutoff)
    a = int(0.35 * SR)
    r = int(0.5 * SR)
    e = np.ones(n)
    e[:a] = np.linspace(0, 1, a)
    e[-r:] = np.linspace(1, 0, r)
    return s * e * gain


def pluck(m, dur=0.35, gain=0.18):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = mtof(m)
    s = (2 * ((t * f) % 1) - 1) + 0.5 * np.sin(2 * np.pi * f * 2 * t)
    s = LP(s, 2600) * np.exp(-t * 9)
    return s * gain


def bass(m, dur, gain=0.42):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = mtof(m)
    s = np.sin(2 * np.pi * f * t) + 0.35 * np.tanh(3 * np.sin(2 * np.pi * f * t))
    e = np.minimum(1, t / 0.01) * np.exp(-t * 2.2)
    return s * e * gain


def riser(dur, gain=0.35):
    n = int(dur * SR)
    t = np.arange(n) / SR
    s = rng.standard_normal(n)
    cut = 300 + (t / dur) ** 2 * 9000
    out = np.zeros(n)
    # piecewise filter with rising cutoff
    seg = int(0.02 * SR)
    for i in range(0, n, seg):
        out[i:i + seg] = LP(s[i:i + seg], float(cut[i]))
    sweep = np.sin(2 * np.pi * np.cumsum(200 + (t / dur) ** 2 * 1400) / SR) * 0.15
    return (out + sweep) * (t / dur) ** 2 * gain


def whoosh(dur=0.6, gain=0.3):
    n = int(dur * SR)
    t = np.arange(n) / SR
    s = rng.standard_normal(n)
    shape = np.sin(np.pi * t / dur) ** 2
    out = np.zeros(n)
    seg = int(0.01 * SR)
    for i in range(0, n, seg):
        out[i:i + seg] = LP(s[i:i + seg], 400 + 5000 * float(shape[i]))
    return out * shape * gain


def impact(gain=1.0):
    n = int(2.5 * SR)
    t = np.arange(n) / SR
    f = 32 + 90 * np.exp(-t * 8)
    boom = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 1.6)
    no = LP(rng.standard_normal(n), 1800) * np.exp(-t * 4) * 0.6
    return np.tanh((boom + no) * 1.3) * gain


def ping(m=88, gain=0.12):
    n = int(0.4 * SR)
    t = np.arange(n) / SR
    f = mtof(m)
    s = np.sin(2 * np.pi * f * t) + 0.4 * np.sin(2 * np.pi * f * 1.5 * t)
    return s * np.exp(-t * 12) * gain


def bell(m, gain=0.2):
    n = int(3.0 * SR)
    t = np.arange(n) / SR
    f = mtof(m)
    s = sum(a * np.sin(2 * np.pi * f * r * t) * np.exp(-t * d) for a, r, d in [(1, 1, 1.2), (.5, 2.76, 2.5), (.3, 5.4, 4), (.2, 2, 1.8)])
    return s * gain


def click_sfx():
    n = int(0.05 * SR)
    t = np.arange(n) / SR
    return (np.sin(2 * np.pi * 1800 * t) * np.exp(-t * 160) + rng.standard_normal(n) * np.exp(-t * 400) * 0.3) * 0.35


# ---------------- arranjo ----------------
# Progressão (A menor, moderna): Am - F - C - G, 2 tempos de compasso por acorde (4 beats)
CHORDS = [(57, 60, 64, 69), (53, 57, 60, 65), (48, 55, 60, 64), (55, 59, 62, 67)]
ROOTS = [45, 41, 48, 43]
BAR = 4 * BEAT  # 2 s


def chord_at(t):
    return int((t // BAR) % 4)


# Cena 1 (0–5): tensão — drone, relógio acelerando, pings de mensagem, batida de coração
drone = pad((45, 52, 57), 5.3, cutoff=500, gain=0.10)
add(drone, 0.0)
tt = 0.0
step = 0.5
while tt < 4.7:
    add(tick(), tt, 0.9, pan=0.3)
    tt += step
    step = max(0.12, step * 0.93)
for m_t in [0.55, 0.95, 1.35, 1.7, 2.05, 2.4, 2.7, 3.0, 3.3, 3.55, 3.8, 4.05]:
    add(ping(88 + int(rng.integers(0, 5)), 0.10), m_t, pan=0.4)
for b in np.arange(0.0, 4.6, 1.0):
    add(kick(0.55), b)
    add(kick(0.35), b + 0.22)
add(riser(1.4, 0.45), 3.75)

# Transição + revelação (5.15): impacto
add(impact(0.95), 5.15)
add(whoosh(0.9, 0.35), 4.6, pan=-0.3)

# Cena 2 (5.15–10): pads abertos + arpejo suave
for i, t0 in enumerate(np.arange(5.15, 10.0, BAR)):
    c = CHORDS[i % 4]
    add(pad(c, BAR + 0.4, cutoff=1600, gain=0.17), t0)
    add(bass(ROOTS[i % 4], BAR, 0.35), t0)
    for k in range(8):
        add(pluck(c[k % 4] + 12, gain=0.16), t0 + k * BEAT / 2, pan=(-0.4 if k % 2 else 0.4))
add(bell(81, 0.16), 5.3)
add(bell(76, 0.12), 5.7)
add(riser(1.6, 0.3), 8.5)
add(whoosh(0.7, 0.3), 9.7)

# Groove principal (10–27) — intensidade crescente por cena
GROOVE_START = 10.0
for t0 in np.arange(GROOVE_START, 27.0, BEAT):
    beat_i = int(round((t0 - GROOVE_START) / BEAT))
    add(kick(0.85), t0)
    if beat_i % 2 == 1:
        add(clap(), t0, 0.9)
    for s in range(4 if t0 >= 16 else 2):
        sub = BEAT / (4 if t0 >= 16 else 2)
        add(hat(open_=(s == 2 and t0 >= 22)), t0 + s * sub, 0.8 if s % 2 else 0.5, pan=0.25)
for i, t0 in enumerate(np.arange(GROOVE_START, 27.0, BAR)):
    c = CHORDS[i % 4]
    add(pad(c, BAR + 0.3, cutoff=1800 if t0 < 22 else 2600, gain=0.09), t0)
    root = ROOTS[i % 4]
    for k in range(8):
        add(bass(root if k % 4 != 3 else root + 12, BEAT / 2 * 0.95), t0 + k * BEAT / 2, 0.85)
    if t0 >= 16:
        for k in range(8):
            add(pluck(c[(k * 3) % 4] + 12, gain=0.09), t0 + k * BEAT / 2 + BEAT / 4, pan=(-0.5 if k % 2 else 0.5))

# whooshes nas trocas de cena + cliques nos botões
for t0 in (15.75, 21.75):
    add(whoosh(0.6, 0.32), t0, pan=0.2)
add(click_sfx(), 19.6)
add(click_sfx(), 25.2)
add(riser(1.8, 0.45), 25.3)

# Cena 6 (27–38): clímax
add(impact(0.8), 27.0)
for t0 in np.arange(27.0, 31.4, BEAT):
    beat_i = int(round((t0 - 27.0) / BEAT))
    add(kick(0.9), t0)
    if beat_i % 2 == 1:
        add(clap(), t0, 1.0)
    for s in range(4):
        add(hat(open_=(s == 2)), t0 + s * BEAT / 4, 0.7 if s % 2 else 0.45, pan=0.25)
for i, t0 in enumerate(np.arange(27.0, 31.4, BAR)):
    c = CHORDS[i % 4]
    add(pad(c, BAR + 0.3, cutoff=3200, gain=0.11), t0)
    for k in range(8):
        add(bass(ROOTS[i % 4] if k % 4 != 3 else ROOTS[i % 4] + 12, BEAT / 2 * 0.95), t0 + k * BEAT / 2, 0.85)
        add(pluck(c[k % 4] + 24, gain=0.07), t0 + k * BEAT / 2, pan=(-0.5 if k % 2 else 0.5))
add(riser(0.9, 0.4), 30.6)
# logo: stop + sting
add(impact(1.0), 31.55)
add(bell(81, 0.22), 31.6)
add(bell(88, 0.14), 31.95)
# final: pad largo + pulso leve até o CTA
add(pad((45, 57, 60, 64, 71), 6.6, cutoff=2400, gain=0.12), 31.6)
for t0 in np.arange(32.0, 37.0, BEAT):
    add(kick(0.45), t0)
    add(hat(), t0 + BEAT / 2, 0.4)
add(bell(76, 0.18), 34.2)
add(bell(81, 0.14), 34.45)
add(pad((41, 53, 57, 60, 64), 4.0, cutoff=2000, gain=0.12), 34.0)
add(impact(0.5), 37.0)

# ---------------- mix / master ----------------
mix = np.stack([L, R], axis=1)

# reverb simples (IR de ruído com decaimento) para dar espaço
ir_n = int(1.8 * SR)
ir_t = np.arange(ir_n) / SR
ir = rng.standard_normal((ir_n, 2)) * np.exp(-ir_t * 3.2)[:, None]
ir = np.stack([LP(ir[:, 0], 5000), LP(ir[:, 1], 5000)], axis=1)
ir /= np.sqrt((ir ** 2).sum())
from numpy.fft import irfft, rfft  # noqa: E402

nfft = 1 << int(np.ceil(np.log2(N + ir_n)))
wet = np.stack([irfft(rfft(mix[:, ch], nfft) * rfft(ir[:, ch], nfft), nfft)[:N] for ch in range(2)], axis=1)
mix = mix + wet * 0.22

# fade in/out
fi = int(0.05 * SR)
fo = int(0.8 * SR)
mix[:fi] *= np.linspace(0, 1, fi)[:, None]
mix[-fo:] *= np.linspace(1, 0, fo)[:, None]

# soft clip + normalização
mix = np.tanh(mix * 0.9)
mix /= np.abs(mix).max() / 0.89

out = sys.argv[1] if len(sys.argv) > 1 else 'music.wav'
with wave.open(out, 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((mix * 32767).astype('<i2').tobytes())
print('ok', out)
