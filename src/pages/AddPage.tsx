import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import TopBar from '../components/TopBar'
import DeepToggle from '../components/DeepToggle'
import { Sheet as Modal, useToast } from '../components/ui'
import { haptic } from '../lib/prefs'
import { Camera, Chevron, Folder as FolderIcon, Music, Photo } from '../components/Icons'
import { copySheet, deleteSheet, editLines, findDuplicate, getSheet, guessArtist, listFolders, listSongs, recognize, saveSheet, type SongWithSheets } from '../lib/api'
import { useSpeech } from '../lib/speech'
import { LINE_KINDS, NOTE_TYPES, emptyLine, emptyRecognized, eventsOf, kindOf, lineToText, parseLineText, type Folder, type Line, type LineKind, type NoteType, type Recognized } from '../lib/types'

type Stage = 'photo' | 'recognizing' | 'edit' | 'saving'

export default function AddPage() {
  const nav = useNavigate()
  const { id: editId } = useParams()
  const [params] = useSearchParams()
  const [folders, setFolders] = useState<Folder[]>([])
  const [folderId, setFolderId] = useState(params.get('folder') ?? '')
  const [stage, setStage] = useState<Stage>(editId ? 'edit' : 'photo')
  const [files, setFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [data, setData] = useState<Recognized>(emptyRecognized())
  /** 스텝 줄의 입력 글(타이핑 중 모양 유지용). 줄 index → 글 */
  const [texts, setTexts] = useState<Record<number, string>>({})
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [audioUrl, setAudioUrl] = useState('')
  const [hasAudioPath, setHasAudioPath] = useState(false)
  const [hasSync, setHasSync] = useState(false)
  const [err, setErr] = useState('')
  const camRef = useRef<HTMLInputElement>(null)
  // ── 말로 고치기(AI가 줄 내용을 직접 바꿈) ──
  const [askOpen, setAskOpen] = useState(false)
  const [barMode, setBarMode] = useState(false) // 8박 찍기: 스텝을 누르면 그 스텝에서 한 구절이 끝난다는 도장
  const [askText, setAskText] = useState('')
  const [asking, setAsking] = useState(false)
  const [askNote, setAskNote] = useState('')
  const [undoLines, setUndoLines] = useState<Line[] | null>(null)
  const applyAsk = async () => {
    const q = askText.trim()
    if (!q) return
    setAsking(true)
    try {
      const r = await editLines(data.lines, data.memo, q)
      if (!r.lines || r.unclear) {
        toast(r.unclear || '요청을 이해하지 못했어요')
        return
      }
      setUndoLines(data.lines)
      setData({ ...data, lines: r.lines.length ? r.lines : [emptyLine()] })
      setTexts({})
      setAskNote(r.note)
      setAskText('')
      setAskOpen(false)
      haptic(15)
      toast(r.note ? `고쳤어요: ${r.note}` : '고쳤어요')
    } catch (e) {
      toast((e as Error).message)
    } finally {
      setAsking(false)
    }
  }
  const undoAsk = () => {
    if (!undoLines) return
    setData({ ...data, lines: undoLines })
    setTexts({})
    setUndoLines(null)
    setAskNote('')
    toast('되돌렸어요')
  }
  // ── 다른 폴더에서 불러오기(복사) ──
  const [allFolders, setAllFolders] = useState<Folder[]>([])
  const [importOpen, setImportOpen] = useState(false)
  const [srcFolder, setSrcFolder] = useState('')
  const [srcSongs, setSrcSongs] = useState<SongWithSheets[] | null>(null)
  const [importing, setImporting] = useState('')
  const openImport = () => {
    setImportOpen(true)
    const first = allFolders.find((f) => f.id !== folderId)
    if (!srcFolder && first) setSrcFolder(first.id)
  }
  useEffect(() => {
    if (!importOpen || !srcFolder) return
    setSrcSongs(null)
    listSongs(srcFolder)
      .then(setSrcSongs)
      .catch(() => setSrcSongs([]))
  }, [importOpen, srcFolder])
  const importSheet = async (sheetId: string, title: string) => {
    if (!folderId) return toast('저장할 폴더를 골라 주세요')
    setImporting(sheetId)
    try {
      const saved = await copySheet(sheetId, folderId)
      haptic(20)
      toast(`"${title}" 스텝지를 불러왔어요`)
      nav(`/sheet/${saved.id}`, { replace: true })
    } catch (e) {
      toast((e as Error).message)
    } finally {
      setImporting('')
    }
  }
  const fileRef = useRef<HTMLInputElement>(null)
  const toast = useToast()
  const speech = useSpeech((t) => setAskText((q) => `${q}${q && !q.endsWith(' ') ? ' ' : ''}${t}`), toast, '셔플댄스 스텝지를 고치는 요청. 스텝 이름(런닝맨, 티스텝, 찰스턴, 크리스크로스, 글라이드, 킥볼체인지), 박수(4박, 8박), 줄 번호가 자주 나옴.')
  const hasAudio = hasAudioPath || Boolean(audioFile) || Boolean(audioUrl.trim())

  useEffect(() => {
    listFolders().then((fs) => {
      setAllFolders(fs)
      const editable = fs.filter((f) => f.role === 'owner' || f.role === 'editor')
      setFolders(editable)
      // 편집 중엔 원래 폴더를 그대로 둔다 (예전엔 여기서 첫 폴더로 바뀌어 스텝지가 개인 폴더로 옮겨지는 버그가 있었음)
      if (!editId) setFolderId((cur) => cur || editable[0]?.id || '')
    })
    if (editId)
      getSheet(editId).then((s) => {
        if (!s) return
        setFolderId(s.folder_id)
        setAudioUrl(s.audio_url ?? '')
        setHasAudioPath(Boolean(s.audio_path))
        setHasSync(eventsOf(s.sync, 'file').length > 0 || eventsOf(s.sync, 'yt').length > 0)
        setData({
          title: s.song?.title ?? '',
          artist: s.song?.artist ?? '',
          creator_name: s.creator_name,
          creator_info: s.creator_info ?? '',
          memo: s.memo,
          lines: s.lines.length ? s.lines : [emptyLine()],
        })
        setTexts({})
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId])

  const pick = (list: FileList | null) => {
    if (!list) return
    const arr = [...files, ...Array.from(list)].slice(0, 6)
    setFiles(arr)
    setPreviews(arr.map((f) => URL.createObjectURL(f)))
  }

  const run = async () => {
    setErr('')
    setStage('recognizing')
    try {
      const r = await recognize(files)
      setData({ ...emptyRecognized(), ...r, lines: r.lines.length ? r.lines : emptyRecognized().lines })
      setTexts({})
      setStage('edit')
    } catch (e) {
      setErr(`사진을 읽지 못했어요: ${(e as Error).message}`)
      setStage('photo')
    }
  }

  const skip = () => {
    setData(emptyRecognized())
    setStage('edit')
  }

  const save = async () => {
    setErr('')
    if (!data.title.trim()) return setErr('노래 제목은 꼭 적어 주세요.')
    if (!data.creator_name.trim()) return setErr('창작자 이름은 꼭 적어 주세요.')
    if (!folderId) return setErr('저장할 폴더를 골라 주세요.')
    const unsure = data.lines.reduce((n, l) => n + l.steps.filter((s) => s.uncertain && s.name.trim()).length, 0)
    if (unsure > 0 && !confirm(`노란 칸(확실하지 않은 글자)이 ${unsure}개 남아 있어요.\n확인: 그대로 저장 (노란 표시는 남아요) / 취소: 돌아가서 고치기`)) return
    setStage('saving')
    try {
      let artist = data.artist.trim()
      if (!artist) {
        artist = await guessArtist(data.title)
        if (artist) setData((d) => ({ ...d, artist }))
      }
      let overwriteId = editId
      if (!editId) {
        const dup = await findDuplicate(folderId, data.title, data.artist, data.creator_name)
        if (dup) {
          const ow = confirm('같은 노래, 같은 창작자의 스텝지가 이미 있어요.\n확인: 덮어쓰기 / 취소: 돌아가서 창작자 이름 바꾸기')
          if (!ow) {
            setStage('edit')
            return
          }
          overwriteId = dup
        }
      }
      const cleaned: Recognized = {
        ...data,
        artist,
        lines: data.lines
          .map((l) => {
            const kind = kindOf(l)
            const notes = (l.notes ?? []).map((n) => ({ ...n, text: n.text.trim() })).filter((n) => n.text)
            const out: Line = { kind, steps: kind === 'steps' ? l.steps.filter((s) => s.name.trim()) : [] }
            if (kind !== 'steps') out.label = (l.label ?? '').trim()
            if (notes.length) out.notes = notes
            return out
          })
          .filter((l) => l.steps.length || (l.label ?? '').trim() || l.notes?.length),
      }
      const saved = await saveSheet({ ...cleaned, folderId, audioFile, audioUrl: audioUrl.trim(), photoFiles: files, overwriteId })
      haptic(20)
      toast(editId ? '수정했어요' : '스텝지를 저장했어요')
      nav(`/sheet/${saved.id}`, { replace: true })
    } catch (e) {
      setErr((e as Error).message)
      setStage('edit')
    }
  }

  const setLine = (i: number, line: Line) => setData((d) => ({ ...d, lines: d.lines.map((l, k) => (k === i ? line : l)) }))
  const lineText = (i: number, l: Line) => texts[i] ?? lineToText(l)
  /** 스텝 줄 글을 고치면 " / "로 나눠 스텝으로 (노란 표시는 사라짐) */
  const setText = (i: number, t: string) => {
    setTexts((x) => ({ ...x, [i]: t }))
    setLine(i, { ...data.lines[i], steps: parseLineText(t) })
  }
  /** 8박 도장 켜고 끄기: 스텝 j 뒤에 " |" */
  const toggleBar = (i: number, j: number) => {
    const l = data.lines[i]
    const steps = l.steps.map((st, k) => (k === j ? { ...st, bar: !st.bar } : st))
    const next = { ...l, steps }
    setLine(i, next)
    setTexts((x) => ({ ...x, [i]: lineToText(next) }))
    haptic(10)
  }
  const shiftTexts = (from: number, delta: number, drop?: number) =>
    setTexts((x) => {
      const o: Record<number, string> = {}
      for (const [k, v] of Object.entries(x)) {
        const n = Number(k)
        if (n === drop) continue
        o[n >= from ? n + delta : n] = v
      }
      return o
    })
  const removeLine = (i: number) => {
    setData((d) => ({ ...d, lines: d.lines.filter((_, k) => k !== i) }))
    shiftTexts(i + 1, -1, i)
  }
  const insertAfter = (i: number, kind: LineKind = 'steps') => {
    setData((d) => ({ ...d, lines: [...d.lines.slice(0, i + 1), emptyLine(kind), ...d.lines.slice(i + 1)] }))
    shiftTexts(i + 1, 1)
  }
  const addLine = (kind: LineKind) => setData((d) => ({ ...d, lines: [...d.lines, emptyLine(kind)] }))
  const cycleKind = (i: number) => {
    const l = data.lines[i]
    const idx = LINE_KINDS.findIndex((k) => k.v === kindOf(l))
    const next = LINE_KINDS[(idx + 1) % LINE_KINDS.length].v
    const label = next === 'steps' ? undefined : (l.label ?? '') || lineText(i, l)
    setLine(i, { ...l, kind: next, label, steps: next === 'steps' ? (l.steps.length ? l.steps : parseLineText(l.label ?? '')) : l.steps })
  }
  const addNote = (i: number, type: NoteType = 'explanation') => setLine(i, { ...data.lines[i], notes: [...(data.lines[i].notes ?? []), { text: '', type }] })
  const setNote = (i: number, j: number, patch: { text?: string; type?: NoteType }) =>
    setLine(i, { ...data.lines[i], notes: (data.lines[i].notes ?? []).map((n, k) => (k === j ? { ...n, ...patch } : n)) })
  const removeNote = (i: number, j: number) => setLine(i, { ...data.lines[i], notes: (data.lines[i].notes ?? []).filter((_, k) => k !== j) })

  if (stage === 'photo' || stage === 'recognizing')
    return (
      <div className="screen">
        <TopBar title="스텝지 추가" sub="1 / 3 · 사진 고르기" back="/" />
        <div className="content">
          <div className="steps-bar">
            <div className="on" />
            <div />
            <div />
          </div>
          <div className="drop">
            <Camera />
            <div>종이 스텝지나 칠판을 찍거나, 저장된 사진·캡처를 골라 주세요. 여러 장도 돼요.</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
              <button type="button" className="btn big" onClick={() => camRef.current?.click()}>
                <Camera /> 사진 찍기
              </button>
              <button type="button" className="btn big" onClick={() => fileRef.current?.click()}>
                <Photo /> 앨범에서 고르기
              </button>
              {allFolders.length > 1 && (
                <button type="button" className="btn big" onClick={openImport}>
                  <FolderIcon /> 다른 폴더에서 불러오기
                </button>
              )}
            </div>
            <input ref={camRef} type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => pick(e.target.files)} />
            <input ref={fileRef} type="file" accept="image/*" multiple className="sr-only" onChange={(e) => pick(e.target.files)} />
          </div>
          {previews.length > 0 && (
            <div className="thumbs">
              {previews.map((p, i) => (
                <img key={i} src={p} alt={`고른 사진 ${i + 1}`} />
              ))}
            </div>
          )}
          {err && <div className="error">{err}</div>}
        </div>

        <Modal open={importOpen} title="다른 폴더에서 불러오기" onClose={() => setImportOpen(false)}>
          <div className="panel-desc">다른 폴더에 있는 스텝지를 골라 지금 폴더로 복사해요. 글·음원·사진이 그대로 들어오고, 원본은 그 폴더에 남아요.</div>
          <div className="field">
            <label htmlFor="imp-to">넣을 폴더</label>
            <select id="imp-to" value={folderId} onChange={(e) => setFolderId(e.target.value)}>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="imp-from">가져올 폴더</label>
            <select id="imp-from" value={srcFolder} onChange={(e) => setSrcFolder(e.target.value)}>
              {allFolders
                .filter((f) => f.id !== folderId)
                .map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                    {f.song_count ? ` · ${f.song_count}곡` : ''}
                  </option>
                ))}
            </select>
          </div>
          <div className="list" style={{ marginTop: 10 }}>
            {srcSongs === null && <div className="panel-desc">불러오는 중…</div>}
            {srcSongs && srcSongs.every((sg) => !sg.sheets.length) && <div className="panel-desc">이 폴더엔 스텝지가 없어요.</div>}
            {srcSongs?.flatMap((sg) =>
              sg.sheets.map((sh) => (
                <button key={sh.id} type="button" className="card" onClick={() => importSheet(sh.id, sg.title)} disabled={!!importing}>
                  <span className={sh.audio_path || sh.audio_url ? 'ico' : 'ico soft'}>
                    <Music />
                  </span>
                  <span className="grow">
                    <span className="t">{sg.title}</span>
                    <span className="s">
                      {sg.artist ? `${sg.artist} · ` : ''}창작 {sh.creator_name}
                    </span>
                  </span>
                  {importing === sh.id ? <span className="chip">복사 중…</span> : <Chevron />}
                </button>
              )),
            )}
          </div>
        </Modal>
        <div className="bottom">
          <button type="button" className="btn primary block" disabled={files.length === 0 || stage === 'recognizing'} onClick={run}>
            {stage === 'recognizing' ? '읽는 중… 잠시만요' : '다음: 사진 읽기'}
          </button>
          <button type="button" className="btn block" onClick={skip}>
            사진 없이 직접 입력
          </button>
        </div>
      </div>
    )

  return (
    <div className="screen">
      <TopBar title={editId ? '스텝지 수정' : '인식 결과 확인'} sub={editId ? undefined : '2 / 3 · 틀린 칸 고치기'} back />
      <div className="content">
        {!editId && (
          <div className="steps-bar">
            <div className="on" />
            <div className="on" />
            <div />
          </div>
        )}
        {previews.length > 0 && (
          <div className="hint">
            <div className="thumbs">
              {previews.map((p, i) => (
                <img key={i} src={p} alt={`원본 ${i + 1}`} style={{ width: 84, height: 108 }} />
              ))}
            </div>
            <div>
              사진에서 읽은 내용이에요. 틀린 칸을 눌러 고친 뒤 저장하세요.
              <div className="warnnote">노란 칸은 확실하지 않은 글자예요. 고치면 노란색이 사라지고, 그대로 두고 저장도 돼요.</div>
            </div>
          </div>
        )}

        <div className="form-head">
          <div className="k">창작자 *</div>
          <div className="v pad v2">
            <input aria-label="창작자 이름" placeholder="이름" value={data.creator_name} onChange={(e) => setData({ ...data, creator_name: e.target.value })} />
            <input aria-label="기수/지부" placeholder="DC·인스타·기수 (선택)" value={data.creator_info} onChange={(e) => setData({ ...data, creator_info: e.target.value })} />
          </div>
          <div className="k">제목 *</div>
          <div className="v pad v2">
            <input
              aria-label="노래 제목"
              placeholder="노래 제목"
              value={data.title}
              onChange={(e) => setData({ ...data, title: e.target.value })}
              onBlur={async () => {
                if (data.artist.trim() || !data.title.trim()) return
                const a = await guessArtist(data.title)
                if (a) setData((d) => (d.artist.trim() ? d : { ...d, artist: a }))
              }}
            />
            <input aria-label="가수" placeholder="가수 (비우면 자동으로 찾아요)" value={data.artist} onChange={(e) => setData({ ...data, artist: e.target.value })} />
          </div>
        </div>

        <div className="editbox">
          <div className="edithead">
            <span>번호를 누르면 줄 종류가 바뀌어요 (스텝 → 구간 → 반복 → 쉬기 → 글)</span>
          </div>
          <div className="editrow" style={{ padding: '8px 10px 2px', gap: 8 }}>
            <button type="button" className="btn primary" style={{ flex: 1, minHeight: 44 }} onClick={() => setAskOpen(true)}>
              🎤 말로 고치기
            </button>
            <button type="button" className={barMode ? 'btn on' : 'btn'} style={{ minHeight: 44 }} onClick={() => setBarMode((v) => !v)} title="박수가 안 적힌 스텝지에 8박 경계를 찍어요">
              {barMode ? '📍 찍기 끝' : '📍 8박 찍기'}
            </button>
            {undoLines && (
              <button type="button" className="btn" style={{ minHeight: 44 }} onClick={undoAsk}>
                되돌리기
              </button>
            )}
          </div>
          {askNote && <div className="panel-desc" style={{ padding: '0 12px 6px' }}>방금 고친 것: {askNote}</div>}
          {barMode && (
            <div className="panel-desc" style={{ padding: '0 12px 6px' }}>
              박수가 안 적힌 줄에서 <b>한 구절(8박)이 끝나는 스텝을 누르세요.</b> 그 스텝 뒤에 ┃ 도장이 찍히고, 도장 하나가 8박으로 계산돼요. 다시 누르면 지워져요.
            </div>
          )}
          {(() => {
            let n = 0
            return data.lines.map((l, i) => {
              const kind = kindOf(l)
              if (kind === 'section') n = 0
              const no = kind === 'steps' ? String(++n) : LINE_KINDS.find((k) => k.v === kind)?.label
              const hint = LINE_KINDS.find((k) => k.v === kind)?.hint
              const unsure = l.steps.some((s) => s.uncertain)
              return (
                <div className={`editline k-${kind}`} key={i}>
                  <button type="button" className="kind" title="줄 종류 바꾸기" onClick={() => cycleKind(i)}>
                    {no}
                  </button>
                  {kind === 'steps' && barMode ? (
                    <div className="barline" aria-label={`${i + 1}줄 8박 찍기`}>
                      {l.steps.filter((st) => st.name.trim()).length ? (
                        l.steps.map((st, j) =>
                          st.name.trim() ? (
                            <button type="button" key={j} className={st.bar ? 'chip on' : 'chip'} onClick={() => toggleBar(i, j)}>
                              {st.name}
                              {st.beats ? <small> {st.beats}</small> : null}
                              {st.bar ? <b> ┃</b> : null}
                            </button>
                          ) : null,
                        )
                      ) : (
                        <span className="empty">(빈 줄)</span>
                      )}
                    </div>
                  ) : kind === 'steps' ? (
                    <input aria-label={`${i + 1}줄 스텝`} className={unsure ? 'uncertain-input' : ''} value={lineText(i, l)} placeholder={i === 0 ? '예) 전주 - 바운스 8' : hint} onChange={(e) => setText(i, e.target.value)} />
                  ) : (
                    <input aria-label={`${i + 1}줄 ${no}`} value={l.label ?? ''} placeholder={hint} onChange={(e) => setLine(i, { ...l, label: e.target.value })} />
                  )}
                  <button type="button" className="x" aria-label="줄 삭제" onClick={() => removeLine(i)}>
                    ×
                  </button>
                  {(l.notes ?? []).map((nt, j) => (
                    <div className="editnote" key={j}>
                      <select aria-label="해설 종류" value={nt.type ?? 'explanation'} onChange={(e) => setNote(i, j, { type: e.target.value as NoteType })}>
                        {NOTE_TYPES.map((t) => (
                          <option key={t.v} value={t.v}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                      <input aria-label="해설 내용" value={nt.text} placeholder="예) 양손 빠이빠이, 날아갈 듯이" onChange={(e) => setNote(i, j, { text: e.target.value })} />
                      <button type="button" className="x" aria-label="해설 삭제" onClick={() => removeNote(i, j)}>
                        ×
                      </button>
                    </div>
                  ))}
                  <div className="editrow">
                    <button type="button" className="mini note" onClick={() => addNote(i)}>
                      + 파란 해설
                    </button>
                    <button type="button" className="mini" onClick={() => insertAfter(i)}>
                      + 아래에 줄
                    </button>
                  </div>
                </div>
              )
            })
          })()}
          <div className="editfoot">
            <button type="button" className="btn pill" onClick={() => addLine('steps')}>
              + 스텝 줄
            </button>
            <button type="button" className="btn pill" onClick={() => addLine('section')}>
              + 구간
            </button>
            <button type="button" className="btn pill" onClick={() => addLine('repeat')}>
              + 반복
            </button>
            <button type="button" className="btn pill" onClick={() => addLine('rest')}>
              + 쉬기
            </button>
          </div>
          <div className="edittip">스텝 여러 개는 " / "로 나눠요. 스텝 이름 뒤 숫자가 박수예요. 예) 런닝맨 4 / 찰스턴 8 / W 2 / V 2</div>
        </div>

        <div className="field">
          <label htmlFor="m">비고 (규칙·참고)</label>
          <input id="m" value={data.memo} onChange={(e) => setData({ ...data, memo: e.target.value })} placeholder="예: 후렴은 2번 반복, 영상 참고" />
        </div>

        <div className="field">
          <label htmlFor="au">음원·영상 파일 (MP3, MP4 등 내가 가진 파일)</label>
          <input id="au" type="file" accept="audio/*,video/*" onChange={(e) => setAudioFile(e.target.files?.[0] ?? null)} />
        </div>
        <div className="field">
          <label htmlFor="al">유튜브 링크 (파일과 함께 넣어도 돼요 · 앱 안에서 스텝지와 같이 봐요)</label>
          <input id="al" type="url" value={audioUrl} onChange={(e) => setAudioUrl(e.target.value)} placeholder="https://" />
        </div>

        {editId && (
          <div className="field">
            <label>노래 동기화</label>
            <button type="button" className="btn block" onClick={() => nav(`/sheet/${editId}/sync`)} disabled={!hasAudio}>
              {hasSync ? '동기화 교정하기' : '노래와 줄 맞추기 (동기화)'}
            </button>
            <div className="edittip">{hasAudio ? '재생하면서 1번 줄이 시작될 때 한 번만 누르면, 박자를 분석해 나머지 줄을 자동으로 맞춰요. 틀린 줄만 고치면 돼요.' : '음원 파일이나 유튜브 링크를 넣고 저장한 뒤 동기화할 수 있어요.'}</div>
          </div>
        )}

        <div className="field">
          <label htmlFor="fo">저장할 폴더</label>
          <select id="fo" value={folderId} onChange={(e) => setFolderId(e.target.value)} disabled={Boolean(editId)}>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
                {f.kind === 'shared' ? ' (공유)' : ''}
              </option>
            ))}
          </select>
        </div>
        {err && <div className="error">{err}</div>}
        {editId && (
          <button
            type="button"
            className="btn danger block"
            onClick={async () => {
              if (!confirm('이 스텝지를 삭제할까요? 되돌릴 수 없어요.')) return
              await deleteSheet(editId)
              nav('/library', { replace: true })
            }}
          >
            이 스텝지 삭제
          </button>
        )}
      </div>
      <Modal open={askOpen} title="말로 고치기" onClose={() => { speech.stop(); setAskOpen(false) }}>
        <div className="panel-desc">어느 줄을 어떻게 바꿀지 말하거나 적어 주세요. 예: "3번 줄 티스텝을 런닝맨 4박으로" / "후렴 첫 줄 지워" / "2번 줄 아래에 찰스턴 8박 넣어" / "1번 줄에 손동작 해설 양손 빠이빠이"</div>
        <textarea className="ask" rows={3} value={askText} onChange={(e) => setAskText(e.target.value)} placeholder="예: 3번 줄 티스텝을 런닝맨 4박으로" />
        {speech.ok && (
          <button type="button" className={speech.listening ? 'btn mic on' : 'btn mic'} onClick={speech.listening ? speech.stop : speech.start} disabled={asking || speech.busy}>
            {speech.listening ? `● 녹음 중 ${speech.seconds}초 · 다 말했으면 누르세요` : speech.busy ? '받아 적는 중…' : '🎤 말로 하기'}
          </button>
        )}
        <DeepToggle />
        <button type="button" className="btn primary block" onClick={applyAsk} disabled={asking || !askText.trim()}>
          {asking ? '고치는 중…' : '이대로 고치기'}
        </button>
      </Modal>
      <div className="bottom">
        <button type="button" className="btn primary block" disabled={stage === 'saving'} onClick={save}>
          {stage === 'saving' ? '저장 중…' : editId ? '수정 저장' : '저장'}
        </button>
      </div>
    </div>
  )
}
