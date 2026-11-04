import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Back } from './Icons'

export default function TopBar({ title, sub, back, right }: { title: string; sub?: string; back?: string | boolean; right?: ReactNode }) {
  const nav = useNavigate()
  return (
    <div className="topbar">
      {back && (
        <button type="button" className="iconbtn plain" aria-label="뒤로" onClick={() => (typeof back === 'string' ? nav(back) : nav(-1))}>
          <Back />
        </button>
      )}
      <h1>
        {title}
        {sub && (
          <>
            <br />
            <span className="sub">{sub}</span>
          </>
        )}
      </h1>
      {right}
    </div>
  )
}
