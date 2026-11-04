export type Role = 'owner' | 'editor' | 'viewer'

export interface Folder {
  id: string
  name: string
  kind: 'personal' | 'shared'
  owner_id: string
  invite_code: string | null
  role?: Role
  song_count?: number
}

export interface Song {
  id: string
  folder_id: string
  title: string
  artist: string
}

/** 보조 해설의 종류 (파란 작은 글씨). lyric(가사)만 회색 */
export type NoteType = 'explanation' | 'hand_motion' | 'style' | 'caution' | 'creator_intent' | 'note' | 'lyric'
export const NOTE_TYPES: { v: NoteType; label: string }[] = [
  { v: 'explanation', label: '해설' },
  { v: 'hand_motion', label: '손동작' },
  { v: 'style', label: '느낌·스타일' },
  { v: 'caution', label: '주의' },
  { v: 'creator_intent', label: '창작자 의도' },
  { v: 'note', label: '메모' },
  { v: 'lyric', label: '가사' },
]
export interface Note {
  text: string
  type?: NoteType
}

/** 스텝 하나: 표준 이름 + 박수(숫자 문자열, 없으면 '') + 원문 */
export interface Step {
  name: string
  beats: string
  /** 사진에 적힌 원래 표기 (표준화 전, 다르면만 채움) */
  raw?: string
  uncertain?: boolean
  /** 8박 도장: 박수가 안 적힌 스텝지에서 "이 스텝에서 한 구절(8박)이 끝남"을 사용자가 찍어 둔 표시 (글로는 뒤에 " |") */
  bar?: boolean
  /** 반복 도장: 이 스텝 뒤에서 앞 N박을 한 번 더 춤 (글로는 뒤에 " ↻8"). 동기화에서는 이 줄이 N박 더 길어짐 */
  again?: number
}

/** 줄 종류: steps 일반 / section 구간 제목 / repeat 반복 지시 / rest 쉼·전환 / text 그 밖의 글 */
export type LineKind = 'steps' | 'section' | 'repeat' | 'rest' | 'text'
export const LINE_KINDS: { v: LineKind; label: string; hint: string }[] = [
  { v: 'steps', label: '스텝', hint: '예) 런닝맨 4 / 티스텝 4' },
  { v: 'section', label: '구간', hint: '예) 후렴, A파트, 전주' },
  { v: 'repeat', label: '반복', hint: '예) 8박 반복, 16박 반복, 처음부터 한 번 더' },
  { v: 'rest', label: '쉬기', hint: '예) 4박 쉬기, 8박 쉬기, 턴 후 정리' },
  { v: 'text', label: '글', hint: '예) 셔플 부분만' },
]

/** 스텝지 한 줄. steps 줄이면 스텝 여러 개(8박 권장, 강제 아님), 그 외는 label */
export interface Line {
  steps: Step[]
  kind?: LineKind
  label?: string
  notes?: Note[]
}

export interface Stepsheet {
  id: string
  song_id: string
  folder_id: string
  creator_name: string
  creator_info: string
  lines: Line[]
  memo: string
  /** 노래 동기화: lines 순서대로 각 줄이 시작되는 시각(초). 안 찍은 줄은 null */
  /** 노래 동기화: 줄별 시작 시각(초). 옛 데이터는 배열(음원용), 새 데이터는 { file, yt } */
  sync?: SyncData
  audio_path: string | null
  audio_url: string | null
  photo_paths: string[]
  created_by: string | null
  created_at: string
  updated_at: string
  /** 수정 완료 표시: 검토가 끝난 스텝지. 다시 고치려 하면 경고하고, 고치면 표시가 풀림 */
  finalized?: boolean
  song?: Song
}

export interface Recognized {
  title: string
  artist: string
  creator_name: string
  creator_info: string
  memo: string
  lines: Line[]
}

export const emptyStep = (): Step => ({ name: '', beats: '' })
export const emptyLine = (kind: LineKind = 'steps'): Line => ({ steps: [], kind })

export const emptyRecognized = (): Recognized => ({
  title: '',
  artist: '',
  creator_name: '',
  creator_info: '',
  memo: '',
  lines: [emptyLine(), emptyLine(), emptyLine()],
})

export const kindOf = (l: Line): LineKind => l.kind ?? 'steps'
export const isStepLine = (l: Line) => kindOf(l) === 'steps'

