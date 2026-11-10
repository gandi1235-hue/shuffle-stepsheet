import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Player, { isVideoSrc, type PlayerHandle } from '../components/Player'
import YouTubePlayer, { youtubeId } from '../components/YouTubePlayer'
import TopBar from '../components/TopBar'
import HelpButton from '../components/HelpButton'
import { Pause, Play } from '../components/Icons'
import { Skeleton } from '../components/ui'
import { getSheet, signedUrl } from '../lib/api'
import { eventsOf, fmtBeats, kindOf, savedBpm, type Line, type Stepsheet, type SyncEvent } from '../lib/types'
import { bpmFromEvents, defaultEvents, lineBeats } from '../lib/sync'
import { haptic, useMedia, usePrefs } from '../lib/prefs'

/**
 * 따라 보기: 수정이 끝난 스텝지를 영상(유튜브·파일)과 싱크 맞춰 열람하는 연습 화면.
 * 지금 추는 줄을 크게, 다음 줄을 미리, 줄 안에서 얼마나 지났는지 막대로. 이전·다음 줄로 바로 이동하고, 한 줄만 반복할 수 있다
 */
export default function WatchPage() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const [sheet, setSheet] = useState<Stepsheet | null>(null)
  const [audio, setAudio] = useState('')
  const [err, setErr] = useState('')
  const [t, setT] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [loopLine, setLoopLine] = useState(false)
  const player = useRef<PlayerHandle | null>(null)
  const lastTick = useRef<{ t: number; at: number }>({ t: 0, at: 0 })
  const [prefs] = usePrefs()
  const wide = useMedia('(min-width: 900px)')
  const sideLayout = prefs.videoLayout ? prefs.videoLayout === 'side' : wide
  const [source] = useState<'file' | 'youtube'>(() => (localStorage.getItem(`src-${id}`) === 'youtube' ? 'youtube' : 'file'))

  useEffect(() => {
    getSheet(id)
      .then(async (s) => {
        setSheet(s)
        if (!s) return
        if (s.audio_path) setAudio(await signedUrl('audio', s.audio_path))
        else if (s.audio_url) setAudio(s.audio_url)
      })
      .catch((e) => setErr(e.message))
  }, [id])

  // 연습 중 화면 꺼짐 방지
  useEffect(() => {
    let lock: { release: () => void } | null = null
    const n = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => void }> } }
    n.wakeLock?.request('screen').then((l) => (lock = l)).catch(() => undefined)
    return () => lock?.release()
  }, [])

  if (err) return <div className="error">{err}</div>
  if (!sheet)
    return (
      <div className="content">
        <Skeleton rows={5} h={56} />
      </div>
    )

  const ytId = sheet.audio_url ? youtubeId(sheet.audio_url) : null
  const hasFile = Boolean(sheet.audio_path && audio)
  const playingYt = Boolean(ytId) && (!hasFile || source === 'youtube')
  const hasPlayer = hasFile || Boolean(ytId)
  const fileIsVideo = Boolean(sheet.audio_path && isVideoSrc(sheet.audio_path))
  const withVideo = playingYt || (hasFile && fileIsVideo)
  const src: 'yt' | 'file' = playingYt ? 'yt' : 'file'
  const saved = eventsOf(sheet.sync, src)
  const bpm = savedBpm(sheet.sync) ?? bpmFromEvents(sheet, saved.length ? saved : eventsOf(sheet.sync, 'file'))
  const events: SyncEvent[] = saved.length ? saved : playingYt ? defaultEvents(sheet, bpm) : []
  const hasSync = events.length > 0

  // 지금 줄: 시각이 지난 마지막 사건. 다음 줄: 그다음 사건
  let k = -1
  for (let i = 0; i < events.length; i++) if (events[i].t <= t + 0.05) k = i
  const cur = k >= 0 ? events[k] : null
  const next = k + 1 < events.length ? events[k + 1] : null
  const curEnd = cur ? (next ? next.t : cur.t + (lineBeats(sheet, cur.line) * 60) / bpm) : 0
  const ratio = cur ? Math.max(0, Math.min(1, (t - cur.t) / Math.max(0.1, curEnd - cur.t))) : 0
  const remain = cur ? Math.max(0, curEnd - t) : events[0] ? Math.max(0, events[0].t - t) : 0
  const ended = cur !== null && next === null && t > curEnd + 0.5

  const onTime = (now: number) => {
    setT(now)
    const prev = lastTick.current
    setPlaying(now !== prev.t && Date.now() - prev.at < 1500)
    lastTick.current = { t: now, at: Date.now() }
    // 한 줄 반복: 지금 줄이 끝나면 그 줄 시작으로
    if (loopLine && cur && now >= curEnd - 0.08) player.current?.seek(cur.t, true)
  }
  const go = (ev: SyncEvent | null) => {
    if (!ev) return
    haptic(10)
    player.current?.seek(ev.t, true)
  }
  const prevEv = () => {
    // 지금 줄이 시작된 지 1.5초가 지났으면 그 줄 처음으로, 아니면 앞 줄로
    if (cur && t - cur.t > 1.5) return go(cur)
    go(k > 0 ? events[k - 1] : events[0] ?? null)
  }
  const toggle = () => {
    haptic(8)
    if (playing) player.current?.pause()
    else if (cur || t > 0) player.current?.play()
    else go(events[0] ?? null)
  }

  const lineView = (i: number, big: boolean) => {
    const l = sheet.lines[i]
    if (!l) return null
    return <LineText line={l} big={big} />
  }
  const numOf = (i: number) => {
    // 구간 제목마다 번호를 다시 세는 스텝지 표기와 같게
    let n = 0
    for (let j = 0; j <= i; j++) {
      const kind = kindOf(sheet.lines[j])
      if (kind === 'section') n = 0
      else if (kind === 'steps') n++
    }
    return n
  }
  const sectionOf = (i: number) => {
    for (let j = i; j >= 0; j--) if (kindOf(sheet.lines[j]) === 'section') return sheet.lines[j].label ?? ''
    return ''
  }
  const title = sheet.song?.title ?? ''

  return (
    <div className={withVideo ? `screen sheet-screen with-video watch-screen ${sideLayout ? 'side' : 'top'}` : 'screen sheet-screen watch-screen'}>
      <TopBar title="따라 보기" sub={`${title} · ${sheet.creator_name}`} back={`/sheet/${sheet.id}`} right={<HelpButton page="watch" />} />

      <div className="content watch">
        {!hasPlayer ? (
          <div className="empty">
            영상이나 음원이 없어요. <Link to={`/edit/${sheet.id}`}>수정</Link>에서 유튜브 링크나 파일을 넣어 주세요.
          </div>
        ) : !hasSync ? (
          <div className="empty">
            아직 동기화가 없어요.
            <button type="button" className="btn primary block" style={{ marginTop: 12 }} onClick={() => nav(`/sheet/${sheet.id}/sync`)}>
              동기화 맞추기
            </button>
          </div>
        ) : (
          <>
            <div className="prog" aria-label="진행">
              <span className="pos">{cur ? `${k + 1} / ${events.length}` : `전주 · ${remain.toFixed(0)}초 뒤 시작`}</span>
              <span className="bar">
                <i style={{ width: `${Math.round(ratio * 100)}%` }} />
              </span>
              {bpm > 0 && <span className="bpmtag">{Math.round(bpm)} BPM</span>}
            </div>

            {ended ? (
              <div className="now done">
                <div className="main">끝! 수고했어요 👏</div>
                <button type="button" className="btn primary" style={{ marginTop: 12 }} onClick={() => go(events[0])}>
                  처음부터 다시
                </button>
              </div>
            ) : cur ? (
              <div className="now" key={k}>
                {sectionOf(cur.line) && <div className="sec">{sectionOf(cur.line)}</div>}
                <div className="no">{numOf(cur.line)}번 줄</div>
                {lineView(cur.line, true)}
              </div>
            ) : (
              <div className="now wait">
                <div className="sec">전주</div>
                <div className="main">{events[0] ? `${Math.max(0, events[0].t - t).toFixed(0)}초 뒤 1번 줄` : '준비'}</div>
                {events[0] && lineView(events[0].line, false)}
              </div>
            )}

            {next && !ended && (
              <div className={`next${remain <= 3 ? ' soon' : ''}`}>
                <div className="head">
                  <span>다음</span>
                  <span className="cd">{remain <= 3 ? `${Math.ceil(remain)}` : `${remain.toFixed(0)}초 뒤`}</span>
                </div>
                <div className="no">{numOf(next.line)}번 줄{sectionOf(next.line) && sectionOf(next.line) !== (cur ? sectionOf(cur.line) : '') ? ` · ${sectionOf(next.line)}` : ''}</div>
                {lineView(next.line, false)}
              </div>
            )}

            <div className="ctl">
              <button type="button" className="btn" onClick={prevEv} aria-label="이전 줄">
                ◀ 이전
              </button>
              <button type="button" className="btn primary" onClick={toggle} aria-label={playing ? '일시정지' : '재생'}>
                {playing ? <Pause /> : <Play />}
                <span>{playing ? '멈춤' : cur || t > 0 ? '재생' : '시작'}</span>
              </button>
              <button type="button" className="btn" onClick={() => go(next)} disabled={!next} aria-label="다음 줄">
                다음 ▶
              </button>
            </div>
            <div className="ctl2">
              <button type="button" className={loopLine ? 'btn pill on' : 'btn pill'} onClick={() => { haptic(8); setLoopLine(!loopLine) }} aria-pressed={loopLine}>
                {loopLine ? '↻ 이 줄만 반복 중' : '↻ 이 줄만 반복'}
              </button>
              <Link to={`/sheet/${sheet.id}`} className="btn pill">
                전체 스텝지
              </Link>
            </div>
            <div className="panel-desc">줄이 어긋나면 <Link to={`/sheet/${sheet.id}/sync`}>동기화 교정</Link>에서 그 줄이 시작될 때 눌러 고치세요. 속도는 재생기의 − / +.</div>
          </>
        )}
      </div>

      {playingYt && ytId && <YouTubePlayer videoId={ytId} name={title} onTime={onTime} handle={player} />}
      {hasFile && !playingYt && <Player src={audio} name={title} video={fileIsVideo} onTime={onTime} handle={player} />}
    </div>
  )
}

/** 한 줄의 스텝을 크게(지금 줄) 또는 보통 크기(다음 줄)로. 비고(손동작·주의)는 아래 작게 */
function LineText({ line, big }: { line: Line; big: boolean }) {
  const kind = kindOf(line)
  const steps = line.steps.filter((s) => s.name.trim())
  return (
    <>
      <div className="main">
        {kind === 'steps' && steps.length ? (
          steps.map((s, j) => (
            <span className="st" key={j}>
              {j > 0 && <span className="sep">/</span>}
              <span className="name">{s.name}</span>
              {s.beats && <span className="beats">{fmtBeats(s.beats)}</span>}
              {s.again ? <span className="beats">↻{s.again}</span> : null}
            </span>
          ))
        ) : (
          <span className="name">{line.label ?? ''}</span>
        )}
      </div>
      {line.notes && line.notes.length > 0 && <div className={big ? 'note' : 'note small'}>{line.notes.map((n) => n.text).join(' · ')}</div>}
    </>
  )
}
