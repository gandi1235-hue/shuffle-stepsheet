import { fmtBeats, kindOf, sheetStats, type Line, type Note } from '../lib/types'

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
  /** 노래 동기화: 지금 재생 중인 줄(lines 인덱스) */
  activeIndex?: number
  /** 줄을 누르면 (lines 인덱스) */
  onLine?: (index: number) => void
  /** 줄별 시작 시각(초) 표시 */
  marks?: (number | null)[]
  /** 머리말(제목·창작자 표) 없이 줄만 (영상과 같이 볼 때) */
  noHead?: boolean
}

const mmss = (t: number) => `${Math.floor(t / 60)}:${Math.floor(t % 60).toString().padStart(2, '0')}`

const NOTE_PREFIX: Partial<Record<NonNullable<Note['type']>, string>> = { hand_motion: '손동작', caution: '주의' }

/** 셔플박스 표준 양식: 머리말 + 번호 줄(스텝명 박수 / …) + 파란 해설. 검정·파랑·회색만 씀. 화면·문서·인쇄 공용 */
export default function SheetTable({ title, artist, creator, creatorInfo, lines, memo, big, onMemo, activeIndex, onLine, marks, noHead }: Props) {
  const st = sheetStats(lines)
  let n = 0
  const rows = lines
    .map((l, index) => ({ l, kind: kindOf(l), index }))
    .filter(({ l, kind }) => (kind === 'steps' ? l.steps.some((s) => s.name.trim()) || l.notes?.length : (l.label ?? '').trim() || l.notes?.length))
  return (
    <div className={big ? 'form big' : 'form'}>
      {!noHead && (
      <div className="form-head">
        <div className="k">제목</div>
        <div className="v">
          <b>{title}</b>
          {artist && <span className="sub">{artist}</span>}
        </div>
        <div className="k">창작자</div>
        <div className="v">
          <b>{creator}</b>
          {creatorInfo && <span className="sub">{creatorInfo}</span>}
        </div>
      </div>
      )}

      <ol className="form-body">
        {rows.map(({ l, kind, index }, i) => {
          const mark = marks?.[index]
          if (kind === 'section') {
            n = 0
            return (
              <li className="sec" key={i}>
                {l.label}
                <Notes notes={l.notes} />
              </li>
            )
          }
          const no = kind === 'steps' ? String(++n) : kind === 'repeat' ? '↻' : ''
          const cls = ['line', kind, activeIndex === index ? 'now' : '', onLine && kind === 'steps' ? 'tap' : ''].filter(Boolean).join(' ')
          return (
            <li className={cls} key={i} onClick={onLine && kind === 'steps' ? () => onLine(index) : undefined}>
              <span className="no">{no}</span>
              <div className="body">
                {kind === 'steps' ? (
                  <div className="main">
                    {l.steps
                      .filter((s) => s.name.trim())
                      .map((s, j) => (
                        <span className="st" key={j}>
                          {j > 0 && <span className="sep">/</span>}
                          <span className={s.uncertain ? 'name uncertain' : 'name'} title={s.raw && s.raw !== s.name ? `원문: ${s.raw}` : undefined}>
                            {s.name}
                          </span>
                          {s.beats && <span className="beats">{fmtBeats(s.beats)}</span>}
                        </span>
                      ))}
                  </div>
                ) : (
                  <div className="main">{l.label}</div>
                )}
                <Notes notes={l.notes} />
              </div>
              {marks && kind === 'steps' && <span className={typeof mark === 'number' ? 'mark' : 'mark empty'}>{typeof mark === 'number' ? mmss(mark) : '–'}</span>}
            </li>
          )
        })}
      </ol>

      {(memo || onMemo) && (
        <div className={onMemo ? 'form-memo tap' : 'form-memo'} onClick={onMemo} role={onMemo ? 'button' : undefined}>
          <span className="k">비고</span>
          <span className={memo ? '' : 'ph no-print'}>{memo || '+ 메모 적기'}</span>
        </div>
      )}
      <div className="form-stats">
        <span>{st.lines}줄</span>
        <span>{st.steps}스텝</span>
        {st.beats > 0 && <span>{st.beats}박</span>}
      </div>
    </div>
  )
}

function Notes({ notes }: { notes?: Note[] }) {
  if (!notes?.length) return null
  return (
    <>
      {notes.map((nt, k) => {
        const pre = nt.type ? NOTE_PREFIX[nt.type] : undefined
        return (
          <div className={`note ${nt.type ?? 'note'}`} key={k}>
            {pre && <span className="tag">{pre}</span>}
            {nt.text}
          </div>
        )
      })}
    </>
  )
}
