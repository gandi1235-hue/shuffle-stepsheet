/**
 * 음원에서 박자(BPM)와 박 위치를 자동으로 찾는다. 서버 없이 기기 안에서만 계산.
 *
 * 방법: 앞부분(최대 90초)을 22.05kHz 모노로 풀어 → 1024점 FFT로 "소리가 새로 시작되는 세기"(spectral flux)를
 * 1초에 약 86번 구하고 → 그 곡선의 자기상관으로 60~200 BPM 중 가장 잘 맞는 주기를 고른다.
 * 셔플 음악에 흔한 110~160 BPM 쪽에 살짝 가중치를 둬 반 박자/두 배 박자로 틀리는 일을 줄인다.
 */
export interface Tempo {
  bpm: number
  /** 한 박이 시작되는 시각 중 하나(초). t = phase + k * (60/bpm) 가 모두 박 시작 */
  phase: number
  /** 0~1. 0.3 아래면 믿기 어려움 */
  confidence: number
}

const SR = 22050
const FRAME = 1024
const HOP = 256
const MAX_SECONDS = 90

/** 음원 파일(blob)에서 박자 찾기. 실패하면 null */
export async function detectTempo(data: ArrayBuffer): Promise<Tempo | null> {
  try {
    const mono = await decodeMono(data)
    if (!mono || mono.length < SR * 8) return null
    return analyzeSamples(mono)
  } catch {
    return null
  }
}

/** 22.05kHz 모노 샘플에서 박자 찾기 (테스트용으로 따로 둠) */
export function analyzeSamples(mono: Float32Array): Tempo | null {
  const { all, low } = onsetCurve(mono)
  return pickTempo(all, low)
}

async function decodeMono(data: ArrayBuffer): Promise<Float32Array | null> {
  const Ctx = window.OfflineAudioContext || (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext }).webkitOfflineAudioContext
  if (!Ctx) return null
  const ctx = new Ctx(1, SR, SR)
  const buf: AudioBuffer = await new Promise((resolve, reject) => {
    const p = ctx.decodeAudioData(data.slice(0), resolve, reject)
    if (p && typeof (p as Promise<AudioBuffer>).then === 'function') (p as Promise<AudioBuffer>).then(resolve, reject)
  })
  const n = Math.min(buf.length, Math.floor(MAX_SECONDS * buf.sampleRate))
  const out = new Float32Array(n)
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const ch = buf.getChannelData(c)
    for (let i = 0; i < n; i++) out[i] += ch[i] / buf.numberOfChannels
  }
  // 브라우저가 샘플레이트를 못 바꿨으면 직접 줄인다
  if (Math.abs(buf.sampleRate - SR) > 1) {
    const ratio = buf.sampleRate / SR
    const m = Math.floor(n / ratio)
    const res = new Float32Array(m)
    for (let i = 0; i < m; i++) res[i] = out[Math.floor(i * ratio)]
    return res
  }
  return out
}

/** 프레임마다 "새 소리가 터지는 세기"를 구한 곡선 (초당 SR/HOP ≈ 86개). all: 전체 음역, low: 저음(킥) 음역 */
function onsetCurve(x: Float32Array): { all: Float32Array; low: Float32Array } {
  const frames = Math.floor((x.length - FRAME) / HOP)
  const win = new Float32Array(FRAME)
  for (let i = 0; i < FRAME; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / FRAME)
  const re = new Float32Array(FRAME)
  const im = new Float32Array(FRAME)
  const bins = FRAME / 2
  const prev = new Float32Array(bins)
  const cur = new Float32Array(bins)
  const nov = new Float32Array(frames)
  const lowNov = new Float32Array(frames)
  const LOW_BINS = 8 // ≈ 170Hz 아래
  for (let f = 0; f < frames; f++) {
    const off = f * HOP
    for (let i = 0; i < FRAME; i++) {
      re[i] = x[off + i] * win[i]
      im[i] = 0
    }
    fft(re, im)
    let s = 0
    let sl = 0
    for (let k = 1; k < bins; k++) {
      cur[k] = Math.log1p(Math.hypot(re[k], im[k]) * 4)
      const d = cur[k] - prev[k]
      if (d > 0) {
        s += d
        if (k <= LOW_BINS) sl += d
      }
    }
    nov[f] = s
    lowNov[f] = sl
    prev.set(cur)
  }
  return { all: detrend(nov), low: detrend(lowNov) }
}

/** 느린 변화(볼륨 흐름)는 빼고 짧게 튀는 부분만 남긴다 */
function detrend(nov: Float32Array): Float32Array {
  const frames = nov.length
  const span = Math.round(0.5 * (SR / HOP))
  const out = new Float32Array(frames)
  let acc = 0
  for (let i = 0; i < frames; i++) {
    acc += nov[i]
    if (i >= span) acc -= nov[i - span]
    const mean = acc / Math.min(i + 1, span)
    out[i] = Math.max(0, nov[i] - mean)
  }
  return out
}

