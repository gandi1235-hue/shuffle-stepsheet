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
}

/** 줄 종류: steps 일반 / section 구간 제목 / repeat 반복 지시 / rest 쉼·전환 / text 그 밖의 글 */
export type LineKind = 'steps' | 'section' | 'repeat' | 'rest' | 'text'
export const LINE_KINDS: { v: LineKind; label: string; hint: string }[] = [
  { v: 'steps', label: '스텝', hint: '예) 런닝맨 4 / 티스텝 4' },
  { v: 'section', label: '구간', hint: '예) 후렴, A파트, 전주' },
  { v: 'repeat', label: '반복', hint: '예) 처음부터 한 번 더 반복' },
  { v: 'rest', label: '쉬기', hint: '예) 4박 쉬기, 턴 후 정리' },
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
  return l.steps.map((s) => (s.beats ? `${s.name} ${fmtBeats(s.beats)}` : s.name)).join(' / ')
}
/** 한 줄 글 → 스텝들. " / "로 나누고 맨 뒤 숫자를 박수로 */
export function parseLineText(text: string): Step[] {
  return text
    .split(/\s+\/\s*|\s*\/\s+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => {
      const m = t.match(/^(.*?)[\s(]*(\d+)\s*박?\)?$/)
      if (m && m[1].trim()) return { name: m[1].trim(), beats: m[2] }
      return { name: t, beats: '' }
    })
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
export type SyncSource = 'file' | 'yt'
export type SyncData = Marks | { file?: Marks | null; yt?: Marks | null } | null
export const hasMarks = (m: Marks | null | undefined) => Boolean(m?.some((v) => typeof v === 'number'))
/** 음원용/유튜브용 줄별 시각 꺼내기 (옛 배열 데이터는 음원용으로 봄) */
export function syncOf(sync: SyncData | undefined, src: SyncSource): Marks {
  if (!sync) return []
  if (Array.isArray(sync)) return src === 'file' ? sync : []
  return sync[src] ?? []
}
/** 한쪽만 바꿔 넣은 새 값 (둘 다 비면 null) */
export function withSync(sync: SyncData | undefined, src: SyncSource, marks: Marks | null): SyncData {
  const base: { file?: Marks | null; yt?: Marks | null } = !sync ? {} : Array.isArray(sync) ? { file: sync } : { ...sync }
  base[src] = marks
  if (!hasMarks(base.file) && !hasMarks(base.yt)) return null
  return base
}
