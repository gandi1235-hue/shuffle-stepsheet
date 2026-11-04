import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import TopBar from '../components/TopBar'
import { Chevron, Music, People, Plus, Search } from '../components/Icons'
import { getFolder, listSongs, type SongWithSheets } from '../lib/api'
import type { Folder } from '../lib/types'

type Sort = 'name' | 'recent' | 'audio'

export default function FolderPage() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const [folder, setFolder] = useState<Folder | null>(null)
  const [songs, setSongs] = useState<SongWithSheets[]>([])
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<Sort>('name')
  const [err, setErr] = useState('')

  useEffect(() => {
    getFolder(id).then(setFolder).catch((e) => setErr(e.message))
    listSongs(id).then(setSongs).catch((e) => setErr(e.message))
  }, [id])

  const shown = useMemo(() => {
    const term = q.trim()
    let list = songs.filter(
      (s) =>
        !term ||
        s.title.includes(term) ||
        s.artist.includes(term) ||
        s.sheets.some((sh) => sh.creator_name.includes(term) || sh.sections.some((sec) => sec.steps.some((st) => st.name.includes(term)))),
    )
    if (sort === 'audio') list = list.filter((s) => s.sheets.some((sh) => sh.audio_path || sh.audio_url))
    if (sort === 'recent') list = [...list].sort((a, b) => latest(b).localeCompare(latest(a)))
    else list = [...list].sort((a, b) => a.title.localeCompare(b.title, 'ko'))
    return list
  }, [songs, q, sort])

  const canEdit = folder?.role === 'owner' || folder?.role === 'editor'

  return (
    <div className="screen">
      <TopBar
        title={folder?.name ?? '폴더'}
        sub={folder ? `${folder.kind === 'shared' ? '공유 폴더' : '개인 폴더'} · ${songs.length}곡` : undefined}
        back="/"
        right={
          folder?.kind === 'shared' ? (
            <Link to={`/folder/${id}/members`} className="btn" style={{ minHeight: 40 }}>
              <People /> 멤버
            </Link>
          ) : undefined
        }
      />
      <div className="content" style={{ paddingBottom: 100 }}>
        <div className="search" style={{ height: 46 }}>
          <Search />
          <label htmlFor="fq" className="sr-only">
            이 폴더에서 검색
          </label>
          <input id="fq" type="search" placeholder="이 폴더에서 검색" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="chips">
          {(
            [
              ['name', '가나다순'],
              ['recent', '최근 추가'],
              ['audio', '음원 있음'],
            ] as [Sort, string][]
          ).map(([k, label]) => (
            <button key={k} type="button" className={sort === k ? 'btn pill on' : 'btn pill'} onClick={() => setSort(k)}>
              {label}
            </button>
          ))}
        </div>
        {err && <div className="error">{err}</div>}
        {shown.length === 0 && <div className="empty">{songs.length === 0 ? '아직 스텝지가 없어요. 아래 버튼으로 추가해 보세요.' : '맞는 노래가 없어요'}</div>}
        <div className="list">
          {shown.map((s) => {
            const isOpen = open[s.id] ?? shown.length <= 3
            return (
              <div className="song" key={s.id}>
                <button type="button" className={isOpen ? 'open' : ''} onClick={() => setOpen({ ...open, [s.id]: !isOpen })} aria-expanded={isOpen}>
                  <span className="grow" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: 18, fontWeight: 700 }}>{s.title}</span>
                    <span style={{ fontSize: 14, color: 'var(--faint)' }}>
                      {s.artist ? `${s.artist} · ` : ''}창작자 {s.sheets.length}명
                    </span>
                  </span>
                  <Chevron open={isOpen} />
                </button>
                {isOpen &&
                  s.sheets
                    .slice()
                    .sort((a, b) => a.creator_name.localeCompare(b.creator_name, 'ko'))
                    .map((sh) => {
                      const hasAudio = Boolean(sh.audio_path || sh.audio_url)
                      const steps = sh.sections.reduce((n, sec) => n + sec.steps.length, 0)
                      return (
                        <Link key={sh.id} to={`/sheet/${sh.id}`} className="ver">
                          <span className={hasAudio ? 'dot' : 'dot off'} />
                          <span style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: 17, fontWeight: 500 }}>창작 {sh.creator_name}</span>
                            <span style={{ fontSize: 14, color: 'var(--faint)' }}>
                              {[sh.difficulty, `${steps}스텝`, hasAudio ? '음원 있음' : '음원 없음'].filter(Boolean).join(' · ')}
                            </span>
                          </span>
                          <span style={{ color: hasAudio ? 'var(--accent)' : '#d1d5db' }}>
                            <Music />
                          </span>
                        </Link>
                      )
                    })}
              </div>
            )
          })}
        </div>
      </div>
      {canEdit && (
        <button type="button" className="fab" onClick={() => nav(`/add?folder=${id}`)}>
          <Plus />
          스텝지 추가
        </button>
      )}
    </div>
  )
}

function latest(s: SongWithSheets) {
  return s.sheets.reduce((m, sh) => (sh.updated_at > m ? sh.updated_at : m), '')
}
