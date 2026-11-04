import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import InstallBanner from '../components/InstallBanner'
import SongList from '../components/SongList'
import { createSharedFolder, joinFolder, listFolders, listSongs, searchSheets, type SongWithSheets } from '../lib/api'
import { supabase } from '../lib/supabase'
import type { Folder, Stepsheet } from '../lib/types'
import { Folder as FolderIcon, Music, People, Plus, Search, Shared, User } from '../components/Icons'

const roleKo = { owner: '주인', editor: '편집자', viewer: '보기' }
const SEL = 'selected-folder'

export default function Home() {
  const nav = useNavigate()
  const [folders, setFolders] = useState<Folder[]>([])
  const [sel, setSel] = useState<string>(() => localStorage.getItem(SEL) ?? '')
  const [songs, setSongs] = useState<SongWithSheets[] | null>(null)
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Stepsheet[] | null>(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    listFolders()
      .then((f) => {
        setFolders(f)
        if (!f.some((x) => x.id === sel)) setSel(f[0]?.id ?? '')
      })
      .catch((e) => setErr(e.message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!sel) return
    localStorage.setItem(SEL, sel)
    setSongs(null)
    listSongs(sel).then(setSongs).catch((e) => setErr(e.message))
  }, [sel])

  useEffect(() => {
    if (!q.trim()) {
      setResults(null)
      return
    }
    const t = setTimeout(() => searchSheets(q).then(setResults).catch((e) => setErr(e.message)), 300)
    return () => clearTimeout(t)
  }, [q])

  const newShared = async () => {
    const name = prompt('공유 폴더 이름을 적어 주세요 (예: 월수반)')
    if (!name) return
    try {
      const id = await createSharedFolder(name)
      const f = await listFolders()
      setFolders(f)
      setSel(id)
    } catch (e) {
      setErr((e as Error).message)
    }
  }

  const join = async () => {
    const code = prompt('받은 초대 코드를 적어 주세요')
    if (!code) return
    try {
      const id = await joinFolder(code.trim())
      const f = await listFolders()
      setFolders(f)
      setSel(id)
    } catch (e) {
      setErr((e as Error).message)
    }
  }

  const folderMenu = () => {
    const pick = prompt('1: 새 공유 폴더 만들기\n2: 초대 코드로 참여\n번호를 적어 주세요', '1')
    if (pick === '1') newShared()
    else if (pick === '2') join()
  }

  const folder = folders.find((f) => f.id === sel)
  const canEdit = folder?.role === 'owner' || folder?.role === 'editor'

  return (
    <div className="screen">
      <div className="topbar">
        <h1 className="brand">스텝지함</h1>
        <button type="button" className="iconbtn" aria-label="로그아웃" onClick={() => supabase.auth.signOut()}>
          <User />
        </button>
      </div>
      <div className="content" style={{ paddingBottom: 100 }}>
        <InstallBanner />
        <div className="search">
          <Search />
          <label htmlFor="q" className="sr-only">
            검색
          </label>
          <input id="q" type="search" placeholder="노래, 가수, 창작자, 스텝 이름" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {err && <div className="error">{err}</div>}

        {results ? (
          <div className="list">
            <div className="label">검색 결과 {results.length}개</div>
            {results.length === 0 && <div className="empty">찾는 스텝지가 없어요</div>}
            {results.map((s) => (
              <SheetCard key={s.id} s={s} />
            ))}
          </div>
        ) : (
          <>
            <div className="tabs" role="tablist" aria-label="폴더">
              {folders.map((f) => (
                <button key={f.id} type="button" role="tab" aria-selected={f.id === sel} className={f.id === sel ? 'tab on' : 'tab'} onClick={() => setSel(f.id)}>
                  {f.kind === 'shared' ? <Shared /> : <FolderIcon />}
                  {f.name}
                  <span className="n">{f.song_count}</span>
                </button>
              ))}
              <button type="button" className="tab add" aria-label="폴더 추가 또는 참여" onClick={folderMenu}>
                <Plus />
              </button>
            </div>

            {folder && (
              <div className="row-head">
                <div className="label">
                  {folder.kind === 'shared' ? `공유 폴더 · 내 권한 ${roleKo[folder.role ?? 'viewer']}` : '내 개인 폴더'} · {songs?.length ?? folder.song_count ?? 0}곡
                </div>
                {folder.kind === 'shared' && (
                  <Link to={`/folder/${folder.id}/members`} className="btn pill" style={{ minHeight: 34 }}>
                    <People /> 멤버
                  </Link>
                )}
              </div>
            )}

            {songs && songs.length === 0 && <div className="empty">아직 스텝지가 없어요. 아래 버튼으로 추가해 보세요.</div>}
            {songs && <SongList songs={songs} />}
            {!songs && sel && <div className="spinner">불러오는 중…</div>}
          </>
        )}
      </div>
      {canEdit && (
        <Link to={`/add?folder=${sel}`} className="fab">
          <Plus />
          스텝지 추가
        </Link>
      )}
    </div>
  )
}

export function SheetCard({ s }: { s: Stepsheet }) {
  return (
    <Link className="card" to={`/sheet/${s.id}`}>
      <span className={s.audio_path || s.audio_url ? 'ico' : 'ico soft'}>
        <Music />
      </span>
      <span className="grow">
        <span className="t">{s.song?.title ?? '제목 없음'}</span>
        <span className="s">
          {s.song?.artist ? `${s.song.artist} · ` : ''}창작 {s.creator_name}
        </span>
      </span>
    </Link>
  )
}
