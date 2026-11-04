/** 캐릭터 레벨: 만든 스텝지 수 + 1 (0장 = 1렙, 1장 = 2렙, 2장 = 3렙 …) */
export const levelOf = (sheets: number) => Math.max(0, Math.floor(sheets)) + 1
const KEY = (uid: string) => `lv-${uid}`
/** 이 기기에서 마지막으로 본 내 레벨 (없으면 null) */
export function seenLevel(uid: string): number | null {
  const v = Number(localStorage.getItem(KEY(uid)))
  return v >= 1 ? v : null
}
export function rememberLevel(uid: string, lv: number) {
  localStorage.setItem(KEY(uid), String(lv))
}
/** 칭호 기준: 2급강사 Lv.8(스텝지 7장), 1급강사 Lv.16(스텝지 15장) */
export const TITLES: { lv: number; title: string }[] = [
  { lv: 8, title: '2급강사' },
  { lv: 16, title: '1급강사' },
]
export function titleOf(lv: number): string {
  let t = ''
  for (const x of TITLES) if (lv >= x.lv) t = x.title
  return t
}
/** 다음 칭호와 거기까지 남은 스텝지 수 */
export function nextTitle(lv: number): { title: string; left: number } | null {
  const n = TITLES.find((x) => lv < x.lv)
  return n ? { title: n.title, left: n.lv - lv } : null
}
/** 레벨 표시 글: "Lv.9 · 2급강사" */
export const levelLabel = (lv: number) => (titleOf(lv) ? `Lv.${lv} · ${titleOf(lv)}` : `Lv.${lv}`)
