import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Player, { isVideoSrc, type PlayerHandle } from '../components/Player'
import YouTubePlayer, { youtubeId } from '../components/YouTubePlayer'
import SheetTable from '../components/SheetTable'
import TopBar from '../components/TopBar'
import { Sheet as Modal, Skeleton, useToast } from '../components/ui'
import { getFolder, getSheet, planRequest, signedUrl, updateSync } from '../lib/api'
import { haptic } from '../lib/prefs'
import { useSpeech } from '../lib/speech'
import { detectTempo, snapToBeat, type Tempo } from '../lib/tempo'
import { activeLine, eventsOf, marksFromEvents, savedBpm, withSync, type Folder, type Stepsheet, type SyncEvent, type SyncSource } from '../lib/types'
import { DEFAULT_BPM, bpmFromEvents, fillEvents, linesToPlan, orderPromptLines, planLines, planOf, planText, stepIdxOf, type PlanItem } from '../lib/sync'

const fmtT = (x: number) => `${Math.floor(x / 60)}:${Math.floor(x % 60).toString().padStart(2, '0')}`
const r1 = (x: number) => Math.round(x * 10) / 10

type Analysis = 'idle' | 'running' | 'done' | 'weak' | 'failed' | 'na'

/**
 * 노래 동기화 화면: 노래를 틀고 1번 줄이 시작되는 순간 한 번만 누르면, 음원에서 분석한 박자로 나머지 줄을 자동으로 채운다.
 * 틀린 줄은 그 줄이 시작될 때 줄을 눌러 고친다. 영상 순서가 스텝지와 다르면 글로 요청("2번부터 시작, 1번은 맨 끝에")해서 순서를 바꾼다.
 */
