/** 캐릭터 레벨: 만든 스텝지 수 + 1 (0장 = 1렙, 1장 = 2렙, 2장 = 3렙 …) */
export const levelOf = (sheets: number) => Math.max(0, Math.floor(sheets)) + 1
/** 다음 레벨까지 남은 스텝지 수 (항상 1장) */
export const toNext = () => 1
const KEY = (uid: string) => `lv-${uid}`
/** 이 기기에서 마지막으로 본 내 레벨 (없으면 null) */
export function seenLevel(uid: string): number | null {
  const v = Number(localStorage.getItem(KEY(uid)))
  return v >= 1 ? v : null
}
export function rememberLevel(uid: string, lv: number) {
  localStorage.setItem(KEY(uid), String(lv))
}
/** 칭호: 5렙부터 2급강사, 10렙부터 1급강사 */
export function titleOf(lv: number): string {
  if (lv >= 10) return '1급강사'
  if (lv >= 5) return '2급강사'
  return ''
}
/** 레벨 표시 글: "Lv.7 · 2급강사" */
export const levelLabel = (lv: number) => (titleOf(lv) ? `Lv.${lv} · ${titleOf(lv)}` : `Lv.${lv}`)
