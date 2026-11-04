import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import TopBar from '../components/TopBar'
import { Camera, Photo } from '../components/Icons'
import { findDuplicate, getSheet, listFolders, recognize, saveSheet } from '../lib/api'
import { emptyLine, emptyRecognized, emptyStep, type Folder, type Line, type Recognized } from '../lib/types'

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
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [audioUrl, setAudioUrl] = useState('')
  const [err, setErr] = useState('')
  const camRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    listFolders().then((fs) => {
      const editable = fs.filter((f) => f.role === 'owner' || f.role === 'editor')
      setFolders(editable)
      if (!folderId && editable[0]) setFolderId(editable[0].id)
    })
    if (editId)
      getSheet(editId).then((s) => {
        if (!s) return
        setFolderId(s.folder_id)
        setAudioUrl(s.audio_url ?? '')
        setData({
          title: s.song?.title ?? '',
          artist: s.song?.artist ?? '',
          creator_name: s.creator_name,
          creator_info: s.creator_info ?? '',
          memo: s.memo,
          lines: s.lines.map((l) => ({ steps: [l.steps[0] ?? emptyStep(), l.steps[1] ?? emptyStep()] })),
        })
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
      const lines = (r.lines ?? []).map((l) => ({ steps: [l.steps[0] ?? emptyStep(), l.steps[1] ?? emptyStep()] }))
      setData({ ...emptyRecognized(), ...r, lines: lines.length ? lines : emptyRecognized().lines })
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
    if (!data.title.trim()) return setErr('안무곡(노래 제목)은 꼭 적어 주세요.')
    if (!data.creator_name.trim()) return setErr('응시자(창작자 이름)는 꼭 적어 주세요.')
    if (!folderId) return setErr('저장할 폴더를 골라 주세요.')
    setStage('saving')
    try {
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
        lines: data.lines
          .map((l) => ({ steps: l.steps.filter((s) => s.name.trim()).map((s) => ({ name: s.name.trim(), beats: s.beats.trim() })) }))
          .filter((l) => l.steps.length),
      }
      const saved = await saveSheet({ ...cleaned, folderId, audioFile, audioUrl: audioUrl.trim(), photoFiles: files, overwriteId })
      nav(`/sheet/${saved.id}`, { replace: true })
    } catch (e) {
      setErr((e as Error).message)
      setStage('edit')
    }
  }

  const setLine = (i: number, line: Line) => setData({ ...data, lines: data.lines.map((l, k) => (k === i ? line : l)) })
  const setStep = (i: number, j: number, patch: { name?: string; beats?: string }) =>
    setLine(i, { steps: data.lines[i].steps.map((s, k) => (k === j ? { ...s, ...patch, uncertain: false } : s)) })

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

  const unc = (b?: boolean) => (b ? 'uncertain-input' : '')

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
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div className="thumbs">
              {previews.map((p, i) => (
                <img key={i} src={p} alt={`원본 ${i + 1}`} style={{ width: 84, height: 108 }} />
              ))}
            </div>
            <div style={{ fontSize: 15, color: 'var(--muted)' }}>
              사진에서 읽은 내용이에요. 틀린 칸을 눌러 고친 뒤 저장하세요.
              <div style={{ marginTop: 6, color: 'var(--warn-fg)', fontSize: 14 }}>노란 칸은 확실하지 않은 글자</div>
            </div>
          </div>
        )}

        <div className="form-head">
          <div className="k">응시자 *</div>
          <div className="v pad v2">
            <input aria-label="응시자 이름" placeholder="이름" value={data.creator_name} onChange={(e) => setData({ ...data, creator_name: e.target.value })} />
            <input aria-label="기수/지부" placeholder="기수/지부 (선택)" value={data.creator_info} onChange={(e) => setData({ ...data, creator_info: e.target.value })} />
          </div>
          <div className="k">안무곡 *</div>
          <div className="v pad v2">
            <input aria-label="노래 제목" placeholder="노래 제목" value={data.title} onChange={(e) => setData({ ...data, title: e.target.value })} />
            <input aria-label="가수" placeholder="가수 (선택)" value={data.artist} onChange={(e) => setData({ ...data, artist: e.target.value })} />
          </div>
        </div>

        <div style={{ border: '2px solid var(--fg)' }}>
          <div className="edithead">
            <div>줄</div>
            <div>스텝 1</div>
            <div>박</div>
            <div>스텝 2</div>
            <div>박</div>
            <div></div>
          </div>
          {data.lines.map((l, i) => (
            <div className="editline" key={i}>
              <div className="no">{i + 1}</div>
              <input aria-label={`${i + 1}줄 스텝 1`} className={unc(l.steps[0]?.uncertain)} value={l.steps[0]?.name ?? ''} placeholder={i === 0 ? '전주 - …' : '스텝'} onChange={(e) => setStep(i, 0, { name: e.target.value })} />
              <input aria-label={`${i + 1}줄 스텝 1 박수`} className={unc(l.steps[0]?.uncertain)} value={l.steps[0]?.beats ?? ''} placeholder="4박" onChange={(e) => setStep(i, 0, { beats: e.target.value })} />
              <input aria-label={`${i + 1}줄 스텝 2`} className={unc(l.steps[1]?.uncertain)} value={l.steps[1]?.name ?? ''} placeholder="스텝 (선택)" onChange={(e) => setStep(i, 1, { name: e.target.value })} />
              <input aria-label={`${i + 1}줄 스텝 2 박수`} className={unc(l.steps[1]?.uncertain)} value={l.steps[1]?.beats ?? ''} placeholder="4박" onChange={(e) => setStep(i, 1, { beats: e.target.value })} />
              <button type="button" className="x" aria-label="줄 삭제" onClick={() => setData({ ...data, lines: data.lines.filter((_, k) => k !== i) })}>
                ×
              </button>
            </div>
          ))}
          <div style={{ padding: 8, borderTop: '1px solid var(--soft)', display: 'flex', gap: 8, alignItems: 'center' }}>
            <button type="button" className="btn pill" onClick={() => setData({ ...data, lines: [...data.lines, emptyLine()] })}>
              + 줄 추가
            </button>
            <span style={{ fontSize: 13, color: 'var(--faint)' }}>마지막 "마무리"는 자동으로 붙어요</span>
          </div>
        </div>

        <div className="field">
          <label htmlFor="m">참고</label>
          <input id="m" value={data.memo} onChange={(e) => setData({ ...data, memo: e.target.value })} placeholder="예: Y스텝시 손동작 있음" />
        </div>

        <div className="field">
          <label htmlFor="au">음원 파일 (MP3 등, 내가 가진 파일)</label>
          <input id="au" type="file" accept="audio/*" onChange={(e) => setAudioFile(e.target.files?.[0] ?? null)} />
        </div>
        <div className="field">
          <label htmlFor="al">또는 음원 링크 (유튜브 등)</label>
          <input id="al" type="url" value={audioUrl} onChange={(e) => setAudioUrl(e.target.value)} placeholder="https://" />
        </div>

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
      </div>
      <div className="bottom">
        <button type="button" className="btn primary block" disabled={stage === 'saving'} onClick={save}>
          {stage === 'saving' ? '저장 중…' : editId ? '수정 저장' : '저장'}
        </button>
      </div>
    </div>
  )
}
