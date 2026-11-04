/** 처음 사용 안내(카드뉴스·화면 둘러보기)를 봤는지 기억 */
export const ONBOARD_KEY = 'onboarded'
export type TourName = 'start' | 'sheet' | 'sync'
const key = (n: TourName) => `tour-${n}`
export const tourDone = (n: TourName) => localStorage.getItem(key(n)) === '1'
export const markTour = (n: TourName) => localStorage.setItem(key(n), '1')
/** 설정에서 "안내 다시 보기": 카드뉴스와 모든 둘러보기를 처음 상태로 */
export function resetGuides() {
  localStorage.removeItem(ONBOARD_KEY)
  for (const n of ['start', 'sheet', 'sync'] as TourName[]) localStorage.removeItem(key(n))
}
