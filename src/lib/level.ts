/**
 * 캐릭터 레벨. 다음 레벨에 필요한 스텝지가 1, 2, 3, 4…장씩 늘어나서(등차), 누적으로는
 * Lv.2 = 1장, Lv.3 = 3장, Lv.4 = 6장, Lv.5 = 10장, Lv.6 = 15장, Lv.7 = 21장, Lv.8 = 28장 …
 */
export const needFor = (lv: number) => ((lv - 1) * lv) / 2
export function levelOf(sheets: number): number {
  const n = Math.max(0, Math.floor(sheets))
  let lv = 1
  while (needFor(lv + 1) <= n) lv++
  return lv
}
/** 지금 레벨 안에서의 진행: 다음 레벨까지 남은 장수와 0~1 비율 */
export function progressOf(sheets: number): { lv: number; left: number; ratio: number } {
  const n = Math.max(0, Math.floor(sheets))
  const lv = levelOf(n)
  const base = needFor(lv)
  const span = needFor(lv + 1) - base
  return { lv, left: needFor(lv + 1) - n, ratio: Math.min(1, (n - base) / span) }
}
const KEY = (uid: string) => `lv-${uid}`
/** 이 기기에서 마지막으로 본 내 레벨 (없으면 null) */
export function seenLevel(uid: string): number | null {
  const v = Number(localStorage.getItem(KEY(uid)))
  return v >= 1 ? v : null
}
export function rememberLevel(uid: string, lv: number) {
  localStorage.setItem(KEY(uid), String(lv))
}
/** 등급 기준: 신입회원 Lv.1, 정회원 Lv.2~4, 2급강사 Lv.5~9, 1급강사 Lv.10~19, 셔플킹/퀸 Lv.20~ */
export const TITLES: { lv: number; title: string }[] = [
  { lv: 1, title: '신입회원' },
  { lv: 2, title: '정회원' },
  { lv: 5, title: '2급강사' },
  { lv: 10, title: '1급강사' },
  { lv: 20, title: '셔플킹/퀸' },
]
/** 등급 번호 0~4 (TITLES 순서) */
export function tierOf(lv: number): number {
  let t = 0
  TITLES.forEach((x, i) => {
    if (lv >= x.lv) t = i
  })
  return t
}
/** 캐릭터 그림 번호 0~3: 신입·정회원은 기본 그림, 2급강사·1급강사·셔플킹/퀸은 승급할 때마다 더 화려한 그림 */
export const imageTier = (lv: number) => Math.max(0, tierOf(lv) - 1)
export const TIER_IMAGE_NAMES = ['기본', '2급강사', '1급강사', '셔플킹/퀸']
export function titleOf(lv: number): string {
  let t = ''
  for (const x of TITLES) if (lv >= x.lv) t = x.title
  return t
}
/** 다음 칭호와 거기까지 남은 스텝지 수 */
export function nextTitle(sheets: number): { title: string; left: number } | null {
  const lv = levelOf(sheets)
  const n = TITLES.find((x) => lv < x.lv)
  return n ? { title: n.title, left: needFor(n.lv) - Math.max(0, Math.floor(sheets)) } : null
}
/** 레벨 표시 글: "Lv.5 · 2급강사" */
export const levelLabel = (lv: number) => (titleOf(lv) ? `Lv.${lv} · ${titleOf(lv)}` : `Lv.${lv}`)
