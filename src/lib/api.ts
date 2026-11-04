import { supabase } from './supabase'
import { deepAi } from './prefs'
import type { Storyboard } from './frames'
import { normalizeLines, stepNames, type Folder, type Line, type Recognized, type Role, type Song, type Stepsheet, type SyncData } from './types'

export async function listFolders(): Promise<Folder[]> {
  // 내 멤버 줄만! (공유 폴더는 다른 멤버의 줄도 읽을 수 있어서, 안 거르면 같은 폴더가 멤버 수만큼 나오고 권한도 남의 것이 보였음)
  const { data: auth } = await supabase.auth.getSession()
  const uid = auth.session?.user.id
  if (!uid) return []
  const { data: members, error } = await supabase
    .from('folder_members')
    .select('role, folders(id, name, kind, owner_id, invite_code)')
    .eq('user_id', uid)
  if (error) throw error
  const folders: Folder[] = (members ?? []).map((m) => {
    const f = m.folders as unknown as Folder
    return { ...f, role: m.role as Role }
  })
  const { data: counts } = await supabase.from('songs').select('folder_id')
  const byFolder = new Map<string, number>()
  for (const c of counts ?? []) byFolder.set(c.folder_id, (byFolder.get(c.folder_id) ?? 0) + 1)
  for (const f of folders) f.song_count = byFolder.get(f.id) ?? 0
  folders.sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name, 'ko') : a.kind === 'personal' ? -1 : 1))
  return folders
}

export async function getFolder(id: string): Promise<Folder | null> {
  const { data } = await supabase.from('folders').select('*').eq('id', id).maybeSingle()
  if (!data) return null
  const { data: me } = await supabase.rpc('my_role', { fid: id })
  return { ...(data as Folder), role: (me as Role) ?? undefined }
}

export interface SongWithSheets extends Song {
  sheets: Stepsheet[]
}

export async function listSongs(folderId: string): Promise<SongWithSheets[]> {
  const { data, error } = await supabase
    .from('songs')
    .select('*, stepsheets(*)')
    .eq('folder_id', folderId)
    .order('title')
  if (error) throw error
  return (data ?? [])
    .map((s) => ({ ...(s as Song), sheets: ((s.stepsheets as Stepsheet[]) ?? []).map((sh) => ({ ...sh, lines: normalizeLines(sh.lines) })) }))
    .filter((s) => s.sheets.length > 0) // 스텝지가 다 옮겨지거나 지워져 빈 노래는 목록에 안 보임
}

/** 제목 비교용: 공백·대소문자 무시 */
export const titleKey = (t: string) => t.replace(/\s+/g, '').toLowerCase()

/**
 * 폴더에서 같은 노래 찾기. 제목이 같으면(공백·대소문자 무시) 가수 표기가 달라도 같은 노래로 봄 —
 * "두아 리파" / "두아 리파, 백스트리트 보이즈"처럼 가수만 다르게 적혀 노래가 둘로 갈라지지 않게.
 * 가수까지 같은 게 있으면 그걸 우선.
 */
export async function findSong(folderId: string, title: string, artist: string): Promise<Song | null> {
  const { data } = await supabase.from('songs').select('*').eq('folder_id', folderId)
  const key = titleKey(title)
  const same = ((data as Song[]) ?? []).filter((s) => titleKey(s.title) === key)
  if (!same.length) return null
  return same.find((s) => s.artist.trim() === artist.trim()) ?? same.find((s) => !s.artist.trim()) ?? same[0]
}

export async function getSheet(id: string): Promise<Stepsheet | null> {
  const { data, error } = await supabase.from('stepsheets').select('*, song:songs(*)').eq('id', id).maybeSingle()
  if (error) throw error
  if (!data) return null
  const sh = data as Stepsheet
  return { ...sh, lines: normalizeLines(sh.lines) }
}

export async function recentSheets(limit = 6): Promise<Stepsheet[]> {
  const { data } = await supabase
    .from('stepsheets')
    .select('*, song:songs(*)')
    .order('updated_at', { ascending: false })
    .limit(limit)
  return (data as Stepsheet[]) ?? []
}

