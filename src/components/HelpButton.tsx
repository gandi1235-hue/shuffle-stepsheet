import { useState } from 'react'
import { Help } from './Icons'
import { Sheet as Modal } from './ui'
import { HELP, type HelpPage } from '../lib/help'

/** 화면마다 오른쪽 위 ? 버튼: 이 화면에서 궁금할 만한 것 짧은 Q&A */
export default function HelpButton({ page }: { page: HelpPage }) {
  const [open, setOpen] = useState(false)
  const h = HELP[page]
  return (
    <>
      <button type="button" className="iconbtn" aria-label="이 화면 사용법" onClick={() => setOpen(true)}>
        <Help />
      </button>
      <Modal open={open} title={`${h.title} · 궁금한 것`} onClose={() => setOpen(false)}>
        <div className="help-list">
          {h.items.map((it) => (
            <div className="help-item" key={it.q}>
              <div className="help-q">{it.q}</div>
              <ul className="help-a">
                {it.a.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Modal>
    </>
  )
}
