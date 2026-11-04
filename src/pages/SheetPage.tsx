import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Player from '../components/Player'
import SheetTable from '../components/SheetTable'
import TopBar from '../components/TopBar'
import { Close, Edit, Photo, Print, Share } from '../components/Icons'
import { deleteSheet, getFolder, getSheet, signedUrl } from '../lib/api'
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
  const [err, setErr] = useState('')

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

  useEffect(() => {
    let lock: { release: () => void } | null = null
    const n = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => void }> } }
    n.wakeLock?.request('screen').then((l) => (lock = l)).catch(() => undefined)
    return () => lock?.release()
  }, [])

  if (err) return <div className="error">{err}</div>
  if (!sheet) return <div className="spinner">불러오는 중…</div>

  const canEdit = folder?.role === 'owner' || folder?.role === 'editor'
    const isExternal = !sheet.audio_path && Boolean(sheet.audio_url)

  const share = async () => {
    const url = window.location.href
    const text = `${sheet.song?.title ?? ''} 스텝지 (창작 ${sheet.creator_name})`
    if (navigator.share) await navigator.share({ title: text, url }).catch(() => undefined)
    else {
      await navigator.clipboard.writeText(url)
      alert('링크를 복사했어요. 카카오톡에 붙여 넣어 주세요.')
    }
  }

  const remove = async () => {
    if (!confirm('이 스텝지를 삭제할까요? 되돌릴 수 없어요.')) return
    await deleteSheet(sheet.id)
    nav(`/folder/${sheet.folder_id}`)
  }

  if (big)
    return (
      <div className="screen">
        <div className="topbar">
          <h1>{sheet.song?.title}</h1>
          <button type="button" className="iconbtn" aria-label="크게 보기 닫기" onClick={() => setBig(false)}>
            <Close />
          </button>
        </div>
        <div className="content">
          <SheetTable title={sheet.song?.title ?? ''} artist={sheet.song?.artist ?? ''} creator={sheet.creator_name} creatorInfo={sheet.creator_info} lines={sheet.lines} memo={sheet.memo} big />
        </div>
        {audio && <Player src={audio} name={sheet.song?.title ?? ''} />}
      </div>
    )

  return (
    <div className="screen">
      <TopBar
        title={folder?.name ?? ''}
        back={`/folder/${sheet.folder_id}`}
        right={
          <>
            {photos.length > 0 && (
              <button type="button" className="iconbtn" aria-label="원본 사진 보기" onClick={() => setShowPhotos(!showPhotos)}>
                <Photo />
              </button>
            )}
            {canEdit && (
              <button type="button" className="iconbtn" aria-label="수정" onClick={() => nav(`/edit/${sheet.id}`)}>
                <Edit />
              </button>
            )}
            <button type="button" className="iconbtn" aria-label="인쇄" onClick={() => window.print()}>
              <Print />
            </button>
            <button type="button" className="iconbtn" aria-label="공유" onClick={share}>
              <Share />
            </button>
          </>
        }
      />
      <div className="content">
        {showPhotos && (
          <div className="list">
            {photos.map((p, i) => (
              <img key={i} src={p} alt={`원본 사진 ${i + 1}`} className="photo-view" />
            ))}
          </div>
        )}

        <h2 className="print-title">셔플댄스 스텝지</h2>
        <SheetTable title={sheet.song?.title ?? ''} artist={sheet.song?.artist ?? ''} creator={sheet.creator_name} creatorInfo={sheet.creator_info} lines={sheet.lines} memo={sheet.memo} />

        {isExternal && (
          <a className="btn block" href={sheet.audio_url!} target="_blank" rel="noreferrer">
            음원 링크 열기
          </a>
        )}
        {!audio && !isExternal && <div className="notice">아직 붙인 음원이 없어요. {canEdit && '수정에서 음원 파일을 붙일 수 있어요.'}</div>}
        {!audio && (
          <button type="button" className="btn block" onClick={() => setBig(true)}>
            크게 보기
          </button>
        )}
        {canEdit && (
          <button type="button" className="btn danger block" onClick={remove}>
            이 스텝지 삭제
          </button>
        )}
      </div>
      {audio && !isExternal && <Player src={audio} name={sheet.song?.title ?? ''} onBig={() => setBig(true)} />}
    </div>
  )
}
