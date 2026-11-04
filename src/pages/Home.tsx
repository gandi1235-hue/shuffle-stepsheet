import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { EmptyState, Sheet, Skeleton, useToast } from '../components/ui'
import { haptic } from '../lib/prefs'
import SongList from '../components/SongList'
import { createSharedFolder, joinFolder, listFolders, listSongs, searchSheets, type SongWithSheets } from '../lib/api'
import type { Folder, Stepsheet } from '../lib/types'
import { Back, Camera, Edit, Folder as FolderIcon, Music, People, Plus, Search, Shared, Brand } from '../components/Icons'

const roleKo = { owner: '주인', editor: '편집자', viewer: '보기' }
const SEL = 'selected-folder'

export default function Home() {
  const [folders, setFolders] = useState<Folder[]>([])
  const [sel, setSel] = useState<string>(() => localStorage.getItem(SEL) ?? '')
  const [songs, setSongs] = useState<SongWithSheets[] | null>(null)
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Stepsheet[] | null>(null)
  const [err, setErr] = useState('')
  const [params] = useSearchParams()
  const [dlg, setDlg] = useState<'menu' | 'new' | 'join' | null>(params.get('dlg') === 'menu' ? 'menu' : null)
  const [text, setText] = useState('')
  const toast = useToast()

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

  const submitDlg = async () => {
    const v = text.trim()
    if (!v) return
    try {
      const id = dlg === 'new' ? await createSharedFolder(v) : await joinFolder(v)
      const f = await listFolders()
      setFolders(f)
      setSel(id)
      setDlg(null)
      setText('')
      haptic()
      toast(dlg === 'new' ? `"${v}" 폴더를 만들었어요` : '폴더에 참여했어요')
    } catch (e) {
      setErr((e as Error).message)
      setDlg(null)
    }
  }

  const folder = folders.find((f) => f.id === sel)
  const canEdit = folder?.role === 'owner' || folder?.role === 'editor'

  return (
    <div className="screen">
      <div className="hero">
        <div className="topbar">
          <Link to="/" className="iconbtn" aria-label="처음으로">
            <Back />
          </Link>
          <h1 className="brand"><Brand /></h1>
        </div>
        <div className="greet">{folder ? `${folder.name} · ${songs?.length ?? folder.song_count ?? 0}곡` : '저장된 스텝지'}</div>
        <div className="search">
          <Search />
          <label htmlFor="q" className="sr-only">
            검색
          </label>
          <input id="q" type="search" placeholder="노래, 가수, 창작자, 스텝 이름" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>
      <div className="content" style={{ paddingBottom: 100 }}>
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
              <button type="button" className="tab add" aria-label="폴더 추가 또는 참여" onClick={() => setDlg('menu')}>
                <Plus />
              </button>
            </div>

            {folder && (
              <div className="row-head">
                <div className="label">
                  {folder.kind === 'shared' ? `공유 폴더 · 내 권한 ${roleKo[folder.role ?? 'viewer']}` : '내 개인 폴더'} · {songs?.length ?? folder.song_count ?? 0}곡
                </div>
                <span className="row-btns">
                  {folder.kind === 'shared' && (
                    <Link to={`/folder/${folder.id}/members`} className="btn pill" style={{ minHeight: 34 }}>
                      <People /> 멤버
                    </Link>
                  )}
                  <Link to={`/folder/${folder.id}/edit`} className="btn pill" style={{ minHeight: 34 }} aria-label="폴더 편집">
                    <Edit /> 편집
                  </Link>
                </span>
              </div>
            )}

            {songs && songs.length === 0 && (
              <EmptyState
                icon={<Camera />}
                title="아직 스텝지가 없어요"
                desc={canEdit ? '종이 스텝지 사진 한 장이면 바로 등록돼요.' : '이 폴더의 편집자가 스텝지를 올리면 여기에 보여요.'}
                action={
                  canEdit ? (
                    <Link to={`/add?folder=${sel}`} className="btn primary">
                      첫 스텝지 등록하기
                    </Link>
                  ) : undefined
                }
              />
            )}
            {songs && <SongList songs={songs} />}
            {!songs && sel && <Skeleton rows={4} />}
          </>
        )}
      </div>
      {canEdit && (
        <Link to={`/add?folder=${sel}`} className="fab">
          <Plus />
          스텝지 추가
        </Link>
      )}

      <Sheet open={dlg === 'menu'} title="폴더" onClose={() => setDlg(null)}>
        <button type="button" className="menu-item" onClick={() => setDlg('new')}>
          <span className="ico">
            <Shared />
          </span>
          <span className="grow">
            <b>새 공유 폴더 만들기</b>
            <span>반이나 팀 이름으로 폴더를 만들고 사람들을 초대해요</span>
          </span>
        </button>
        <button type="button" className="menu-item" onClick={() => setDlg('join')}>
          <span className="ico">
            <People />
          </span>
          <span className="grow">
            <b>초대 코드로 참여</b>
            <span>카카오톡으로 받은 6자리 코드를 넣어요</span>
          </span>
        </button>
      </Sheet>
      <Sheet open={dlg === 'new' || dlg === 'join'} title={dlg === 'new' ? '새 공유 폴더' : '초대 코드로 참여'} onClose={() => setDlg(null)}>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            submitDlg()
          }}
          className="list"
        >
          <div className="field">
            <label htmlFor="dlg-input">{dlg === 'new' ? '폴더 이름' : '초대 코드'}</label>
            <input
              id="dlg-input"
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={dlg === 'new' ? '예: 월수반' : '예: AB12CD'}
              autoCapitalize={dlg === 'join' ? 'characters' : undefined}
            />
          </div>
          <button type="submit" className="btn primary block" disabled={!text.trim()}>
            {dlg === 'new' ? '만들기' : '참여하기'}
          </button>
        </form>
      </Sheet>
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
