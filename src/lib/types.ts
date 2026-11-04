export type Role = 'owner' | 'editor' | 'viewer'

export interface Folder {
  id: string
  name: string
  kind: 'personal' | 'shared'
  owner_id: string
  invite_code: string | null
  role?: Role
  song_count?: number
}

export interface Song {
  id: string
  folder_id: string
  title: string
  artist: string
}

/** 스텝 하나: 이름 + 박수 (예: "T스텝 오 왼", "4박") */
export interface Step {
  name: string
  beats: string
  uncertain?: boolean
}

/** 스텝지 한 줄: 스텝 1~2개 */
export interface Line {
  steps: Step[]
}

export interface Stepsheet {
  id: string
  song_id: string
  folder_id: string
  creator_name: string
  creator_info: string
  lines: Line[]
  memo: string
  audio_path: string | null
  audio_url: string | null
  photo_paths: string[]
  created_by: string | null
  created_at: string
  updated_at: string
  song?: Song
}

export interface Recognized {
  title: string
  artist: string
  creator_name: string
  creator_info: string
  memo: string
  lines: Line[]
}

export const emptyStep = (): Step => ({ name: '', beats: '4박' })
export const emptyLine = (): Line => ({ steps: [emptyStep(), emptyStep()] })

export const emptyRecognized = (): Recognized => ({
  title: '',
  artist: '',
  creator_name: '',
  creator_info: '',
  memo: '',
  lines: [emptyLine(), emptyLine(), emptyLine()],
})

export function beatsOf(s: string): number {
  const m = s.match(/\d+/)
  return m ? Number(m[0]) : 0
}

export function sheetStats(lines: Line[]) {
  const steps = lines.flatMap((l) => l.steps.filter((s) => s.name.trim()))
  return { lines: lines.length, steps: steps.length, beats: steps.reduce((n, s) => n + beatsOf(s.beats), 0) }
}

export function stepNames(lines: Line[]): string[] {
  return lines.flatMap((l) => l.steps.map((s) => s.name))
}
