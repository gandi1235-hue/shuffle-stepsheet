import { useEffect, useRef, useState } from 'react'
import { Pause, Play } from './Icons'

const SPEEDS = [1, 0.9, 0.8, 0.7, 0.5]

function fmt(s: number) {
  if (!isFinite(s)) return '0:00'
  const m = Math.floor(s / 60)
  const r = Math.floor(s % 60)
  return `${m}:${r.toString().padStart(2, '0')}`
}

export default function Player({ src, name, onBig }: { src: string; name: string; onBig?: () => void }) {
  const ref = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [t, setT] = useState(0)
  const [d, setD] = useState(0)
  const [speed, setSpeed] = useState(1)
  const [loop, setLoop] = useState<{ a: number; b: number | null } | null>(null)

  useEffect(() => {
    const a = ref.current
    if (!a) return
    a.playbackRate = speed
  }, [speed])

  useEffect(() => {
    const a = ref.current
    if (!a) return
    const onTime = () => {
      setT(a.currentTime)
      if (loop && loop.b !== null && a.currentTime >= loop.b) a.currentTime = loop.a
    }
    const onMeta = () => setD(a.duration)
    a.addEventListener('timeupdate', onTime)
    a.addEventListener('loadedmetadata', onMeta)
    a.addEventListener('play', () => setPlaying(true))
    a.addEventListener('pause', () => setPlaying(false))
    return () => {
      a.removeEventListener('timeupdate', onTime)
      a.removeEventListener('loadedmetadata', onMeta)
    }
  }, [loop])

  const toggle = () => {
    const a = ref.current
    if (!a) return
    if (a.paused) a.play()
    else a.pause()
  }

  const cycleSpeed = () => setSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length])

  const loopBtn = () => {
    const a = ref.current
    if (!a) return
    if (!loop) setLoop({ a: a.currentTime, b: null })
    else if (loop.b === null) setLoop({ a: loop.a, b: Math.max(a.currentTime, loop.a + 1) })
    else setLoop(null)
  }

  const loopLabel = !loop ? '구간 반복' : loop.b === null ? '끝 지점 찍기' : '반복 해제'

  return (
    <div className="player">
      <audio ref={ref} src={src} preload="metadata" />
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
        <button type="button" className="btn" onClick={cycleSpeed}>
          속도 {speed}×
        </button>
        <button type="button" className={loop ? 'btn pill on' : 'btn'} onClick={loopBtn}>
          {loopLabel}
        </button>
        {onBig && (
          <button type="button" className="btn" onClick={onBig}>
            크게 보기
          </button>
        )}
      </div>
    </div>
  )
}
