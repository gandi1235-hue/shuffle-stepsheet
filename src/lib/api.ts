import { supabase } from './supabase'
import { normalizeLines, stepNames, type Folder, type Recognized, type Role, type Song, type Stepsheet } from './types'

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
  return (data ?? []).map((s) => ({ ...(s as Song), sheets: ((s.stepsheets as Stepsheet[]) ?? []).map((sh) => ({ ...sh, lines: normalizeLines(sh.lines) })) }))
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
}

export async function saveSheet(input: SaveInput): Promise<Stepsheet> {
  const { data: user } = await supabase.auth.getUser()
  const title = input.title.trim()
  const artist = input.artist.trim()
  let { data: song } = await supabase
    .from('songs')
    .select('*')
    .eq('folder_id', input.folderId)
    .eq('title', title)
    .eq('artist', artist)
    .maybeSingle()
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
    const upd = await supabase.from('stepsheets').update(row).eq('id', input.overwriteId).select('*').single()
    if (upd.error) throw upd.error
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
  const { data: song } = await supabase
    .from('songs')
    .select('id')
    .eq('folder_id', folderId)
    .eq('title', title.trim())
    .eq('artist', artist.trim())
    .maybeSingle()
  if (!song) return null
  const { data } = await supabase
    .from('stepsheets')
    .select('id')
    .eq('song_id', song.id)
    .eq('creator_name', creator.trim() || '미상')
    .maybeSingle()
  return data?.id ?? null
}

export async function deleteSheet(id: string) {
  const { error } = await supabase.from('stepsheets').delete().eq('id', id)
  if (error) throw error
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

export async function joinFolder(code: string): Promise<string> {
  const { data, error } = await supabase.rpc('join_folder', { code })
  if (error) throw error
  return data as string
}

export interface Member {
  user_id: string
  role: Role
  display_name: string
}

export async function listMembers(folderId: string): Promise<Member[]> {
  const { data, error } = await supabase
    .from('folder_members')
    .select('user_id, role, profiles(display_name)')
    .eq('folder_id', folderId)
  if (error) throw error
  return (data ?? []).map((m) => ({
    user_id: m.user_id,
    role: m.role as Role,
    display_name: (m.profiles as unknown as { display_name: string })?.display_name ?? '',
  }))
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

export async function updateSync(id: string, sync: (number | null)[] | null) {
  const { error } = await supabase.from('stepsheets').update({ sync, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}

export async function updateMemo(id: string, memo: string) {
  const { error } = await supabase.from('stepsheets').update({ memo, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}

/** 스텝지를 다른 폴더로 복사 (음원·사진 파일도 새 폴더 경로로 다시 올림) */
export async function copySheet(id: string, targetFolderId: string): Promise<Stepsheet> {
  const src = await getSheet(id)
  if (!src) throw new Error('스텝지를 찾을 수 없어요')
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
