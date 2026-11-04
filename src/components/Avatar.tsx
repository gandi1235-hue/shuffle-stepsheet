import { avatarUrl } from '../lib/api'

const COLORS = ['#d9376e', '#c2185b', '#7c3aed', '#0369a1', '#0f766e', '#b45309', '#be123c', '#4338ca']

/** 멤버 아바타: 사진이 있으면 사진, 없으면 이름 첫 글자 동그라미 (사람마다 색이 다름) */
export default function Avatar({ path, name, userId, size = 40 }: { path?: string | null; name: string; userId?: string; size?: number }) {
  const key = userId ?? name
  let h = 0
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0
  const bg = COLORS[h % COLORS.length]
  const style = { width: size, height: size, fontSize: Math.round(size * 0.42) }
  if (path) return <img className="avatar" src={avatarUrl(path)} alt="" style={style} />
  return (
    <span className="avatar initial" style={{ ...style, background: bg }} aria-hidden="true">
      {(name.trim()[0] ?? '?').toUpperCase()}
    </span>
  )
}
