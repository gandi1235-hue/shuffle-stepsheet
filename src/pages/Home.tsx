import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createSharedFolder, joinFolder, listFolders, recentSheets, searchSheets } from '../lib/api'
import { supabase } from '../lib/supabase'
import type { Folder, Stepsheet } from '../lib/types'
import { Folder as FolderIcon, Music, Plus, Search, Shared, User } from '../components/Icons'

const roleKo = { owner: '주인', editor: '편집자', viewer: '보기' }

export default function Home() {
  const nav = useNavigate()
  const [folders, setFolders] = useState<Folder[]>([])
  const [recent, setRecent] = useState<Stepsheet[]>([])
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Stepsheet[] | null>(null)
  const [err, setErr] = useState('')

  const load = () =>
    Promise.all([listFolders(), recentSheets()])
      .then(([f, r]) => {
        setFolders(f)
        setRecent(r)
      })
      .catch((e) => setErr(e.message))

  useEffect(() => {
    load()
  }, [])

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
      nav(`/folder/${id}`)
    } catch (e) {
      setErr((e as Error).message)
    }
  }

  const join = async () => {
    const code = prompt('받은 초대 코드를 적어 주세요')
    if (!code) return
    try {
      const id = await joinFolder(code.trim())
      nav(`/folder/${id}`)
    } catch (e) {
      setErr((e as Error).message)
    }
  }

  const personal = folders.filter((f) => f.kind === 'personal')
  const shared = folders.filter((f) => f.kind === 'shared')

  return (
    <div className="screen">
      <div className="topbar">
        <h1 style={{ fontSize: 24 }}>스텝지함</h1>
        <button type="button" className="iconbtn" aria-label="로그아웃" onClick={() => supabase.auth.signOut()}>
          <User />
        </button>
      </div>
      <div className="content" style={{ paddingBottom: 100 }}>
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
            <div className="list">
              <div className="label">내 폴더</div>
              {personal.map((f) => (
                <Link key={f.id} className="card" to={`/folder/${f.id}`}>
                  <FolderIcon />
                  <span className="grow">
                    <span className="t">{f.name}</span>
                  </span>
                  <span className="n">{f.song_count}곡</span>
                </Link>
              ))}
            </div>

            <div className="list">
              <div className="row-head">
                <div className="label">공유 폴더</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button type="button" className="btn pill" onClick={join}>
                    초대 코드로 참여
                  </button>
                  <button type="button" className="btn pill" onClick={newShared}>
                    + 새 공유 폴더
                  </button>
                </div>
              </div>
              {shared.length === 0 && <div className="empty">아직 공유 폴더가 없어요</div>}
              {shared.map((f) => (
                <Link key={f.id} className="card" to={`/folder/${f.id}`}>
                  <Shared />
                  <span className="grow">
                    <span className="t">{f.name}</span>
                    <span className="s">내 권한: {roleKo[f.role ?? 'viewer']}</span>
                  </span>
                  <span className="n">{f.song_count}곡</span>
                </Link>
              ))}
            </div>

            {recent.length > 0 && (
              <div className="list">
                <div className="label">최근 스텝지</div>
                {recent.map((s) => (
                  <SheetCard key={s.id} s={s} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
      <Link to="/add" className="fab">
        <Plus />
        스텝지 추가
      </Link>
    </div>
  )
}

export function SheetCard({ s }: { s: Stepsheet }) {
  return (
    <Link className="card" to={`/sheet/${s.id}`} style={{ padding: '12px 14px' }}>
      <span className="grow">
        <span className="t" style={{ fontSize: 17 }}>
          {s.song?.title ?? '제목 없음'}
        </span>
        <span className="s">
          {s.song?.artist ? `${s.song.artist} · ` : ''}창작 {s.creator_name}
        </span>
      </span>
      <span style={{ color: s.audio_path || s.audio_url ? 'var(--accent)' : '#d1d5db' }}>
        <Music />
      </span>
    </Link>
  )
}
