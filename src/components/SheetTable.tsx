import { sheetStats, type Line } from '../lib/types'

interface Props {
  title: string
  artist: string
  creator: string
  creatorInfo?: string
  lines: Line[]
  memo?: string
  big?: boolean
}

/** 대한셔플댄스협회 스텝지 양식: 머리말 표 + 한 줄에 스텝 1~2개 (N박) */
export default function SheetTable({ title, artist, creator, creatorInfo, lines, memo, big }: Props) {
  const st = sheetStats(lines)
  return (
    <div className={big ? 'form big' : 'form'}>
      <div className="form-head">
        <div className="k">응시자</div>
        <div className="v">{[creator, creatorInfo].filter(Boolean).join('/')}</div>
        <div className="k">안무곡</div>
        <div className="v">
          {title}
          {artist ? ` / ${artist}` : ''}
        </div>
      </div>
      <div className="form-body">
        {lines.map((l, i) => (
          <div className="line" key={i}>
            {l.steps
              .filter((s) => s.name.trim())
              .map((s, j) => (
                <span className="st" key={j}>
                  <span className={s.uncertain ? 'uncertain' : ''}>{s.name}</span>
                  {s.beats && <span className="beats"> ({s.beats})</span>}
                </span>
              ))}
          </div>
        ))}
        <div className="line">마무리</div>
        {memo && <div className="line memo-line">참고: {memo}</div>}
      </div>
      <div className="form-stats">
        총 {st.lines}줄 · {st.steps}스텝 · {st.beats}박
      </div>
    </div>
  )
}
