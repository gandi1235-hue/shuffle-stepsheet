import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import TopBar from '../components/TopBar'
import HelpButton from '../components/HelpButton'
import { useToast } from '../components/ui'
import { deleteFolder, getFolder, leaveFolder, listMembers, renameFolder } from '../lib/api'
import type { Folder } from '../lib/types'

/** 폴더 편집: 이름 바꾸기 · 폴더 없애기(주인) · 폴더에서 나가기(멤버). 멤버 관리는 따로(멤버 화면) */
export default function FolderEditPage() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const toast = useToast()
  const [folder, setFolder] = useState<Folder | null>(null)
  const [name, setName] = useState('')
  const [memberCount, setMemberCount] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    getFolder(id)
      .then((f) => {
        setFolder(f)
        setName(f?.name ?? '')
      })
      .catch((e) => setErr(e.message))
    listMembers(id)
      .then((m) => setMemberCount(m.length))
      .catch(() => setMemberCount(null))
  }, [id])

  const isOwner = folder?.role === 'owner'
  const shared = folder?.kind === 'shared'

  const rename = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!folder) return
    const v = name.trim()
    if (!v || v === folder.name) return
    setBusy(true)
    try {
      await renameFolder(id, v)
      setFolder({ ...folder, name: v })
      toast('폴더 이름을 바꿨어요')
    } catch (er) {
      setErr((er as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!folder) return
    const n = memberCount ?? 1
    if (!confirm(`"${folder.name}" 폴더를 정말 없앨까요?\n\n안에 있는 스텝지·음원·사진이 모두 지워지고, 멤버 ${n}명 모두에게서 사라져요. 되돌릴 수 없어요.`)) return
    const typed = prompt(`정말 없애려면 폴더 이름을 똑같이 적어 주세요.\n(${folder.name})`)
    if (typed === null) return
    if (typed.trim() !== folder.name) return toast('이름이 달라서 없애지 않았어요')
    setBusy(true)
    try {
      await deleteFolder(id)
      toast('폴더를 없앴어요')
      nav('/library', { replace: true })
    } catch (er) {
      setErr((er as Error).message)
      setBusy(false)
    }
  }

  const leave = async () => {
    if (!folder) return
    if (!confirm(`"${folder.name}" 폴더에서 나갈까요?\n다시 들어오려면 초대 링크가 필요해요.`)) return
    setBusy(true)
    try {
      await leaveFolder(id)
      toast('폴더에서 나왔어요')
      nav('/library', { replace: true })
    } catch (er) {
      setErr((er as Error).message)
      setBusy(false)
    }
  }

  return (
    <div className="screen">
      <TopBar title="폴더 편집" sub={folder?.name} back={`/folder/${id}`} right={<HelpButton page="folderEdit" />} />
      <div className="content">
        {err && <div className="error">{err}</div>}

        <section className="panel">
          <div className="panel-title">폴더 이름</div>
          {isOwner ? (
            <form className="editrow" onSubmit={rename}>
              <input aria-label="폴더 이름" value={name} onChange={(e) => setName(e.target.value)} maxLength={30} />
              <button type="submit" className="btn primary" disabled={busy || !name.trim() || name.trim() === folder?.name}>
                바꾸기
              </button>
            </form>
          ) : (
            <div className="panel-desc">이름은 폴더 주인만 바꿀 수 있어요.</div>
          )}
        </section>

        {shared && (
          <section className="panel">
            <div className="panel-title">멤버</div>
            <div className="panel-desc">{memberCount === null ? '…' : `${memberCount}명`} · 초대, 권한 바꾸기, 내보내기는 멤버 화면에서 해요.</div>
            <Link to={`/folder/${id}/members`} className="btn block">
              멤버 관리로 가기
            </Link>
          </section>
        )}

        <section className="panel">
          <div className="panel-title">{shared ? (isOwner ? '폴더 없애기' : '폴더에서 나가기') : '내 개인 폴더'}</div>
          {!shared && <div className="panel-desc">개인 폴더는 없앨 수 없어요. 스텝지는 한 장씩 지울 수 있어요.</div>}
          {shared && isOwner && (
            <>
              <div className="panel-desc">없애면 안의 스텝지가 모두 지워지고 멤버 모두에게서 사라져요. 폴더를 남기고 싶으면 멤버 화면에서 주인을 다른 분께 넘긴 뒤 나가세요.</div>
              <button type="button" className="btn danger block" onClick={remove} disabled={busy}>
                이 폴더 없애기
              </button>
            </>
          )}
          {shared && !isOwner && (
            <button type="button" className="btn danger block" onClick={leave} disabled={busy}>
              이 폴더에서 나가기
            </button>
          )}
        </section>
      </div>
    </div>
  )
}
