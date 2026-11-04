import { useEffect, useRef } from 'react'
import { useAuth } from '../lib/auth'
import { getJob, getSheet, parsePlan, updateSync } from '../lib/api'
import { JOB_EVENT, listJobs, removeJob, type LocalJob } from '../lib/jobs'
import { planFromReply } from '../lib/sync'
import { withSync } from '../lib/types'
import { useToast } from './ui'

/**
 * 서버에서 이어서 도는 AI 작업을 5초마다 확인해, 끝나면 결과를 스텝지에 저장하고 알려 준다.
 * 어느 화면에 있어도(앱을 껐다 켜도) 작업이 사라지지 않는다. 취소는 기기에서 작업을 잊는 것으로 충분(결과를 안 받음).
 */
export default function JobWatcher() {
  const { session } = useAuth()
  const toast = useToast()
  const busy = useRef(false)
  useEffect(() => {
    if (!session) return
    const check = async (j: LocalJob) => {
      // 10분 넘게 소식 없는 작업은 포기
      if (Date.now() - j.started > 10 * 60 * 1000) {
        removeJob(j.id)
        toast(`${j.title} 영상 보고 맞추기가 너무 오래 걸려 그만뒀어요. 다시 해 보세요`)
        return
      }
      let job
      try {
        job = await getJob(j.id)
      } catch {
        return
      }
      if (!job || job.status === 'running') return
      removeJob(j.id)
      if (job.status === 'failed') return toast(`${j.title} 영상 보고 맞추기 실패: ${job.error ?? '알 수 없는 오류'}`)
      try {
        const sheet = await getSheet(j.sheetId)
        if (!sheet) return
        const r = parsePlan(job.result, sheet.lines.length)
        const out = planFromReply(sheet, r, j.bpm, 0)
        if (!out) return toast(`${j.title}: ${r.unclear || '영상에서 스텝 시작을 찾지 못했어요'}`)
        await updateSync(sheet.id, withSync(sheet.sync, j.src, out.events, out.rate, out.plan))
        toast(`🎬 ${j.title} 영상 보고 맞춘 동기화를 저장했어요${r.note ? ` · ${r.note}` : ''}`)
        window.dispatchEvent(new CustomEvent(JOB_EVENT, { detail: { sheetId: j.sheetId, jobId: j.id } }))
      } catch (e) {
        toast(`${j.title} 결과를 저장하지 못했어요: ${(e as Error).message}`)
      }
    }
    const tick = async () => {
      if (busy.current || document.visibilityState === 'hidden') return
      const jobs = listJobs()
      if (!jobs.length) return
      busy.current = true
      try {
        for (const j of jobs) await check(j)
      } finally {
        busy.current = false
      }
    }
    tick()
    const iv = setInterval(tick, 5000)
    const onVis = () => tick()
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('ai-jobs-changed', onVis)
    return () => {
      clearInterval(iv)
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('ai-jobs-changed', onVis)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session])
  return null
}
