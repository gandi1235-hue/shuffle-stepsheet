import { beatsOf, kindOf, type Marks, type Stepsheet } from './types'

export const DEFAULT_BPM = 128
const r1 = (x: number) => Math.round(x * 10) / 10

/** 스텝 줄들의 lines 인덱스 */
export function stepIdxOf(sheet: Pick<Stepsheet, 'lines'>) {
  return sheet.lines.map((l, i) => (kindOf(l) === 'steps' && l.steps.some((st) => st.name.trim()) ? i : -1)).filter((i) => i >= 0)
}
/** 한 줄의 박수. 안 적혀 있으면 8박 */
export function lineBeats(sheet: Pick<Stepsheet, 'lines'>, i: number) {
  const b = sheet.lines[i].steps.reduce((n, st) => n + beatsOf(st.beats), 0)
  return b > 0 ? b : 8
}
/** from번째 스텝 줄이 t0에 시작한다고 보고, 그 뒤 줄들을 박자로 채움 (앞 줄들은 그대로) */
export function fill(sheet: Pick<Stepsheet, 'lines'>, base: Marks, from: number, t0: number, rate: number): Marks {
  const idx = stepIdxOf(sheet)
  const m = [...base]
  let cur = t0
  for (let k = from; k < idx.length; k++) {
    m[idx[k]] = r1(cur)
    cur += (lineBeats(sheet, idx[k]) * 60) / rate
  }
  return m
}
/** 저장된 시각에서 박자 짐작 (첫 두 스텝 줄 간격). 못 구하면 기본값 */
export function bpmFromMarks(sheet: Pick<Stepsheet, 'lines'>, marks: Marks): number {
  const idx = stepIdxOf(sheet)
  if (idx.length < 2) return DEFAULT_BPM
  const a = marks[idx[0]]
  const b = marks[idx[1]]
  if (typeof a !== 'number' || typeof b !== 'number' || b <= a + 0.3) return DEFAULT_BPM
  return Math.max(60, Math.min(200, Math.round(((lineBeats(sheet, idx[0]) * 60) / (b - a)) * 10) / 10))
}
/** 유튜브 기본값: 영상 시작(0초)과 동시에 1번 줄 */
export function defaultMarks(sheet: Pick<Stepsheet, 'lines'>, rate: number): Marks {
  return fill(sheet, sheet.lines.map(() => null), 0, 0, rate)
}
