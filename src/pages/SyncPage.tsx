import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Player, { isVideoSrc, type PlayerHandle } from '../components/Player'
import YouTubePlayer, { youtubeId } from '../components/YouTubePlayer'
import SheetTable from '../components/SheetTable'
import TopBar from '../components/TopBar'
import HelpButton from '../components/HelpButton'
import Tour from '../components/Tour'
import { Sheet as Modal, Skeleton, useToast } from '../components/ui'
import { getFolder, getSheet, planRequest, signedUrl, updateSync, videoSync, type AiSyncSrc } from '../lib/api'
import { haptic } from '../lib/prefs'
import { useSpeech } from '../lib/speech'
import { detectTempo, snapToBeat, type Tempo } from '../lib/tempo'
import { activeLine, eventsOf, marksFromEvents, savedBpm, savedPlan, withSync, type Folder, type Stepsheet, type SyncEvent, type SyncSource } from '../lib/types'
import { DEFAULT_BPM, bpmFromEvents, defaultPlan, fillEvents, foldBpm, orderPromptLines, planFromReply, planIndexOfEvent, planLines, planOf, planText, samePlan, stepIdxOf, unpinned, isRest, type PlanItem } from '../lib/sync'
import { JOB_EVENT, addJob, jobFor, removeJob } from '../lib/jobs'
import { contactSheets } from '../lib/frames'
import DeepToggle from '../components/DeepToggle'

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
  const [watching, setWatching] = useState('') // 영상 보고 맞추기 진행 상태 글 ('' = 안 하는 중)
  const [jobId, setJobId] = useState<string | null>(() => jobFor(id)?.id ?? null) // 서버에서 돌고 있는 영상 보고 맞추기
  const [stamps, setStamps] = useState<number[] | null>(null) // 8박마다 찍기 중이면 찍은 시각들
  const [manual, setManual] = useState(false) // 수동 교정 도구(여기부터·BPM·박자 찍기 등) 펼침
  const touched = useRef(false) // 사용자가 줄을 직접 고쳤는지 (분석이 늦게 끝나도 덮어쓰지 않으려고)
  const bpmSure = useRef(false) // 박자가 믿을 만한지(음원 분석 성공·8박 찍기·손으로 고침·저장값). 아니면 AI에게 박자를 안 알려 주고 스스로 재게 함

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

  // 서버에서 돌던 영상 보고 맞추기가 끝나 저장되면 그 결과를 불러옴
  useEffect(() => {
    const onDone = (e: Event) => {
      const d = (e as CustomEvent<{ sheetId: string }>).detail
      if (d?.sheetId !== id) return
      setJobId(null)
      setWatching('')
      getSheet(id).then((s) => {
        if (!s) return
        setSheet(s)
        load(s, source === 'youtube' || !s.audio_path ? 'yt' : 'file', tempo)
      })
    }
    window.addEventListener(JOB_EVENT, onDone)
    return () => window.removeEventListener(JOB_EVENT, onDone)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, source, tempo])

  /** 저장된 동기화를 불러와 시작 상태 만들기 */
  const load = (s: Stepsheet, src: SyncSource, tp: Tempo | null) => {
    const saved = eventsOf(s.sync, src)
    setHistory([])
    setOrderNote('')
    if (saved.length) {
      const rate = savedBpm(s.sync) ?? bpmFromEvents(s, saved)
      bpmSure.current = savedBpm(s.sync) !== null
      setEvents(saved)
      setPlan(savedPlan(s.sync, src) ?? planOf(s, saved, rate))
      setBpm(rate)
      setPhase('fix')
      touched.current = true
    } else if (src === 'yt') {
      // 유튜브 기본값: 영상 시작과 동시에 1번 줄. 박자는 음원용 동기화가 있으면 거기서, 없으면 기본값
      const rate = savedBpm(s.sync) ?? tp?.bpm ?? bpmFromEvents(s, eventsOf(s.sync, 'file'))
      bpmSure.current = savedBpm(s.sync) !== null || (!!tp && tp.confidence >= 0.25)
      setBpm(rate)
      setPlan(defaultPlan(s))
      setEvents(fillEvents(s, defaultPlan(s), 0, rate))
      setPhase('fix')
      touched.current = false
    } else {
      setEvents([])
      setPlan(defaultPlan(s))
      setPhase('first')
      touched.current = false
      bpmSure.current = !!tp && tp.confidence >= 0.25
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
      if (r.confidence >= 0.25) bpmSure.current = true
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
  const orderChanged = !samePlan(plan, defaultPlan(sheet))

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
    bpmSure.current = true
  }
  /**
   * 교정: 줄을 누른 그 순간이 그 줄의 시작이 됨. 박자(BPM)와 줄 박수는 그대로 두고 시작 위치만 옮기므로
   * 그 뒤 줄들도 같이 밀리고(이미 고정한 줄은 제자리), 앞 줄과 벌어진 만큼은 쉼이 됨. 같은 줄이 여러 번이면 지금과 가장 가까운 것
   */
  const fixLine = (i: number) => {
    const tn = r1(now())
    const mine = events.map((e, k) => ({ e, k })).filter((x) => x.e.line === i)
    if (!mine.length) {
      push([...events, { t: tn, line: i }].sort((a, b) => a.t - b.t))
    } else {
      const near = mine.reduce((a, b) => (Math.abs(b.e.t - tn) < Math.abs(a.e.t - tn) ? b : a))
      const pi = planIndexOfEvent(plan, events, near.k)
      if (pi >= 0) {
        const next = plan.map((p, k) => (k === pi && !isRest(p) ? { ...p, at: tn } : p))
        setPlan(next)
        push(fillEvents(sheet, next, events[0].t, bpm))
      } else push(events.map((e, k) => (k === near.k ? { ...e, t: tn } : e)).sort((a, b) => a.t - b.t))
    }
    touched.current = true
    haptic(10)
    toast(`${stepIdx.indexOf(i) + 1}번 줄 시작 → ${fmtT(tn)} (뒤 줄도 같이 옮겨요)`)
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
    setPlan(unpinned(plan))
    setPhase('first')
    touched.current = false
    if (tempo) setBpm(tempo.bpm)
    player.current?.seek(0, true)
  }
  /** 직접 요청 → AI가 춤추는 계획(줄 순서·쉼·길이·시작 시각·박자)으로 바꿔 줌 → 그대로 다시 채움 */
  const applyRequest = async () => {
    const q = request.trim()
    if (!q) return
    // 영상·음원이 있으면 AI가 영상을 처음부터 끝까지 보면서 요청을 같이 반영 (글만으로 못 알아듣는 "영상 보고 맞춰" 같은 요청도 됨)
    if ((playingYt && ytId) || (hasFile && audio)) {
      await watchVideo(q)
      return
    }
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
  /**
   * 영상 보고 맞추기(고도 추론): 영상의 장면들을 시각을 적은 장면표로 만들고, AI가 그걸 보고 줄마다 시작 시각을 찾는다.
   * 유튜브면 서버가 유튜브 미리보기 장면(스토리보드)을 가져오고, 올려 둔 영상 파일이면 1초마다 프레임을 뽑는다.
   */
  const watchVideo = async (req = '') => {
    if (watching) return
    try {
      let src: AiSyncSrc
      if (playingYt && ytId) {
        // 유튜브는 AI(Gemini)가 영상을 직접 봄 — 서버에서 영상을 내려받지 않음
        setWatching('AI에게 유튜브 영상을 보여 주는 중…')
        src = { ytUrl: `https://www.youtube.com/watch?v=${ytId}` }
      } else if (fileIsVideo && audio) {
        setWatching('영상에서 장면 뽑는 중… 0%')
        const fr = await contactSheets(audio, (d, n) => setWatching(`영상에서 장면 뽑는 중… ${Math.round((d / n) * 100)}%`))
        setWatching(`AI에게 영상 ${fr.frames}장면을 보내는 중…`)
        src = fr
      } else if (hasFile && audio) {
        // 음악 파일: AI(Gemini)가 음악을 직접 듣고 전주·구절 경계로 맞춤
        setWatching('음악 파일 읽는 중…')
        const blob = await (await fetch(audio)).blob()
        if (blob.size > 14 * 1024 * 1024) throw new Error('음원 파일이 너무 커요 (14MB까지). 유튜브 링크를 넣거나 작은 파일로 바꿔 주세요')
        const b64 = await new Promise<string>((res, rej) => {
          const fr = new FileReader()
          fr.onload = () => res(String(fr.result).split(',')[1] ?? '')
          fr.onerror = () => rej(new Error('음원을 읽지 못했어요'))
          fr.readAsDataURL(blob)
        })
        const ext = (sheet.audio_path ?? '').split('.').pop()?.toLowerCase() ?? ''
        const mime = blob.type && blob.type !== 'application/octet-stream' ? blob.type : ({ m4a: 'audio/mp4', mp4: 'audio/mp4', aac: 'audio/aac', mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', webm: 'audio/webm', flac: 'audio/flac' } as Record<string, string>)[ext] ?? 'audio/mpeg'
        setWatching('AI에게 음악을 들려주는 중…')
        src = { audio: { media_type: mime, data: b64 } }
      } else throw new Error('음원 파일이나 유튜브 링크가 있어야 AI가 맞출 수 있어요')
      // 박자를 확실히 알 때만 AI에게 알려 줌. 기본값(128)을 아는 척 보내면 AI가 엉뚱한 격자에 맞춰 버림
      const r = await videoSync(sheet.id, src, orderPromptLines(sheet), bpmSure.current ? bpm : 0, req)
      if ('jobId' in r) {
        // 서버에서 이어서 돎: 화면을 떠나거나 앱을 꺼도 끝나면 저장되고 알려 줌
        addJob({ id: r.jobId, sheetId: sheet.id, kind: 'video_sync', src: playingYt ? 'yt' : 'file', bpm, sure: bpmSure.current, title: sheet.song?.title ?? '스텝지', started: Date.now() })
        setJobId(r.jobId)
        setWatching('')
        setAskOpen(false)
        toast(`AI가 ${req ? '요청을 읽고 ' : ''}${playingYt || fileIsVideo ? '영상을 보고' : '음악을 듣고'} 있어요 (1~3분). 다른 화면에 가 있어도 끝나면 저장되고 알려 드려요`)
        return
      }
      const out = planFromReply(sheet, r, bpm, events[0]?.t ?? 0, { sure: bpmSure.current, phase: !playingYt && tempo ? tempo.phase : null })
      if (!out) throw new Error(r.unclear || '영상에서 스텝 시작을 찾지 못했어요')
      setPlan(out.plan)
      setOrderNote(r.note)
      setBpm(out.rate)
      push(out.events)
      setPhase('fix')
      touched.current = true
      setAskOpen(false)
      haptic([15, 60, 15])
      toast(`AI가 맞췄어요${r.note ? ` · ${r.note}` : ''}${out.snapped ? ` · ${out.rate} BPM 격자에 맞춤` : ''}. 틀린 줄은 그 줄이 시작될 때 눌러 고치세요`)
    } catch (e) {
      toast((e as Error).message)
    } finally {
      setWatching('')
    }
  }
  const cancelJob = () => {
    if (jobId) removeJob(jobId)
    setJobId(null)
    toast('AI 맞추기를 취소했어요')
  }
  /**
   * 8박마다 찍기: 노래를 들으며 한 구절(8박)이 시작될 때마다 누른다. 처음 찍은 순간이 1번 줄 시작,
   * 찍은 간격의 중간값으로 BPM을 정확히 잡고(8박 = 간격) 그 박자로 전체를 다시 채운다
   */
  const stamp = () => {
    const tn = r1(now())
    setStamps((st) => [...(st ?? []), tn])
    haptic(12)
  }
  const finishStamps = () => {
    const st = stamps ?? []
    setStamps(null)
    if (!st.length) return
    let rate = bpm
    if (st.length >= 2) {
      const gaps = st.slice(1).map((t, i) => t - st[i]).filter((g) => g > 0.5)
      if (gaps.length) {
        gaps.sort((a, b) => a - b)
        rate = foldBpm((8 * 60) / gaps[Math.floor(gaps.length / 2)])
        setBpm(rate)
        bpmSure.current = true
      }
    }
    const next = unpinned(plan)
    setPlan(next)
    push(fillEvents(sheet, next, st[0], rate))
    setPhase('fix')
    touched.current = true
    haptic([15, 60, 15])
    toast(st.length >= 2 ? `${st.length}번 찍어 ${Math.round(rate * 10) / 10} BPM으로 맞췄어요 (1번 줄 ${fmtT(st[0])}부터)` : `1번 줄 시작을 ${fmtT(st[0])}로 잡았어요`)
  }
  const resetOrder = () => {
    setPlan(defaultPlan(sheet))
    setOrderNote('')
    if (events.length) push(fillEvents(sheet, defaultPlan(sheet), events[0].t, bpm))
    setAskOpen(false)
  }
  const save = async () => {
    setSaving(true)
    try {
      await updateSync(sheet.id, withSync(sheet.sync, playingYt ? 'yt' : 'file', events, bpm, plan))
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
      <TopBar title="노래 동기화" sub={`${sheet.song?.title ?? ''} · ${sheet.creator_name}`} back={`/sheet/${sheet.id}`} right={<HelpButton page="sync" />} />
      <div className="content sync-content">
        {!canEdit && <div className="notice">이 폴더에서 편집 권한이 없어 저장은 안 돼요.</div>}
        {sheet.finalized && <div className="notice warn">✔ 수정 완료로 표시된 스텝지예요. 여기서는 동기화(시각)만 바뀌고 표시는 그대로예요.</div>}
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
        <div className="panel-desc">말로 하거나 글로 적어 주세요. 유튜브·음원이 있으면 AI가 영상을 처음부터 끝까지 보면서 요청을 반영해요 (1~3분). 순서, 반복, 쉬는 박, 줄 길이, 시작 시각, 박자 다 돼요. 예: "1번이 두 번 반복돼" / "중간에 쉬는 데 있으니 영상 보고 꼼꼼히 맞춰 줘" / "2번은 35초에" / "박자 128"</div>
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
        <DeepToggle note="빠른 모델로 바로 맞춰요. 복잡한 요청이면 켜 보세요" />
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
        <Tour
          name="sync"
          ready={Boolean(folder)}
          steps={[
            { sel: '[data-tour="ai"]', title: 'AI로 맞추기', desc: '누르면 AI가 노래를 듣고(영상은 보고) 줄마다 시작 시각을 찾아요. 1~3분 뒤 자동 저장돼요.' },
            { sel: '[data-tour="manual"]', title: '직접 고치기', desc: '틀린 줄은 재생 중 그 줄이 시작될 때 그 줄을 누르면 돼요. 더 세밀한 도구는 여기를 펼치세요.' },
          ]}
        />
      )}
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
                tempo && analysis === 'done' ? `유튜브 · 음원에서 찾은 박자 ${tempo.bpm} BPM` : `유튜브 · ${Math.round(bpm * 10) / 10} BPM 기준`
              ) : (
                <>
                  {analysis === 'running' && '박자 분석 중… (몇 초 걸려요)'}
                  {analysis === 'done' && tempo && `박자 자동 인식: ${tempo.bpm} BPM`}
                  {analysis === 'weak' && tempo && `박자 ${tempo.bpm} BPM (확신 낮음)`}
                  {analysis === 'failed' && `박자를 못 찾았어요 · ${Math.round(bpm * 10) / 10} BPM 기준`}
                  {analysis === 'na' && `${Math.round(bpm * 10) / 10} BPM 기준`}
                </>
              )}
              {orderChanged && <span className="order-chip">순서 {orderText}</span>}
            </div>
            {jobId && (
              <div className="job-chip">
                🤖 AI가 {playingYt || fileIsVideo ? '영상을 보고' : '음악을 듣고'} 있어요… 끝나면 저장되고 알려 드려요. 다른 화면에 가도 돼요.
                <button type="button" className="btn tiny" onClick={cancelJob}>
                  취소
                </button>
              </div>
            )}
            {stamps !== null ? (
              <>
                <div className="sync-hint">
                  노래를 들으며 <b>한 구절(8박)이 시작될 때마다</b> 찍으세요. 처음 찍는 순간이 1번 줄 시작이고, 찍은 간격으로 박자(BPM)를 정확히 잡아요. 서너 번만 찍어도 돼요.
                </div>
                <div className="row">
                  <button type="button" className="btn next" onClick={stamp}>
                    👣 찍기{stamps.length ? ` (${stamps.length}번)` : ''}
                  </button>
                </div>
                <div className="row">
                  <button type="button" className="btn" onClick={() => setStamps(null)}>
                    그만두기
                  </button>
                  <button type="button" className="btn save" onClick={finishStamps} disabled={!stamps.length}>
                    다 찍었어요
                  </button>
                </div>
              </>
            ) : (
            <>
            <div className="sync-hint">
              {phase === 'first' ? (
                <>
                  <b>🤖 AI로 맞추기</b>를 누르면 AI가 {playingYt || fileIsVideo ? '영상을 보고' : '음악을 듣고'} 줄마다 시작을 찾아요. 1~3분 걸리고 끝나면 자동 저장돼요.
                </>
              ) : (
                <>
                  틀린 줄이 있으면 <b>그 줄이 시작되는 순간 그 줄을 누르세요.</b> 뒤 줄도 같이 옮겨져요. 다 맞으면 저장.
                </>
              )}
            </div>
            <div className="row">
              <button type="button" className="btn primary ai-btn" onClick={() => watchVideo()} disabled={Boolean(watching) || Boolean(jobId) || asking} data-tour="ai">
                {watching || (jobId ? 'AI가 맞추는 중…' : '🤖 AI로 맞추기')}
              </button>
              <button type="button" className="btn" onClick={() => setAskOpen(true)} disabled={asking}>
                🎤 말로 요청
              </button>
            </div>
            <div className="row">
              {phase === 'fix' && (
                <button type="button" className="btn save" onClick={save} disabled={saving || !canEdit}>
                  {saving ? '저장 중…' : '동기화 저장'}
                </button>
              )}
              <button type="button" className={manual ? 'btn more on' : 'btn more'} onClick={() => setManual((v) => !v)} aria-expanded={manual} data-tour="manual">
                {manual ? '간단히 ▴' : '직접 고치기 ▾'}
              </button>
            </div>
            {manual && (
              <div className="manual-box">
                <DeepToggle note="AI로 맞출 때 더 깊이 생각해요 (느리지만 정확)" />
                {phase === 'first' ? (
                  <>
                    <div className="sync-hint">
                      노래를 틀고 <b>{firstNo}번 줄 동작이 시작되는 순간</b> 누르세요. 나머지 줄은 박자로 자동 계산돼요.
                    </div>
                    <div className="row">
                      <button type="button" className="btn next" onClick={markFirst}>
                        여기부터 ({firstNo}번 줄 시작)
                      </button>
                      <button type="button" className="btn" onClick={() => setStamps([])}>
                        박자 찍기
                      </button>
                    </div>
                  </>
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
                      <button type="button" className="btn" onClick={() => setStamps([])}>
                        박자 찍기
                      </button>
                      <button type="button" className="btn" onClick={undo} disabled={!history.length}>
                        되돌리기
                      </button>
                      <button type="button" className="btn" onClick={restart}>
                        처음부터
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
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
