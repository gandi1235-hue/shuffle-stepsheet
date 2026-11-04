import { createClient } from '@supabase/supabase-js'

// 공개용(publishable) 값이라 코드에 넣어도 안전합니다. 환경변수가 있으면 그것을 씁니다.
const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || 'https://ahttzotjptmfywpvkopi.supabase.co'
const key = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || 'sb_publishable_J1y2b9sqQrnfv-QIEkrUEw_Sa_1kdB_'

export const configured = Boolean(url && key)

export const supabase = createClient(
  url ?? 'https://placeholder.supabase.co',
  key ?? 'placeholder',
)
