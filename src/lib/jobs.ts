/**
 * 서버에서 이어서 도는 AI 작업(영상 보고 맞추기 등)을 기기에 기억해 두고, 화면을 떠났다 와도 결과를 받아 적용한다.
 * 작업 번호와 적용에 필요한 정보(어느 스텝지, 어느 음원, 박자)를 localStorage에 둔다.
 */
import type { SyncSource } from './types'

export type LocalJob = { id: string; sheetId: string; kind: 'video_sync'; src: SyncSource; bpm: number; sure?: boolean; title: string; started: number } // sure: bpm이 믿을 만한 값인지(음원 분석·직접 찍음)
const KEY = 'ai-jobs'
/** 작업이 끝나 적용됐을 때 창에 알리는 이벤트 (detail: { sheetId, jobId }) */
export const JOB_EVENT = 'ai-job-done'

export function listJobs(): LocalJob[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}
export function addJob(job: LocalJob) {
  localStorage.setItem(KEY, JSON.stringify([...listJobs().filter((j) => j.id !== job.id), job]))
  window.dispatchEvent(new Event('ai-jobs-changed'))
}
export function removeJob(id: string) {
  localStorage.setItem(KEY, JSON.stringify(listJobs().filter((j) => j.id !== id)))
  window.dispatchEvent(new Event('ai-jobs-changed'))
}
export const jobFor = (sheetId: string) => listJobs().find((j) => j.sheetId === sheetId) ?? null
