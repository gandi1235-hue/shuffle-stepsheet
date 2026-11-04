import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { FOLDER_INVITE_TEXT } from '../lib/share'
import TopBar from '../components/TopBar'
import { useToast } from '../components/ui'
import { deleteFolder, getFolder, leaveFolder, listMembers, removeMember, renameFolder, setMemberRole, transferOwner, type Member } from '../lib/api'
import { useAuth } from '../lib/auth'
import type { Folder, Role } from '../lib/types'

export default function MembersPage() {
  const { id = '' } = useParams()
  const { session } = useAuth()
  const [folder, setFolder] = useState<Folder | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [err, setErr] = useState('')
  const toast = useToast()
  const nav = useNavigate()

  const load = () => listMembers(id).then(setMembers).catch((e) => setErr(e.message))
  useEffect(() => {
    getFolder(id).then(setFolder)
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const isOwner = folder?.role === 'owner'
  const invite = async () => {
    if (!folder?.invite_code) return
    const text = FOLDER_INVITE_TEXT(folder.name, folder.invite_code)
    if (navigator.share) await navigator.share({ text }).catch(() => undefined)
    else {
      await navigator.clipboard.writeText(text)
      toast('초대 글을 복사했어요. 카카오톡에 붙여 넣으세요.')
    }
  }

  const change = async (m: Member, role: Role) => {
    try {
      await setMemberRole(id, m.user_id, role)
      load()
    } catch (e) {
      setErr((e as Error).message)
    }
  }

  const rename = async () => {
    if (!folder) return
    const v = prompt('폴더 이름', folder.name)?.trim()
    if (!v || v === folder.name) return
    try {
      await renameFolder(id, v)
      load()
      toast('이름을 바꿨어요')
    } catch (e) {
      setErr((e as Error).message)
    }
  }
  const remove = async () => {
    if (!folder) return
    if (!confirm(`"${folder.name}" 폴더를 없앨까요?\n안에 있는 스텝지·음원·사진이 모두 지워지고, 멤버 ${members.length}명 모두에게서 사라져요. 되돌릴 수 없어요.`)) return
    if (prompt('정말 없애려면 폴더 이름을 똑같이 적어 주세요.') !== folder.name) return
    try {
      await deleteFolder(id)
      toast('폴더를 없앴어요')
      nav('/library', { replace: true })
    } catch (e) {
      setErr((e as Error).message)
    }
  }
  const leave = async () => {
    if (!folder) return
    if (!confirm(`"${folder.name}" 폴더에서 나갈까요?\n다시 들어오려면 초대 링크가 필요해요.`)) return
    try {
      await leaveFolder(id)
      toast('폴더에서 나왔어요')
      nav('/library', { replace: true })
    } catch (e) {
      setErr((e as Error).message)
    }
  }
  const handOver = async (m: Member) => {
    if (!confirm(`${m.display_name} 님을 이 폴더의 주인으로 바꿀까요?\n나는 편집자가 되고, 멤버 초대·내보내기는 새 주인만 할 수 있어요.`)) return
    try {
      await transferOwner(id, m.user_id)
      toast(`${m.display_name} 님이 주인이 됐어요`)
      getFolder(id).then(setFolder)
      load()
    } catch (e) {
      setErr((e as Error).message)
    }
  }

  const kick = async (m: Member) => {
    if (!confirm(`${m.display_name} 님을 폴더에서 내보낼까요?`)) return
    await removeMember(id, m.user_id)
    load()
  }

  return (
    <div className="screen">
      <TopBar title={`${folder?.name ?? ''} 멤버`} sub={`${members.length}명`} back="/library" />
      <div className="content">
        {isOwner && (
          <>
            <button type="button" className="btn primary block" onClick={invite}>
              카카오톡으로 초대하기
            </button>
            <div className="notice">
              초대 코드 <b>{folder?.invite_code}</b> · 새로 들어온 사람은 "보기" 권한으로 시작해요. 아래에서 편집자로 바꾸거나, 폴더 주인을 다른 분께 넘길 수 있어요.
            </div>
          </>
        )}
        {err && <div className="error">{err}</div>}
        <div>
          {members.map((m) => (
            <div className="member" key={m.user_id}>
              <span className="nm">
                {m.display_name || '이름 없음'}
                {m.user_id === session?.user.id && <span style={{ color: 'var(--faint)', fontSize: 14 }}> (나)</span>}
              </span>
              {isOwner && m.role !== 'owner' ? (
                <>
                  <select aria-label="권한" value={m.role} onChange={(e) => change(m, e.target.value as Role)}>
                    <option value="editor">편집자</option>
                    <option value="viewer">보기만</option>
                  </select>
                  <button type="button" className="btn" style={{ minHeight: 40 }} onClick={() => handOver(m)}>
                    주인으로
                  </button>
                  <button type="button" className="btn danger" style={{ minHeight: 40 }} onClick={() => kick(m)}>
                    내보내기
                  </button>
                </>
              ) : (
                <span className="chip accent">{m.role === 'owner' ? '주인' : m.role === 'editor' ? '편집자' : '보기만'}</span>
              )}
            </div>
          ))}
        </div>

        <section className="panel">
          <div className="panel-title">폴더 관리</div>
          {isOwner ? (
            <>
              <button type="button" className="btn block" onClick={rename}>
                폴더 이름 바꾸기
              </button>
              <div className="panel-desc">폴더를 없애려면 멤버 모두에게서 사라져요. 주인을 다른 분께 넘긴 뒤 나가는 방법도 있어요.</div>
              <button type="button" className="btn danger block" onClick={remove}>
                폴더 없애기
              </button>
            </>
          ) : (
            <button type="button" className="btn danger block" onClick={leave}>
              이 폴더에서 나가기
            </button>
          )}
        </section>
      </div>
    </div>
  )
}
