import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { SongWithSheets } from '../lib/api'
import { compareKo, initialLabel, initialOf, initialRank } from '../lib/hangul'
import { sheetStats } from '../lib/types'
import { Chevron, Music } from '../components/Icons'

const normTitle = (t: string) => t.toLowerCase().replace(/[\s\-_.,!?'"()\[\]~·]/g, '')

/** 가나다순 · ㄱㄴㄷ 구분 · 같은 곡은 "제목 (3)"으로 묶고 눌러서 펼치기 */
export default function SongList({ songs, grouped = true }: { songs: SongWithSheets[]; grouped?: boolean }) {
  const nav = useNavigate()
  const [open, setOpen] = useState<Record<string, boolean>>({})

  const sections = useMemo(() => {
    // 같은 제목(띄어쓰기·대소문자·기호 무시)은 가수가 달라도 한 묶음으로
    const byTitle = new Map<string, SongWithSheets>()
    for (const s of songs) {
      const k = normTitle(s.title)
      const cur = byTitle.get(k)
      if (!cur) byTitle.set(k, { ...s, sheets: [...s.sheets] })
      else byTitle.set(k, { ...cur, artist: cur.artist || s.artist, sheets: [...cur.sheets, ...s.sheets] })
    }
    const sorted = [...byTitle.values()].sort((a, b) => compareKo(a.title, b.title))
    if (!grouped) return [{ key: '', items: sorted }]
    const map = new Map<string, SongWithSheets[]>()
    for (const s of sorted) {
      const k = initialOf(s.title)
      map.set(k, [...(map.get(k) ?? []), s])
    }
    return [...map.entries()].sort((a, b) => initialRank(a[0]) - initialRank(b[0])).map(([key, items]) => ({ key, items }))
  }, [songs, grouped])

  if (songs.length === 0) return null

  return (
    <div className="songlist">
      {sections.map((sec) => (
        <div className="section" key={sec.key || 'all'}>
          {sec.key && <div className="section-key">{initialLabel(sec.key)}</div>}
          <div className="song-group">
            {sec.items.map((s) => {
              const n = s.sheets.length
              const isOpen = open[s.id] ?? false
              const sheets = [...s.sheets].sort((a, b) => compareKo(a.creator_name, b.creator_name))
              const hasAnyAudio = s.sheets.some((sh) => sh.audio_path || sh.audio_url)
              const onClick = () => {
                if (n === 1) nav(`/sheet/${sheets[0].id}`)
                else setOpen({ ...open, [s.id]: !isOpen })
              }
              return (
                <div className={isOpen ? 'song open' : 'song'} key={s.id}>
                  <button type="button" onClick={onClick} aria-expanded={n > 1 ? isOpen : undefined}>
                    <span className={hasAnyAudio ? 'ico' : 'ico soft'}>
                      <Music />
                    </span>
                    <span className="grow">
                      <span className="title">
                        {s.title}
                        {n > 1 && <span className="count"> ({n})</span>}
                      </span>
                      <span className="meta">
                        {s.artist || '가수 미입력'}
                        {n === 1 && ` · 창작 ${sheets[0].creator_name}`}
                        {n > 1 && ` · 창작자 ${n}명`}
                      </span>
                    </span>
                    <Chevron open={n > 1 ? isOpen : undefined} />
                  </button>
                  {isOpen &&
                    sheets.map((sh) => {
                      const hasAudio = Boolean(sh.audio_path || sh.audio_url)
                      const st = sheetStats(sh.lines)
                      return (
                        <Link key={sh.id} to={`/sheet/${sh.id}`} className="ver">
                          <span className={hasAudio ? 'dot' : 'dot off'} />
                          <span className="grow">
                            <span className="nm">{sh.creator_name}</span>
                            <span className="meta">{[sh.creator_info, `${st.lines}줄 · ${st.steps}스텝`, hasAudio ? '음원 있음' : '음원 없음'].filter(Boolean).join(' · ')}</span>
                          </span>
                          <Chevron />
                        </Link>
                      )
                    })}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
