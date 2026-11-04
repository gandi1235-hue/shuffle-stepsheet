import { useEffect, useRef, useState } from 'react'
import { Pause, Play } from './Icons'
import { haptic } from '../lib/prefs'

export interface PlayerHandle {
  time: () => number
  seek: (t: number, play?: boolean) => void
  play: () => void
  pause: () => void
}

/** 속도: 0.80 ~ 1.10, 0.05 단위 */
const MIN = 0.8
const MAX = 1.1
const STEP = 0.05

export function fmt(s: number) {
  if (!isFinite(s)) return '0:00'
  const m = Math.floor(s / 60)
  const r = Math.floor(s % 60)
  return `${m}:${r.toString().padStart(2, '0')}`
}

export const isVideoSrc = (name: string) => /\.(mp4|m4v|mov|webm|mkv)(\?|$)/i.test(name)

interface Props {
  src: string
  name: string
  /** 파일 경로나 mime으로 영상인지 (영상이면 화면을 같이 보여 줌) */
  video?: boolean
  onBig?: () => void
  onTime?: (t: number) => void
  handle?: React.MutableRefObject<PlayerHandle | null>
  /** 도구 줄에 덧붙일 버튼 (예: 노래 동기화) */
  extra?: React.ReactNode
}

/** 음원·영상 파일 재생기 (바닥에 붙음). 영상이면 작은 화면을 위에 보여 줌 */
export default function Player({ src, name, video, onBig, onTime, handle, extra }: Props) {
  const ref = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)
  const [t, setT] = useState(0)
  const [d, setD] = useState(0)
  const [speed, setSpeed] = useState(1)
  const [loop, setLoop] = useState<{ a: number; b: number | null } | null>(null)
  const onTimeRef = useRef(onTime)
  onTimeRef.current = onTime

  useEffect(() => {
    if (!handle) return
    handle.current = {
      time: () => ref.current?.currentTime ?? 0,
      seek: (tt, play) => {
        const a = ref.current
        if (!a) return
        a.currentTime = Math.max(0, tt)
        setT(a.currentTime)
        if (play) a.play().catch(() => undefined)
      },
      play: () => ref.current?.play().catch(() => undefined),
      pause: () => ref.current?.pause(),
    }
    return () => {
      handle.current = null
    }
  }, [handle])

  useEffect(() => {
    const a = ref.current
    if (a) a.playbackRate = speed
  }, [speed])

  useEffect(() => {
    const a = ref.current
    if (!a) return
    const onTimeEv = () => {
      setT(a.currentTime)
      onTimeRef.current?.(a.currentTime)
      if (loop && loop.b !== null && a.currentTime >= loop.b) a.currentTime = loop.a
    }
    const onMeta = () => setD(a.duration)
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    a.addEventListener('timeupdate', onTimeEv)
    a.addEventListener('loadedmetadata', onMeta)
    a.addEventListener('play', onPlay)
    a.addEventListener('pause', onPause)
    return () => {
      a.removeEventListener('timeupdate', onTimeEv)
      a.removeEventListener('loadedmetadata', onMeta)
      a.removeEventListener('play', onPlay)
      a.removeEventListener('pause', onPause)
    }
  }, [loop])

  const toggle = () => {
    const a = ref.current
    if (!a) return
    haptic(8)
    if (a.paused) a.play().catch(() => undefined)
    else a.pause()
  }
  const bump = (dir: 1 | -1) => setSpeed((s) => Math.min(MAX, Math.max(MIN, Math.round((s + dir * STEP) * 100) / 100)))

  const loopBtn = () => {
    const a = ref.current
    if (!a) return
    if (!loop) setLoop({ a: a.currentTime, b: null })
    else if (loop.b === null) setLoop({ a: loop.a, b: Math.max(a.currentTime, loop.a + 1) })
    else setLoop(null)
  }
  const loopLabel = !loop ? '구간 반복' : loop.b === null ? '끝 지점 찍기' : '반복 해제'

  return (
    <div className={video ? 'player has-video' : 'player'}>
      <video ref={ref} src={src} preload="metadata" playsInline className={video ? 'screen-video' : 'sr-only'} onClick={toggle} />
      <div className="main">
        <button type="button" className="play" aria-label={playing ? '일시정지' : '재생'} onClick={toggle}>
          {playing ? <Pause /> : <Play />}
        </button>
        <div className="info">
          <div className="meta">
            <b>{name}</b>
            <span>
              {fmt(t)} / {fmt(d)}
            </span>
          </div>
          <input
            type="range"
            aria-label="재생 위치"
            min={0}
            max={d || 0}
            step={0.1}
            value={t}
            onChange={(e) => {
              if (ref.current) ref.current.currentTime = Number(e.target.value)
            }}
          />
        </div>
      </div>
      <div className="tools">
        <div className="speed" role="group" aria-label="재생 속도">
          <button type="button" className="btn" aria-label="느리게" onClick={() => bump(-1)} disabled={speed <= MIN + 1e-6}>
            −
          </button>
          <span>{speed.toFixed(2)}×</span>
          <button type="button" className="btn" aria-label="빠르게" onClick={() => bump(1)} disabled={speed >= MAX - 1e-6}>
            +
          </button>
        </div>
        <button type="button" className={loop ? 'btn pill on' : 'btn'} onClick={loopBtn}>
          {loopLabel}
        </button>
        {onBig && (
          <button type="button" className="btn" onClick={onBig}>
            크게 보기
          </button>
        )}
      </div>
      {extra && <div className="tools extra">{extra}</div>}
    </div>
  )
}
