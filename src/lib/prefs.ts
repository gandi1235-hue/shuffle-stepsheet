import { useEffect, useState } from 'react'

export type FontSize = 'normal' | 'large' | 'xlarge'
export type VideoLayout = 'top' | 'side'
/** 색 테마: rose = 로즈+크림(기본), netflix = 검정+빨강(원래 디자인) */
export type Theme = 'rose' | 'netflix'
export interface Prefs {
  font: FontSize
  contrast: boolean
  /** 영상과 스텝 배치: 위아래 / 좌우. 없으면 화면 너비에 따라 자동 */
  videoLayout?: VideoLayout
  /** AI 고급 추론: 켜면 가장 좋은 모델로 오래 생각(느리지만 똑똑). 기본은 빠른 모델 */
  deepAi?: boolean
  /** 색 테마. 없으면 rose */
  theme?: Theme
}
const KEY = 'prefs'
const DEFAULT: Prefs = { font: 'normal', contrast: false }

export function loadPrefs(): Prefs {
  try {
    return { ...DEFAULT, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }
  } catch {
    return DEFAULT
  }
}

const ZOOM: Record<FontSize, number> = { normal: 1, large: 1.12, xlarge: 1.25 }
let zoom = 1
let listening = false

/** CSS zoom을 쓰면 vh 단위가 틀어져서, 실제 화면 높이를 변수(--app-h)로 직접 넣어 준다 */
function setViewportVar() {
  document.documentElement.style.setProperty('--app-h', `${Math.round(window.innerHeight / zoom)}px`)
}

export function applyPrefs(p: Prefs) {
  const el = document.documentElement
  el.dataset.font = p.font
  el.dataset.contrast = p.contrast ? 'high' : 'normal'
  el.dataset.theme = p.theme ?? 'rose'
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', p.theme === 'netflix' ? '#0a0a0b' : '#d9376e')
  zoom = ZOOM[p.font]
  setViewportVar()
  if (!listening) {
    listening = true
    window.addEventListener('resize', setViewportVar)
    window.visualViewport?.addEventListener('resize', setViewportVar)
  }
}

export function usePrefs(): [Prefs, (patch: Partial<Prefs>) => void] {
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs)
  useEffect(() => applyPrefs(prefs), [prefs])
  const update = (patch: Partial<Prefs>) => {
    const next = { ...prefs, ...patch }
    localStorage.setItem(KEY, JSON.stringify(next))
    setPrefs(next)
  }
  return [prefs, update]
}

/** 짧은 진동 피드백 (지원 기기에서만) */
export function haptic(ms: number | number[] = 12) {
  try {
    navigator.vibrate?.(ms)
  } catch {
    /* 무시 */
  }
}

/** 미디어 쿼리 값(바뀌면 다시 그림) */
export function useMedia(q: string): boolean {
  const [m, setM] = useState(() => window.matchMedia(q).matches)
  useEffect(() => {
    const mq = window.matchMedia(q)
    const on = () => setM(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [q])
  return m
}
/** AI 고급 추론을 켰는지 (API 호출 때 같이 보냄) */
export const deepAi = () => loadPrefs().deepAi === true
