import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import TopBar from '../components/TopBar'
import { Camera, Photo } from '../components/Icons'
import { findDuplicate, getSheet, listFolders, recognize, saveSheet } from '../lib/api'
import { emptyRecognized, type Folder, type Recognized, type Section } from '../lib/types'

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
          difficulty: s.difficulty,
          memo: s.memo,
          sections: s.sections,
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
      setData({ ...emptyRecognized(), ...r })
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
        sections: data.sections
          .map((s) => ({ ...s, steps: s.steps.filter((st) => st.name.trim()).map((st) => ({ ...st, uncertain: false })) }))
          .filter((s) => s.steps.length),
      }
      const saved = await saveSheet({ ...cleaned, folderId, audioFile, audioUrl: audioUrl.trim(), photoFiles: files, overwriteId })
      nav(`/sheet/${saved.id}`, { replace: true })
    } catch (e) {
      setErr((e as Error).message)
      setStage('edit')
    }
  }

  const setSec = (i: number, sec: Section) => setData({ ...data, sections: data.sections.map((s, k) => (k === i ? sec : s)) })

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
            <input ref={fileRef} type="file" accept="image/*,application/pdf" multiple className="sr-only" onChange={(e) => pick(e.target.files)} />
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

  let n = 0
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
                <img key={i} src={p} alt={`원본 ${i + 1}`} />
              ))}
            </div>
            <div style={{ fontSize: 15, color: 'var(--muted)' }}>
              사진에서 읽은 내용이에요. 틀린 칸을 눌러 고친 뒤 저장하세요.
              <div style={{ marginTop: 6, color: 'var(--warn-fg)', fontSize: 14 }}>노란 칸은 확실하지 않은 글자</div>
            </div>
          </div>
        )}

        <div className="grid2">
          <F label="노래 제목 *" id="t" v={data.title} set={(v) => setData({ ...data, title: v })} />
          <F label="가수" id="a" v={data.artist} set={(v) => setData({ ...data, artist: v })} />
          <F label="창작자 *" id="c" v={data.creator_name} set={(v) => setData({ ...data, creator_name: v })} />
          <div className="field">
            <label htmlFor="d">난이도</label>
            <select id="d" value={data.difficulty} onChange={(e) => setData({ ...data, difficulty: e.target.value })}>
              <option value="">선택 안 함</option>
              <option>초급</option>
              <option>중급</option>
              <option>고급</option>
            </select>
          </div>
        </div>

        <div className="sheet">
          <div className="hrow" style={{ gridTemplateColumns: '28px minmax(0,1.4fr) 80px minmax(0,1fr) 36px', gap: 6, padding: '8px' }}>
            <div></div>
            <div>스텝 *</div>
            <div>카운트</div>
            <div>방향·비고</div>
            <div></div>
          </div>
          {data.sections.map((sec, i) => (
            <div key={i}>
              <div className="secrow">
                <input aria-label="구간 이름" value={sec.name} placeholder="구간 (인트로, A, 후렴…)" onChange={(e) => setSec(i, { ...sec, name: e.target.value })} />
                {data.sections.length > 1 && (
                  <button type="button" className="x" aria-label="구간 삭제" onClick={() => setData({ ...data, sections: data.sections.filter((_, k) => k !== i) })}>
                    ×
                  </button>
                )}
              </div>
              {sec.steps.map((st, j) => {
                n += 1
                const upd = (patch: Partial<typeof st>) => setSec(i, { ...sec, steps: sec.steps.map((s, k) => (k === j ? { ...s, ...patch, uncertain: false } : s)) })
                const cls = st.uncertain ? 'uncertain-input' : ''
                return (
                  <div className="editrow" key={j}>
                    <div className="no">{n}</div>
                    <input aria-label="스텝 이름" className={cls} value={st.name} placeholder="스텝" onChange={(e) => upd({ name: e.target.value })} />
                    <input aria-label="카운트" className={cls} value={st.count} placeholder="8×2" onChange={(e) => upd({ count: e.target.value })} />
                    <input aria-label="방향 또는 비고" value={st.direction} placeholder="방향" onChange={(e) => upd({ direction: e.target.value })} />
                    <button type="button" className="x" aria-label="줄 삭제" onClick={() => setSec(i, { ...sec, steps: sec.steps.filter((_, k) => k !== j) })}>
                      ×
                    </button>
                  </div>
                )
              })}
              <div style={{ padding: 8, borderTop: '1px solid var(--soft)' }}>
                <button type="button" className="btn pill" onClick={() => setSec(i, { ...sec, steps: [...sec.steps, { name: '', count: '', direction: '' }] })}>
                  + 스텝 줄 추가
                </button>
              </div>
            </div>
          ))}
          <div style={{ padding: 8, borderTop: '1px solid var(--line)' }}>
            <button type="button" className="btn pill" onClick={() => setData({ ...data, sections: [...data.sections, { name: '', steps: [{ name: '', count: '', direction: '' }] }] })}>
              + 구간 추가
            </button>
          </div>
        </div>

        <div className="field">
          <label htmlFor="m">메모</label>
          <textarea id="m" value={data.memo} onChange={(e) => setData({ ...data, memo: e.target.value })} placeholder="주의할 점, 박자 등" />
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

function F({ label, id, v, set }: { label: string; id: string; v: string; set: (v: string) => void }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} value={v} onChange={(e) => set(e.target.value)} />
    </div>
  )
}
