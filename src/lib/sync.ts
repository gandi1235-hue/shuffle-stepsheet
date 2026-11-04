import { beatsOf, kindOf, type Stepsheet, type SyncEvent, type SyncPlanItem } from './types'

export const DEFAULT_BPM = 128
const r1 = (x: number) => Math.round(x * 10) / 10
type Lines = Pick<Stepsheet, 'lines'>

/**
 * 춤추는 계획 한 항목.
 * - { line }            그 줄(lines 인덱스)을 춤. beats를 주면 평소와 다른 박수만큼(길게/짧게), at을 주면 그 시각(초)에 시작
 * - { rest }            그만큼 박을 쉼(동작 없음·전환·기다림)
 */
export type PlanItem = SyncPlanItem
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
/** 셔플 곡 범위(90~180)로 접기: 너무 느리면 두 배, 너무 빠르면 절반 (16박을 8박으로 적는 등 두 배 오차 보정) */
export function foldBpm(v: number): number {
  let x = v
  while (x > 0 && x < 90) x *= 2
  while (x > 180) x /= 2
  return Math.max(60, Math.min(200, Math.round(x * 10) / 10))
}
/** 사건 목록에서 박자 짐작: 줄 간격마다 (박수×60/간격)을 구해 중간값. 한 줄만 눌러 틀린 경우에 휘둘리지 않음 */
export function bpmFromEvents(sheet: Lines, events: SyncEvent[]): number {
  const rates: number[] = []
  for (let k = 0; k + 1 < events.length; k++) {
    const a = events[k]
    const b = events[k + 1]
    if (b.t <= a.t + 0.3) continue
    rates.push(foldBpm((lineBeats(sheet, a.line) * 60) / (b.t - a.t)))
  }
  if (!rates.length) return DEFAULT_BPM
  rates.sort((x, y) => x - y)
  return rates[Math.floor(rates.length / 2)]
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
 * (계획을 저장하지 않은 옛 데이터용) 사건 목록 → 계획. 줄 사이가 그 줄 박수보다 한 박 넘게 길면 그만큼 쉼으로,
 * 짧으면 다음 줄을 그 시각에 고정(at)한다. 줄의 박수(찰스턴 4 = 4박)는 절대 바꾸지 않는다.
 */
export function planOf(sheet: Lines, events: SyncEvent[], rate: number): PlanItem[] {
  const beat = 60 / rate
  const out: PlanItem[] = []
  let pinNext = false
  events.forEach((e, k) => {
    const next = events[k + 1]
    const item: PlanItem = pinNext ? { line: e.line, at: e.t } : { line: e.line }
    pinNext = false
    out.push(item)
    if (!next) return
    const got = Math.round((next.t - e.t) / beat)
    const want = lineBeats(sheet, e.line)
    if (got > want + 1) out.push({ rest: got - want })
    else if (got < want - 1) pinNext = true
  })
  return out
}
/** 계획에서 손으로 고정한 시각(at)만 걷어냄 (처음부터 다시 맞출 때) */
export function unpinned(plan: PlanItem[]): PlanItem[] {
  return plan.map((p) => (isRest(p) || p.at === undefined ? p : { line: p.line, ...(p.beats ? { beats: p.beats } : {}) }))
}
/**
 * k번째 사건(시간순)이 계획의 몇 번째 항목인지. 같은 줄이 여러 번 나오면 같은 줄 중 몇 번째인지로 짝을 맞춤
 */
export function planIndexOfEvent(plan: PlanItem[], events: SyncEvent[], k: number): number {
  const line = events[k]?.line
  if (line === undefined) return -1
  const nth = events.slice(0, k).filter((e) => e.line === line).length
  let seen = 0
  for (let i = 0; i < plan.length; i++) {
    const p = plan[i]
    if (!isRest(p) && p.line === line) {
      if (seen === nth) return i
      seen++
    }
  }
  return -1
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
    if (k >= 0) out.push(`${k + 1}. ${section ? `[${section}] ` : ''}${l.steps.map((s) => `${s.name}${s.beats ? ' ' + s.beats : ''}`).join(' / ')} (${lineBeats(sheet, i)}박${l.steps.some((s) => beatsOf(s.beats) > 0) ? '' : ', 안 적혀 있어 8박으로 추정'})`)
  })
  return out
}
/**
 * AI 답(줄 번호는 1부터)을 lines 인덱스 계획으로 바꾸고 시각을 채움. 첫 줄 시각(at)이 없으면 t0부터.
 * 쓸 만한 줄이 없으면 null
 */
export function planFromReply(
  sheet: Lines,
  reply: { plan: PlanItem[]; bpm: number | null; startAt: number | null },
  bpm: number,
  t0: number,
): { plan: PlanItem[]; events: SyncEvent[]; rate: number } | null {
  const idx = stepIdxOf(sheet)
  const plan = reply.plan
    .map((p): PlanItem | null => (isRest(p) ? p : idx[p.line - 1] === undefined ? null : { ...p, line: idx[p.line - 1] }))
    .filter((p): p is PlanItem => p !== null)
  if (!planLines(plan).length) return null
  const rate = reply.bpm && reply.bpm >= 60 && reply.bpm <= 200 ? reply.bpm : bpm
  const first = plan.find((p): p is { line: number; at?: number } => !isRest(p) && typeof p.at === 'number')
  const start = reply.startAt !== null && reply.startAt >= 0 ? reply.startAt : (first?.at ?? t0)
  return { plan, events: fillEvents(sheet, plan, start, rate), rate }
}
