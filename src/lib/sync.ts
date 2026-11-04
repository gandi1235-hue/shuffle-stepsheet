import { beatsOf, kindOf, type Stepsheet, type SyncEvent } from './types'

export const DEFAULT_BPM = 128
const r1 = (x: number) => Math.round(x * 10) / 10
type Lines = Pick<Stepsheet, 'lines'>

/**
 * 춤추는 계획 한 항목.
 * - { line }            그 줄(lines 인덱스)을 춤. beats를 주면 평소와 다른 박수만큼(길게/짧게), at을 주면 그 시각(초)에 시작
 * - { rest }            그만큼 박을 쉼(동작 없음·전환·기다림)
 */
export type PlanItem = { line: number; beats?: number; at?: number } | { rest: number }
export const isRest = (p: PlanItem): p is { rest: number } => 'rest' in p
export const planLines = (plan: PlanItem[]) => plan.filter((p) => !isRest(p)).map((p) => (p as { line: number }).line)
export const linesToPlan = (lines: number[]): PlanItem[] => lines.map((line) => ({ line }))

/** 스텝 줄들의 lines 인덱스 (스텝지에 적힌 순서) */
export function stepIdxOf(sheet: Lines) {
  return sheet.lines.map((l, i) => (kindOf(l) === 'steps' && l.steps.some((st) => st.name.trim()) ? i : -1)).filter((i) => i >= 0)
}
/** 한 줄의 박수. 안 적혀 있으면 8박 */
export function lineBeats(sheet: Lines, i: number) {
  const b = sheet.lines[i].steps.reduce((n, st) => n + beatsOf(st.beats), 0)
  return b > 0 ? b : 8
}
/** 계획대로 t0부터 박자로 시각을 채움 (쉼은 시간만 흐름, at이 있는 줄은 그 시각으로 맞춤) */
export function fillEvents(sheet: Lines, plan: PlanItem[], t0: number, rate: number): SyncEvent[] {
  const out: SyncEvent[] = []
  const sec = (beats: number) => (beats * 60) / rate
  let cur = t0
  for (const p of plan) {
    if (isRest(p)) {
      cur += sec(p.rest)
      continue
    }
    if (typeof p.at === 'number' && p.at >= 0) cur = p.at
    out.push({ t: r1(cur), line: p.line })
    cur += sec(p.beats && p.beats > 0 ? p.beats : lineBeats(sheet, p.line))
  }
  return out.sort((a, b) => a.t - b.t)
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
  return fillEvents(sheet, linesToPlan(stepIdxOf(sheet)), 0, rate)
}
/** 사건 목록의 줄 순서 (저장된 동기화에서 순서 복원) */
export function orderOf(events: SyncEvent[]): number[] {
  return events.map((e) => e.line)
}
/**
 * 저장된 사건 목록 → 계획. 줄 사이가 그 줄 박수보다 한 박 넘게 길면 그만큼 쉼으로, 짧으면 그 줄을 짧게(beats) 본다.
 * 그래야 박자를 −/+로 바꿔 다시 채워도 쉬는 구간이 사라지지 않는다.
 */
export function planOf(sheet: Lines, events: SyncEvent[], rate: number): PlanItem[] {
  const beat = 60 / rate
  const out: PlanItem[] = []
  events.forEach((e, k) => {
    const next = events[k + 1]
    const item: PlanItem = { line: e.line }
    if (next) {
      const got = Math.round((next.t - e.t) / beat)
      const want = lineBeats(sheet, e.line)
      if (got > want + 1) {
        out.push(item)
        out.push({ rest: got - want })
        return
      }
      if (got >= 1 && got < want - 1) item.beats = got
    }
    out.push(item)
  })
  return out
}
/** 계획을 사람이 읽는 글로: "1 → 2 → (4박 쉼) → 3" (번호는 스텝지에 적힌 순서) */
export function planText(sheet: Lines, plan: PlanItem[]): string {
  const idx = stepIdxOf(sheet)
  return plan
    .map((p) => (isRest(p) ? `(${p.rest}박 쉼)` : `${idx.indexOf(p.line) + 1}${p.beats ? `(${p.beats}박)` : ''}`))
    .join(' → ')
}
/** 줄 목록을 AI에게 보여 줄 글로: "3. [후렴] 런닝맨 4 / 티스텝 4 (8박)" */
export function orderPromptLines(sheet: Lines): string[] {
  const idx = stepIdxOf(sheet)
  let section = ''
  const out: string[] = []
  sheet.lines.forEach((l, i) => {
    if (kindOf(l) === 'section') section = l.label ?? ''
    const k = idx.indexOf(i)
    if (k >= 0) out.push(`${k + 1}. ${section ? `[${section}] ` : ''}${l.steps.map((s) => `${s.name}${s.beats ? ' ' + s.beats : ''}`).join(' / ')} (${lineBeats(sheet, i)}박)`)
  })
  return out
}
