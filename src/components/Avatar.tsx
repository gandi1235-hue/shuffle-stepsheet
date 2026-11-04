import { avatarUrl } from '../lib/api'
import { imageTier } from '../lib/level'

const COLORS = ['#d9376e', '#c2185b', '#7c3aed', '#0369a1', '#0f766e', '#b45309', '#be123c', '#4338ca']

export function avatarColor(key: string) {
  let h = 0
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0
  return COLORS[h % COLORS.length]
}

/** 레벨에 맞는 그림 경로: 등급별 그림이 있으면 그중 하나, 없으면 기본 그림 */
export function tierPath(path: string | null | undefined, tiers: string[] | null | undefined, level: number | undefined): string | null {
  if (tiers?.length && level) return tiers[Math.min(imageTier(level), tiers.length - 1)] ?? path ?? null
  return path ?? null
}

/** 멤버 아바타(동그라미): 사진이 있으면 사진(전신 캐릭터면 머리 쪽), 없으면 이름 첫 글자 (사람마다 색이 다름). level을 주면 작은 Lv 배지 */
export default function Avatar({ path: base, tiers, name, userId, size = 40, level, badge = true }: { path?: string | null; tiers?: string[] | null; name: string; userId?: string; size?: number; level?: number; badge?: boolean }) {
  const path = tierPath(base, tiers, level)
  const bg = avatarColor(userId ?? name)
  const style = { width: size, height: size, fontSize: Math.round(size * 0.42) }
  const img = path ? (
    <img className="avatar" src={avatarUrl(path)} alt="" style={style} />
  ) : (
    <span className="avatar initial" style={{ ...style, background: bg }} aria-hidden="true">
      {(name.trim()[0] ?? '?').toUpperCase()}
    </span>
  )
  if (!level || !badge) return img
  return (
    <span className="avatar-wrap" style={{ width: size, height: size }}>
      {img}
      <span className="lv-badge" style={{ fontSize: Math.max(10, Math.round(size * 0.26)) }}>
        Lv.{level}
      </span>
    </span>
  )
}

/** 전신 캐릭터 카드(세로 3:4): 사진이 있으면 전신, 없으면 큰 첫 글자 */
export function Character({ path: base, tiers, level, name, userId, width = 96, className = '' }: { path?: string | null; tiers?: string[] | null; level?: number; name: string; userId?: string; width?: number; className?: string }) {
  const path = tierPath(base, tiers, level)
  const style = { width, height: Math.round((width * 4) / 3) }
  if (path) return <img className={`character ${className}`} src={avatarUrl(path)} alt="" style={style} />
  return (
    <span className={`character initial ${className}`} style={{ ...style, background: avatarColor(userId ?? name), fontSize: Math.round(width * 0.5) }} aria-hidden="true">
      {(name.trim()[0] ?? '?').toUpperCase()}
    </span>
  )
}