export async function searchSheets(q: string): Promise<Stepsheet[]> {
  const term = q.trim()
  if (!term) return []
  const { data: songs } = await supabase
    .from('songs')
    .select('id')
    .or(`title.ilike.%${term}%,artist.ilike.%${term}%`)
  const songIds = (songs ?? []).map((s) => s.id)
  let query = supabase.from('stepsheets').select('*, song:songs(*)').limit(50)
  const ors = [`creator_name.ilike.%${term}%`, `memo.ilike.%${term}%`]
  if (songIds.length) ors.push(`song_id.in.(${songIds.join(',')})`)
  query = query.or(ors.join(','))
  const { data } = await query
  const byText = ((data as Stepsheet[]) ?? []).filter(Boolean)
  // 스텝 이름 검색은 클라이언트에서 보완
  const { data: all } = await supabase.from('stepsheets').select('*, song:songs(*)').limit(500)
  const extra = ((all as Stepsheet[]) ?? []).filter((s) =>
    stepNames(s.lines).some((n) => n.includes(term)),
  )
  const seen = new Set<string>()
  return [...byText, ...extra].filter((s) => (seen.has(s.id) ? false : (seen.add(s.id), true)))
}

export async function uploadFile(bucket: 'audio' | 'photos', folderId: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'bin'
  const path = `${folderId}/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from(bucket).upload(path, file, { contentType: file.type })
  if (error) throw error
  return path
}

export async function signedUrl(bucket: 'audio' | 'photos', path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60)
  if (error) throw error
  return data.signedUrl
}

export interface SaveInput extends Recognized {
  folderId: string
  audioFile?: File | null
  audioUrl?: string
  photoFiles?: File[]
  overwriteId?: string
  /** 고칠 때: 붙어 있던 음원·영상 파일을 떼어 냄 */
  dropAudio?: boolean
}

export async function saveSheet(input: SaveInput): Promise<Stepsheet> {
  const { data: user } = await supabase.auth.getUser()
  const title = input.title.trim()
  const artist = input.artist.trim()
  let song = await findSong(input.folderId, title, artist)
  if (song && !song.artist.trim() && artist) {
    // 가수 없이 저장돼 있던 노래에 가수를 적어 주면 채워 둠
    await supabase.from('songs').update({ artist }).eq('id', song.id)
    song = { ...song, artist }
  }
  if (!song) {
    const ins = await supabase.from('songs').insert({ folder_id: input.folderId, title, artist }).select('*').single()
    if (ins.error) throw ins.error
    song = ins.data
  }

  const photo_paths: string[] = []
  for (const f of input.photoFiles ?? []) photo_paths.push(await uploadFile('photos', input.folderId, f))
  let audio_path: string | null = null
  if (input.audioFile) audio_path = await uploadFile('audio', input.folderId, input.audioFile)

  const row = {
    song_id: song.id,
    folder_id: input.folderId,
    creator_name: input.creator_name.trim() || '미상',
    creator_info: input.creator_info.trim(),
    lines: input.lines,
    memo: input.memo,
    created_by: user.user?.id ?? null,
    updated_at: new Date().toISOString(),
    ...(audio_path ? { audio_path } : {}),
    ...(input.audioUrl ? { audio_url: input.audioUrl } : {}),
    ...(photo_paths.length ? { photo_paths } : {}),
  }

  if (input.overwriteId) {
    // 내용을 고치면 "수정 완료" 표시는 풀림 (다시 검토하고 눌러야 함)
    // 유튜브 링크를 지우면 비워지고(전엔 빈 칸을 무시해서 안 지워졌음), 파일을 떼면 audio_path도 비움
    const patch = { ...row, finalized: false, audio_url: input.audioUrl?.trim() ? input.audioUrl.trim() : null, ...(input.dropAudio && !audio_path ? { audio_path: null } : {}) }
    let oldPath: string | null = null
    if (input.dropAudio || audio_path) {
      const { data: prev } = await supabase.from('stepsheets').select('audio_path').eq('id', input.overwriteId).maybeSingle()
      oldPath = (prev as { audio_path?: string | null } | null)?.audio_path ?? null
    }
    const upd = await supabase.from('stepsheets').update(patch).eq('id', input.overwriteId).select('*').single()
    if (upd.error) throw upd.error
    if (oldPath && oldPath !== audio_path) await supabase.storage.from('audio').remove([oldPath]).catch(() => undefined)
    return upd.data as Stepsheet
  }
  const ins = await supabase.from('stepsheets').insert(row).select('*').single()
  if (ins.error) {
    if (ins.error.code === '23505') throw new Error('DUPLICATE')
    throw ins.error
  }
  return ins.data as Stepsheet
}

export async function findDuplicate(folderId: string, title: string, artist: string, creator: string) {
  const song = await findSong(folderId, title, artist)
  if (!song) return null
  const { data } = await supabase
    .from('stepsheets')
    .select('id')
    .eq('song_id', song.id)
    .eq('creator_name', creator.trim() || '미상')
    .maybeSingle()
  return data?.id ?? null
}

/** 스텝지 삭제 (붙어 있던 음원·사진 파일도 함께 지움) */
export async function deleteSheet(id: string) {
  const { data: s } = await supabase.from('stepsheets').select('song_id, audio_path, photo_paths').eq('id', id).maybeSingle()
  const { error } = await supabase.from('stepsheets').delete().eq('id', id)
  if (error) throw error
  const row = s as { song_id?: string; audio_path?: string | null; photo_paths?: string[] | null } | null
  // 그 노래에 스텝지가 하나도 안 남으면 노래 줄도 지움 (빈 노래가 목록에 남지 않게)
  if (row?.song_id) {
    const { count } = await supabase.from('stepsheets').select('id', { count: 'exact', head: true }).eq('song_id', row.song_id)
    if (count === 0) await supabase.from('songs').delete().eq('id', row.song_id)
  }
  if (row?.audio_path) await supabase.storage.from('audio').remove([row.audio_path]).catch(() => undefined)
  if (row?.photo_paths?.length) await supabase.storage.from('photos').remove(row.photo_paths).catch(() => undefined)
}

export async function recognize(files: File[]): Promise<Recognized> {
  const images = await Promise.all(
    files.map(async (f) => {
      const blob = await shrink(f)
      const data = await toBase64(blob)
      return { media_type: blob.type || 'image/jpeg', data }
    }),
  )
  const { data, error } = await supabase.functions.invoke('recognize', { body: { images } })
  if (error) throw error
  if (data?.error) throw new Error(data.error)
  const r = data as Recognized
  r.lines = normalizeLines(r.lines)
  r.creator_info ??= ''
  r.memo ??= ''
  return r
}

async function shrink(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file)
  const max = 1600
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bmp.width * scale)
  canvas.height = Math.round(bmp.height * scale)
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height)
  return new Promise((res) => canvas.toBlob((b) => res(b ?? file), 'image/jpeg', 0.85))
}

function toBase64(blob: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res((r.result as string).split(',')[1])
    r.onerror = rej
    r.readAsDataURL(blob)
  })
}

// 폴더 / 멤버
export async function createSharedFolder(name: string): Promise<string> {
  const { data, error } = await supabase.rpc('create_shared_folder', { folder_name: name })
  if (error) throw error
  return data as string
}

/** 초대 코드로 참여. 코드는 소문자 16진수로 저장돼 있어서, 대문자로 적어도(휴대폰 자동 대문자) 들어가게 소문자로 맞춤 */
export async function joinFolder(code: string): Promise<string> {
  const { data, error } = await supabase.rpc('join_folder', { code: code.trim().toLowerCase() })
  if (error) throw error
  return data as string
}

export interface Member {
  user_id: string
  role: Role
  /** 본명 (카카오 이름) */
  display_name: string
  nickname: string
  avatar_path: string | null
  /** 화면에 보이는 이름: 닉네임이 있으면 닉네임, 없으면 본명 */
  name: string
}

type ProfileRow = { display_name: string; nickname?: string | null; avatar_path?: string | null }
const shownName = (p: ProfileRow | null | undefined) => (p?.nickname?.trim() || p?.display_name || '').trim()

export async function listMembers(folderId: string): Promise<Member[]> {
  const { data, error } = await supabase
    .from('folder_members')
    .select('user_id, role, profiles(display_name, nickname, avatar_path)')
    .eq('folder_id', folderId)
  if (error) throw error
  return (data ?? []).map((m) => {
    const p = m.profiles as unknown as ProfileRow | null
    return {
      user_id: m.user_id,
      role: m.role as Role,
      display_name: p?.display_name ?? '',
      nickname: p?.nickname ?? '',
      avatar_path: p?.avatar_path ?? null,
      name: shownName(p) || '이름 없음',
    }
  })
}

/** 내가 볼 수 있는 스텝지를 만든 사람별로 센 수 (캐릭터 레벨 = 수 + 1). 내 것은 전부, 남의 것은 같이 있는 폴더 안의 것만 */
export async function sheetCounts(): Promise<Map<string, number>> {
  const { data, error } = await supabase.from('stepsheets').select('created_by')
  if (error) throw error
  const m = new Map<string, number>()
  for (const r of data ?? []) if (r.created_by) m.set(r.created_by, (m.get(r.created_by) ?? 0) + 1)
  return m
}
/** 내가 만든 스텝지 수 */
export async function mySheetCount(): Promise<number> {
  const uid = (await supabase.auth.getUser()).data.user?.id
  if (!uid) return 0
  const { count, error } = await supabase.from('stepsheets').select('id', { count: 'exact', head: true }).eq('created_by', uid)
  if (error) throw error
  return count ?? 0
}

/* ── 내 프로필: 닉네임·아바타 ── */
export interface Profile {
  id: string
  display_name: string
  nickname: string
  avatar_path: string | null
}

export async function getProfile(): Promise<Profile | null> {
  const uid = (await supabase.auth.getUser()).data.user?.id
  if (!uid) return null
  const { data, error } = await supabase.from('profiles').select('id, display_name, nickname, avatar_path').eq('id', uid).maybeSingle()
  if (error) throw error
  return data ? { id: data.id, display_name: data.display_name, nickname: data.nickname ?? '', avatar_path: data.avatar_path ?? null } : null
}

export async function updateProfile(patch: { nickname?: string; avatar_path?: string | null }) {
  const uid = (await supabase.auth.getUser()).data.user?.id
  if (!uid) throw new Error('로그인이 필요해요')
  const { error } = await supabase.from('profiles').update(patch).eq('id', uid)
  if (error) throw error
}

/** 아바타 공개 주소 (버킷이 공개라 서명 없이 바로 씀) */
export function avatarUrl(path: string): string {
  return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl
}

/** 아바타 그림 올리기 → 경로. 파일 이름에 시각을 넣어 캐시가 안 남게 */
export async function uploadAvatar(blob: Blob): Promise<string> {
  const uid = (await supabase.auth.getUser()).data.user?.id
  if (!uid) throw new Error('로그인이 필요해요')
  const ext = blob.type === 'image/png' ? 'png' : 'jpg'
  const path = `${uid}/avatar-${Date.now()}.${ext}`
  const { error } = await supabase.storage.from('avatars').upload(path, blob, { contentType: blob.type || 'image/jpeg', upsert: true })
  if (error) throw error
  return path
}

/** 사진을 정사각형 작은 그림으로 (그대로 아바타로 쓸 때) */
/** 사진 → AI 전신 캐릭터 (엣지 함수가 Gemini 이미지 모델 호출). 결과는 그림 Blob */
export async function makeAvatar(file: File): Promise<Blob> {
  const small = await shrinkImage(file, 768)
  const b64 = await new Promise<string>((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(String(r.result).split(',')[1] ?? '')
    r.onerror = () => rej(new Error('사진을 읽지 못했어요'))
    r.readAsDataURL(small)
  })
  const { data, error } = await supabase.functions.invoke('recognize', { body: { avatar: { media_type: small.type || 'image/jpeg', data: b64 } } })
  if (error) {
    const msg = await (error as { context?: Response }).context?.json?.().then((j: { error?: string }) => j?.error).catch(() => undefined)
    throw new Error(msg || '아바타를 만들지 못했어요. 잠시 뒤 다시 해 보세요')
  }
  if (data?.error) throw new Error(data.error)
  if (!data?.image) throw new Error('아바타를 만들지 못했어요')
  const bin = atob(data.image)
  const arr = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
  return new Blob([arr], { type: data.media_type || 'image/png' })
}
/** 그림 파일을 긴 변 max 픽셀로 줄여(비율 유지) JPEG/PNG로. 투명 PNG는 PNG 유지 */
export async function shrinkImage(file: File, max = 1024): Promise<Blob> {
  const img = await createImageBitmap(file)
  const k = Math.min(1, max / Math.max(img.width, img.height))
  const w = Math.round(img.width * k)
  const h = Math.round(img.height * k)
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  c.getContext('2d')!.drawImage(img, 0, 0, w, h)
  const png = file.type === 'image/png'
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('그림을 읽지 못했어요'))), png ? 'image/png' : 'image/jpeg', 0.9))
}

/* ── 폴더 톡 ── */
export interface Message {
  id: string
  folder_id: string
  user_id: string
  body: string
  created_at: string
}

export async function listMessages(folderId: string, limit = 200): Promise<Message[]> {
  const { data, error } = await supabase.from('messages').select('id, folder_id, user_id, body, created_at').eq('folder_id', folderId).order('created_at', { ascending: false }).limit(limit)
  if (error) throw error
  return (data ?? []).reverse() as Message[]
}

export async function sendMessage(folderId: string, body: string): Promise<Message> {
  const uid = (await supabase.auth.getUser()).data.user?.id
  if (!uid) throw new Error('로그인이 필요해요')
  const { data, error } = await supabase.from('messages').insert({ folder_id: folderId, user_id: uid, body }).select('id, folder_id, user_id, body, created_at').single()
  if (error) throw error
  return data as Message
}

export async function deleteMessage(id: string) {
  const { error } = await supabase.from('messages').delete().eq('id', id)
  if (error) throw error
}

/** 새 메시지가 오면 cb. 돌려주는 함수를 부르면 구독 해제 */
export function subscribeMessages(folderId: string, cb: (m: Message) => void): () => void {
  const ch = supabase
    .channel(`messages-${folderId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `folder_id=eq.${folderId}` }, (payload) => cb(payload.new as Message))
    .subscribe()
  return () => {
    supabase.removeChannel(ch)
  }
}

