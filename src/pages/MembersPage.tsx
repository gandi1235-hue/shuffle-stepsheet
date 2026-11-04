import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import TopBar from '../components/TopBar'
import { useToast } from '../components/ui'
import { getFolder, listMembers, removeMember, setMemberRole, type Member } from '../lib/api'
import { useAuth } from '../lib/auth'
import type { Folder, Role } from '../lib/types'

export default function MembersPage() {
  const { id = '' } = useParams()
  const { session } = useAuth()
  const [folder, setFolder] = useState<Folder | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [err, setErr] = useState('')
  const toast = useToast()

  const load = () => listMembers(id).then(setMembers).catch((e) => setErr(e.message))
  useEffect(() => {
    getFolder(id).then(setFolder)
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const isOwner = folder?.role === 'owner'
  const invite = async () => {
    if (!folder?.invite_code) return
    const text = `[스텝지함] "${folder.name}" 폴더 초대\n앱: ${window.location.href.split('#')[0]}\n초대 코드: ${folder.invite_code}\n앱에 들어가 "초대 코드로 참여"를 누르고 코드를 넣어 주세요.`
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

  const kick = async (m: Member) => {
    if (!confirm(`${m.display_name} 님을 폴더에서 내보낼까요?`)) return
    await removeMember(id, m.user_id)
    load()
  }

  return (
    <div className="screen">
      <TopBar title={`${folder?.name ?? ''} 멤버`} sub={`${members.length}명`} back="/" />
      <div className="content">
        {isOwner && (
          <>
            <button type="button" className="btn primary block" onClick={invite}>
              카카오톡으로 초대하기
            </button>
            <div className="notice">
              초대 코드 <b>{folder?.invite_code}</b> · 새로 들어온 사람은 "보기" 권한으로 시작해요. 아래에서 편집자로 바꿀 수 있어요.
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
      </div>
    </div>
  )
}
