import { useEffect, useRef, useState } from 'react'
import { transcribe } from './api'
import { haptic } from './prefs'

/**
 * 말로 적기: 마이크로 녹음했다가(누르면 시작, 다시 누르면 끝) 서버에서 받아 적어 onFinal로 넘김.
 * 브라우저 내장 인식보다 한국어·스텝 이름을 훨씬 잘 알아들음. toast는 마이크 거부 등 오류 알림용.
 */
export function useSpeech(onFinal: (text: string) => void, toast: (msg: string) => void, hint?: string) {
  const [listening, setListening] = useState(false)
  const [busy, setBusy] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const rec = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])
  const timer = useRef<number | null>(null)
  const cb = useRef(onFinal)
  cb.current = onFinal
  const ok = typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia) && typeof MediaRecorder !== 'undefined'

  const clearTimer = () => {
    if (timer.current) window.clearInterval(timer.current)
    timer.current = null
  }
  const start = async () => {
    if (!ok || listening || busy) return
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      toast('마이크 사용을 허용해 주세요')
      return
    }
    const type = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'].find((t) => MediaRecorder.isTypeSupported(t)) ?? ''
    const r = new MediaRecorder(stream, type ? { mimeType: type } : undefined)
    chunks.current = []
    r.ondataavailable = (e) => {
      if (e.data.size) chunks.current.push(e.data)
    }
    r.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop())
      clearTimer()
      setListening(false)
      const blob = new Blob(chunks.current, { type: r.mimeType || type || 'audio/webm' })
      chunks.current = []
      if (blob.size < 1500) return // 너무 짧음(실수로 누름)
      setBusy(true)
      try {
        const text = await transcribe(blob, hint)
        if (text) {
          cb.current(text)
          haptic(10)
        } else toast('말이 들리지 않았어요. 다시 말해 주세요')
      } catch (e) {
        toast((e as Error).message)
      } finally {
        setBusy(false)
      }
    }
    rec.current = r
    r.start()
    setListening(true)
    setSeconds(0)
    timer.current = window.setInterval(() => setSeconds((n) => n + 1), 1000)
    haptic(10)
    // 너무 길어지지 않게 60초에서 자동으로 끝냄
    window.setTimeout(() => {
      if (rec.current === r && r.state === 'recording') r.stop()
    }, 60000)
  }
  const stop = () => {
    const r = rec.current
    rec.current = null
    if (r && r.state === 'recording') r.stop()
    else {
      clearTimer()
      setListening(false)
    }
  }
  useEffect(
    () => () => {
      clearTimer()
      const r = rec.current
      rec.current = null
      if (r && r.state === 'recording') {
        r.onstop = () => r.stream.getTracks().forEach((t) => t.stop())
        r.stop()
      }
    },
    [],
  )
  return { ok, listening, busy, seconds, start, stop }
}
