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

export interface Step {
  name: string
  count: string
  direction: string
  uncertain?: boolean
}

export interface Section {
  name: string
  steps: Step[]
}

export interface Stepsheet {
  id: string
  song_id: string
  folder_id: string
  creator_name: string
  difficulty: string
  sections: Section[]
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
  difficulty: string
  memo: string
  sections: Section[]
}

export const emptyRecognized = (): Recognized => ({
  title: '',
  artist: '',
  creator_name: '',
  difficulty: '',
  memo: '',
  sections: [{ name: '본문', steps: [{ name: '', count: '', direction: '' }] }],
})