function pickTempo(nov: Float32Array, low: Float32Array): Tempo | null {
  const rate = SR / HOP
  const n = nov.length
  // 자기상관 (지연 0.25초 ~ 2.2초까지)
  const maxLag = Math.min(n - 1, Math.round(2.2 * rate))
  const minLag = Math.round(0.25 * rate)
  const ac = new Float32Array(maxLag + 1)
  let energy = 0
  for (let i = 0; i < n; i++) energy += nov[i] * nov[i]
  if (energy <= 0) return null
  for (let lag = minLag; lag <= maxLag; lag++) {
    let s = 0
    for (let i = lag; i < n; i++) s += nov[i] * nov[i - lag]
    ac[lag] = s / energy
  }
  const at = (lag: number) => {
    const i = Math.floor(lag)
    if (i < minLag || i + 1 > maxLag) return 0
    const fr = lag - i
    return ac[i] * (1 - fr) + ac[i + 1] * fr
  }
  // 후보 BPM마다 1배·2배·3배·4배 주기의 자기상관을 더해 점수. 셔플 음악 범위(≈130)에 완만한 가중치
  let best = 0
  let bestBpm = 0
  let sum = 0
  let count = 0
  for (let bpm = 60; bpm <= 200; bpm += 0.25) {
    const L = (60 / bpm) * rate
    const score = at(L) + 0.8 * at(2 * L) + 0.6 * at(3 * L) + 0.5 * at(4 * L)
    const prior = Math.exp(-0.5 * Math.pow(Math.log2(bpm / 130) / 0.45, 2))
    const v = score * (0.35 + 0.65 * prior)
    sum += v
    count++
    if (v > best) {
      best = v
      bestBpm = bpm
    }
  }
  if (!bestBpm) return null
  const mean = sum / count
  const confidence = Math.max(0, Math.min(1, (best / mean - 1) / 3))
  // 정밀 보정 + 박 위치: 후보 BPM(±0.6, 0.02 간격)마다 주기 P로 90초 전체를 빗질해 저음(킥) novelty 합이 최대인 (BPM, 위상)을 고른다.
  // 긴 구간을 쓰므로 소수점 BPM까지 맞아 노래 끝까지 밀리지 않는다. 저음이 거의 없으면 전체 음역으로
  let lowEnergy = 0
  for (let i = 0; i < n; i++) lowEnergy += low[i]
  const src = lowEnergy > 1e-6 ? low : nov
  let fineBpm = bestBpm
  let bestPhase = 0
  let bestSum = -1
  for (let bpm = bestBpm - 0.6; bpm <= bestBpm + 0.6001; bpm += 0.02) {
    const Pf = (60 / bpm) * rate
    const steps = Math.max(8, Math.round(Pf * 2))
    for (let s = 0; s < steps; s++) {
      const ph = (s / steps) * Pf
      let acc = 0
      for (let t = ph; t < n; t += Pf) acc += src[Math.round(t)] ?? 0
      if (acc > bestSum) {
        bestSum = acc
        bestPhase = ph
        fineBpm = bpm
      }
    }
  }
  bestBpm = fineBpm
  return { bpm: Math.round(bestBpm * 100) / 100, phase: ((bestPhase + FRAME / 2 / HOP) * HOP) / SR, confidence: Math.round(confidence * 100) / 100 }
}

/** 제자리 radix-2 FFT (길이는 2의 거듭제곱) */
function fft(re: Float32Array, im: Float32Array) {
  const n = re.length
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      let t = re[i]
      re[i] = re[j]
      re[j] = t
      t = im[i]
      im[i] = im[j]
      im[j] = t
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len
    const wr = Math.cos(ang)
    const wi = Math.sin(ang)
    for (let i = 0; i < n; i += len) {
      let cr = 1
      let ci = 0
      for (let j = 0; j < len / 2; j++) {
        const a = i + j
        const b = a + len / 2
        const tr = re[b] * cr - im[b] * ci
        const ti = re[b] * ci + im[b] * cr
        re[b] = re[a] - tr
        im[b] = im[a] - ti
        re[a] += tr
        im[a] += ti
        const ncr = cr * wr - ci * wi
        ci = cr * wi + ci * wr
        cr = ncr
      }
    }
  }
}

/** t(초)를 가장 가까운 박 시작으로 당긴다 (tolerance 안일 때만) */
export function snapToBeat(t: number, tempo: Tempo | null, tolerance = 0.2): number {
  if (!tempo) return t
  const P = 60 / tempo.bpm
  const k = Math.round((t - tempo.phase) / P)
  const near = tempo.phase + k * P
  return Math.abs(near - t) <= tolerance ? Math.max(0, near) : t
}
