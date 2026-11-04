import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { getProfile, mySheetCount, type Profile } from '../lib/api'
import { useAuth } from '../lib/auth'
import { levelOf, rememberLevel, seenLevel, titleOf } from '../lib/level'
import { haptic } from '../lib/prefs'
import { Character } from './Avatar'

export type LevelUpInfo = { from: number; to: number; profile: Profile | null; sheets: number }

/** 레벨업 연출: 번쩍 → 빛줄기·색종이·반짝이·물결 속에 캐릭터가 환하게 빛남. 누르거나 5.5초 뒤에 사라짐 */
export function LevelUpOverlay({ info, onClose }: { info: LevelUpInfo; onClose: () => void }) {
  useEffect(() => {
    haptic([20, 40, 20])
    const t = setTimeout(onClose, 9000)
    return () => clearTimeout(t)
  }, [onClose])
  const name = info.profile?.nickname?.trim() || info.profile?.display_name || '나'
  const title = titleOf(info.to)
  const newTitle = title && title !== titleOf(info.from)
  const colors = ['#ffd166', '#ff7ab3', '#7ad7ff', '#d9376e', '#b5f28a', '#fff']
  return (
    <div className="levelup" role="dialog" aria-label="레벨 업" onClick={onClose}>
      <button type="button" className="levelup-x" aria-label="닫기" onClick={onClose}>
        ✕
      </button>
      <div className="levelup-flash" />
      <div className="levelup-rays" />
      {Array.from({ length: 48 }, (_, i) => (
        <span key={i} className="confetti" style={{ ['--i' as string]: i, ['--x' as string]: (i * 37) % 100, ['--r' as string]: 360 + ((i * 97) % 720), ['--c' as string]: colors[i % colors.length], width: 6 + (i % 3) * 3, height: 10 + (i % 4) * 3 }} />
      ))}
      <div className="levelup-card">
        <div className="levelup-title" aria-label="LEVEL UP!">
          {'LEVEL UP!'.split('').map((ch, i) => (
            <span key={i} style={{ ['--i' as string]: i }}>{ch === ' ' ? '\u00a0' : ch}</span>
          ))}
        </div>
        <div className="levelup-stage">
          {[0, 1, 2].map((i) => (
            <span key={i} className="levelup-ring" style={{ ['--i' as string]: i }} />
          ))}
          {Array.from({ length: 18 }, (_, i) => (
            <span key={i} className="spark" style={{ ['--i' as string]: i }} />
          ))}
          <div className="levelup-glow" />
          <Character path={info.profile?.avatar_path} name={name} userId={info.profile?.id} width={140} className="shine" />
        </div>
        <div className="levelup-lv">
          <span className="old">Lv.{info.from}</span>
          <span className="arrow">→</span>
          <span className="new">Lv.{info.to}</span>
        </div>
        {newTitle && <div className="levelup-title-badge">🏅 {title}가 됐어요!</div>}
        <div className="levelup-name">{name} · 스텝지 {info.sheets}장{title && !newTitle ? ` · ${title}` : ''}</div>
        <div className="levelup-close">아무 데나 누르면 닫혀요</div>
      </div>
    </div>
  )
}

/**
 * 레벨업 감시: 화면이 바뀔 때마다(특히 스텝지 저장 뒤) 내 스텝지 수를 세어, 이 기기에서 마지막으로 본 레벨보다 오르면 연출을 띄움.
 * 처음 쓰는 기기에서는 지금 레벨만 기억해 두고 연출은 안 함.
 */
export default function LevelUpWatcher() {
  const { session } = useAuth()
  const loc = useLocation()
  const [info, setInfo] = useState<LevelUpInfo | null>(null)
  const uid = session?.user.id
  useEffect(() => {
    if (!uid) return
    // 저장 뒤에 가는 화면(스텝지 보기)과 설정·서재에서만 센다
    if (!/^\/(sheet\/[^/]+|settings|library|)$/.test(loc.pathname)) return
    let alive = true
    mySheetCount()
      .then(async (n) => {
        if (!alive) return
        const lv = levelOf(n)
        const seen = seenLevel(uid)
        if (seen === null) return rememberLevel(uid, lv)
        if (lv > seen) {
          const profile = await getProfile().catch(() => null)
          if (!alive) return
          rememberLevel(uid, lv)
          setInfo({ from: seen, to: lv, profile, sheets: n })
        } else if (lv < seen) rememberLevel(uid, lv)
      })
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [uid, loc.pathname])
  if (!info) return null
  return <LevelUpOverlay info={info} onClose={() => setInfo(null)} />
}