/* ── 톡 안 읽음 ── */
const READ_KEY = (folderId: string) => `chat-read-${folderId}`
/** 이 폴더 톡을 마지막으로 본 시각 (없으면 3일 전으로 봄) */
export function lastRead(folderId: string): string {
  return localStorage.getItem(READ_KEY(folderId)) || new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString()
}
export function markRead(folderId: string) {
  localStorage.setItem(READ_KEY(folderId), new Date().toISOString())
}
/** 폴더별 안 읽은 메시지 수 (남이 보낸 것만) */
export async function unreadCounts(folderIds: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>()
  if (!folderIds.length) return out
  const me = (await supabase.auth.getUser()).data.user?.id
  const since = folderIds.map(lastRead).sort()[0]
  const { data, error } = await supabase.from('messages').select('folder_id, user_id, created_at').in('folder_id', folderIds).gt('created_at', since)
  if (error) return out
  for (const m of data ?? []) {
    if (m.user_id === me) continue
    if (m.created_at <= lastRead(m.folder_id)) continue
    out.set(m.folder_id, (out.get(m.folder_id) ?? 0) + 1)
  }
  return out
}

export async function setMemberRole(folderId: string, userId: string, role: Role) {
  const { error } = await supabase.from('folder_members').update({ role }).eq('folder_id', folderId).eq('user_id', userId)
  if (error) throw error
}

