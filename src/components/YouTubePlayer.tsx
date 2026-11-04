import { useEffect, useRef, useState } from 'react'
import { fmt, type PlayerHandle } from './Player'

/** 유튜브 링크에서 영상 ID 뽑기 (youtu.be/ID, watch?v=ID, shorts/ID, embed/ID) */
export function youtubeId(url: string): string | null {
  try {
    const u = new URL(url.trim())
    if (/youtu\.be$/i.test(u.hostname)) return u.pathname.slice(1).split('/')[0] || null
    if (/youtube\.com$/i.test(u.hostname) || /youtube-nocookie\.com$/i.test(u.hostname)) {
      if (u.searchParams.get('v')) return u.searchParams.get('v')
      const m = u.pathname.match(/\/(shorts|embed|live)\/([^/?]+)/)
      if (m) return m[2]
    }
  } catch {
    /* 링크가 아님 */
  }
  return null
}

type YT = {
  Player: new (el: HTMLElement, opts: Record<string, unknown>) => YTPlayer
  PlayerState: { PLAYING: number; PAUSED: number; ENDED: number }
}
interface YTPlayer {
  getCurrentTime: () => number
  getDuration: () => number
  seekTo: (t: number, allow: boolean) => void
  playVideo: () => void
  pauseVideo: () => void
  setPlaybackRate: (r: number) => void
  getPlayerState: () => number
  destroy: () => void
}
declare global {
  interface Window {
    YT?: YT
    onYouTubeIframeAPIReady?: () => void
  }
}

let apiPromise: Promise<YT> | null = null
function loadApi(): Promise<YT> {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  if (!apiPromise)
    apiPromise = new Promise((resolve) => {
      const prev = window.onYouTubeIframeAPIReady
      window.onYouTubeIframeAPIReady = () => {
        prev?.()
        resolve(window.YT as YT)
      }
      const s = document.createElement('script')
      s.src = 'https://www.youtube.com/iframe_api'
      document.head.appendChild(s)
    })
  return apiPromise
}

const SPEEDS = [0.75, 1, 1.25]

/** 유튜브 영상을 앱 안에서 스텝지와 같이 보고, 동기화(현재 시각 읽기·이동)도 되게 */
export default function YouTubePlayer({ videoId, name, onTime, handle, extra }: { videoId: string; name: string; onTime?: (t: number) => void; handle?: React.MutableRefObject<PlayerHandle | null>; extra?: React.ReactNode }) {
  const box = useRef<HTMLDivElement>(null)
  const yt = useRef<YTPlayer | null>(null)
  const [ready, setReady] = useState(false)
  const [t, setT] = useState(0)
  const [d, setD] = useState(0)
  const [speed, setSpeed] = useState(1)
  const onTimeRef = useRef(onTime)
  onTimeRef.current = onTime

  useEffect(() => {
    let dead = false
    let timer = 0
    loadApi().then((YT) => {
      if (dead || !box.current) return
      const el = document.createElement('div')
      box.current.appendChild(el)
      yt.current = new YT.Player(el, {
        videoId,
        host: 'https://www.youtube-nocookie.com',
        playerVars: { playsinline: 1, rel: 0, modestbranding: 1 },
        events: {
          onReady: () => {
            setReady(true)
            setD(yt.current?.getDuration() ?? 0)
          },
        },
      })
      timer = window.setInterval(() => {
        const p = yt.current
        if (!p || typeof p.getCurrentTime !== 'function') return
        const now = p.getCurrentTime()
        setT(now)
        onTimeRef.current?.(now)
        if (!d) setD(p.getDuration())
      }, 250)
    })
    return () => {
      dead = true
      window.clearInterval(timer)
      yt.current?.destroy()
      yt.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId])

  useEffect(() => {
    if (!handle) return
    handle.current = {
      time: () => yt.current?.getCurrentTime() ?? 0,
      seek: (tt, play) => {
        yt.current?.seekTo(Math.max(0, tt), true)
        if (play) yt.current?.playVideo()
      },
      play: () => yt.current?.playVideo(),
      pause: () => yt.current?.pauseVideo(),
    }
    return () => {
      handle.current = null
    }
  }, [handle])

  const cycleSpeed = () => {
    const s = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length]
    setSpeed(s)
    yt.current?.setPlaybackRate(s)
  }

  return (
    <div className="player has-video yt">
      <div className="yt-box" ref={box} title={name} />
      {/* 재생·탐색은 유튜브 자체 조작으로. 여기엔 속도와 부가 버튼만 한 줄로 */}
      <div className="tools">
        <button type="button" className="btn" onClick={cycleSpeed} disabled={!ready}>
          속도 {speed}×
        </button>
        <span className="yt-time" aria-live="off">
          {fmt(t)} / {fmt(d)}
        </span>
        {extra}
      </div>
    </div>
  )
}