export default function SyncPage() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const toast = useToast()
  const [sheet, setSheet] = useState<Stepsheet | null>(null)
  const [folder, setFolder] = useState<Folder | null>(null)
  const [audio, setAudio] = useState('')
  const [err, setErr] = useState('')
  const player = useRef<PlayerHandle | null>(null)
  const [t, setT] = useState(0)
  const [events, setEvents] = useState<SyncEvent[]>([])
  const [plan, setPlan] = useState<PlanItem[]>([]) // 춤추는 계획: 줄(lines 인덱스)·쉼
  const [orderNote, setOrderNote] = useState('')
  const [history, setHistory] = useState<SyncEvent[][]>([])
  const [bpm, setBpm] = useState(DEFAULT_BPM)
  const [tempo, setTempo] = useState<Tempo | null>(null)
  const [analysis, setAnalysis] = useState<Analysis>('idle')
  const [phase, setPhase] = useState<'first' | 'fix'>('first')
  const [source, setSourceState] = useState<'file' | 'youtube'>(() => (localStorage.getItem(`src-${id}`) === 'youtube' ? 'youtube' : 'file'))
  const [saving, setSaving] = useState(false)
  const [askOpen, setAskOpen] = useState(false)
  const [request, setRequest] = useState('')
  const speech = useSpeech((t) => setRequest((q) => `${q}${q && !q.endsWith(' ') ? ' ' : ''}${t}`), toast)
  const { listening, busy: hearing, seconds, ok: speechOk, start: startListen, stop: stopListen } = speech
  const [asking, setAsking] = useState(false)
  const touched = useRef(false) // 사용자가 줄을 직접 고쳤는지 (분석이 늦게 끝나도 덮어쓰지 않으려고)

  useEffect(() => {
    getSheet(id)
      .then(async (s) => {
        if (!s) return setErr('스텝지를 찾을 수 없어요')
        setSheet(s)
        getFolder(s.folder_id).then(setFolder)
        const src: SyncSource = s.audio_path && (!s.audio_url || !youtubeId(s.audio_url) || localStorage.getItem(`src-${id}`) !== 'youtube') ? 'file' : 'yt'
        load(s, src, null)
        if (s.audio_path) {
          const url = await signedUrl('audio', s.audio_path)
          setAudio(url)
          analyze(url)
        } else if (s.audio_url) {
          setAudio(s.audio_url)
          setAnalysis('na')
        }
      })
      .catch((e) => setErr(e.message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  /** 저장된 동기화를 불러와 시작 상태 만들기 */
  const load = (s: Stepsheet, src: SyncSource, tp: Tempo | null) => {
    const saved = eventsOf(s.sync, src)
    const idx = stepIdxOf(s)
    setHistory([])
    setOrderNote('')
    if (saved.length) {
      const rate = savedBpm(s.sync) ?? bpmFromEvents(s, saved)
      setEvents(saved)
      setPlan(planOf(s, saved, rate))
      setBpm(rate)
      setPhase('fix')
      touched.current = true
    } else if (src === 'yt') {
      // 유튜브 기본값: 영상 시작과 동시에 1번 줄. 박자는 음원용 동기화가 있으면 거기서, 없으면 기본값
      const rate = savedBpm(s.sync) ?? tp?.bpm ?? bpmFromEvents(s, eventsOf(s.sync, 'file'))
      setBpm(rate)
      setPlan(linesToPlan(idx))
      setEvents(fillEvents(s, linesToPlan(idx), 0, rate))
      setPhase('fix')
      touched.current = false
    } else {
      setEvents([])
      setPlan(linesToPlan(idx))
      setPhase('first')
      touched.current = false
    }
  }
  const setSource = (v: 'file' | 'youtube') => {
    if (!sheet) return
    setSourceState(v)
    localStorage.setItem(`src-${id}`, v)
    load(sheet, v === 'youtube' ? 'yt' : 'file', tempo)
    player.current?.pause()
  }

  /** 음원에서 박자 자동 분석 (기기 안에서만 계산, 몇 초 걸림) */
  const analyze = async (url: string) => {
    setAnalysis('running')
    try {
      const buf = await (await fetch(url)).arrayBuffer()
      const r = await detectTempo(buf)
      if (!r) return setAnalysis('failed')
      setTempo(r)
      setAnalysis(r.confidence >= 0.25 ? 'done' : 'weak')
      if (!touched.current) setBpm(r.bpm)
    } catch {
      setAnalysis('failed')
    }
  }

  // 분석이 끝났을 때 이미 채워 뒀고 아직 손으로 고친 게 없으면 새 박자로 다시 채움
  useEffect(() => {
    if (!sheet || !tempo || touched.current || phase !== 'fix' || !events.length) return
    setEvents(fillEvents(sheet, plan, events[0].t, tempo.bpm))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tempo])

  if (err) return <div className="error">{err}</div>
  if (!sheet)
    return (
      <div className="content">
        <Skeleton rows={6} h={48} />
      </div>
    )

  const canEdit = folder?.role === 'owner' || folder?.role === 'editor'
  const ytId = sheet.audio_url ? youtubeId(sheet.audio_url) : null
  const hasFile = Boolean(sheet.audio_path && audio)
  const playingYt = Boolean(ytId) && (!hasFile || source === 'youtube')
  const fileIsVideo = Boolean(sheet.audio_path && isVideoSrc(sheet.audio_path))
  const noPlayer = !hasFile && !ytId
  const beatsOk = analysis === 'done' && !playingYt
  const stepIdx = stepIdxOf(sheet)
  const activeIndex = activeLine(events, t)
  const marks = marksFromEvents(events, sheet.lines.length)
  const orderText = planText(sheet, plan)
  const order = planLines(plan)
  const orderChanged = plan.length !== stepIdx.length || order.some((l, k) => l !== stepIdx[k]) || plan.some((p) => 'rest' in p || p.beats || p.at !== undefined)

  const now = () => player.current?.time() ?? 0
  const push = (ev: SyncEvent[]) => {
    setHistory((h) => [...h.slice(-20), events])
    setEvents(ev)
  }

  /** 1번(순서상 첫) 줄 시작: 여기부터 박자로 전체 채움 */
  const markFirst = () => {
    if (!order.length) return toast('스텝 줄이 없어요')
    const t0 = r1(snapToBeat(now(), beatsOk ? tempo : null))
    setEvents(fillEvents(sheet, plan, t0, bpm))
    setPhase('fix')
    haptic(15)
  }
  const changeBpm = (v: number) => {
    const rate = Math.max(60, Math.min(200, Math.round(v * 10) / 10))
    setBpm(rate)
    if (events.length) push(fillEvents(sheet, plan, events[0].t, rate))
    touched.current = true
  }
  /** 교정: 줄을 누른 그 순간이 그 줄의 시작이 됨 (그 줄만 바뀜). 같은 줄이 여러 번이면 지금과 가장 가까운 것 */
  const fixLine = (i: number) => {
    const tn = r1(now())
    const mine = events.map((e, k) => ({ e, k })).filter((x) => x.e.line === i)
    let ev: SyncEvent[]
    if (!mine.length) ev = [...events, { t: tn, line: i }].sort((a, b) => a.t - b.t)
    else {
      const near = mine.reduce((a, b) => (Math.abs(b.e.t - tn) < Math.abs(a.e.t - tn) ? b : a))
      ev = events.map((e, k) => (k === near.k ? { ...e, t: tn } : e)).sort((a, b) => a.t - b.t)
    }
    push(ev)
    touched.current = true
    haptic(10)
    toast(`${stepIdx.indexOf(i) + 1}번 줄 시작 → ${fmtT(tn)}`)
  }
  const undo = () => {
    const prev = history[history.length - 1]
    if (!prev) return
    setHistory((h) => h.slice(0, -1))
    setEvents(prev)
  }
  const restart = () => {
    setHistory([])
    setEvents([])
    setPhase('first')
    touched.current = false
    if (tempo) setBpm(tempo.bpm)
    player.current?.seek(0, true)
  }
  /** 직접 요청 → AI가 춤추는 계획(줄 순서·쉼·길이·시작 시각·박자)으로 바꿔 줌 → 그대로 다시 채움 */
  const applyRequest = async () => {
    const q = request.trim()
    if (!q) return
    setAsking(true)
    try {
      const r = await planRequest(orderPromptLines(sheet), q)
      if (r.unclear && !r.plan.length) throw new Error(r.unclear)
      const next: PlanItem[] = r.plan
        .map((p): PlanItem | null => ('rest' in p ? p : stepIdx[p.line - 1] === undefined ? null : { ...p, line: stepIdx[p.line - 1] }))
        .filter((p): p is PlanItem => p !== null)
      if (!planLines(next).length) throw new Error(r.unclear || '요청을 이해하지 못했어요')
      setPlan(next)
      setOrderNote(r.note)
      const rate = r.bpm && r.bpm >= 60 && r.bpm <= 200 ? r.bpm : bpm
      if (r.bpm) setBpm(rate)
      const t0 = r.startAt !== null && r.startAt >= 0 ? r.startAt : events[0]?.t
      if (typeof t0 === 'number') {
        push(fillEvents(sheet, next, t0, rate))
        setPhase('fix')
        touched.current = true
      }
      setAskOpen(false)
      haptic(15)
      toast(r.note ? `${r.note} · ${planText(sheet, next)}` : `바꿨어요: ${planText(sheet, next)}`)
    } catch (e) {
      toast((e as Error).message)
    } finally {
      setAsking(false)
    }
  }
  const resetOrder = () => {
    setPlan(linesToPlan(stepIdx))
    setOrderNote('')
    if (events.length) push(fillEvents(sheet, linesToPlan(stepIdx), events[0].t, bpm))
    setAskOpen(false)
  }
  const save = async () => {
    setSaving(true)
    try {
      await updateSync(sheet.id, withSync(sheet.sync, playingYt ? 'yt' : 'file', events, bpm))
      haptic(20)
      toast(`${playingYt ? '유튜브' : '음원'}용 동기화를 저장했어요. 재생하면 지금 줄이 표시돼요`)
      nav(`/sheet/${sheet.id}`, { replace: true })
    } catch (e) {
      toast((e as Error).message)
    } finally {
      setSaving(false)
    }
  }
  const onLine = (i: number) => {
    if (phase === 'first') return
    fixLine(i)
  }
  const firstNo = order.length ? stepIdx.indexOf(order[0]) + 1 : 1

  return (
    <div className="screen sync-screen">
      <TopBar title="노래 동기화" sub={`${sheet.song?.title ?? ''} · ${sheet.creator_name}`} back={`/sheet/${sheet.id}`} />
      <div className="content sync-content">
        {!canEdit && <div className="notice">이 폴더에서 편집 권한이 없어 저장은 안 돼요.</div>}
        {noPlayer && <div className="notice">음원이 없어요. 수정 화면에서 음원 파일이나 유튜브 링크를 넣은 뒤 동기화할 수 있어요.</div>}
        <SheetTable
          title={sheet.song?.title ?? ''}
          artist={sheet.song?.artist ?? ''}
          creator={sheet.creator_name}
          creatorInfo={sheet.creator_info}
          lines={sheet.lines}
          memo={sheet.memo}
          activeIndex={activeIndex}
          onLine={phase === 'fix' ? onLine : undefined}
          marks={phase === 'fix' ? marks : undefined}
        />
      </div>

      <Modal open={askOpen} title="직접 요청" onClose={() => { stopListen(); setAskOpen(false) }}>
        <div className="panel-desc">말로 하거나 글로 적어 주세요. 순서, 반복, 쉬는 박, 줄 길이, 시작 시각, 박자 다 돼요. 예: "1번 하고 4박 더 쉬고 2번" / "후렴을 두 번" / "3번은 16박으로 길게" / "2번은 35초에" / "박자 128"</div>
        <textarea className="ask" rows={3} value={request} onChange={(e) => setRequest(e.target.value)} placeholder="예: 1번 하고 4박 더 쉬고 2번" />
        {speechOk && (
          <button type="button" className={listening ? 'btn mic on' : 'btn mic'} onClick={listening ? stopListen : startListen} disabled={asking || hearing}>
            {listening ? `● 녹음 중 ${seconds}초 · 다 말했으면 누르세요` : hearing ? '받아 적는 중…' : '🎤 말로 하기'}
          </button>
        )}
        <div className="panel-desc">
          지금 순서: {orderText}
          {orderNote ? ` · ${orderNote}` : ''}
        </div>
        <div className="row-btns" style={{ display: 'flex', gap: 8 }}>
          {orderChanged && (
            <button type="button" className="btn" onClick={resetOrder} disabled={asking}>
              스텝지 순서로
            </button>
          )}
          <button type="button" className="btn primary" style={{ flex: 1 }} onClick={applyRequest} disabled={asking || !request.trim()}>
            {asking ? '읽는 중…' : '이대로 맞추기'}
          </button>
        </div>
      </Modal>

      {!noPlayer && (
        <div className="sync-dock no-print">
          <div className="syncbar">
            {hasFile && ytId && (
              <div className="row">
                <div className="srcseg" role="group" aria-label="무엇에 맞출지">
                  <button type="button" className={source === 'file' ? 'on' : ''} onClick={() => setSource('file')}>
                    음원에 맞추기
                  </button>
                  <button type="button" className={source === 'youtube' ? 'on' : ''} onClick={() => setSource('youtube')}>
                    유튜브에 맞추기
                  </button>
                </div>
              </div>
            )}
            <div className={`sync-status ${playingYt ? 'na' : analysis}`}>
              {playingYt ? (
                tempo && analysis === 'done' ? `유튜브 · 음원에서 찾은 박자 ${tempo.bpm} BPM으로 자동 채워요` : `유튜브 · ${Math.round(bpm * 10) / 10} BPM 기준으로 자동 채워요 (틀리면 −/+ 또는 직접 요청)`
              ) : (
                <>
                  {analysis === 'running' && '박자 분석 중… (몇 초 걸려요)'}
                  {analysis === 'done' && tempo && `박자 자동 인식: ${tempo.bpm} BPM`}
                  {analysis === 'weak' && tempo && `박자 ${tempo.bpm} BPM (확신 낮음 · 틀리면 −/+ 또는 직접 요청)`}
                  {analysis === 'failed' && `박자를 못 찾았어요 · ${Math.round(bpm * 10) / 10} BPM 기준으로 채워요 (틀리면 −/+ 또는 직접 요청)`}
                  {analysis === 'na' && `${Math.round(bpm * 10) / 10} BPM 기준으로 자동 채워요 (틀리면 −/+ 또는 직접 요청)`}
                </>
              )}
              {orderChanged && <span className="order-chip">순서 {orderText}</span>}
            </div>
            <div className="sync-hint">
              {phase === 'first' ? (
                <>
                  노래를 틀고 <b>{firstNo}번 줄 동작이 시작되는 순간</b> 아래 버튼을 누르세요. 나머지 줄은 박자로 자동 계산돼요.
                </>
              ) : (
                <>
                  틀린 줄이 있으면 <b>그 줄이 시작되는 순간 그 줄을 누르세요.</b> 그 순간이 그 줄의 시작이 돼요(그 줄만 바뀜). 다 맞으면 저장.
                </>
              )}
            </div>
            {phase === 'first' ? (
              <div className="row">
                <button type="button" className="btn next" onClick={markFirst}>
                  여기부터 ({firstNo}번 줄 시작)
                </button>
                <button type="button" className="btn ask-btn" onClick={() => setAskOpen(true)}>
                  직접
                  <br />
                  요청
                </button>
              </div>
            ) : (
              <>
                <div className="row">
                  <div className="bpm">
                    <button type="button" className="btn" aria-label="느린 박자" onClick={() => changeBpm(bpm - 0.5)}>
                      −
                    </button>
                    <span>
                      {Math.round(bpm * 10) / 10}
                      <small>BPM</small>
                    </span>
                    <button type="button" className="btn" aria-label="빠른 박자" onClick={() => changeBpm(bpm + 0.5)}>
                      +
                    </button>
                  </div>
                </div>
                <div className="row">
                  <button type="button" className="btn" onClick={() => setAskOpen(true)}>
                    직접 요청
                  </button>
                  <button type="button" className="btn" onClick={undo} disabled={!history.length}>
                    되돌리기
                  </button>
                  <button type="button" className="btn" onClick={restart}>
                    처음부터
                  </button>
                </div>
                <div className="row">
                  <button type="button" className="btn save" onClick={save} disabled={saving || !canEdit}>
                    {saving ? '저장 중…' : '동기화 저장'}
                  </button>
                </div>
              </>
            )}
          </div>
          {playingYt && ytId && <YouTubePlayer videoId={ytId} name={sheet.song?.title ?? ''} onTime={setT} handle={player} />}
          {hasFile && !playingYt && <Player src={audio} name={sheet.song?.title ?? ''} video={fileIsVideo} onTime={setT} handle={player} />}
        </div>
      )}
    </div>
  )
}