export async function removeMember(folderId: string, userId: string) {
  const { error } = await supabase.from('folder_members').delete().eq('folder_id', folderId).eq('user_id', userId)
  if (error) throw error
}

export async function renameFolder(folderId: string, name: string) {
  const { error } = await supabase.from('folders').update({ name: name.trim() }).eq('id', folderId)
  if (error) throw error
}

/** 공유 폴더 없애기 (주인만). 안의 음원·사진 파일도 지움 */
export async function deleteFolder(folderId: string) {
  for (const bucket of ['audio', 'photos'] as const) {
    const { data } = await supabase.storage.from(bucket).list(folderId, { limit: 1000 })
    const paths = (data ?? []).map((o) => `${folderId}/${o.name}`)
    if (paths.length) await supabase.storage.from(bucket).remove(paths)
  }
  const { error } = await supabase.from('folders').delete().eq('id', folderId)
  if (error) throw error
}

/** 내가 공유 폴더에서 나가기 (주인은 못 나감: 먼저 주인을 넘기거나 폴더를 없애야 함) */
export async function leaveFolder(folderId: string) {
  const uid = (await supabase.auth.getUser()).data.user?.id
  if (!uid) throw new Error('로그인이 필요해요')
  const { error } = await supabase.from('folder_members').delete().eq('folder_id', folderId).eq('user_id', uid)
  if (error) throw error
}

