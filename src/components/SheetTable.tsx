import type { Section } from '../lib/types'

export default function SheetTable({ sections, big }: { sections: Section[]; big?: boolean }) {
  let n = 0
  return (
    <div className={big ? 'sheet big' : 'sheet'}>
      <div className="hrow">
        <div>No</div>
        <div>스텝</div>
        <div className="r">카운트</div>
        <div className="r">방향</div>
      </div>
      {sections.map((sec, i) => (
        <div key={i}>
          {(sections.length > 1 || sec.name) && <div className="sec">{sec.name || '본문'}</div>}
          {sec.steps.map((st, j) => {
            n += 1
            return (
              <div className="srow" key={j}>
                <div className="no">{n}</div>
                <div className="nm">{st.uncertain ? <span className="uncertain">{st.name}</span> : st.name}</div>
                <div className="r">{st.count}</div>
                <div className="r dir">{st.direction}</div>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
