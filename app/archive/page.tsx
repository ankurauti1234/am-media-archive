'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { ProtectedLayout } from '@/components/protected-layout'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table'
import {
  Calendar as CalendarIcon,
  Video,
  FileSpreadsheet,
  Play,
  Pause,
  Download,
  Tv,
  Clock,
  Maximize2,
  Minimize2,
  Volume1,
  Volume2,
  VolumeX,
  RotateCcw,
  RotateCw,
  Loader2,
  Database,
  FileWarning,
  ChevronsLeft,
  ChevronsRight,
  Table as TableIcon,
  Scissors,
  Info,
} from 'lucide-react'
import { format } from 'date-fns'
import { archiveApi } from '@/lib/api-client'

// Exactly matches the channel definitions from the TV channels directory
const CHANNELS = [
  // Active / Enabled Channels
  { id: '1002', name: 'Kentron TV HD', type: 'News & Entertainment', disabled: false, logoUrl: 'https://d2wka5to517y0w.cloudfront.net/ar_channels_logo/kentron_tv_logo.png' },
  { id: '1005', name: 'Boon TV', type: 'Educational & Cultural', disabled: false, logoUrl: 'https://d2wka5to517y0w.cloudfront.net/ar_channels_logo/boon_tv.png' },
  { id: '1007', name: 'Public TV', type: 'Public Broadcasting', disabled: false, logoUrl: 'https://d2wka5to517y0w.cloudfront.net/ar_channels_logo/1st_channel.png' },
  { id: '1009', name: 'First News Channel', type: '24/7 News', disabled: false, logoUrl: 'https://d2wka5to517y0w.cloudfront.net/ar_channels_logo/1st_news_channel.png' },
  { id: '1010', name: 'Armenia TV', type: 'General Broadcast', disabled: false, logoUrl: 'https://d2wka5to517y0w.cloudfront.net/ar_channels_logo/armenia_tv.png' },
  { id: '1011', name: 'Shant TV', type: 'Drama & News', disabled: false, logoUrl: 'https://d2wka5to517y0w.cloudfront.net/ar_channels_logo/shant_tv_logo.png' },
  { id: '1012', name: 'A TV', type: 'Music & Entertainment', disabled: false, logoUrl: null },
  { id: '1013', name: 'TV 5', type: 'Entertainment & News', disabled: false, logoUrl: 'https://d2wka5to517y0w.cloudfront.net/ar_channels_logo/5_tv.png' },
  { id: '1014', name: 'Dar 21 tv', type: 'Youth & Music', disabled: false, logoUrl: 'https://d2wka5to517y0w.cloudfront.net/ar_channels_logo/dar_21_hd.png' },
  { id: '1017', name: 'Mir TV', type: 'Interstate Broadcasting', disabled: false, logoUrl: 'https://d2wka5to517y0w.cloudfront.net/ar_channels_logo/mir_tv.png' },
  // Disabled / Inactive Channels
  { id: '1001', name: 'Fast Sports', type: 'Sports Channel', disabled: true, logoUrl: 'https://d2wka5to517y0w.cloudfront.net/ar_channels_logo/fast_sports.png' },
  { id: '1003', name: 'Free News', type: 'News Channel', disabled: true, logoUrl: 'https://d2wka5to517y0w.cloudfront.net/ar_channels_logo/free_news.png' },
  { id: '1004', name: 'Nur TV', type: 'Entertainment', disabled: true, logoUrl: 'https://d2wka5to517y0w.cloudfront.net/ar_channels_logo/nur_tv.png' },
  { id: '1006', name: 'Nor Hayastan', type: 'Entertainment', disabled: true, logoUrl: 'https://d2wka5to517y0w.cloudfront.net/ar_channels_logo/nor_hayasthan.png' },
  { id: '1008', name: 'Shoghakat TV', type: 'Cultural & Religious', disabled: true, logoUrl: 'https://d2wka5to517y0w.cloudfront.net/ar_channels_logo/shokhagat_tv.png' },
]

interface DbRecord {
  id: number
  channelId: string
  date: string
  hour: number
  videoS3Url: string
  csvS3Url: string
  localVideoPath: string
  localCsvPath: string
}

export default function ArchivePage() {
  return (
    <ProtectedLayout>
      <ArchiveDashboard />
    </ProtectedLayout>
  )
}

