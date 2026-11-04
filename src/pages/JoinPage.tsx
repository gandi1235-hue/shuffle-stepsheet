import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useToast } from '../components/ui'
import { joinFolder } from '../lib/api'
import { PENDING_JOIN } from '../lib/share'

/** 초대 링크(#/join/코드)로 들어오면 폴더에 바로 참여시키고 그 폴더로 */
export default function JoinPage() {
  const { code = '' } = useParams()
  const nav = useNavigate()
  const toast = useToast()
  const [err, setErr] = useState('')

  useEffect(() => {
    localStorage.removeItem(PENDING_JOIN)
    joinFolder(code)
      .then((id) => {
        toast('폴더에 들어왔어요')
        nav(`/folder/${id}`, { replace: true })
      })
      .catch((e: Error) => setErr(e.message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code])

  return (
    <div className="screen">
      <div className="content" style={{ paddingTop: 40, textAlign: 'center' }}>
        {err ? (
          <>
            <div className="error">초대 코드 {code}로 들어가지 못했어요: {err}</div>
            <button type="button" className="btn block" onClick={() => nav('/library', { replace: true })}>
              스텝지함으로
            </button>
          </>
        ) : (
          <div className="spinner">폴더에 들어가는 중…</div>
        )}
      </div>
    </div>
  )
}
