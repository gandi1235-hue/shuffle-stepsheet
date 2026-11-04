import { beatsOf, kindOf, type Stepsheet, type SyncEvent } from './types'

export const DEFAULT_BPM = 128
const r1 = (x: number) => Math.round(x * 10) / 10
type Lines = Pick<Stepsheet, 'lines'>

/** 스텝 줄들의 lines 인덱스 (스텝지에 적힌 순서) */
export function stepIdxOf(sheet: Lines) {
  return sheet.lines.map((l, i) => (kindOf(l) === 'steps' && l.steps.some((st) => st.name.trim()) ? i : -1)).filter((i) => i >= 0)
}
/** 한 줄의 박수. 안 적혀 있으면 8박 */
export function lineBeats(sheet: Lines, i: number) {
  const b = sheet.lines[i].steps.reduce((n, st) => n + beatsOf(st.beats), 0)
  return b > 0 ? b : 8
}
/** order(춤추는 순서의 lines 인덱스)대로 t0부터 박자로 시각을 채움 */
export function fillEvents(sheet: Lines, order: number[], t0: number, rate: number): SyncEvent[] {
  const out: SyncEvent[] = []
  let cur = t0
  for (const line of order) {
    out.push({ t: r1(cur), line })
    cur += (lineBeats(sheet, line) * 60) / rate
  }
  return out
}
/** 사건 목록에서 박자 짐작 (첫 두 사건 간격). 못 구하면 기본값 */
export function bpmFromEvents(sheet: Lines, events: SyncEvent[]): number {
  if (events.length < 2) return DEFAULT_BPM
  const [a, b] = events
  if (b.t <= a.t + 0.3) return DEFAULT_BPM
  return Math.max(60, Math.min(200, Math.round(((lineBeats(sheet, a.line) * 60) / (b.t - a.t)) * 10) / 10))
}
/** 유튜브 기본값: 영상 시작(0초)과 동시에 1번 줄, 스텝지 순서대로 */
export function defaultEvents(sheet: Lines, rate: number): SyncEvent[] {
  return fillEvents(sheet, stepIdxOf(sheet), 0, rate)
}
/** 사건 목록의 줄 순서 (저장된 동기화에서 순서 복원) */
export function orderOf(events: SyncEvent[]): number[] {
  return events.map((e) => e.line)
}
/** 줄 목록을 AI에게 보여 줄 글로: "3. [후렴] 런닝맨 4 / 티스텝 4" */
export function orderPromptLines(sheet: Lines): string[] {
  const idx = stepIdxOf(sheet)
  let section = ''
  const out: string[] = []
  sheet.lines.forEach((l, i) => {
    if (kindOf(l) === 'section') section = l.label ?? ''
    const k = idx.indexOf(i)
    if (k >= 0) out.push(`${k + 1}. ${section ? `[${section}] ` : ''}${l.steps.map((s) => `${s.name}${s.beats ? ' ' + s.beats : ''}`).join(' / ')}`)
  })
  return out
}
