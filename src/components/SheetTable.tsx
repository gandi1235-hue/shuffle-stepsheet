import { sheetStats, type Line } from '../lib/types'

interface Props {
  title: string
  artist: string
  creator: string
  creatorInfo?: string
  lines: Line[]
  memo?: string
  big?: boolean
  /** 있으면 참고 줄을 눌러 메모를 고칠 수 있음 */
  onMemo?: () => void
}

/** 대한셔플댄스협회 스텝지 양식: 머리말 표 + 한 줄에 스텝 1~2개 (N박). 화면·인쇄 공용 */
export default function SheetTable({ title, artist, creator, creatorInfo, lines, memo, big, onMemo }: Props) {
  const st = sheetStats(lines)
  const rows = lines.map((l) => l.steps.filter((s) => s.name.trim()))
  return (
    <div className={big ? 'form big' : 'form'}>
      <div className="form-head">
        <div className="k">응시자</div>
        <div className="v">
          <b>{creator}</b>
          {creatorInfo && <span className="sub">{creatorInfo}</span>}
        </div>
        <div className="k">안무곡</div>
        <div className="v">
          <b>{title}</b>
          {artist && <span className="sub">{artist}</span>}
        </div>
      </div>

      <ol className="form-body">
        {rows.map((steps, i) => (
          <li className={steps.length > 1 ? 'line two' : 'line'} key={i}>
            <span className="no">{i + 1}</span>
            {steps.map((s, j) => (
              <span className="st" key={j}>
                <span className={s.uncertain ? 'name uncertain' : 'name'}>{s.name}</span>
                {s.beats && <span className="beats">{s.beats}</span>}
              </span>
            ))}
          </li>
        ))}
        <li className="line end">
          <span className="no" />
          <span className="st">
            <span className="name">마무리</span>
          </span>
        </li>
      </ol>

      {(memo || onMemo) && (
        <div className={onMemo ? 'form-memo tap' : 'form-memo'} onClick={onMemo} role={onMemo ? 'button' : undefined}>
          <span className="k">참고</span>
          <span className={memo ? '' : 'ph no-print'}>{memo || '+ 메모 적기'}</span>
        </div>
      )}
      <div className="form-stats">
        <span>{st.lines}줄</span>
        <span>{st.steps}스텝</span>
        <span>{st.beats}박</span>
      </div>
    </div>
  )
}