function ArchiveDashboard() {
  // Navigation & filter states
  // Defaulting to 1009, today's date, 00:00 (hour 0)
  const [selectedChannel, setSelectedChannel] = useState('1009')
  const [selectedDate, setSelectedDate] = useState<Date>(new Date('2026-06-15'))
  const [selectedHour, setSelectedHour] = useState<number>(0)

  // Safe client-side mount: update date to today to avoid SSR hydration mismatches
  useEffect(() => {
    setSelectedDate(new Date())
  }, [])

  // API State
  const [dayRecords, setDayRecords] = useState<DbRecord[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [activeView, setActiveView] = useState<'player' | 'table'>('player')

  // Derive active record for player
  const record = useMemo(() => {
    return dayRecords.find((r) => r.hour === selectedHour) || null
  }, [dayRecords, selectedHour])

  // Video player custom states
  const videoRef = useRef<HTMLVideoElement>(null)
  const playerContainerRef = useRef<HTMLDivElement>(null)
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [volume, setVolume] = useState(1) // 0 to 1
  const [videoProgress, setVideoProgress] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const [hoverTime, setHoverTime] = useState<number | null>(null)
  const [hoverX, setHoverX] = useState<number>(0)
  
  // Keyboard/Action feedback overlay state
  const [feedback, setFeedback] = useState<{ type: string; visible: boolean; triggerId: number }>({
    type: '',
    visible: false,
    triggerId: 0,
  })

  const [isFindingClosest, setIsFindingClosest] = useState(false)

  // Video Clipper States
  const [isClipperMode, setIsClipperMode] = useState(false)
  const [clipStart, setClipStart] = useState<number>(0)
  const [clipEnd, setClipEnd] = useState<number>(10)
  const [clipName, setClipName] = useState<string>('')
  const [isClipping, setIsClipping] = useState(false)
  const [clippingProgress, setClippingProgress] = useState(0)
  const [clippingSpeed, setClippingSpeed] = useState<number>(1)
  const [showClipperInfo, setShowClipperInfo] = useState(false)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const isClippingRef = useRef(false)
  const clipEndRef = useRef(0)
  
  // Cache variables to restore player state after clipping completes
  const prevPlayStateRef = useRef(false)
  const prevTimeRef = useRef(0)
  const prevVolumeRef = useRef(1)
  const prevMuteRef = useRef(false)
  const prevSpeedRef = useRef(1)

  const dateString = format(selectedDate, 'yyyy-MM-dd')
  const formattedDateLabel = format(selectedDate, 'PPP')

  // Derive active TV Channel info
  const activeChannelObj = useMemo(() => {
    return CHANNELS.find((c) => c.id === selectedChannel) || CHANNELS[0]
  }, [selectedChannel])

  // Fetch records from API for the selected channel and date
  useEffect(() => {
    let active = true
    const fetchArchiveRecords = async () => {
      setIsLoading(true)
      setFetchError(null)
      try {
        const records = await archiveApi.getDailyRecords(selectedChannel, dateString)
        if (active) {
          setDayRecords(records)
        }
      } catch (err: any) {
        console.error('Fetch error:', err)
        if (active) {
          setFetchError(err.message || 'Failed to query database')
        }
      } finally {
        if (active) {
          setIsLoading(false)
        }
      }
    }

    fetchArchiveRecords()
    return () => {
      active = false
    }
  }, [selectedChannel, dateString])

  const handleOpenClosestRecording = async () => {
    setIsFindingClosest(true)
    try {
      const record = await archiveApi.getClosestRecord(selectedChannel, dateString, selectedHour)
      if (record) {
        const recordDateStr = record.date.split('T')[0]
        const [year, month, day] = recordDateStr.split('-').map(Number)
        const recordDate = new Date(year, month - 1, day)
        setSelectedDate(recordDate)
        setSelectedHour(record.hour)
      } else {
        alert('No recordings found for this channel in the database.')
      }
    } catch (err: any) {
      console.error('Error finding closest recording:', err)
      alert(err.message || 'Could not search for closest recording.')
    } finally {
      setIsFindingClosest(false)
    }
  }

  // Reset player when hour/channel changes
  useEffect(() => {
    setIsPlaying(false)
    setVideoProgress(0)
    setCurrentTime(0)
    setDuration(0)

    // Set default clip name based on current channel, date, and hour
    const formattedHour = selectedHour.toString().padStart(2, '0')
    const safeChannelName = activeChannelObj.name.replace(/[^a-zA-Z0-9]/g, '_')
    setClipName(`${safeChannelName}_${dateString}_${formattedHour}h_clip`)
    setClipStart(0)
    setClipEnd(60) // default to 60s (updated when metadata loads)
  }, [selectedChannel, selectedDate, selectedHour, record, activeChannelObj, dateString])

  // Reset clip boundaries to video start/end when entering clipper mode or when video/duration changes
  useEffect(() => {
    if (isClipperMode) {
      setClipStart(0)
      const dur = videoRef.current?.duration || duration
      if (dur && !isNaN(dur) && dur > 0) {
        setClipEnd(dur)
      }
    }
  }, [isClipperMode, record, duration])

  // Derived helper for Table View rows (incorporates active rows)
  const tableRows = useMemo(() => {
    return Array.from({ length: 24 }).map((_, hour) => {
      const dbMatch = dayRecords.find((r) => r.hour === hour) || null
      const hasData = !!dbMatch
      const videoUrlToUse = dbMatch?.videoS3Url || ''
      const csvUrlToUse = dbMatch?.csvS3Url || ''
      let displayFileName = ''

      if (dbMatch) {
        const parts = dbMatch.localVideoPath.split(/[\\/]/)
        displayFileName = parts[parts.length - 1]
      }

      return {
        hour,
        hasData,
        record: dbMatch,
        fileName: displayFileName || '—',
        videoUrl: videoUrlToUse,
        csvUrl: csvUrlToUse,
      }
    })
  }, [dayRecords])

  // Helper to show visual feedback overlay in the center of the video
  const showFeedback = (type: string) => {
    const triggerId = Date.now()
    setFeedback({ type, visible: true, triggerId })
    setTimeout(() => {
      setFeedback((prev) => (prev.triggerId === triggerId ? { ...prev, visible: false } : prev))
    }, 500)
  }

  // Video operations
  const handlePlayPause = () => {
    if (!videoRef.current) return
    if (isPlaying) {
      videoRef.current.pause()
      setIsPlaying(false)
      showFeedback('pause')
    } else {
      videoRef.current.play()
      setIsPlaying(true)
      showFeedback('play')
    }
  }

  const handleMuteToggle = () => {
    if (!videoRef.current) return
    const targetMute = !isMuted
    videoRef.current.muted = targetMute
    setIsMuted(targetMute)
    showFeedback(targetMute ? 'mute' : 'unmute')
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVol = parseFloat(e.target.value)
    setVolume(newVol)
    if (videoRef.current) {
      videoRef.current.volume = newVol
      videoRef.current.muted = newVol === 0
    }
    if (newVol > 0 && isMuted) {
      setIsMuted(false)
    }
  }

  const handleVideoTimeUpdate = () => {
    if (!videoRef.current) return
    const curTime = videoRef.current.currentTime
    setCurrentTime(curTime)
    setVideoProgress((curTime / (videoRef.current.duration || 1)) * 100)

    // Check if we are clipping and reached end
    if (isClippingRef.current) {
      const totalDuration = clipEndRef.current - clipStart
      const elapsed = Math.max(0, curTime - clipStart)
      const pct = Math.min(100, (elapsed / (totalDuration || 1)) * 100)
      setClippingProgress(pct)

      if (curTime >= clipEndRef.current || curTime >= (videoRef.current.duration || 0)) {
        stopClipping(true)
      }
    }
  }

  const stopClipping = (download = true) => {
    if (!mediaRecorderRef.current || !isClippingRef.current) return

    isClippingRef.current = false
    setIsClipping(false)

    try {
      mediaRecorderRef.current.stop()
    } catch (e) {
      console.error("Error stopping MediaRecorder:", e)
    }

    if (videoRef.current) {
      videoRef.current.pause()

      // Restore previous state
      videoRef.current.playbackRate = prevSpeedRef.current
      videoRef.current.muted = prevMuteRef.current
      videoRef.current.volume = prevVolumeRef.current
      videoRef.current.currentTime = prevTimeRef.current
      if (prevPlayStateRef.current) {
        videoRef.current.play().catch(e => console.error("Error resuming playback:", e))
      }
    }
  }

  const startClipping = () => {
    if (!videoRef.current) return
    const video = videoRef.current

    // Validation
    if (clipStart < 0 || clipEnd <= clipStart || clipEnd > duration) {
      alert("Invalid start or end time. Start time must be >= 0, and end time must be > start time and within video duration.")
      return
    }

    // Cache current player state
    prevPlayStateRef.current = !video.paused
    prevTimeRef.current = video.currentTime
    prevVolumeRef.current = video.volume
    prevMuteRef.current = video.muted
    prevSpeedRef.current = video.playbackRate

    // Setup capturing stream
    const anyVideo = video as any
    let stream: MediaStream | null = null
    try {
      if (typeof anyVideo.captureStream === 'function') {
        stream = anyVideo.captureStream()
      } else if (typeof anyVideo.mozCaptureStream === 'function') {
        stream = anyVideo.mozCaptureStream()
      }
    } catch (e) {
      console.error("Error capturing stream:", e)
    }

    if (!stream) {
      alert("Your browser does not support capturing streams from video elements or CORS headers are blocking it. Please ensure the video has fully loaded.")
      return
    }

    // Prepare recorder
    let mimeType = 'video/webm;codecs=vp9,opus'
    if (typeof MediaRecorder.isTypeSupported === 'function') {
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm;codecs=vp8,opus'
      }
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm'
      }
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/mp4'
      }
    } else {
      mimeType = 'video/webm'
    }

    const chunks: Blob[] = []
    let recorder: MediaRecorder
    try {
      recorder = new MediaRecorder(stream, { mimeType })
    } catch (e) {
      console.error("Failed to construct MediaRecorder with mimeType " + mimeType, e)
      try {
        recorder = new MediaRecorder(stream)
        mimeType = recorder.mimeType || 'video/webm'
      } catch (err2) {
        alert("Failed to start MediaRecorder: " + String(err2))
        return
      }
    }

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        chunks.push(e.data)
      }
    }

    recorder.onstop = () => {
      if (chunks.length > 0) {
        const blob = new Blob(chunks, { type: mimeType })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url

        let ext = 'webm'
        if (mimeType.includes('mp4')) {
          ext = 'mp4'
        } else if (mimeType.includes('ogg')) {
          ext = 'ogg'
        }

        const cleanName = clipName.trim() || 'video_clip'
        a.download = `${cleanName}.${ext}`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      }
    }

    mediaRecorderRef.current = recorder
    isClippingRef.current = true
    clipEndRef.current = clipEnd
    setIsClipping(true)
    setClippingProgress(0)

    // Adjust playback settings for clipping
    video.pause()
    video.currentTime = clipStart
    video.muted = true
    video.playbackRate = clippingSpeed

    // Start recording and playback
    recorder.start(250)
    video.play().catch(e => {
      console.error("Error playing video for clipping:", e)
      stopClipping(false)
      alert("Playback failed. Please ensure the video is loaded and CORS is supported.")
    })
  }

  const handleCancelClipping = () => {
    if (isClippingRef.current) {
      isClippingRef.current = false
      setIsClipping(false)
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.onstop = null
        try {
          mediaRecorderRef.current.stop()
        } catch (e) {}
      }

      // Restore video player
      if (videoRef.current) {
        videoRef.current.pause()
        videoRef.current.playbackRate = prevSpeedRef.current
        videoRef.current.muted = prevMuteRef.current
        videoRef.current.volume = prevVolumeRef.current
        videoRef.current.currentTime = prevTimeRef.current
        if (prevPlayStateRef.current) {
          videoRef.current.play().catch(e => console.error("Error resuming playback:", e))
        }
      }
    }
  }

  const handleLoadedMetadata = () => {
    if (!videoRef.current) return
    const dur = videoRef.current.duration
    setDuration(dur)
    setClipEnd(dur || 60)
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current) return
    const newProgress = parseFloat(e.target.value)
    const targetTime = (newProgress / 100) * duration
    videoRef.current.currentTime = targetTime
    setCurrentTime(targetTime)
    setVideoProgress(newProgress)
  }

  const toggleFullscreen = () => {
    if (!playerContainerRef.current) return
    if (!document.fullscreenElement) {
      playerContainerRef.current.requestFullscreen().catch((err) => {
        console.error('Error enabling fullscreen:', err)
      })
    } else {
      document.exitFullscreen()
    }
  }

  // Handle controls visibility fadeout timeout
  const resetControlsTimeout = () => {
    setShowControls(true)
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current)
    }
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false)
      }, 2500)
    }
  }

  // Reset visibility timeout on play/pause changes
  useEffect(() => {
    resetControlsTimeout()
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current)
    }
  }, [isPlaying])

  // Sync fullscreen change event
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }
  }, [])

  // Window keyboard shortcuts (Space to toggle, arrows to skip, f for fullscreen, m to mute)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement
      if (
        activeEl?.tagName === 'INPUT' ||
        activeEl?.tagName === 'TEXTAREA' ||
        activeEl?.getAttribute('contenteditable') === 'true' ||
        activeEl?.closest('.rdp') // inside datepicker popup
      ) {
        return
      }

      if (e.key === ' ' || e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault()
      }

      switch (e.key) {
        case ' ':
          handlePlayPause()
          break
        case 'ArrowLeft':
          if (videoRef.current) {
            videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 10)
            showFeedback('skip-backward')
          }
          break
        case 'ArrowRight':
          if (videoRef.current) {
            videoRef.current.currentTime = Math.min(videoRef.current.duration || 0, videoRef.current.currentTime + 10)
            showFeedback('skip-forward')
          }
          break
        case 'm':
        case 'M':
          handleMuteToggle()
          break
        case 'f':
        case 'F':
          toggleFullscreen()
          break
        case 'ArrowUp':
          setVolume((v) => {
            const next = Math.min(1, v + 0.05)
            if (videoRef.current) videoRef.current.volume = next
            return next
          })
          showFeedback('volume-up')
          break
        case 'ArrowDown':
          setVolume((v) => {
            const next = Math.max(0, v - 0.05)
            if (videoRef.current) videoRef.current.volume = next
            return next
          })
          showFeedback('volume-down')
          break
        default:
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isPlaying, isMuted, volume, duration])

  const handleDoubleClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    if (target.closest('.player-controls-bar')) {
      return
    }
    toggleFullscreen()
  }

  const handleSingleClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    if (target.closest('.player-controls-bar')) {
      return
    }
    handlePlayPause()
  }

  const handleMouseMoveProgress = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const percent = Math.min(Math.max(0, x / rect.width), 1)
    const time = percent * duration
    setHoverTime(time)
    setHoverX(x)
  }

  const handleMouseLeaveProgress = () => {
    setHoverTime(null)
  }

  // Helper to format video seconds as m:ss
  const formatTime = (seconds: number): string => {
    if (isNaN(seconds)) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Helper to format video seconds as m:ss.t (with tenths of a second)
  const formatTimeWithSubseconds = (seconds: number): string => {
    if (isNaN(seconds)) return '0:00.0'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    const tenths = Math.floor((seconds % 1) * 10)
    return `${mins}:${secs.toString().padStart(2, '0')}.${tenths}`
  }

  // Determine actual playing video URL and details
  const videoUrl = useMemo(() => {
    return record?.videoS3Url || ''
  }, [record])

  const fileName = useMemo(() => {
    if (record?.localVideoPath) {
      // extract basename
      const parts = record.localVideoPath.split(/[\\/]/)
      return parts[parts.length - 1]
    }
    return ''
  }, [record])

  const csvUrl = record?.csvS3Url || ''

  return (
    <div className="flex flex-col h-full bg-background select-none">
      {/* Page Header */}
      <div className="py-4 px-6 border-b border-border/50 bg-background flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shrink-0">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-foreground flex items-center gap-2">
            Media Archives
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Query TV channel streams and telemetry data files directly from database.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Active selection info */}
          <Badge variant="outline" className="text-xs px-2.5 py-1 border-primary/20 bg-primary/5 text-primary-foreground font-medium rounded-full">
            Channel: {activeChannelObj.name} ({selectedChannel})
          </Badge>
          <Badge variant="outline" className="text-xs px-2.5 py-1 border-primary/20 bg-primary/5 text-primary-foreground font-medium rounded-full">
            Date: {formattedDateLabel}
          </Badge>
          <Badge variant="outline" className="text-xs px-2.5 py-1 border-primary/20 bg-primary/5 text-primary-foreground font-medium rounded-full">
            Hour: {selectedHour.toString().padStart(2, '0')}:00
          </Badge>
        </div>
      </div>

      {/* Main Grid split */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-0 overflow-hidden">
        {/* Left Side: Filter Selectors (3 Cols) */}
        <div className="lg:col-span-3 border-r border-border/50 overflow-y-auto p-5 space-y-4 bg-card/10 flex flex-col h-full min-h-0">
          
          {/* 1. Channel Selector - Scrollable 10 Channel list */}
          <div className="space-y-1.5 flex flex-col flex-1 min-h-0">
            <label className="text-[10px] font-bold text-muted-foreground/80 uppercase tracking-wider block shrink-0">
              Select TV Channel
            </label>
            <div className="grid grid-cols-1 gap-1 overflow-y-auto flex-1 pr-1.5">
              {CHANNELS.map((ch) => (
                <button
                  key={ch.id}
                  disabled={ch.disabled}
                  onClick={() => setSelectedChannel(ch.id)}
                  className={`w-full flex items-center justify-between p-2 rounded-[var(--radius)] text-left text-xs transition-all border font-medium shrink-0 ${
                    ch.disabled
                      ? 'bg-card/20 border-border/20 text-muted-foreground/45 cursor-not-allowed opacity-55'
                      : selectedChannel === ch.id
                      ? 'bg-primary border-primary text-primary-foreground shadow-sm cursor-pointer'
                      : 'bg-card border-border/60 hover:bg-muted/40 text-foreground cursor-pointer'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {/* Logo thumbnail */}
                    <div className={`h-8 w-8 rounded bg-white border flex items-center justify-center shrink-0 overflow-hidden ${
                      selectedChannel === ch.id ? 'border-white/20' : 'border-border/60'
                    }`}>
                      {ch.logoUrl ? (
                        <img
                          src={ch.logoUrl}
                          alt={ch.name}
                          className={`h-full w-full object-contain p-0.5 ${ch.disabled ? 'grayscale opacity-50' : ''}`}
                        />
                      ) : (
                        <Tv className={`h-4 w-4 ${selectedChannel === ch.id ? 'text-primary' : 'text-muted-foreground'}`} />
                      )}
                    </div>

                    <div className="flex flex-col gap-0.5 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold truncate text-[11px]">{ch.name}</span>
                        {ch.disabled && (
                          <span className="text-[8px] bg-muted px-1 py-0.2 rounded text-muted-foreground font-mono shrink-0">Disabled</span>
                        )}
                      </div>
                      <span className={`text-[10px] ${
                        ch.disabled
                          ? 'text-muted-foreground/30'
                          : selectedChannel === ch.id
                          ? 'text-primary-foreground/75'
                          : 'text-muted-foreground'
                      }`}>
                        ID: {ch.id}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <Separator className="border-border/50 shrink-0" />

          {/* 2. Date Selection */}
          <div className="space-y-1.5 shrink-0">
            <label className="text-[10px] font-bold text-muted-foreground/80 uppercase tracking-wider block">
              Day Selection
            </label>
            <Popover>
              <PopoverTrigger className="w-full justify-start text-left font-normal h-9 text-xs border border-border bg-card rounded-[var(--radius)] flex items-center px-3 hover:bg-muted/40 transition-colors cursor-pointer">
                <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                {formattedDateLabel}
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && setSelectedDate(date)}
                  disabled={(date) => {
                    const today = new Date()
                    today.setHours(23, 59, 59, 999)
                    return date > today
                  }}
                />
              </PopoverContent>
            </Popover>
          </div>

          <Separator className="border-border/50 shrink-0" />

          {/* 3. Hour Selector Grid */}
          <div className="space-y-1.5 shrink-0">
            <label className="text-[10px] font-bold text-muted-foreground/80 uppercase tracking-wider block">
              Hour Selector (24h)
            </label>
            
            <div className="grid grid-cols-4 gap-1">
              {Array.from({ length: 24 }).map((_, hour) => {
                const isSelected = selectedHour === hour
                return (
                  <button
                    key={hour}
                    onClick={() => setSelectedHour(hour)}
                    className={`h-8 flex flex-col items-center justify-center rounded-[var(--radius)] text-center transition-all border cursor-pointer ${
                      isSelected
                        ? 'bg-primary border-primary text-primary-foreground font-semibold shadow-sm text-xs'
                        : 'bg-card border-border/60 hover:bg-muted/40 text-foreground text-[11px]'
                    }`}
                  >
                    <span>{hour.toString().padStart(2, '0')}:00</span>
                  </button>
                )
              })}
            </div>
          </div>

        </div>

        {/* Right Side: Large Unified Media workspace (9 Cols) */}
        <div className="lg:col-span-9 flex flex-col h-full overflow-hidden bg-background">
          {/* Header Action Control Bar */}
          <div className="border-b border-border/50 bg-card/30 px-6 py-3 flex items-center justify-between shrink-0">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Current Segment:</span>
                <span className="text-xs font-semibold text-foreground font-mono">
                  {selectedHour.toString().padStart(2, '0')}:00 - {(selectedHour + 1).toString().padStart(2, '0')}:00
                </span>

              </div>
            </div>

            {/* Combined Action Buttons */}
            <div className="flex items-center gap-2">
              {/* View Switcher Toggle */}
              <div className="flex items-center gap-1 bg-muted p-0.5 rounded-[var(--radius)] border border-border/40 shrink-0 mr-2">
                <button
                  onClick={() => setActiveView('player')}
                  className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-sm transition-all cursor-pointer ${
                    activeView === 'player'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Video className="h-3.5 w-3.5" />
                  Player
                </button>
                <button
                  onClick={() => setActiveView('table')}
                  className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-sm transition-all cursor-pointer ${
                    activeView === 'table'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <TableIcon className="h-3.5 w-3.5" />
                  Table View
                </button>
              </div>

              {activeView === 'player' && videoUrl && (
                <Button
                  size="sm"
                  variant={isClipperMode ? 'default' : 'outline'}
                  onClick={() => setIsClipperMode(!isClipperMode)}
                  className={`h-8 text-xs flex items-center gap-1.5 shadow-sm cursor-pointer ${
                    isClipperMode ? 'bg-primary text-primary-foreground' : 'bg-background border-border text-foreground hover:bg-muted'
                  }`}
                >
                  <Scissors className="h-3.5 w-3.5" />
                  {isClipperMode ? 'Hide Clipper' : 'Video Clipper'}
                </Button>
              )}

              <a
                href={videoUrl || undefined}
                download={fileName || undefined}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  if (!videoUrl) e.preventDefault()
                }}
              >
                <Button 
                  size="sm" 
                  disabled={!videoUrl}
                  className="h-8 text-xs flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download Recording
                </Button>
              </a>

              <a
                href={csvUrl || undefined}
                download={record?.localCsvPath || undefined}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  if (!csvUrl) e.preventDefault()
                }}
              >
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!csvUrl}
                  className="h-8 text-xs flex items-center gap-1.5 bg-background border-border text-foreground hover:bg-muted cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5 text-muted-foreground" />
                  Download CSV
                </Button>
              </a>
            </div>
          </div>

          {/* Media Player Panel */}
          <div className="flex-1 overflow-hidden flex flex-col justify-center bg-background min-h-0">
            
            {isLoading ? (
              <div className="flex-1 flex flex-col items-center justify-center border border-border/50 rounded-[var(--radius)] bg-card/10 h-full">
                <Loader2 className="h-8 w-8 text-primary animate-spin" />
                <p className="mt-2.5 text-xs text-muted-foreground">Querying database...</p>
              </div>
            ) : fetchError ? (
              <div className="flex-1 flex flex-col items-center justify-center border border-border/50 rounded-[var(--radius)] bg-card/10 p-6 h-full text-center">
                <FileWarning className="h-10 w-10 text-destructive/80" />
                <h3 className="mt-2.5 text-sm font-semibold text-foreground">Database Error</h3>
                <p className="mt-1 text-xs text-muted-foreground max-w-sm leading-relaxed">
                  {fetchError}. Verify that the SSH jumpserver tunnel is actively listening on local port 5433.
                </p>
              </div>
            ) : activeView === 'table' ? (
              <div className="flex-1 flex flex-col overflow-hidden border border-border/50 rounded-[var(--radius)] bg-card/10 h-full">
                <div className="p-4 border-b border-border/50 bg-card/25 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2">
                    <TableIcon className="h-4.5 w-4.5 text-primary" />
                    <span className="text-sm font-semibold text-foreground">Hourly segments list for channel</span>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {dayRecords.length} Active Records
                  </Badge>
                </div>
                <div className="flex-1 overflow-y-auto min-h-0">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background/95 backdrop-blur z-10 border-b border-border/50 shadow-sm">
                      <TableRow>
                        <TableHead className="w-[20%] pl-4">Hour Block</TableHead>
                        <TableHead className="w-[15%]">Status</TableHead>
                        <TableHead className="w-[45%]">File Name</TableHead>
                        <TableHead className="w-[20%] text-right pr-6">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tableRows.map((row) => {
                        const isCurrentRowSelected = selectedHour === row.hour
                        return (
                          <TableRow 
                            key={row.hour} 
                            className={`transition-colors duration-150 ${
                              isCurrentRowSelected ? 'bg-primary/5 hover:bg-primary/10' : ''
                            }`}
                          >
                            <TableCell className="font-mono text-xs font-semibold py-3 pl-4">
                              {row.hour.toString().padStart(2, '0')}:00 - {(row.hour + 1).toString().padStart(2, '0')}:00
                            </TableCell>
                            <TableCell className="py-3">
                              {row.hasData ? (
                                <Badge className="bg-emerald-500/10 border border-emerald-500/25 text-emerald-500 text-[10px] font-semibold py-0.5 px-2.5 rounded-full uppercase">
                                  Available
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px] text-muted-foreground/60 border-muted-foreground/20 font-semibold py-0.5 px-2.5 rounded-full uppercase">
                                  Empty
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="font-mono text-xs max-w-0 truncate py-3 text-foreground/80" title={row.fileName}>
                              {row.fileName}
                            </TableCell>
                            <TableCell className="text-right py-3 pr-6">
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  size="sm"
                                  disabled={!row.hasData}
                                  onClick={() => {
                                    setSelectedHour(row.hour)
                                    setActiveView('player')
                                  }}
                                  className="h-7 px-2.5 text-[11px] font-semibold flex items-center gap-1 cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90"
                                >
                                  <Play className="h-3 w-3 fill-current" />
                                  Play
                                </Button>
                                <a
                                  href={row.videoUrl || undefined}
                                  download={row.fileName || undefined}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => {
                                    if (!row.videoUrl || row.videoUrl === '#') e.preventDefault()
                                  }}
                                >
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={!row.hasData}
                                    className="h-7 w-7 p-0 flex items-center justify-center cursor-pointer border-border/80 text-foreground hover:bg-muted"
                                    title="Download Video"
                                  >
                                    <Video className="h-3.5 w-3.5 text-muted-foreground/80" />
                                  </Button>
                                </a>
                                <a
                                  href={row.csvUrl || undefined}
                                  download={row.record?.localCsvPath || undefined}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => {
                                    if (!row.csvUrl || row.csvUrl === '#') e.preventDefault()
                                  }}
                                >
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={!row.csvUrl || row.csvUrl === '#'}
                                    className="h-7 w-7 p-0 flex items-center justify-center cursor-pointer border-border/80 text-foreground hover:bg-muted"
                                    title="Download CSV"
                                  >
                                    <FileSpreadsheet className="h-3.5 w-3.5 text-muted-foreground/80" />
                                  </Button>
                                </a>
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : !videoUrl ? (
              <div className="flex-1 flex flex-col items-center justify-center border border-border/50 rounded-[var(--radius)] bg-card/10 p-6 h-full text-center">
                <FileWarning className="h-10 w-10 text-muted-foreground/60" />
                <h3 className="mt-3 text-sm font-semibold text-foreground">No Recording Found</h3>
                <p className="mt-1 text-xs text-muted-foreground max-w-sm leading-relaxed">
                  There are no upload database rows for channel <strong>{selectedChannel}</strong> on <strong>{dateString}</strong> during the <strong>{selectedHour}:00</strong> hour block.
                </p>
                <div className="mt-5">
                  <Button 
                    size="sm" 
                    onClick={handleOpenClosestRecording}
                    disabled={isFindingClosest}
                    className="text-xs flex items-center gap-1.5 cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    {isFindingClosest ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Finding Closest Recording...
                      </>
                    ) : (
                      <>
                        <Play className="h-3 w-3 fill-current" />
                        Open Closest Available Recording
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col gap-4 overflow-hidden min-h-0">
                {/* File Info Box */}
                {/* <div className="flex items-center justify-between p-3.5 bg-card/30 border border-border/40 rounded-[var(--radius)] shrink-0">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-foreground">Active File Name:</span>
                      <code className="text-xs bg-muted border border-border px-1.5 py-0.5 rounded font-mono text-primary-foreground">
                        {fileName}
                      </code>
                    </div>
                    {record && (
                      <p className="text-[10px] text-muted-foreground">
                        S3 Storage URL: <span className="font-mono">{record.videoS3Url}</span>
                      </p>
                    )}
                    {demoMode && (
                      <p className="text-[10px] text-muted-foreground">
                        Demonstration Loop: playing mock content for UI review.
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline" className="text-[10px] bg-muted/50 border-border/60 py-0.5 px-2 font-bold">
                      1-Hour recording
                    </Badge>
                  </div>
                </div> */}

                {/* Massive Player wrapper */}
                <div 
                  ref={playerContainerRef}
                  onMouseMove={resetControlsTimeout}
                  onMouseLeave={() => isPlaying && setShowControls(false)}
                  onDoubleClick={handleDoubleClick}
                  className="flex-1 border border-border/50 rounded-[var(--radius)] overflow-hidden bg-black relative flex items-center justify-center shadow-md min-h-0 group/player"
                >
                  <video
                    ref={videoRef}
                    src={videoUrl}
                    crossOrigin="anonymous"
                    onClick={handleSingleClick}
                    className="w-full h-full object-contain cursor-pointer"
                    onTimeUpdate={handleVideoTimeUpdate}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    onLoadedMetadata={handleLoadedMetadata}
                    preload="auto"
                    loop
                  />

                  {/* Fullscreen Recording/Clipping progress overlay */}
                  {isClipping && (
                    <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center gap-6 z-40 p-6 animate-in fade-in duration-300">
                      <div className="flex flex-col items-center gap-3">
                        <div className="relative flex items-center justify-center h-16 w-16">
                          <span className="absolute inline-flex h-full w-full rounded-full bg-destructive/30 animate-ping opacity-75"></span>
                          <div className="relative rounded-full h-12 w-12 bg-destructive flex items-center justify-center shadow-lg shadow-destructive/50">
                            <Scissors className="h-5 w-5 text-white animate-pulse" />
                          </div>
                        </div>
                        <h3 className="text-lg font-bold text-white tracking-wide">Recording Video Clip...</h3>
                        <p className="text-xs text-muted-foreground max-w-xs text-center truncate">
                          {clipName}
                        </p>
                      </div>

                      <div className="w-full max-w-sm flex flex-col gap-2">
                        <div className="flex justify-between items-center text-xs font-mono text-white/80">
                          <span>{Math.round(clippingProgress)}%</span>
                          <span>
                            {videoRef.current ? formatTimeWithSubseconds(videoRef.current.currentTime) : '0:00.0'} / {formatTimeWithSubseconds(clipEnd)}
                          </span>
                        </div>
                        <div className="w-full bg-white/10 rounded-full h-2.5 overflow-hidden">
                          <div 
                            className="bg-destructive h-full transition-all duration-100 ease-out"
                            style={{ width: `${clippingProgress}%` }}
                          />
                        </div>
                        <div className="flex justify-between items-center text-[10px] text-muted-foreground mt-1">
                          <span>Speed: {clippingSpeed}x</span>
                          <span>Recording stream chunk active</span>
                        </div>
                      </div>

                      <Button 
                        variant="destructive" 
                        size="sm"
                        onClick={handleCancelClipping}
                        className="h-9 px-6 font-semibold flex items-center gap-1.5 shadow-lg shadow-destructive/20 cursor-pointer"
                      >
                        Cancel Recording
                      </Button>
                    </div>
                  )}

                  {/* Keyboard/Action feedback overlay in the center of the screen */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                    <div 
                      className={`flex flex-col items-center justify-center h-20 w-20 bg-black/75 text-white rounded-full shadow-2xl transition-all duration-300 transform ${
                        feedback.visible ? 'opacity-100 scale-100' : 'opacity-0 scale-75'
                      }`}
                    >
                      {feedback.type === 'skip-forward' && (
                        <>
                          <ChevronsRight className="h-7 w-7 text-white animate-pulse" />
                          <span className="text-[10px] font-bold text-white font-mono mt-0.5">+10s</span>
                        </>
                      )}
                      {feedback.type === 'skip-backward' && (
                        <>
                          <ChevronsLeft className="h-7 w-7 text-white animate-pulse" />
                          <span className="text-[10px] font-bold text-white font-mono mt-0.5">-10s</span>
                        </>
                      )}
                      {feedback.type === 'play' && <Play className="h-8 w-8 text-white fill-current translate-x-0.5" />}
                      {feedback.type === 'pause' && <Pause className="h-8 w-8 text-white fill-current" />}
                      {feedback.type === 'mute' && <VolumeX className="h-8 w-8 text-white" />}
                      {feedback.type === 'unmute' && <Volume2 className="h-8 w-8 text-white" />}
                      {feedback.type.startsWith('volume-') && (
                        <>
                          {volume === 0 ? (
                            <VolumeX className="h-7 w-7 text-white" />
                          ) : volume < 0.5 ? (
                            <Volume1 className="h-7 w-7 text-white" />
                          ) : (
                            <Volume2 className="h-7 w-7 text-white" />
                          )}
                          <span className="text-[10px] font-bold text-white font-mono mt-0.5">{Math.round(volume * 100)}%</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Controls Overlay - fades out automatically when playing & mouse is idle */}
                  <div 
                    className={`player-controls-bar absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/95 via-black/75 to-transparent p-5 flex flex-col gap-3 transition-opacity duration-300 z-10 ${
                      showControls ? 'opacity-100' : 'opacity-0 cursor-none'
                    }`}
                  >
                    
                    {/* Media seeker bar / timeline (Custom YouTube-style with hover time preview) */}
                    <div className="w-full flex items-center gap-3">
                      <span className="text-xs text-white/95 font-mono select-none">
                        {formatTime(currentTime)}
                      </span>
                      
                      <div 
                        className="relative flex-1 h-2 group/timeline cursor-pointer flex items-center"
                        onMouseMove={handleMouseMoveProgress}
                        onMouseLeave={handleMouseLeaveProgress}
                      >
                        {/* Background grey track */}
                        <div className="absolute inset-x-0 h-1 bg-white/20 rounded-full group-hover/timeline:h-1.5 transition-all" />
                        {/* Active primary colored track */}
                        <div 
                          className="absolute left-0 h-1 bg-primary rounded-full group-hover/timeline:h-1.5 transition-all" 
                          style={{ width: `${videoProgress}%` }}
                        />
                        {/* Interactive Range Input overlayed directly over it */}
                        <input
                          type="range"
                          min="0"
                          max="100"
                          step="0.1"
                          value={videoProgress}
                          onChange={handleSeek}
                          className="absolute inset-x-0 w-full h-full opacity-0 cursor-pointer z-10"
                        />
                        {/* Custom visual knob/thumb */}
                        <div 
                          className="absolute h-3 w-3 bg-primary rounded-full scale-0 group-hover/timeline:scale-100 transition-transform shadow-md pointer-events-none" 
                          style={{ left: `calc(${videoProgress}% - 6px)` }}
                        />

                        {/* Hover timestamp tooltip */}
                        {hoverTime !== null && (
                          <div 
                            className="absolute bottom-6 bg-black/90 border border-white/15 text-white text-[10px] font-mono py-0.5 px-2 rounded -translate-x-1/2 pointer-events-none z-20 shadow-xl"
                            style={{ left: `${hoverX}px` }}
                          >
                            {formatTime(hoverTime)}
                          </div>
                        )}
                      </div>

                      <span className="text-xs text-white/95 font-mono select-none">
                        {formatTime(duration || 3600)}
                      </span>
                    </div>

                    {/* Control buttons bar */}
                    <div className="flex items-center justify-between mt-1">
                      <div className="flex items-center gap-4.5">
                        {/* Play/Pause Button */}
                        <button
                          onClick={handlePlayPause}
                          className="text-white hover:text-primary transition-colors cursor-pointer p-1"
                          title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
                        >
                          {isPlaying ? (
                            <Pause className="h-5.5 w-5.5 fill-current" />
                          ) : (
                            <Play className="h-5.5 w-5.5 fill-current translate-x-0.5" />
                          )}
                        </button>

                        {/* 10s Skip Backward Button */}
                        <button
                          onClick={() => {
                            if (videoRef.current) {
                              videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 10)
                              showFeedback('skip-backward')
                            }
                          }}
                          className="text-white hover:text-primary transition-colors cursor-pointer p-1"
                          title="Skip back 10 seconds (←)"
                        >
                          <RotateCcw className="h-5 w-5" />
                        </button>

                        {/* 10s Skip Forward Button */}
                        <button
                          onClick={() => {
                            if (videoRef.current) {
                              videoRef.current.currentTime = Math.min(videoRef.current.duration || 0, videoRef.current.currentTime + 10)
                              showFeedback('skip-forward')
                            }
                          }}
                          className="text-white hover:text-primary transition-colors cursor-pointer p-1"
                          title="Skip forward 10 seconds (→)"
                        >
                          <RotateCw className="h-5 w-5" />
                        </button>

                        {/* Speaker / Volume Control Slider */}
                        <div className="flex items-center gap-2 group/volume">
                          <button
                            onClick={handleMuteToggle}
                            className="text-white hover:text-primary transition-colors cursor-pointer p-1"
                            title={isMuted ? 'Unmute (M)' : 'Mute (M)'}
                          >
                            {isMuted || volume === 0 ? (
                              <VolumeX className="h-5.5 w-5.5" />
                            ) : volume < 0.5 ? (
                                <Volume1 className="h-5.5 w-5.5" />
                            ) : (
                              <Volume2 className="h-5.5 w-5.5" />
                            )}
                          </button>
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={isMuted ? 0 : volume}
                            onChange={handleVolumeChange}
                            className="w-0 opacity-0 scale-0 pointer-events-none group-hover/volume:w-20 group-hover/volume:opacity-100 group-hover/volume:scale-100 group-hover/volume:pointer-events-auto transition-all duration-300 h-1 rounded bg-white/20 accent-primary outline-none cursor-pointer"
                          />
                        </div>
                      </div>

                      {/* Right-aligned metadata + fullscreen controls */}
                      <div className="flex items-center gap-4">
                        <Badge className="bg-black/85 border border-white/10 text-white/90 text-[10px] font-semibold py-1 px-3">
                          1-Hour Segment • 720p HD
                        </Badge>
                        
                        {/* Fullscreen Button */}
                        <button
                          onClick={toggleFullscreen}
                          className="text-white hover:text-primary transition-colors cursor-pointer p-1"
                          title={isFullscreen ? 'Exit Fullscreen (F)' : 'Fullscreen (F)'}
                        >
                          {isFullscreen ? (
                            <Minimize2 className="h-5.5 w-5.5" />
                          ) : (
                            <Maximize2 className="h-5.5 w-5.5" />
                          )}
                        </button>
                      </div>
                    </div>

                  </div>
                </div>

                {isClipperMode && (
                  <div className="bg-card border border-border/60 rounded-[var(--radius)] p-4 flex flex-col gap-4 shrink-0 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="flex items-center justify-between border-b border-border/40 pb-2">
                      <div className="flex items-center gap-2">
                        <div className="bg-primary/10 p-1.5 rounded text-primary">
                          <Scissors className="h-4 w-4" />
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold text-foreground">Video Clipping Utility</h4>
                          <p className="text-[10px] text-muted-foreground">Select timestamps, name your file, and record a client-side clip.</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground font-medium">Record Speed:</span>
                        <div className="flex rounded-md bg-muted p-0.5 border border-border/50">
                          {[1, 2, 4].map((s) => (
                            <button
                              key={s}
                              onClick={() => setClippingSpeed(s)}
                              className={`px-2 py-0.5 text-xs font-mono font-medium rounded-sm transition-all cursor-pointer ${
                                clippingSpeed === s
                                  ? 'bg-background text-foreground shadow-xs'
                                  : 'text-muted-foreground hover:text-foreground'
                              }`}
                            >
                              {s}x
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {showClipperInfo && (
                      <div className="bg-muted/50 border border-border/60 rounded-[var(--radius)] p-3.5 text-xs leading-relaxed text-muted-foreground flex flex-col gap-2.5 animate-in fade-in duration-200">
                        <div className="flex items-center gap-2 text-foreground font-semibold">
                          <Info className="h-4 w-4 text-primary shrink-0" />
                          <span>Why do we "Record & Trim"? Can we trim faster?</span>
                        </div>
                        <p>
                          Trimming a video instantly in the browser without re-recording requires either a dedicated backend encoding server or loading a heavy WebAssembly compiler (like FFmpeg.wasm, which is ~30MB and requires complex cross-origin server headers).
                        </p>
                        <p>
                          To keep this utility <strong>100% private, serverless, and lightweight</strong>, we capture the video stream directly in your browser as it plays back. You can accelerate this process by selecting the <strong>2x or 4x recording speed</strong> options above, allowing you to trim and download the clip in a fraction of the time.
                        </p>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                      {/* Name input */}
                      <div className="md:col-span-5 flex flex-col gap-1.5">
                        <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Clip File Name</label>
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="my_awesome_clip"
                            value={clipName}
                            onChange={(e) => setClipName(e.target.value.replace(/[^a-zA-Z0-9_\-]/g, ''))}
                            className="w-full bg-background border border-border/80 rounded-md px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary font-mono placeholder:text-muted-foreground/50 pr-12"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono text-muted-foreground pointer-events-none">
                            .webm
                          </span>
                        </div>
                      </div>

                      {/* Timeline Track - Editor Style */}
                      <div className="md:col-span-12 flex flex-col gap-2 bg-muted/20 border border-border/40 rounded-lg p-3">
                        <div className="flex justify-between items-center text-[10px] text-muted-foreground font-mono">
                          <span>Timeline Start (0:00.0)</span>
                          <div className="flex items-center gap-1">
                            <span className="bg-primary/25 text-primary px-2 py-0.5 rounded font-bold">
                              Clip Duration: {(clipEnd - clipStart).toFixed(1)}s
                            </span>
                          </div>
                          <span>Timeline End ({formatTimeWithSubseconds(duration || 3600)})</span>
                        </div>

                        {/* Interactive Visual Waveform / Trim Bar */}
                        <div 
                          className="relative h-12 bg-muted/60 border border-border/60 rounded-md overflow-hidden select-none cursor-pointer group"
                          onClick={(e) => {
                            // Click to seek video to clicked location on timeline
                            if (videoRef.current && duration) {
                              const rect = e.currentTarget.getBoundingClientRect()
                              const pct = (e.clientX - rect.left) / rect.width
                              const targetTime = pct * duration
                              videoRef.current.currentTime = targetTime
                            }
                          }}
                        >
                          {/* Grid/Waveform Simulator */}
                          <div className="absolute inset-0 flex justify-between px-2 pointer-events-none opacity-20">
                            {Array.from({ length: 40 }).map((_, i) => (
                              <div 
                                key={i} 
                                className="w-[1px] bg-foreground self-end" 
                                style={{ 
                                  height: i % 10 === 0 ? '80%' : i % 5 === 0 ? '55%' : '30%',
                                }} 
                              />
                            ))}
                          </div>

                          {/* Shaded Trim Region */}
                          <div 
                            className="absolute h-full bg-primary/10 border-l-[3px] border-r-[3px] border-primary transition-all flex items-center justify-between px-1"
                            style={{
                              left: `${(clipStart / (duration || 3600)) * 100}%`,
                              width: `${((clipEnd - clipStart) / (duration || 3600)) * 100}%`
                            }}
                          >
                            <span className="text-[9px] font-bold text-primary opacity-60 uppercase tracking-widest select-none truncate pointer-events-none pl-2">
                              Trim Area
                            </span>
                          </div>

                          {/* Red playhead line tracking active video currentTime */}
                          <div 
                            className="absolute top-0 bottom-0 w-[2px] bg-destructive z-10 pointer-events-none shadow"
                            style={{
                              left: `${(currentTime / (duration || 3600)) * 100}%`
                            }}
                          >
                            <div className="absolute top-0 -left-1 w-2.5 h-2.5 rounded-full bg-destructive" />
                          </div>
                        </div>

                        {/* Dual Drag Sliders */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-1">
                          <div className="flex flex-col gap-1">
                            <div className="flex justify-between items-center text-[11px]">
                              <span className="text-muted-foreground font-semibold uppercase tracking-wider">Start Handle</span>
                              <span className="font-mono font-medium text-foreground">{formatTimeWithSubseconds(clipStart)}</span>
                            </div>
                            <input
                              type="range"
                              min="0"
                              max={Math.max(0, clipEnd - 0.5)}
                              step="0.5"
                              value={clipStart}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0
                                const targetVal = Math.min(val, clipEnd - 0.5)
                                setClipStart(targetVal)
                                if (videoRef.current) {
                                  videoRef.current.currentTime = targetVal
                                }
                              }}
                              className="w-full accent-primary cursor-pointer h-1.5 rounded-lg appearance-none bg-muted-foreground/20"
                            />
                          </div>

                          <div className="flex flex-col gap-1">
                            <div className="flex justify-between items-center text-[11px]">
                              <span className="text-muted-foreground font-semibold uppercase tracking-wider">End Handle</span>
                              <span className="font-mono font-medium text-foreground">{formatTimeWithSubseconds(clipEnd)}</span>
                            </div>
                            <input
                              type="range"
                              min={clipStart + 0.5}
                              max={duration || 3600}
                              step="0.5"
                              value={clipEnd}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0.5
                                setClipEnd(Math.max(val, clipStart + 0.5))
                              }}
                              className="w-full accent-primary cursor-pointer h-1.5 rounded-lg appearance-none bg-muted-foreground/20"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Timestamps inputs */}
                      <div className="md:col-span-4 grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Start Time (sec)</label>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min="0"
                              max={clipEnd - 0.5}
                              step="0.5"
                              value={clipStart}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0
                                const targetVal = Math.max(0, Math.min(val, clipEnd - 0.5))
                                setClipStart(targetVal)
                                if (videoRef.current) {
                                  videoRef.current.currentTime = targetVal
                                }
                              }}
                              className="w-full bg-background border border-border/80 rounded-md px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary font-mono"
                            />
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-8 w-8 shrink-0 cursor-pointer border-border/60 hover:bg-muted"
                              title="Set to current position"
                              onClick={() => {
                                if (videoRef.current) {
                                  const t = parseFloat(videoRef.current.currentTime.toFixed(1))
                                  setClipStart(Math.min(t, clipEnd - 0.5))
                                }
                              }}
                            >
                              <Play className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">End Time (sec)</label>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min={clipStart + 0.5}
                              max={duration || 3600}
                              step="0.5"
                              value={clipEnd}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0.5
                                setClipEnd(Math.max(clipStart + 0.5, Math.min(val, duration || 3600)))
                              }}
                              className="w-full bg-background border border-border/80 rounded-md px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary font-mono"
                            />
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-8 w-8 shrink-0 cursor-pointer border-border/60 hover:bg-muted"
                              title="Set to current position"
                              onClick={() => {
                                if (videoRef.current) {
                                  const t = parseFloat(videoRef.current.currentTime.toFixed(1))
                                  setClipEnd(Math.max(t, clipStart + 0.5))
                                }
                              }}
                            >
                              <Play className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="md:col-span-3 flex items-end justify-end gap-2 pb-0.5">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            // Quick select 30s
                            if (videoRef.current) {
                              const curr = parseFloat(videoRef.current.currentTime.toFixed(1))
                              setClipStart(curr)
                              setClipEnd(parseFloat(Math.min(curr + 30, duration || 3600).toFixed(1)))
                            }
                          }}
                          className="h-8 text-xs cursor-pointer border-border/60 hover:bg-muted"
                        >
                          Quick 30s
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            // Quick select 60s
                            if (videoRef.current) {
                              const curr = parseFloat(videoRef.current.currentTime.toFixed(1))
                              setClipStart(curr)
                              setClipEnd(parseFloat(Math.min(curr + 60, duration || 3600).toFixed(1)))
                            }
                          }}
                          className="h-8 text-xs cursor-pointer border-border/60 hover:bg-muted"
                        >
                          Quick 60s
                        </Button>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={startClipping}
                          className="h-8 text-xs bg-primary text-primary-foreground hover:bg-primary/95 flex items-center gap-1.5 shadow-sm font-semibold cursor-pointer"
                        >
                          <Scissors className="h-3 w-3" />
                          Record & Trim
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => setShowClipperInfo(!showClipperInfo)}
                          className={`h-8 w-8 shrink-0 cursor-pointer border-border/60 ${showClipperInfo ? 'bg-muted text-primary border-primary/50' : 'hover:bg-muted'}`}
                          title="Why Record & Trim?"
                        >
                          <Info className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Footer Notes details */}
                {/* <div className="text-[11px] text-muted-foreground bg-card/10 p-3.5 rounded-[var(--radius)] border border-border/30 flex gap-2 shrink-0">
                  <div className="p-0.5 text-primary-foreground shrink-0 animate-pulse">
                    <Settings className="h-4 w-4" />
                  </div>
                  <p className="leading-relaxed">
                    Connecting live to Postgres RDS instance at port <strong>5433</strong> via tunnel. Metadata is synced with S3 stream addresses and local client downloads.
                  </p>
                </div> */}
              </div>
            )}

          </div>

        </div>
      </div>
    </div>
  )
}