export async function transferOwner(folderId: string, userId: string) {
  const { error } = await supabase.rpc('transfer_folder_owner', { fid: folderId, new_owner: userId })
  if (error) throw error
}

/** 노래 제목으로 가수 추정 (AI) — 실패하면 빈 문자열 */
export async function guessArtist(title: string): Promise<string> {
  if (!title.trim()) return ''
  try {
    const { data, error } = await supabase.functions.invoke('recognize', { body: { title: title.trim() } })
    if (error || !data || data.error) return ''
    return String(data.artist ?? '').trim()
  } catch {
    return ''
  }
}

export async function updateSync(id: string, sync: SyncData) {
  const { error } = await supabase.from('stepsheets').update({ sync, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}

/** 수정 완료 표시 켜고 끄기 */
export async function setFinalized(id: string, finalized: boolean) {
  const { error } = await supabase.from('stepsheets').update({ finalized }).eq('id', id)
  if (error) throw error
}

export async function updateMemo(id: string, memo: string) {
  const { error } = await supabase.from('stepsheets').update({ memo, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}

/** 같은 노래의 버전들(스텝지 전부) */
export async function listVersions(songId: string): Promise<Stepsheet[]> {
  const { data } = await supabase.from('stepsheets').select('*').eq('song_id', songId).order('created_at')
  return ((data as Stepsheet[]) ?? []).map((sh) => ({ ...sh, lines: normalizeLines(sh.lines) }))
}

/** 내용이 같은지 비교하려고 줄·스텝을 글로 눌러 담은 키 (공백·대소문자 무시) */
export function contentKey(lines: Line[]): string {
  return lines
    .map((l) => (l.kind && l.kind !== 'steps' ? `[${l.kind}:${l.label ?? ''}]` : l.steps.map((st) => `${st.name}/${st.beats}`).join(',')))
    .join('|')
    .replace(/\s+/g, '')
    .toLowerCase()
}

/**
 * 저쪽 폴더에 "같은 원본"인 스텝지가 이미 있는지: 같은 노래(제목·가수)에서 사진 파일이 같거나 내용(줄·스텝)이 같으면 같은 원본으로 봄.
 * 편집만 조금 다른 복사본이 두 개 생기지 않게 하려는 것. 있으면 그 스텝지 id
 */
export async function findSameContent(folderId: string, title: string, artist: string, src: Pick<Stepsheet, 'lines' | 'photo_paths'>): Promise<string | null> {
  const song = await findSong(folderId, title, artist)
  if (!song) return null
  const others = await listVersions(song.id)
  const myPhotos = new Set((src.photo_paths ?? []).map((p) => p.split('/').pop()))
  const myKey = contentKey(src.lines)
  for (const o of others) {
    if ((o.photo_paths ?? []).some((p) => myPhotos.has(p.split('/').pop()))) return o.id
    if (myKey && contentKey(o.lines) === myKey) return o.id
  }
  return null
}

/** 스텝지를 다른 폴더로 복사 (음원·사진 파일도 새 폴더 경로로 다시 올림). 저쪽에 같은 원본이 이미 있으면 DUPLICATE */
export async function copySheet(id: string, targetFolderId: string): Promise<Stepsheet> {
  const src = await getSheet(id)
  if (!src) throw new Error('스텝지를 찾을 수 없어요')
  if (await findSameContent(targetFolderId, src.song?.title ?? '', src.song?.artist ?? '', src)) throw new Error('DUPLICATE')
  const refetch = async (bucket: 'audio' | 'photos', path: string) => {
    const url = await signedUrl(bucket, path)
    const blob = await (await fetch(url)).blob()
    const name = path.split('/').pop() ?? 'file'
    return new File([blob], name, { type: blob.type })
  }
  const audioFile = src.audio_path ? await refetch('audio', src.audio_path) : null
  const photoFiles = await Promise.all((src.photo_paths ?? []).map((p) => refetch('photos', p)))
  return saveSheet({
    title: src.song?.title ?? '',
    artist: src.song?.artist ?? '',
    creator_name: src.creator_name,
    creator_info: src.creator_info,
    memo: src.memo,
    lines: src.lines,
    folderId: targetFolderId,
    audioFile,
    audioUrl: src.audio_url ?? '',
    photoFiles,
  })
}

/** 다른 폴더로 옮기기 = 복사한 뒤 원본(글·음원·사진) 지우기 */
export async function moveSheet(id: string, targetFolderId: string): Promise<Stepsheet> {
  const src = await getSheet(id)
  if (!src) throw new Error('스텝지를 찾을 수 없어요')
  const saved = await copySheet(id, targetFolderId)
  await deleteSheet(id)
  if (src.audio_path) await supabase.storage.from('audio').remove([src.audio_path])
  if (src.photo_paths?.length) await supabase.storage.from('photos').remove(src.photo_paths)
  return saved
}

/** 녹음 → 글 (엣지 함수가 Whisper 또는 Gemini로 받아 적음) */
export async function transcribe(blob: Blob, hint?: string): Promise<string> {
  const b64 = await new Promise<string>((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(String(r.result).split(',')[1] ?? '')
    r.onerror = () => rej(new Error('녹음을 읽지 못했어요'))
    r.readAsDataURL(blob)
  })
  const { data, error } = await supabase.functions.invoke('recognize', { body: { audio: { media_type: blob.type || 'audio/webm', data: b64, hint } } })
  if (error) {
    const msg = await (error as { context?: Response }).context?.json?.().then((j: { error?: string }) => j?.error).catch(() => undefined)
    throw new Error(msg || '받아 적지 못했어요. 다시 말해 주세요')
  }
  if (data?.error) throw new Error(data.error)
  return String(data?.text ?? '').trim()
}

/** 스텝 내용 고치기: 말로 한 요청("3번 줄 티스텝을 런닝맨 4박으로")대로 AI가 줄을 바꿔 전체 줄을 돌려줌 */
export async function editLines(lines: Line[], memo: string, request: string): Promise<{ lines: Line[] | null; note: string; unclear: string }> {
  const { data, error } = await supabase.functions.invoke('recognize', { body: { edit_request: request, sheet: { lines, memo }, deep: deepAi() } })
  if (error) throw new Error('요청을 이해하지 못했어요. 다시 적어 주세요.')
  if (data?.error) throw new Error(data.error)
  return { lines: Array.isArray(data?.lines) ? normalizeLines(data.lines) : null, note: String(data?.note ?? ''), unclear: String(data?.unclear ?? '') }
}

/**
 * 직접 요청("1번 하고 4박 더 쉬고 2번", "후렴 두 번", "35초부터", "박자 128")을 춤추는 계획으로.
 * plan 항목: {line: 1부터 세는 스텝 줄 번호, beats?, at?} | {rest: 박수}. 못 알아들으면 unclear에 되묻는 말.
 */
export type PlanReply = { plan: ({ line: number; beats?: number; at?: number } | { rest: number })[]; note: string; startAt: number | null; bpm: number | null; unclear: string }
export async function planRequest(lines: string[], request: string): Promise<PlanReply> {
  const { data, error } = await supabase.functions.invoke('recognize', { body: { order_request: request, lines, deep: deepAi() } })
  if (error) throw new Error('요청을 이해하지 못했어요. 다시 적어 주세요.')
  if (data?.error) throw new Error(data.error)
  return parsePlan(data, lines.length)
}
/**
 * 영상 보고 맞추기(고도 추론): 영상에서 뽑은 장면표(시각이 적힌 프레임 격자)를 AI가 보고 줄마다 시작 시각을 찾아 계획으로.
 * 영상은 올리지 않고 장면표 그림만 보낸다. 1~3분 걸릴 수 있다.
 */
export type AiSyncSrc = { sheets: { media_type: string; data: string }[]; step: number; duration: number } | { ytUrl: string } | { audio: { media_type: string; data: string } }
export async function videoSync(sheetId: string, src: AiSyncSrc, lines: string[], bpm: number): Promise<{ jobId: string } | PlanReply> {
  const video_sync = 'ytUrl' in src ? { yt_url: src.ytUrl, bpm } : 'audio' in src ? { audio: src.audio, bpm } : { frames: src.sheets, step: src.step, duration: src.duration, bpm }
  const { data, error } = await supabase.functions.invoke('recognize', { body: { video_sync, lines, deep: deepAi(), async: true, sheet_id: sheetId } })
  if (error) throw new Error('AI가 영상·음악을 읽지 못했어요. 파일이 크면 시간이 모자랄 수 있어요. 한 번 더 해 보세요.')
  if (data?.error) throw new Error(data.error)
  if (typeof data?.job_id === 'string') return { jobId: data.job_id }
  return parsePlan(data, lines.length)
}
/** 서버에서 이어서 도는 AI 작업 상태 */
export type AiJob = { id: string; status: 'running' | 'done' | 'failed'; result: Record<string, unknown> | null; error: string | null }
export async function getJob(id: string): Promise<AiJob | null> {
  const { data, error } = await supabase.from('ai_jobs').select('id,status,result,error').eq('id', id).maybeSingle()
  if (error) throw error
  return (data as AiJob | null) ?? null
}
/** 유튜브 미리보기 장면(스토리보드)을 서버가 가져다 줌: 스프라이트 그림들 + 격자 정보. 비공개·연령 제한 영상은 안 될 수 있음 */
export async function ytStoryboard(videoId: string): Promise<Storyboard> {
  const { data, error } = await supabase.functions.invoke('recognize', { body: { yt_frames: videoId } })
  if (error) throw new Error('유튜브에서 장면을 가져오지 못했어요. 잠시 뒤 다시 해 보세요.')
  if (data?.error) throw new Error(data.error)
  const sb = data as Storyboard
  if (!Array.isArray(sb?.images) || !sb.images.length || !(sb.interval > 0)) throw new Error('유튜브에서 장면을 가져오지 못했어요')
  return sb
}
export function parsePlan(data: Record<string, unknown> | null, nLines: number): PlanReply {
  const num = (v: unknown) => (typeof v === 'number' && isFinite(v) ? v : null)
  const plan: PlanReply['plan'] = []
  for (const raw of Array.isArray(data?.plan) ? data.plan : []) {
    const r = raw as Record<string, unknown>
    if (typeof r?.rest === 'number' && r.rest > 0) plan.push({ rest: Math.min(64, Math.round(r.rest)) })
    else {
      const line = Number(r?.line)
      if (!Number.isInteger(line) || line < 1 || line > nLines) continue
      const item: { line: number; beats?: number; at?: number } = { line }
      const b = num(r.beats)
      if (b && b > 0 && b <= 128) item.beats = Math.round(b)
      const at = num(r.at)
      if (at !== null && at >= 0) item.at = at
      plan.push(item)
    }
  }
  return { plan, note: String(data?.note ?? ''), startAt: num(data?.start_at), bpm: num(data?.bpm), unclear: String(data?.unclear ?? '') }
}
