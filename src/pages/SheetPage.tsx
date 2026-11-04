import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Player, { isVideoSrc, type PlayerHandle } from '../components/Player'
import YouTubePlayer, { youtubeId } from '../components/YouTubePlayer'
import SheetTable from '../components/SheetTable'
import TopBar from '../components/TopBar'
import { Sheet as Modal, Skeleton, useToast } from '../components/ui'
import { Copy, Doc, Edit, More, Photo, Print, Share } from '../components/Icons'
import { copySheet, getFolder, getSheet, listFolders, moveSheet, signedUrl, updateMemo, updateSync } from '../lib/api'
import type { Folder, Stepsheet } from '../lib/types'

export default function SheetPage() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const [sheet, setSheet] = useState<Stepsheet | null>(null)
  const [folder, setFolder] = useState<Folder | null>(null)
  const [audio, setAudio] = useState<string>('')
  const [photos, setPhotos] = useState<string[]>([])
  const [showPhotos, setShowPhotos] = useState(false)
  const [big, setBig] = useState(false)
  const [menu, setMenu] = useState<null | 'more' | 'copy' | 'move'>(null)
  const [docView, setDocView] = useState(false)
  const [folders, setFolders] = useState<Folder[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const toast = useToast()
  const player = useRef<PlayerHandle | null>(null)
  const [t, setT] = useState(0)
  const [source, setSource] = useState<'file' | 'youtube'>('file')

  useEffect(() => {
    getSheet(id)
      .then(async (s) => {
        setSheet(s)
        if (!s) return
        getFolder(s.folder_id).then(setFolder)
        if (s.audio_path) setAudio(await signedUrl('audio', s.audio_path))
        else if (s.audio_url) setAudio(s.audio_url)
        if (s.photo_paths?.length) setPhotos(await Promise.all(s.photo_paths.map((p) => signedUrl('photos', p))))
      })
      .catch((e) => setErr(e.message))
  }, [id])

  // 연습 중 화면 꺼짐 방지
  useEffect(() => {
    let lock: { release: () => void } | null = null
    const n = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => void }> } }
    n.wakeLock?.request('screen').then((l) => (lock = l)).catch(() => undefined)
    return () => lock?.release()
  }, [])

  if (err) return <div className="error">{err}</div>
  if (!sheet)
    return (
      <div className="content">
        <Skeleton rows={1} h={110} />
        <Skeleton rows={6} h={48} />
      </div>
    )

  const canEdit = folder?.role === 'owner' || folder?.role === 'editor'
  const ytId = sheet.audio_url ? youtubeId(sheet.audio_url) : null
  const hasFile = Boolean(sheet.audio_path && audio)
  const playingYt = Boolean(ytId) && (!hasFile || source === 'youtube')
  const hasPlayer = hasFile || Boolean(ytId)
  const isExternal = !hasFile && Boolean(sheet.audio_url) && !ytId
  const fileIsVideo = Boolean(sheet.audio_path && isVideoSrc(sheet.audio_path))

  // 노래 동기화(저장된 줄별 시각): 재생 중인 줄 표시, 줄을 누르면 그 자리로 이동
  const marks = (sheet.sync ?? []) as (number | null)[]
  const hasSync = marks.some((v) => typeof v === 'number')
  const activeIndex = (() => {
    if (!hasPlayer || !hasSync) return undefined
    let best: number | undefined
    marks.forEach((v, i) => {
      if (typeof v === 'number' && v <= t + 0.05) best = i
    })
    return best
  })()
  const onLine = (i: number) => {
    const v = marks[i]
    if (typeof v === 'number') player.current?.seek(v, true)
  }
  const clearSync = async () => {
    if (!confirm('저장된 노래 동기화를 지울까요?')) return
    try {
      await updateSync(sheet.id, null)
      setSheet({ ...sheet, sync: null })
      toast('동기화를 지웠어요')
    } catch (e) {
      toast((e as Error).message)
    }
  }

  const openFolders = async (mode: 'copy' | 'move') => {
    const fs = await listFolders()
    setFolders(fs.filter((f) => (f.role === 'owner' || f.role === 'editor') && f.id !== sheet.folder_id))
    setMenu(mode)
  }
  const doCopyOrMove = async (f: Folder) => {
    const move = menu === 'move'
    setBusy(true)
    try {
      const saved = move ? await moveSheet(sheet.id, f.id) : await copySheet(sheet.id, f.id)
      setMenu(null)
      toast(move ? `"${f.name}" 폴더로 옮겼어요` : `"${f.name}" 폴더에 복사했어요`)
      nav(`/sheet/${saved.id}`, { replace: move })
    } catch (e) {
      toast((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const editMemo = async () => {
    const memo = prompt('비고 (예: Y스텝시 손동작 있음)', sheet.memo ?? '')
    if (memo === null) return
    try {
      await updateMemo(sheet.id, memo.trim())
      setSheet({ ...sheet, memo: memo.trim() })
      toast(memo.trim() ? '비고를 저장했어요' : '비고를 지웠어요')
    } catch (e) {
      toast((e as Error).message)
    }
  }

  const share = async () => {
    const url = window.location.href
    const text = `${sheet.song?.title ?? ''} 스텝지 (창작 ${sheet.creator_name})`
    if (navigator.share) await navigator.share({ title: text, url }).catch(() => undefined)
    else {
      await navigator.clipboard.writeText(url)
      toast('링크를 복사했어요. 카카오톡에 붙여 넣으세요.')
    }
  }

  const syncBtn =
    canEdit && hasPlayer ? (
      <button type="button" className={hasSync ? 'btn sync on' : 'btn sync'} onClick={() => nav(`/sheet/${sheet.id}/sync`)}>
        {hasSync ? '동기화 교정' : '노래 동기화'}
      </button>
    ) : undefined

  return (
    <div className="screen sheet-screen">
      <TopBar
        title={sheet.song?.title ?? ''}
        sub={`${sheet.creator_name}${folder ? ` · ${folder.name}` : ''}`}
        back="/library"
        right={
          <>
            {photos.length > 0 && (
              <button type="button" className={showPhotos ? 'iconbtn on' : 'iconbtn'} aria-label="원본 사진 보기" aria-pressed={showPhotos} onClick={() => setShowPhotos(!showPhotos)}>
                <Photo />
              </button>
            )}
            {canEdit && (
              <button type="button" className="iconbtn" aria-label="수정" onClick={() => nav(`/edit/${sheet.id}`)}>
                <Edit />
              </button>
            )}
            <button type="button" className={docView ? 'iconbtn on' : 'iconbtn'} aria-label="문서로 보기" aria-pressed={docView} onClick={() => setDocView(!docView)}>
              <Doc />
            </button>
            <button type="button" className="iconbtn" aria-label="더 보기" onClick={() => setMenu('more')}>
              <More />
            </button>
          </>
        }
      />

      <Modal open={menu === 'more'} title="스텝지" onClose={() => setMenu(null)}>
        <button type="button" className="menu-item" onClick={() => { setMenu(null); window.print() }}>
          <span className="ico"><Print /></span>
          <span className="grow"><b>인쇄 / PDF 저장</b><span>A4 한 장 양식으로 출력해요</span></span>
        </button>
        <button type="button" className="menu-item" onClick={() => { setMenu(null); share() }}>
          <span className="ico"><Share /></span>
          <span className="grow"><b>링크 공유</b><span>카카오톡 등으로 이 스텝지 링크를 보내요</span></span>
        </button>
        {hasFile && ytId && (
          <button type="button" className="menu-item" onClick={() => { setMenu(null); setSource(source === 'file' ? 'youtube' : 'file') }}>
            <span className="ico"><Doc /></span>
            <span className="grow"><b>{source === 'file' ? '유튜브 영상으로 보기' : '올린 파일로 듣기'}</b><span>음원 파일과 유튜브 링크가 둘 다 있어요</span></span>
          </button>
        )}
        <button type="button" className="menu-item" onClick={() => openFolders('copy')}>
          <span className="ico"><Copy /></span>
          <span className="grow"><b>다른 폴더로 복사</b><span>원본은 그대로 두고 복사본을 만들어요</span></span>
        </button>
        {canEdit && (
          <button type="button" className="menu-item" onClick={() => openFolders('move')}>
            <span className="ico"><Copy /></span>
            <span className="grow"><b>다른 폴더로 옮기기</b><span>이 폴더에서는 사라지고 저쪽 폴더로 가요</span></span>
          </button>
        )}
        {hasSync && canEdit && (
          <button type="button" className="menu-item" onClick={() => { setMenu(null); clearSync() }}>
            <span className="ico">✕</span>
            <span className="grow"><b>동기화 지우기</b><span>저장된 줄별 시각을 지워요</span></span>
          </button>
        )}
      </Modal>
      <Modal open={menu === 'copy' || menu === 'move'} title={menu === 'move' ? '어느 폴더로 옮길까요?' : '어느 폴더로 복사할까요?'} onClose={() => setMenu(null)}>
        {folders.length === 0 && <div className="notice">보낼 수 있는 폴더가 없어요. 편집 권한이 있는 다른 폴더가 필요해요.</div>}
        {folders.map((f) => (
          <button type="button" className="menu-item" key={f.id} disabled={busy} onClick={() => doCopyOrMove(f)}>
            <span className="grow"><b>{f.name}</b><span>{f.kind === 'shared' ? '공유 폴더' : '내 폴더'}{busy ? ' · 처리 중…' : ''}</span></span>
          </button>
        ))}
      </Modal>

      {showPhotos ? (
        <div className="content">
          {photos.map((p, i) => (
            <img key={i} src={p} alt={`원본 사진 ${i + 1}`} className="photo-view" />
          ))}
        </div>
      ) : docView ? (
        <DocView>
          <h2 className="print-title">셔플댄스 스텝지</h2>
          <SheetTable title={sheet.song?.title ?? ''} artist={sheet.song?.artist ?? ''} creator={sheet.creator_name} creatorInfo={sheet.creator_info} lines={sheet.lines} memo={sheet.memo} />
        </DocView>
      ) : (
        <FitBox big={big} setBig={setBig}>
          <h2 className="print-title">셔플댄스 스텝지</h2>
          <SheetTable title={sheet.song?.title ?? ''} artist={sheet.song?.artist ?? ''} creator={sheet.creator_name} creatorInfo={sheet.creator_info} lines={sheet.lines} memo={sheet.memo} big={big} onMemo={canEdit ? editMemo : undefined} activeIndex={activeIndex} onLine={hasSync ? onLine : undefined} />
        </FitBox>
      )}

      {playingYt && ytId && <YouTubePlayer videoId={ytId} name={sheet.song?.title ?? ''} onTime={setT} handle={player} extra={syncBtn} />}
      {hasFile && !playingYt && <Player src={audio} name={sheet.song?.title ?? ''} video={fileIsVideo} onTime={setT} handle={player} extra={syncBtn} />}
      {isExternal && (
        <div className="bottom no-print">
          <a className="btn block" href={sheet.audio_url!} target="_blank" rel="noreferrer">
            음원 링크 열기
          </a>
        </div>
      )}
    </div>
  )
}

/** 자식(스텝지)을 남은 화면 높이에 맞게: 짧으면 큰 글씨 모드, 길면 축소해서 스크롤 없이 한 화면에 */
function FitBox({ children, big, setBig }: { children: React.ReactNode; big: boolean; setBig: (b: boolean) => void }) {
  const box = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [height, setHeight] = useState<number>()

  useLayoutEffect(() => {
    const b = box.current
    const i = inner.current
    if (!b || !i) return
    const calc = () => {
      const bh = b.clientHeight
      const ih = i.offsetHeight
      if (!bh || !ih) return
      // 큰 글씨 모드는 높이가 약 1.35배. 여유가 충분하면 켜고, 넘치면 끈다(흔들림 방지용 여유 포함)
      if (!big && ih * 1.45 < bh) return setBig(true)
      if (big && ih > bh * 1.2) return setBig(false)
      const s = Math.min(1, bh / ih)
      setScale(s)
      setHeight(ih * s)
    }
    calc()
    const ro = new ResizeObserver(calc)
    ro.observe(b)
    ro.observe(i)
    return () => ro.disconnect()
  }, [children, big, setBig])

  return (
    <div className="fit" ref={box}>
      <div className="fit-wrap" style={{ height }}>
        <div className="fit-inner" ref={inner} style={{ transform: `scale(${scale})` }}>
          {children}
        </div>
      </div>
    </div>
  )
}

/** 인쇄될 모습 그대로(A4 종이) 화면에서 보기 — 폭에 맞춰 축소, 세로 스크롤 */
function DocView({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const fit = () => setScale(Math.min(1, (el.clientWidth - 24) / 794))
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return (
    <div className="docview" ref={ref}>
      <div className="paper-wrap" style={{ height: 1123 * scale + 24 }}>
        <div className="paper" style={{ transform: `scale(${scale})` }}>{children}</div>
      </div>
    </div>
  )
}
