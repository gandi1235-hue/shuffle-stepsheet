import { supabase } from './supabase'
import type { Folder, Recognized, Role, Song, Stepsheet } from './types'

export async function listFolders(): Promise<Folder[]> {
  const { data: members, error } = await supabase
    .from('folder_members')
    .select('role, folders(id, name, kind, owner_id, invite_code)')
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
  return (data ?? []).map((s) => ({ ...(s as Song), sheets: (s.stepsheets as Stepsheet[]) ?? [] }))
}

export async function getSheet(id: string): Promise<Stepsheet | null> {
  const { data, error } = await supabase.from('stepsheets').select('*, song:songs(*)').eq('id', id).maybeSingle()
  if (error) throw error
  return (data as Stepsheet | null) ?? null
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
  const ors = [`creator_name.ilike.%${term}%`, `memo.ilike.%${term}%`, `sections.cs.${JSON.stringify(term)}`]
  if (songIds.length) ors.push(`song_id.in.(${songIds.join(',')})`)
  query = query.or(ors.filter((o) => !o.startsWith('sections.cs')).join(','))
  const { data } = await query
  const byText = ((data as Stepsheet[]) ?? []).filter(Boolean)
  // 스텝 이름 검색은 클라이언트에서 보완
  const { data: all } = await supabase.from('stepsheets').select('*, song:songs(*)').limit(500)
  const extra = ((all as Stepsheet[]) ?? []).filter((s) =>
    s.sections.some((sec) => sec.steps.some((st) => st.name.includes(term))),
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
    difficulty: input.difficulty,
    sections: input.sections,
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
  if (!r.sections?.length) r.sections = [{ name: '본문', steps: [] }]
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
