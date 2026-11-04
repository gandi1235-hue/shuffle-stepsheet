import { againBeats, barBeats, beatsOf, kindOf, type Stepsheet, type SyncEvent, type SyncPlanItem } from './types'

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
  const steps = sheet.lines[i].steps
  const extra = againBeats(steps) // 반복 도장만큼 이 줄이 더 길어짐
  const b = steps.reduce((n, st) => n + beatsOf(st.beats), 0)
  if (b > 0) return b + extra
  const bars = barBeats(steps)
  return (bars > 0 ? bars : 8) + extra
}
/** 박수가 적혀 있지도, 8박 도장이 찍혀 있지도 않아 8박으로 추정하는 줄인지 */
export function beatsGuessed(sheet: Lines, i: number) {
  const st = sheet.lines[i].steps
  return !st.some((s) => beatsOf(s.beats) > 0) && barBeats(st) === 0
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
/** 줄 글에서 박수: "8박 반복" → 8, "16박" → 16, 없으면 0 */
const labelBeats = (label?: string) => {
  const m = (label ?? '').match(/(\d+)\s*박/)
  return m ? Number(m[1]) : 0
}
/**
 * 스텝지에 적힌 대로의 기본 계획: 스텝 줄은 순서대로, "N박 반복" 줄은 바로 앞 N박만큼의 스텝 줄을 한 번 더,
 * "처음부터" 반복은 이 구간 처음부터 한 번 더, "N박 쉬기" 줄은 N박 쉼
 */
export function defaultPlan(sheet: Lines): PlanItem[] {
  const out: PlanItem[] = []
  let sectionStart = 0 // 이 구간이 시작된 out 위치
  sheet.lines.forEach((l, i) => {
    const kind = kindOf(l)
    if (kind === 'steps') {
      if (l.steps.some((st) => st.name.trim())) out.push({ line: i })
      return
    }
    if (kind === 'section') {
      sectionStart = out.length
      return
    }
    if (kind === 'rest') {
      const b = labelBeats(l.label)
      if (b > 0) out.push({ rest: b })
      return
    }
    if (kind === 'repeat') {
      const b = labelBeats(l.label)
      if (b > 0) {
        // 뒤에서부터 N박이 찰 때까지 되감아 그 줄들을 한 번 더
        let need = b
        let k = out.length - 1
        const again: PlanItem[] = []
        while (k >= 0 && need > 0) {
          const p = out[k]
          again.unshift(p)
          need -= isRest(p) ? p.rest : p.beats && p.beats > 0 ? p.beats : lineBeats(sheet, p.line)
          k--
        }
        out.push(...again.map((p) => (isRest(p) ? { rest: p.rest } : { line: p.line })))
      } else if (/처음|전체|다시|한\s*번\s*더/.test(l.label ?? '')) {
        out.push(...out.slice(sectionStart).map((p) => (isRest(p) ? { rest: p.rest } : { line: p.line })))
      }
    }
  })
  return out
}
/** 두 계획이 같은지 (줄·쉼·길이·고정 시각까지) */
export function samePlan(a: PlanItem[], b: PlanItem[]) {
  return a.length === b.length && a.every((p, k) => JSON.stringify(p) === JSON.stringify(b[k]))
}
/** 유튜브 기본값: 영상 시작(0초)과 동시에 1번 줄, 스텝지에 적힌 대로(반복·쉬기 포함) */
export function defaultEvents(sheet: Lines, rate: number): SyncEvent[] {
  return fillEvents(sheet, defaultPlan(sheet), 0, rate)
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
    const kind = kindOf(l)
    if (kind === 'section') section = l.label ?? ''
    if (kind === 'repeat') out.push(`   ↻ 반복 줄: "${l.label ?? ''}"${labelBeats(l.label) ? ` (바로 앞 ${labelBeats(l.label)}박을 한 번 더)` : ''}`)
    if (kind === 'rest' && labelBeats(l.label)) out.push(`   (쉼: ${labelBeats(l.label)}박)`)
    const k = idx.indexOf(i)
    if (k >= 0) out.push(`${k + 1}. ${section ? `[${section}] ` : ''}${l.steps.map((s) => `${s.name}${s.beats ? ' ' + s.beats : ''}${s.again ? ` ↻${s.again}박반복` : ''}${s.bar ? ' |' : ''}`).join(' / ')} (${lineBeats(sheet, i)}박${beatsGuessed(sheet, i) ? ', 안 적혀 있어 8박으로 추정' : barBeats(l.steps) > 0 && !l.steps.some((s) => beatsOf(s.beats) > 0) ? ', |는 8박 경계' : ''}${againBeats(l.steps) ? `, ↻는 앞 구절 반복으로 ${againBeats(l.steps)}박 포함` : ''})`)
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
  opts: { sure?: boolean; phase?: number | null } = {},
): { plan: PlanItem[]; events: SyncEvent[]; rate: number; snapped: boolean } | null {
  const idx = stepIdxOf(sheet)
  const plan = reply.plan
    .map((p): PlanItem | null => (isRest(p) ? p : idx[p.line - 1] === undefined ? null : { ...p, line: idx[p.line - 1] }))
    .filter((p): p is PlanItem => p !== null)
  if (!planLines(plan).length) return null
  const aiRate = reply.bpm && reply.bpm >= 60 && reply.bpm <= 200 ? reply.bpm : null
  // 박자: 믿을 만한 값(음원 분석·직접 찍음·손으로 고침)이 있으면 그것, 없으면 AI가 찾은 줄별 시각들로 정밀하게 재고, 그것도 안 되면 AI 짐작값
  const fit = fitBpm(sheet, plan)
  const sure = opts.sure === true && bpm >= 60 && bpm <= 200
  const rate = sure ? bpm : fit ? fit.bpm : (aiRate ?? bpm)
  const snapped = sure || !!fit
  const first = plan.find((p): p is { line: number; at?: number } => !isRest(p) && typeof p.at === 'number')
  let start = reply.startAt !== null && reply.startAt >= 0 ? reply.startAt : (first?.at ?? t0)
  // 음원 분석으로 박 위치(phase)까지 알면 시작도 실제 박 위에 올림
  if (sure && typeof opts.phase === 'number') {
    const P = 60 / rate
    const near = opts.phase + Math.round((start - opts.phase) / P) * P
    if (Math.abs(near - start) <= 0.25) start = r1(near)
  }
  const plan2 = snapped ? snapPlan(sheet, plan, start, rate) : plan
  return { plan: plan2, events: fillEvents(sheet, plan2, start, rate), rate, snapped }
}
/**
 * AI가 찾은 줄별 시작 시각(at)들로 박자를 정밀하게 재기: 누적 박수 대 시각의 직선 기울기(최소제곱).
 * 크게 벗어난 점(반복·쉼을 AI가 다르게 본 줄)은 한 번 빼고 다시 잰다. 점이 4개 미만이거나 들쭉날쭉하면 null
 */
export function fitBpm(sheet: Lines, plan: PlanItem[]): { bpm: number; err: number } | null {
  const pts: [number, number][] = [] // [누적 박, 시각]
  let cum = 0
  for (const p of plan) {
    if (isRest(p)) {
      cum += p.rest
      continue
    }
    if (typeof p.at === 'number' && p.at >= 0) pts.push([cum, p.at])
    cum += p.beats && p.beats > 0 ? p.beats : lineBeats(sheet, p.line)
  }
  const fit = (ps: [number, number][]) => {
    const n = ps.length
    const mx = ps.reduce((s, [x]) => s + x, 0) / n
    const my = ps.reduce((s, [, y]) => s + y, 0) / n
    let sxx = 0
    let sxy = 0
    for (const [x, y] of ps) {
      sxx += (x - mx) ** 2
      sxy += (x - mx) * (y - my)
    }
    if (sxx <= 0) return null
    const slope = sxy / sxx // 한 박의 초
    const b = my - slope * mx
    const res = ps.map(([x, y]) => Math.abs(y - (b + slope * x)))
    const err = [...res].sort((a, c) => a - c)[Math.floor(res.length / 2)]
    return { slope, res, err }
  }
  let ps = pts
  if (ps.length < 4 || ps[ps.length - 1][0] - ps[0][0] < 16) return null
  let f = fit(ps)
  if (!f) return null
  const keep = ps.filter((_, i) => f!.res[i] <= Math.max(1.0, f!.err * 3))
  if (keep.length >= 4 && keep.length < ps.length) {
    ps = keep
    f = fit(ps) ?? f
  }
  if (f.slope <= 0 || f.err > 0.35) return null
  const bpm = 60 / f.slope
  if (bpm < 60 || bpm > 200) return null
  return { bpm: Math.round(bpm * 10) / 10, err: Math.round(f.err * 100) / 100 }
}
/**
 * AI가 찾은 줄별 시각을 박자 격자에 맞춰 다듬기. 격자(시작 + 누적 박 × 한 박)에서 한 박 이내면 격자 시각으로,
 * 더 멀면(AI가 반복·쉼·멈춤을 본 곳) 가장 가까운 박으로 옮기고 거기서부터 다시 격자로 이어 감
 */
export function snapPlan(sheet: Lines, plan: PlanItem[], start: number, rate: number): PlanItem[] {
  const beat = 60 / rate
  let cur = start
  return plan.map((p): PlanItem => {
    if (isRest(p)) {
      cur += p.rest * beat
      return p
    }
    const beats = p.beats && p.beats > 0 ? p.beats : lineBeats(sheet, p.line)
    if (typeof p.at === 'number' && p.at >= 0) {
      if (Math.abs(p.at - cur) > beat) cur = start + Math.round((p.at - start) / beat) * beat
      const out = { ...p, at: Math.round(cur * 100) / 100 }
      cur += beats * beat
      return out
    }
    cur += beats * beat
    return p
  })
}
