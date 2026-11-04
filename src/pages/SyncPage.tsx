import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Player, { isVideoSrc, type PlayerHandle } from '../components/Player'
import YouTubePlayer, { youtubeId } from '../components/YouTubePlayer'
import SheetTable from '../components/SheetTable'
import TopBar from '../components/TopBar'
import { Skeleton, useToast } from '../components/ui'
import { getFolder, getSheet, signedUrl, updateSync } from '../lib/api'
import { haptic } from '../lib/prefs'
import { detectTempo, snapToBeat, type Tempo } from '../lib/tempo'
import { beatsOf, hasMarks, kindOf, syncOf, withSync, type Folder, type Stepsheet, type SyncSource } from '../lib/types'

const fmtT = (x: number) => `${Math.floor(x / 60)}:${Math.floor(x % 60).toString().padStart(2, '0')}`
const r1 = (x: number) => Math.round(x * 10) / 10
const DEFAULT_BPM = 128

type Analysis = 'idle' | 'running' | 'done' | 'weak' | 'failed' | 'na'

/**
 * 노래 동기화 화면: 노래를 틀고 1번 줄이 시작되는 순간 한 번만 누르면, 음원에서 분석한 박자로 나머지 줄을 자동으로 채운다.
 * 틀린 줄은 그 줄이 시작될 때 줄을 눌러 고친다(그 줄부터 뒤가 같이 밀림). 저장하면 보기 화면에서 재생 중인 줄이 표시된다.
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
  const [marks, setMarks] = useState<(number | null)[]>([])
  const [history, setHistory] = useState<(number | null)[][]>([])
  const [bpm, setBpm] = useState(DEFAULT_BPM)
  const [tempo, setTempo] = useState<Tempo | null>(null)
  const [analysis, setAnalysis] = useState<Analysis>('idle')
  const [phase, setPhase] = useState<'first' | 'fix'>('first')
  const [source, setSourceState] = useState<'file' | 'youtube'>(() => (localStorage.getItem(`src-${id}`) === 'youtube' ? 'youtube' : 'file'))
  const [saving, setSaving] = useState(false)
  const touched = useRef(false) // 사용자가 줄을 직접 고쳤는지 (분석이 늦게 끝나도 덮어쓰지 않으려고)

  useEffect(() => {
    getSheet(id)
      .then(async (s) => {
        if (!s) return setErr('스텝지를 찾을 수 없어요')
        setSheet(s)
        getFolder(s.folder_id).then(setFolder)
        const src: SyncSource = s.audio_path && (!s.audio_url || !youtubeId(s.audio_url) || localStorage.getItem(`src-${id}`) !== 'youtube') ? 'file' : 'yt'
        loadMarks(s, src)
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

  /** 음원용/유튜브용 저장된 시각을 불러와 시작 상태 만들기 */
  const loadMarks = (s: Stepsheet, src: SyncSource) => {
    const saved = syncOf(s.sync, src)
    if (hasMarks(saved)) {
      setMarks(s.lines.map((_, i) => saved[i] ?? null))
      setPhase('fix')
      touched.current = true
    } else {
      setMarks(s.lines.map(() => null))
      setPhase('first')
      touched.current = false
    }
    setHistory([])
  }
  const setSource = (v: 'file' | 'youtube') => {
    if (!sheet) return
    setSourceState(v)
    localStorage.setItem(`src-${id}`, v)
    loadMarks(sheet, v === 'youtube' ? 'yt' : 'file')
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

  // 분석이 끝났을 때 이미 1번 줄을 찍어 뒀고 아직 손으로 고친 게 없으면 새 박자로 다시 채움
  useEffect(() => {
    if (!sheet || !tempo || touched.current || phase !== 'fix') return
    const t0 = marks[stepIdxOf(sheet)[0]]
    if (typeof t0 === 'number') setMarks(fill(sheet, marks, 0, t0, tempo.bpm))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tempo])

  // 재생 중인 줄이 화면에 보이게
  const stepIdx = sheet ? stepIdxOf(sheet) : []
  const activeIndex = (() => {
    let best: number | undefined
    marks.forEach((v, i) => {
      if (typeof v === 'number' && v <= t + 0.05) best = i
    })
    return best
  })()

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

  const now = () => player.current?.time() ?? 0
  const push = (m: (number | null)[]) => {
    setHistory((h) => [...h.slice(-20), marks])
    setMarks(m)
  }

  /** 1번 줄 시작: 여기부터 박자로 전체 채움 */
  const markFirst = () => {
    if (!stepIdx.length) return toast('스텝 줄이 없어요')
    const t0 = r1(snapToBeat(now(), beatsOk ? tempo : null))
    setMarks(fill(sheet, marks, 0, t0, bpm))
    setPhase('fix')
    haptic(15)
  }
  /** 2번 줄 시작으로 박자 재기 (자동 분석이 안 될 때) */
  const markSecond = () => {
    const t0 = marks[stepIdx[0]]
    const t1 = now()
    if (typeof t0 !== 'number' || t1 <= t0 + 0.5 || stepIdx.length < 2) return
    const rate = Math.max(60, Math.min(200, Math.round((lineBeats(sheet, stepIdx[0]) * 60) / (t1 - t0))))
    setBpm(rate)
    push(fill(sheet, marks, 0, t0, rate))
    touched.current = true
    haptic(15)
    toast(`박자 ${rate} BPM으로 다시 맞췄어요`)
  }
  const changeBpm = (v: number) => {
    const rate = Math.max(60, Math.min(200, Math.round(v * 10) / 10))
    setBpm(rate)
    const t0 = marks[stepIdx[0]]
    if (typeof t0 === 'number') push(fill(sheet, marks, 0, t0, rate))
    touched.current = true
  }
  /** 교정: 줄을 누른 그 순간이 그 줄의 시작이 됨 (그 줄만 바뀜) */
  const fixLine = (i: number) => {
    const k = stepIdx.indexOf(i)
    if (k < 0) return
    const tn = r1(now())
    const m = [...marks]
    m[i] = tn
    push(m)
    touched.current = true
    haptic(10)
    toast(`${k + 1}번 줄 시작 → ${fmtT(tn)}`)
  }
  const undo = () => {
    const prev = history[history.length - 1]
    if (!prev) return
    setHistory((h) => h.slice(0, -1))
    setMarks(prev)
  }
  const restart = () => {
    setHistory([])
    setMarks(sheet.lines.map(() => null))
    setPhase('first')
    touched.current = false
    if (tempo) setBpm(tempo.bpm)
    player.current?.seek(0, true)
  }
  const save = async () => {
    setSaving(true)
    try {
      await updateSync(sheet.id, withSync(sheet.sync, playingYt ? 'yt' : 'file', marks))
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
                tempo && analysis === 'done' ? `유튜브 · 음원에서 찾은 박자 ${tempo.bpm} BPM 사용 (다르면 2번 줄로 재세요)` : '유튜브는 박자 자동 분석이 안 돼요 · 2번 줄 시작도 눌러 주세요'
              ) : (
                <>
                  {analysis === 'running' && '박자 분석 중… (몇 초 걸려요)'}
                  {analysis === 'done' && tempo && `박자 자동 인식: ${tempo.bpm} BPM`}
                  {analysis === 'weak' && tempo && `박자 ${tempo.bpm} BPM (확신 낮음 · 틀리면 2번 줄로 재세요)`}
                  {analysis === 'failed' && '박자를 못 찾았어요 · 2번 줄 시작도 눌러 주세요'}
                  {analysis === 'na' && '유튜브는 박자 자동 분석이 안 돼요 · 2번 줄 시작도 눌러 주세요'}
                </>
              )}
            </div>
            <div className="sync-hint">
              {phase === 'first' ? (
                <>
                  노래를 틀고 <b>1번 줄 동작이 시작되는 순간</b> 아래 버튼을 누르세요. 나머지 줄은 박자로 자동 계산돼요.
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
                  여기부터 (1번 줄 시작)
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
                  {(!beatsOk || playingYt) && stepIdx.length > 1 && (
                    <button type="button" className="btn next" onClick={markSecond}>
                      2번 줄 시작
                    </button>
                  )}
                  <button type="button" className="btn" onClick={undo} disabled={!history.length}>
                    되돌리기
                  </button>
                </div>
                <div className="row">
                  <button type="button" className="btn" onClick={restart}>
                    처음부터 다시
                  </button>
                  <button type="button" className="btn save" onClick={save} disabled={saving || !canEdit}>
                    {saving ? '저장 중…' : '저장'}
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

/** 스텝 줄들의 lines 인덱스 */
function stepIdxOf(sheet: Stepsheet) {
  return sheet.lines.map((l, i) => (kindOf(l) === 'steps' && l.steps.some((st) => st.name.trim()) ? i : -1)).filter((i) => i >= 0)
}
/** 한 줄의 박수. 안 적혀 있으면 8박 */
function lineBeats(sheet: Stepsheet, i: number) {
  const b = sheet.lines[i].steps.reduce((n, st) => n + beatsOf(st.beats), 0)
  return b > 0 ? b : 8
}
/** from번째 스텝 줄이 t0에 시작한다고 보고, 그 뒤 줄들을 박자로 채움 (앞 줄들은 그대로) */
function fill(sheet: Stepsheet, base: (number | null)[], from: number, t0: number, rate: number) {
  const idx = stepIdxOf(sheet)
  const m = [...base]
  let cur = t0
  for (let k = from; k < idx.length; k++) {
    m[idx[k]] = r1(cur)
    cur += (lineBeats(sheet, idx[k]) * 60) / rate
  }
  return m
}
