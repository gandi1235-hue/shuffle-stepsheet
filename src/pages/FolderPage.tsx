import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import SongList from '../components/SongList'
import TopBar from '../components/TopBar'
import { People, Plus, Search } from '../components/Icons'
import { getFolder, listSongs, type SongWithSheets } from '../lib/api'
import { stepNames, type Folder } from '../lib/types'

export default function FolderPage() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const [folder, setFolder] = useState<Folder | null>(null)
  const [songs, setSongs] = useState<SongWithSheets[]>([])
  const [q, setQ] = useState('')
  const [err, setErr] = useState('')

  useEffect(() => {
    getFolder(id).then(setFolder).catch((e) => setErr(e.message))
    listSongs(id).then(setSongs).catch((e) => setErr(e.message))
  }, [id])

  const shown = useMemo(() => {
    const term = q.trim()
    return songs.filter(
      (s) =>
        !term ||
        s.title.includes(term) ||
        s.artist.includes(term) ||
        s.sheets.some((sh) => sh.creator_name.includes(term) || stepNames(sh.lines).some((n) => n.includes(term))),
    )
  }, [songs, q])

  const canEdit = folder?.role === 'owner' || folder?.role === 'editor'

  return (
    <div className="screen">
      <TopBar
        title={folder?.name ?? '폴더'}
        sub={folder ? `${folder.kind === 'shared' ? '공유 폴더' : '개인 폴더'} · ${songs.length}곡` : undefined}
        back="/"
        right={
          folder?.kind === 'shared' ? (
            <Link to={`/folder/${id}/members`} className="btn pill" style={{ minHeight: 38 }}>
              <People /> 멤버
            </Link>
          ) : undefined
        }
      />
      <div className="content" style={{ paddingBottom: 100 }}>
        <div className="search">
          <Search />
          <label htmlFor="fq" className="sr-only">
            이 폴더에서 검색
          </label>
          <input id="fq" type="search" placeholder="이 폴더에서 검색" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {err && <div className="error">{err}</div>}
        {shown.length === 0 && <div className="empty">{songs.length === 0 ? '아직 스텝지가 없어요. 아래 버튼으로 추가해 보세요.' : '맞는 노래가 없어요'}</div>}
        <SongList songs={shown} />
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
