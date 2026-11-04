import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { getProfile, mySheetCount, type Profile } from '../lib/api'
import { useAuth } from '../lib/auth'
import { levelOf, rememberLevel, seenLevel, titleOf } from '../lib/level'
import { haptic } from '../lib/prefs'
import { Character } from './Avatar'

export type LevelUpInfo = { from: number; to: number; profile: Profile | null }

/** 레벨업 연출: 캐릭터가 환하게 빛나고 반짝이가 흩어짐. 누르거나 4초 뒤에 사라짐 */
export function LevelUpOverlay({ info, onClose }: { info: LevelUpInfo; onClose: () => void }) {
  useEffect(() => {
    haptic([20, 40, 20])
    const t = setTimeout(onClose, 4200)
    return () => clearTimeout(t)
  }, [onClose])
  const name = info.profile?.nickname?.trim() || info.profile?.display_name || '나'
  const title = titleOf(info.to)
  const newTitle = title && title !== titleOf(info.from)
  return (
    <div className="levelup" role="dialog" aria-label="레벨 업" onClick={onClose}>
      <div className="levelup-card">
        <div className="levelup-title">LEVEL UP!</div>
        <div className="levelup-stage">
          {Array.from({ length: 12 }, (_, i) => (
            <span key={i} className="spark" style={{ ['--i' as string]: i }} />
          ))}
          <div className="levelup-glow" />
          <Character path={info.profile?.avatar_path} name={name} userId={info.profile?.id} width={132} className="shine" />
        </div>
        <div className="levelup-lv">
          <span className="old">Lv.{info.from}</span>
          <span className="arrow">→</span>
          <span className="new">Lv.{info.to}</span>
        </div>
        {newTitle && <div className="levelup-title-badge">🏅 {title}가 됐어요!</div>}
        <div className="levelup-name">{name} · 스텝지 {info.to - 1}장째{title && !newTitle ? ` · ${title}` : ''}</div>
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
          setInfo({ from: seen, to: lv, profile })
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