export function beatsOf(s: string): number {
  const m = (s ?? '').match(/\d+/)
  return m ? Number(m[0]) : 0
}
/** 박수 표시: "4박" → "4", "x2" 같은 글은 그대로 */
export function fmtBeats(s: string): string {
  const b = (s ?? '').trim()
  if (!b) return ''
  const m = b.match(/^(\d+)\s*박?$/)
  return m ? m[1] : b
}

/** 옛 데이터(스텝 1~2개 고정)와 인식 결과를 현재 구조로 맞춤 */
export function normalizeLine(raw: unknown): Line {
  const l = (raw ?? {}) as Partial<Line>
  const kind: LineKind = (['steps', 'section', 'repeat', 'rest', 'text'] as LineKind[]).includes(l.kind as LineKind) ? (l.kind as LineKind) : 'steps'
  const steps: Step[] = kind === 'steps'
    ? (Array.isArray(l.steps) ? l.steps : [])
        .map((s) => ({ name: String(s?.name ?? '').trim(), beats: fmtBeats(String(s?.beats ?? '')), ...(s?.raw && s.raw !== s.name ? { raw: String(s.raw) } : {}), ...(s?.uncertain ? { uncertain: true } : {}) }))
        .filter((s) => s.name)
    : []
  const notes = (Array.isArray(l.notes) ? l.notes : []).map((n) => ({ text: String(n?.text ?? '').trim(), ...(n?.type ? { type: n.type } : {}) })).filter((n) => n.text)
  const out: Line = { steps, kind }
  if (kind !== 'steps') out.label = String(l.label ?? '').trim()
  if (notes.length) out.notes = notes
  return out
}
export const normalizeLines = (ls: unknown): Line[] => (Array.isArray(ls) ? ls : []).map(normalizeLine)

/** 스텝 줄 → 한 줄 글 ("런닝맨 4 / 티스텝 4") */
export function lineToText(l: Line): string {
  return l.steps.map((s) => `${s.beats ? `${s.name} ${fmtBeats(s.beats)}` : s.name}${s.again ? ` ↻${s.again}` : ''}${s.bar ? ' |' : ''}`).join(' / ')
}
/** 한 줄 글 → 스텝들. " / "로 나누고 맨 뒤 숫자를 박수로. " | "는 8박 도장(앞 스텝에서 한 구절 끝) */
export function parseLineText(text: string): Step[] {
  const out: Step[] = []
  const parts = text.split(/(\s+\/\s*|\s*\/\s+|\s*\|\s*)/)
  for (let i = 0; i < parts.length; i += 2) {
    const t = parts[i].trim()
    const sep = parts[i + 1] ?? ''
    if (t) {
      // "↻8" 또는 "(8박 반복)" 꼬리표 → 반복 도장
      let again = 0
      const body = t
        .replace(/\s*(?:↻|\(\s*)(\d+)\s*박?\s*(?:반복)?\s*\)?\s*$/, (_, n) => {
          again = Number(n)
          return ''
        })
        .trim()
      const m = body.match(/^(.*?)[\s(]*(\d+)\s*박?\)?$/)
      const st: Step = m && m[1].trim() ? { name: m[1].trim(), beats: m[2] } : { name: body || t, beats: '' }
      if (again > 0) st.again = again
      out.push(st)
    }
    if (sep.includes('|') && out.length) out[out.length - 1].bar = true
  }
  return out
}
/** 반복 도장으로 더 추는 박수 합 (↻8 + ↻16 = 24) */
export const againBeats = (steps: Step[]) => steps.reduce((n, s) => n + (s.again && s.again > 0 ? s.again : 0), 0)
/** 8박 도장으로 센 줄 박수: 도장 수 × 8, 마지막 도장 뒤에 스텝이 더 있으면 +8. 도장이 없으면 0 */
export function barBeats(steps: Step[]): number {
  const named = steps.filter((s) => s.name.trim())
  const bars = named.filter((s) => s.bar).length
  if (!bars) return 0
  const last = named.map((s) => Boolean(s.bar)).lastIndexOf(true)
  return bars * 8 + (last < named.length - 1 ? 8 : 0)
}

