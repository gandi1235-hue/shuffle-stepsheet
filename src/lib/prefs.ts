import { useEffect, useState } from 'react'

export type FontSize = 'normal' | 'large' | 'xlarge'
export interface Prefs {
  font: FontSize
  contrast: boolean
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

export function applyPrefs(p: Prefs) {
  const el = document.documentElement
  el.dataset.font = p.font
  el.dataset.contrast = p.contrast ? 'high' : 'normal'
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
export function haptic(ms = 12) {
  try {
    navigator.vibrate?.(ms)
  } catch {
    /* 무시 */
  }
}
