import { useEffect, useLayoutEffect, useState } from 'react'
import { markTour, tourDone, type TourName } from '../lib/tour'

export type TourStep = { sel: string; title: string; desc: string }
type Box = { top: number; left: number; width: number; height: number }

/**
 * 화면 둘러보기: 실제 화면 위에서 버튼 하나씩 동그랗게 비추며 설명. 한 번 보면(끝내기·건너뛰기) 다시 안 나옴.
 * 화면에 없는 대상(권한이 없어 안 보이는 버튼 등)은 건너뛴다.
 */
export default function Tour({ name, steps, ready = true }: { name: TourName; steps: TourStep[]; ready?: boolean }) {
  const [i, setI] = useState(0)
  const [show, setShow] = useState(() => !tourDone(name))
  const [box, setBox] = useState<Box | null>(null)
  const step = steps[i]

  // 대상 찾기: 없으면 다음 단계로, 끝까지 없으면 종료
  useLayoutEffect(() => {
    if (!show || !ready) return
    let k = i
    let el: Element | null = null
    while (k < steps.length && !(el = document.querySelector(steps[k].sel))) k++
    if (!el) {
      markTour(name)
      setShow(false)
      return
    }
    if (k !== i) {
      setI(k)
      return
    }
    const target = el
    const measure = () => {
      const r = target.getBoundingClientRect()
      setBox({ top: r.top, left: r.left, width: r.width, height: r.height })
    }
    target.scrollIntoView({ block: 'center', inline: 'nearest' })
    const t = setTimeout(measure, 260)
    measure()
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      clearTimeout(t)
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [show, ready, i, steps, name])

  useEffect(() => {
    if (!show) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && finish()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show])

  if (!show || !ready || !step || !box) return null
  const finish = () => {
    markTour(name)
    setShow(false)
  }
  const last = i >= steps.length - 1 || !steps.slice(i + 1).some((s) => document.querySelector(s.sel))
  const pad = 6
  const below = box.top + box.height + 190 < window.innerHeight
  const cardStyle = below ? { top: box.top + box.height + pad + 12 } : { bottom: window.innerHeight - box.top + pad + 12 }
  return (
    <div className="tour" role="dialog" aria-modal="true" aria-label="화면 둘러보기" onClick={(e) => e.stopPropagation()}>
      <div className="tour-hole" style={{ top: box.top - pad, left: box.left - pad, width: box.width + pad * 2, height: box.height + pad * 2 }} />
      <div className={below ? 'tour-card below' : 'tour-card above'} style={cardStyle}>
        <div className="tour-step">
          {i + 1} / {steps.length}
        </div>
        <h3>{step.title}</h3>
        <p>{step.desc}</p>
        <div className="tour-actions">
          {!last && (
            <button type="button" className="btn" onClick={finish}>
              그만 보기
            </button>
          )}
          <button type="button" className="btn primary" onClick={() => (last ? finish() : setI(i + 1))}>
            {last ? '알겠어요' : '다음'}
          </button>
        </div>
      </div>
    </div>
  )
}