export function sheetStats(lines: Line[]) {
  const stepLines = lines.filter(isStepLine)
  const steps = stepLines.flatMap((l) => l.steps.filter((s) => s.name.trim()))
  return { lines: stepLines.length, steps: steps.length, beats: steps.reduce((n, s) => n + beatsOf(s.beats), 0) }
}

export function stepNames(lines: Line[]): string[] {
  return lines.flatMap((l) => [...l.steps.map((s) => s.name), l.label ?? '', ...(l.notes ?? []).map((n) => n.text)]).filter(Boolean)
}

// ── 노래 동기화 저장 모양 ──
export type Marks = (number | null)[]
/** 줄 시작 사건: t초에 line번째(lines 인덱스) 줄이 시작. 같은 줄이 여러 번 나와도 됨(반복·순서 바뀜) */
export type SyncEvent = { t: number; line: number }
export type SyncTrack = Marks | SyncEvent[]
export type SyncSource = 'file' | 'yt'
/** 춤추는 계획 한 항목 (sync.ts의 PlanItem과 같은 모양) */
export type SyncPlanItem = { line: number; beats?: number; at?: number } | { rest: number }
type SyncObj = { file?: SyncTrack | null; yt?: SyncTrack | null; bpm?: number | null; plan?: Partial<Record<SyncSource, SyncPlanItem[] | null>> | null }
export type SyncData = Marks | SyncObj | null

const isEvents = (v: SyncTrack | null | undefined): v is SyncEvent[] => Array.isArray(v) && v.length > 0 && typeof v[0] === 'object' && v[0] !== null
/** 어떤 저장 모양이든 사건 목록(시간순)으로 */
export function toEvents(v: SyncTrack | null | undefined): SyncEvent[] {
  if (!v) return []
  if (isEvents(v)) return [...v].sort((a, b) => a.t - b.t)
  const out: SyncEvent[] = []
  ;(v as Marks).forEach((t, line) => {
    if (typeof t === 'number') out.push({ t, line })
  })
  return out.sort((a, b) => a.t - b.t)
}
/** 음원용/유튜브용 사건 꺼내기 (옛 배열 데이터는 음원용으로 봄) */
export function eventsOf(sync: SyncData | undefined, src: SyncSource): SyncEvent[] {
  if (!sync) return []
  if (Array.isArray(sync)) return src === 'file' ? toEvents(sync as Marks) : []
  return toEvents(sync[src])
}
/** 한쪽만 바꿔 넣은 새 값 (둘 다 비면 null) */
export function withSync(sync: SyncData | undefined, src: SyncSource, events: SyncEvent[] | null, bpm?: number, plan?: SyncPlanItem[]): SyncData {
  const base: SyncObj = !sync ? {} : Array.isArray(sync) ? { file: sync as Marks } : { ...sync }
  base[src] = events && events.length ? events : null
  if (typeof bpm === 'number' && bpm > 0) base.bpm = Math.round(bpm * 10) / 10
  base.plan = { ...(base.plan ?? {}), [src]: events && events.length && plan?.length ? plan : null }
  if (!toEvents(base.file).length && !toEvents(base.yt).length) return null
  return base
}
/** 표에 보여 줄 줄별 첫 시각 */
export function marksFromEvents(events: SyncEvent[], nLines: number): Marks {
  const m: Marks = Array.from({ length: nLines }, () => null)
  for (const e of events) if (m[e.line] === null) m[e.line] = e.t
  return m
}
/** 지금 시각에 재생 중인 줄 */
export function activeLine(events: SyncEvent[], t: number): number | undefined {
  let best: number | undefined
  for (const e of events) if (e.t <= t + 0.05) best = e.line
  return best
}
/** 저장해 둔 BPM (있으면) */
export function savedBpm(sync: SyncData | undefined): number | null {
  if (!sync || Array.isArray(sync)) return null
  return typeof sync.bpm === 'number' && sync.bpm > 0 ? sync.bpm : null
}
/** 저장해 둔 춤추는 계획 (있으면). 쉼·길이·고정 시각이 그대로 복원됨 */
export function savedPlan(sync: SyncData | undefined, src: SyncSource): SyncPlanItem[] | null {
  if (!sync || Array.isArray(sync)) return null
  const p = sync.plan?.[src]
  return Array.isArray(p) && p.length ? p : null
}
