/**
 * 영상의 장면들을 시각이 적힌 "장면표"(프레임을 격자로 붙인 그림)로 만든다.
 * AI가 영상을 "보고" 줄마다 시작 시각을 찾을 때 쓴다. 기기 안에서만 처리하고 영상 자체는 어디에도 올리지 않는다.
 * 두 가지 원천: (1) 올려 둔 영상 파일 → <video>에서 1초마다 프레임, (2) 유튜브 → 서버가 가져온 미리보기 스프라이트(스토리보드)
 */
export type Sheet = { media_type: string; data: string }
export type FrameSheets = { sheets: Sheet[]; step: number; duration: number; frames: number }
/** 서버(recognize yt_frames)가 돌려주는 유튜브 스토리보드: 스프라이트 그림들과 격자 정보 */
export type Storyboard = { images: string[]; cols: number; rows: number; w: number; h: number; total: number; interval: number; duration: number }

type Progress = (done: number, total: number) => void
const MAX_FRAMES = 180

/** 장면표 조립기: 셀을 차례로 채우고 시각 라벨을 붙여 JPEG로 */
function composer(cw: number, ch: number, cols = 4, rows = 3) {
  const per = cols * rows
  const sheets: Sheet[] = []
  let canvas = document.createElement('canvas')
  let ctx = canvas.getContext('2d')!
  let k = 0
  const flush = () => {
    if (k === 0) return
    sheets.push({ media_type: 'image/jpeg', data: canvas.toDataURL('image/jpeg', 0.72).split(',')[1] })
    k = 0
  }
  const add = (draw: (c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) => void, t: number, remaining: number) => {
    if (k === 0) {
      const r = Math.ceil(Math.min(per, remaining) / cols)
      canvas = document.createElement('canvas')
      canvas.width = cw * cols
      canvas.height = ch * r
      ctx = canvas.getContext('2d')!
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    }
    const x = (k % cols) * cw
    const y = Math.floor(k / cols) * ch
    draw(ctx, x, y, cw, ch)
    const label = `${t.toFixed(1)}s`
    const fs = Math.max(14, Math.round(cw / 16))
    ctx.font = `bold ${fs}px system-ui, sans-serif`
    const w = ctx.measureText(label).width + 10
    ctx.fillStyle = 'rgba(0,0,0,0.75)'
    ctx.fillRect(x, y, w, fs + 8)
    ctx.fillStyle = '#ffeb3b'
    ctx.fillText(label, x + 5, y + fs + 1)
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 1
    ctx.strokeRect(x + 0.5, y + 0.5, cw - 1, ch - 1)
    k++
    if (k === per) flush()
  }
  return { add, done: () => (flush(), sheets) }
}

const wait = (el: HTMLVideoElement, ev: string, ms: number) =>
  new Promise<void>((ok, bad) => {
    const tm = setTimeout(() => {
      cleanup()
      bad(new Error(`영상을 읽지 못했어요 (${ev})`))
    }, ms)
    const onOk = () => {
      cleanup()
      ok()
    }
    const onErr = () => {
      cleanup()
      bad(new Error('이 영상 형식은 이 기기에서 열 수 없어요'))
    }
    const cleanup = () => {
      clearTimeout(tm)
      el.removeEventListener(ev, onOk)
      el.removeEventListener('error', onErr)
    }
    el.addEventListener(ev, onOk, { once: true })
    el.addEventListener('error', onErr, { once: true })
  })

/** 영상 파일(올려 둔 영상의 주소)에서 1초마다 프레임을 뽑아 장면표로 */
export async function contactSheets(src: string, onProgress?: Progress, cell = 320): Promise<FrameSheets> {
  const v = document.createElement('video')
  v.crossOrigin = 'anonymous'
  v.muted = true
  v.playsInline = true
  v.preload = 'auto'
  v.src = src
  try {
    await wait(v, 'loadedmetadata', 20000)
    const duration = v.duration
    if (!isFinite(duration) || duration <= 0) throw new Error('영상 길이를 알 수 없어요')
    const step = duration <= MAX_FRAMES ? 1 : duration / MAX_FRAMES
    const times: number[] = []
    for (let t = 0; t < duration - 0.05; t += step) times.push(Math.round(t * 10) / 10)
    const ratio = v.videoWidth && v.videoHeight ? v.videoWidth / v.videoHeight : 16 / 9
    const cw = ratio >= 1 ? cell : Math.round(cell * ratio)
    const ch = ratio >= 1 ? Math.round(cell / ratio) : cell
    const c = composer(cw, ch)
    for (let i = 0; i < times.length; i++) {
      v.currentTime = times[i]
      await wait(v, 'seeked', 8000)
      c.add((ctx, x, y, w, h) => ctx.drawImage(v, x, y, w, h), times[i], times.length - i)
      onProgress?.(i + 1, times.length)
    }
    return { sheets: c.done(), step: Math.round(step * 100) / 100, duration: Math.round(duration * 10) / 10, frames: times.length }
  } finally {
    v.removeAttribute('src')
    v.load()
  }
}

/** 유튜브 스토리보드(스프라이트 격자)에서 장면을 골라 시각 라벨을 붙인 장면표로 */
export async function storyboardSheets(sb: Storyboard, onProgress?: Progress): Promise<FrameSheets> {
  const per = sb.cols * sb.rows
  // 약 1초 간격, 최대 180장면이 되게 건너뛰기
  const stride = Math.max(1, Math.ceil(0.9 / sb.interval), Math.ceil(sb.total / MAX_FRAMES))
  const picks: number[] = []
  for (let i = 0; i < sb.total; i += stride) picks.push(i)
  const bitmaps: (ImageBitmap | null)[] = []
  for (let j = 0; j < sb.images.length; j++) {
    try {
      const blob = await (await fetch(`data:image/jpeg;base64,${sb.images[j]}`)).blob()
      bitmaps.push(await createImageBitmap(blob))
    } catch {
      bitmaps.push(null)
    }
    onProgress?.(j + 1, sb.images.length + 1)
  }
  const c = composer(sb.w, sb.h)
  let n = 0
  picks.forEach((i, idx) => {
    const bm = bitmaps[Math.floor(i / per)]
    if (!bm) return
    const cell = i % per
    const sx = (cell % sb.cols) * sb.w
    const sy = Math.floor(cell / sb.cols) * sb.h
    if (sx + sb.w > bm.width + 1 || sy + sb.h > bm.height + 1) return
    c.add((ctx, x, y, w, h) => ctx.drawImage(bm, sx, sy, sb.w, sb.h, x, y, w, h), Math.round(i * sb.interval * 10) / 10, picks.length - idx)
    n++
  })
  bitmaps.forEach((b) => b?.close())
  onProgress?.(sb.images.length + 1, sb.images.length + 1)
  if (!n) throw new Error('유튜브 미리보기 장면을 읽지 못했어요')
  return { sheets: c.done(), step: Math.round(stride * sb.interval * 100) / 100, duration: Math.round(sb.duration * 10) / 10, frames: n }
}
