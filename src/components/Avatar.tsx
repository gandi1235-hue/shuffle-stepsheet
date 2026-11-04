import { avatarUrl } from '../lib/api'

const COLORS = ['#d9376e', '#c2185b', '#7c3aed', '#0369a1', '#0f766e', '#b45309', '#be123c', '#4338ca']

export function avatarColor(key: string) {
  let h = 0
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0
  return COLORS[h % COLORS.length]
}

/** 멤버 아바타(동그라미): 사진이 있으면 사진(전신 캐릭터면 머리 쪽), 없으면 이름 첫 글자 (사람마다 색이 다름). level을 주면 작은 Lv 배지 */
export default function Avatar({ path, name, userId, size = 40, level }: { path?: string | null; name: string; userId?: string; size?: number; level?: number }) {
  const bg = avatarColor(userId ?? name)
  const style = { width: size, height: size, fontSize: Math.round(size * 0.42) }
  const img = path ? (
    <img className="avatar" src={avatarUrl(path)} alt="" style={style} />
  ) : (
    <span className="avatar initial" style={{ ...style, background: bg }} aria-hidden="true">
      {(name.trim()[0] ?? '?').toUpperCase()}
    </span>
  )
  if (!level) return img
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
export function Character({ path, name, userId, width = 96, className = '' }: { path?: string | null; name: string; userId?: string; width?: number; className?: string }) {
  const style = { width, height: Math.round((width * 4) / 3) }
  if (path) return <img className={`character ${className}`} src={avatarUrl(path)} alt="" style={style} />
  return (
    <span className={`character initial ${className}`} style={{ ...style, background: avatarColor(userId ?? name), fontSize: Math.round(width * 0.5) }} aria-hidden="true">
      {(name.trim()[0] ?? '?').toUpperCase()}
    </span>
  )
}
