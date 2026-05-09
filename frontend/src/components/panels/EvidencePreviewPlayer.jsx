import { useState, useRef, useEffect } from 'react'
import { Play, Pause, SkipForward, SkipBack, Maximize2, Download, Info, Camera, Volume2, VolumeX } from 'lucide-react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

/**
 * Map a CCTV event to its video URL.
 * Falls back to the known suspect_video.mp4 for any CCTV event.
 */
function resolveVideoUrl(event) {
  if (!event) return `${API}/media/suspect_video.mp4`

  // If the backend stores a video_url or file_path on the event, prefer that
  if (event.video_url)  return event.video_url.startsWith('http') ? event.video_url : `${API}${event.video_url}`
  if (event.file_path)  return `${API}/media/${event.file_path.split(/[\\/]/).pop()}`
  if (event.filename)   return `${API}/media/${event.filename}`

  // CCTV events → serve the real footage
  if (event.type === 'cctv' || event.category === 'cctv') {
    return `${API}/media/suspect_video.mp4`
  }
  return null
}

function fmt(secs) {
  if (!isFinite(secs)) return '00:00'
  const m = Math.floor(secs / 60), s = Math.floor(secs % 60)
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
}

export default function EvidencePreviewPlayer({ event }) {
  const videoRef  = useRef(null)
  const [playing, setPlaying]   = useState(false)
  const [current, setCurrent]   = useState(0)
  const [duration, setDuration] = useState(0)
  const [muted, setMuted]       = useState(true)
  const [error, setError]       = useState(false)

  const videoUrl = resolveVideoUrl(event)
  const isVideo  = !!videoUrl
  const camId    = event?.description?.match(/CAM[-\s\w]+/i)?.[0] || 'CAM_03'
  const ts       = event?.timestamp
    ? new Date(event.timestamp).toLocaleString('en-US', {
        year:'numeric', month:'2-digit', day:'2-digit',
        hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false,
      }).replace(',','')
    : '11/15/2024  04:38:55'

  // Reset when event changes
  useEffect(() => {
    setPlaying(false)
    setCurrent(0)
    setError(false)
    if (videoRef.current) {
      videoRef.current.pause()
      videoRef.current.currentTime = 0
    }
  }, [videoUrl])

  const togglePlay = () => {
    const v = videoRef.current
    if (!v) return
    if (playing) { v.pause(); setPlaying(false) }
    else         { v.play().then(() => setPlaying(true)).catch(() => setError(true)) }
  }

  const seek = (e) => {
    const v = videoRef.current
    if (!v || !duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const pct  = (e.clientX - rect.left) / rect.width
    v.currentTime = pct * duration
  }

  const skip = (delta) => {
    const v = videoRef.current
    if (!v) return
    v.currentTime = Math.max(0, Math.min(duration, v.currentTime + delta))
  }

  const progress = duration > 0 ? (current / duration) * 100 : 0

  return (
    <div className="flex flex-col h-full select-none">
      {/* Panel header */}
      <div className="flex items-center justify-between px-3 py-1.5 flex-shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <span className="text-[9px] font-bold tracking-widest text-slate-500 uppercase">Evidence Preview</span>
        <div className="flex items-center gap-1.5 text-[9px] font-mono" style={{ color:'#00d4ff' }}>
          <Camera size={9} />{camId}
        </div>
      </div>

      {/* Video frame */}
      <div className="flex-1 relative mx-2 mt-1.5 rounded-lg overflow-hidden bg-black" style={{ minHeight:0 }}>

        {isVideo && !error ? (
          /* ── Real <video> element ── */
          <video
            ref={videoRef}
            src={videoUrl}
            muted={muted}
            playsInline
            loop
            className="w-full h-full object-cover"
            onTimeUpdate={e => setCurrent(e.target.currentTime)}
            onDurationChange={e => setDuration(e.target.duration)}
            onEnded={() => setPlaying(false)}
            onError={() => setError(true)}
            onClick={togglePlay}
            style={{ cursor:'pointer', background:'#050805' }}
          />
        ) : (
          /* ── Fallback static frame ── */
          <div className="absolute inset-0 flex items-center justify-center"
            style={{ background:'radial-gradient(ellipse at 40% 40%, #0f1a10 0%, #050805 60%, #020403 100%)' }}>
            <svg width="120" height="150" viewBox="0 0 120 150" fill="none" opacity="0.6">
              <ellipse cx="60" cy="28" rx="16" ry="18" fill="#1a2a1a" stroke="#2a3a2a" strokeWidth="1"/>
              <path d="M40 50 Q60 45 80 50 L85 95 Q60 102 35 95 Z" fill="#152015" stroke="#1e2e1e" strokeWidth="1"/>
              <path d="M80 60 L100 75 L96 80 L76 65 Z" fill="#152015"/>
              <rect x="95" y="72" width="22" height="7" rx="2" fill="#2a3a2a" stroke="#3a4a3a"/>
              <rect x="101" y="79" width="6" height="10" rx="1" fill="#1a2a1a"/>
              <path d="M45 95 L38 135 L50 135 L60 108 L70 135 L82 135 L75 95 Z" fill="#111e11"/>
            </svg>
            {error && (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[10px] text-slate-600 font-mono">Video unavailable</span>
              </div>
            )}
          </div>
        )}

        {/* AI bounding box overlay */}
        {(event?.type === 'cctv' || !event) && !error && (
          <svg className="absolute inset-0 pointer-events-none z-10 w-full h-full"
            viewBox="0 0 320 180" preserveAspectRatio="xMidYMid meet">
            <rect x="88" y="18" width="100" height="148" rx="3"
              stroke="#ef4444" strokeWidth="1.5" fill="rgba(239,68,68,0.05)"
              strokeDasharray="6 3" opacity="0.9"/>
            {[[88,18],[188,18],[88,166],[188,166]].map(([x,y],i) => {
              const d = i < 2 ? 1 : -1, h = i%2===0 ? 1 : -1
              return (
                <g key={i} stroke="#ef4444" strokeWidth="2" opacity="0.95">
                  <line x1={x} y1={y} x2={x+h*14} y2={y}/>
                  <line x1={x} y1={y} x2={x} y2={y+d*14}/>
                </g>
              )
            })}
            <rect x="88" y="5" width="72" height="14" rx="2" fill="#ef4444" opacity="0.9"/>
            <text x="92" y="15.5" fontSize="8" fill="white"
              fontFamily="JetBrains Mono, monospace" fontWeight="600">
              SUSPECT · 94.3%
            </text>
          </svg>
        )}

        {/* Timestamp top-left */}
        <div className="absolute top-2 left-2 z-20 font-mono text-[9px] pointer-events-none"
          style={{ color:'rgba(0,212,255,0.85)', textShadow:'0 1px 4px #000' }}>{ts}</div>

        {/* Cam ID top-right */}
        <div className="absolute top-2 right-2 z-20 font-mono text-[9px] pointer-events-none"
          style={{ color:'rgba(255,255,255,0.5)', textShadow:'0 1px 4px #000' }}>{camId}</div>

        {/* REC indicator */}
        <div className="absolute bottom-2 left-2 z-20 flex items-center gap-1 pointer-events-none">
          <div className={`w-1.5 h-1.5 rounded-full ${playing ? 'blink' : ''}`}
            style={{ background:'#ef4444' }}/>
          <span className="text-[8px] font-mono text-red-400">REC</span>
        </div>

        {/* Confidence badge */}
        <div className="absolute bottom-2 right-2 z-20 px-1.5 py-0.5 rounded text-[8px] font-bold badge-red pointer-events-none">
          HIGH CONFIDENCE
        </div>

        {/* Big play overlay when paused */}
        {!playing && isVideo && !error && (
          <div className="absolute inset-0 z-30 flex items-center justify-center cursor-pointer"
            onClick={togglePlay}
            style={{ background:'rgba(0,0,0,0.25)' }}>
            <div className="w-12 h-12 rounded-full flex items-center justify-center"
              style={{ background:'rgba(0,212,255,0.18)', border:'2px solid rgba(0,212,255,0.4)', backdropFilter:'blur(4px)' }}>
              <Play size={22} style={{ color:'#00d4ff', marginLeft:2 }}/>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="px-3 py-1.5 flex-shrink-0">
        {/* Scrub bar */}
        <div className="relative h-1 rounded-full mb-2 cursor-pointer group"
          style={{ background:'rgba(255,255,255,0.08)' }}
          onClick={seek}>
          <div className="h-full rounded-full transition-all"
            style={{ width:`${progress}%`, background:'linear-gradient(90deg,#00d4ff88,#00d4ff)' }}/>
          <div className="absolute top-1/2 w-2.5 h-2.5 rounded-full border-2 border-white opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ left:`${progress}%`, background:'#00d4ff', transform:'translateY(-50%) translateX(-50%)' }}/>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <button id="video-skip-back" onClick={() => skip(-5)}
              className="w-6 h-6 flex items-center justify-center rounded hover:bg-white/5 text-slate-400 hover:text-white transition-colors">
              <SkipBack size={11}/>
            </button>
            <button id="video-play-pause" onClick={togglePlay}
              className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
              style={{ background:'rgba(0,212,255,0.15)', border:'1px solid rgba(0,212,255,0.25)' }}>
              {playing
                ? <Pause size={11} style={{ color:'#00d4ff' }}/>
                : <Play  size={11} style={{ color:'#00d4ff', marginLeft:1 }}/>}
            </button>
            <button id="video-skip-fwd" onClick={() => skip(5)}
              className="w-6 h-6 flex items-center justify-center rounded hover:bg-white/5 text-slate-400 hover:text-white transition-colors">
              <SkipForward size={11}/>
            </button>
            <span className="text-[9px] font-mono text-slate-500 ml-1">
              {fmt(current)} / {fmt(duration)}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => { setMuted(m => !m); if (videoRef.current) videoRef.current.muted = !muted }}
              className="w-6 h-6 flex items-center justify-center rounded hover:bg-white/5 text-slate-500 hover:text-slate-300 transition-colors">
              {muted ? <VolumeX size={11}/> : <Volume2 size={11}/>}
            </button>
            <button className="w-6 h-6 flex items-center justify-center rounded hover:bg-white/5 text-slate-500 hover:text-slate-300 transition-colors"><Info size={11}/></button>
            <button onClick={() => { const a = document.createElement('a'); a.href=videoUrl; a.download=''; a.click() }}
              className="w-6 h-6 flex items-center justify-center rounded hover:bg-white/5 text-slate-500 hover:text-slate-300 transition-colors"><Download size={11}/></button>
            <button onClick={() => videoRef.current?.requestFullscreen()}
              className="w-6 h-6 flex items-center justify-center rounded hover:bg-white/5 text-slate-500 hover:text-slate-300 transition-colors"><Maximize2 size={11}/></button>
          </div>
        </div>
      </div>
    </div>
  )
}
