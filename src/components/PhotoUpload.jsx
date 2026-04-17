/**
 * PhotoUpload — camera icon overlay on AgentAvatar; allows uploading a 1:1 cropped photo.
 * Only visible to authenticated users.
 *
 * Props:
 *   agentCode: string
 *   agentName: string
 *   onSuccess: function() — called after successful upload
 *
 * Usage: wrap <AgentAvatar> as a child inside this component.
 *   <PhotoUpload agentCode={...} agentName={...} onSuccess={...}>
 *     <AgentAvatar ... />
 *   </PhotoUpload>
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// ─── Square Crop Modal ────────────────────────────────────────────────────────
// Displays the chosen image in a fixed square container. The user drags to
// reposition the image within the frame. On confirm, a 400×400 canvas renders
// the visible crop and returns it as a Blob.

const CROP_SIZE = 300 // px, display size of the crop square
const MIN_SCALE = 1
const MAX_SCALE = 4

function CropModal({ file, agentName, onDone, onCancel }) {
  // ── State ──
  const [imgUrl,      setImgUrl]      = useState(null)       // created after mount (StrictMode-safe)
  const [displaySize, setDisplaySize] = useState(null)       // { w, h } cover-fit px
  const [offset,      setOffset]      = useState({ x: 0, y: 0 })
  const [scale,       setScale]       = useState(1)
  const [uploading,   setUploading]   = useState(false)

  // ── Refs ──
  const imgRef      = useRef(null)
  const dragging    = useRef(false)
  const dragOrigin  = useRef({ x: 0, y: 0 })
  const pinchDist   = useRef(null)
  const scaleRef    = useRef(1)          // mirrors `scale` state — always current for event handlers

  // Create object URL inside effect so React 18 StrictMode double-mount doesn't revoke it mid-use
  useEffect(() => {
    const url = URL.createObjectURL(file)
    setImgUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  // ── Clamp offset so image always covers the crop frame ──
  const clamp = useCallback((ox, oy, dw, dh, sc) => {
    const maxX = Math.max(0, (dw * sc - CROP_SIZE) / 2)
    const maxY = Math.max(0, (dh * sc - CROP_SIZE) / 2)
    return {
      x: Math.max(-maxX, Math.min(maxX, ox)),
      y: Math.max(-maxY, Math.min(maxY, oy)),
    }
  }, [])

  // ── Image load: measure natural size → compute cover-fit displaySize ──
  function onImgLoad() {
    const img = imgRef.current
    if (!img) return
    const { naturalWidth: nw, naturalHeight: nh } = img
    let w, h
    if (nw / nh > 1) { h = CROP_SIZE; w = CROP_SIZE * (nw / nh) }
    else              { w = CROP_SIZE; h = CROP_SIZE * (nh / nw) }
    setDisplaySize({ w, h })
  }

  // ── Zoom helper (uses scaleRef to avoid stale closure) ──
  function applyZoom(newScale) {
    if (!displaySize) return
    const clamped = Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScale))
    scaleRef.current = clamped
    setScale(clamped)
    setOffset(o => clamp(o.x, o.y, displaySize.w, displaySize.h, clamped))
  }

  // ── Pan ──
  function startDrag(cx, cy) {
    dragging.current = true
    dragOrigin.current = { x: cx - offset.x, y: cy - offset.y }
  }
  function moveDrag(cx, cy) {
    if (!dragging.current || !displaySize) return
    const raw = { x: cx - dragOrigin.current.x, y: cy - dragOrigin.current.y }
    setOffset(clamp(raw.x, raw.y, displaySize.w, displaySize.h, scaleRef.current))
  }
  function endDrag() { dragging.current = false }

  // ── Mouse events ──
  const onMouseDown = e => { e.preventDefault(); startDrag(e.clientX, e.clientY) }
  const onMouseMove = e => moveDrag(e.clientX, e.clientY)
  const onMouseUp   = endDrag

  // ── Scroll-wheel zoom ──
  function onWheel(e) {
    e.preventDefault()
    const delta = e.deltaY < 0 ? 0.1 : -0.1
    applyZoom(scaleRef.current + delta)
  }

  // ── Touch events: single-finger pan + two-finger pinch zoom ──
  function onTouchStart(e) {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      pinchDist.current = Math.hypot(dx, dy)
    } else {
      startDrag(e.touches[0].clientX, e.touches[0].clientY)
    }
  }
  function onTouchMove(e) {
    e.preventDefault()
    if (e.touches.length === 2 && displaySize) {
      const dx   = e.touches[0].clientX - e.touches[1].clientX
      const dy   = e.touches[0].clientY - e.touches[1].clientY
      const dist = Math.hypot(dx, dy)
      if (pinchDist.current) applyZoom(scaleRef.current * (dist / pinchDist.current))
      pinchDist.current = dist
    } else if (e.touches.length === 1) {
      moveDrag(e.touches[0].clientX, e.touches[0].clientY)
    }
  }
  function onTouchEnd(e) {
    if (e.touches.length < 2) pinchDist.current = null
    if (e.touches.length === 0) endDrag()
  }

  // ── Canvas crop + upload ──
  async function handleConfirm() {
    const img = imgRef.current
    if (!img || !displaySize) return
    setUploading(true)

    // Scale from display-px → natural-px
    const scaleX = img.naturalWidth  / displaySize.w
    const scaleY = img.naturalHeight / displaySize.h

    // Map crop frame (center of container) back through pan + zoom into image display coords
    // Image center in container = (CROP_SIZE/2 + offset.x, CROP_SIZE/2 + offset.y)
    // Container origin (0,0) maps to image display coord:
    //   x = (0 - (CROP_SIZE/2 + offset.x)) / scale + displaySize.w/2
    //     = displaySize.w/2 - (CROP_SIZE/2 + offset.x) / scale
    const sc           = scaleRef.current
    const cropXDisplay = displaySize.w / 2 - (CROP_SIZE / 2 + offset.x) / sc
    const cropYDisplay = displaySize.h / 2 - (CROP_SIZE / 2 + offset.y) / sc
    const cropWDisplay = CROP_SIZE / sc
    const cropHDisplay = CROP_SIZE / sc

    const canvas = document.createElement('canvas')
    canvas.width  = 400
    canvas.height = 400
    const ctx = canvas.getContext('2d')
    ctx.drawImage(
      img,
      cropXDisplay * scaleX,  cropYDisplay * scaleY,
      cropWDisplay * scaleX,  cropHDisplay * scaleY,
      0, 0, 400, 400,
    )

    canvas.toBlob(blob => {
      setUploading(false)
      onDone(blob)
    }, 'image/jpeg', 0.92)
  }

  // Wait until object URL is ready before rendering modal
  if (!imgUrl) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">

        {/* Header */}
        <div className="px-6 pt-5 pb-3">
          <p className="text-sm font-bold text-gray-800" style={{ fontFamily: 'AIA Everest' }}>
            Crop Photo
          </p>
          <p className="text-xs text-gray-400 mt-0.5" style={{ fontFamily: 'AIA Everest' }}>
            Drag to reposition · scroll or pinch to zoom
          </p>
        </div>

        {/* Crop frame */}
        <div className="px-6 pb-2">
          <div
            className="relative overflow-hidden rounded-xl mx-auto select-none"
            style={{
              width:       CROP_SIZE,
              height:      CROP_SIZE,
              cursor:      'grab',
              background:  '#1C1C28',
              touchAction: 'none',
            }}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
            onWheel={onWheel}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            {/* Single img — hidden (opacity:0) until displaySize is known */}
            <img
              ref={imgRef}
              src={imgUrl}
              alt="Crop"
              onLoad={onImgLoad}
              draggable={false}
              style={{
                position:        'absolute',
                width:           displaySize ? displaySize.w : 'auto',
                height:          displaySize ? displaySize.h : 'auto',
                maxWidth:        'none',
                opacity:         displaySize ? 1 : 0,
                top:             '50%',
                left:            '50%',
                transform:       `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px)) scale(${scale})`,
                transformOrigin: 'center center',
                userSelect:      'none',
                pointerEvents:   'none',
              }}
            />
          </div>

          {/* Zoom controls */}
          <div className="flex items-center justify-center gap-3 mt-3">
            <button
              onClick={() => applyZoom(scaleRef.current - 0.25)}
              className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50 font-bold text-base leading-none"
            >−</button>
            <span className="text-[11px] text-gray-400 w-10 text-center" style={{ fontFamily: 'DM Mono, monospace' }}>
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={() => applyZoom(scaleRef.current + 0.25)}
              className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50 font-bold text-base leading-none"
            >+</button>
          </div>

          <p className="text-center text-[10px] text-gray-400 mt-1.5" style={{ fontFamily: 'AIA Everest' }}>
            Photo for {agentName}
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 px-6 pb-5 pt-2">
          <button
            onClick={onCancel}
            disabled={uploading}
            className="flex-1 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            style={{ fontFamily: 'AIA Everest', fontWeight: 500 }}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={uploading || !displaySize}
            className="flex-1 py-2 rounded-lg bg-[#D31145] text-white text-sm font-semibold hover:bg-[#b80e3a] transition-colors disabled:opacity-50"
            style={{ fontFamily: 'AIA Everest', fontWeight: 700 }}
          >
            {uploading ? 'Saving…' : 'Use This Crop'}
          </button>
        </div>

      </div>
    </div>
  )
}

// ─── PhotoUpload ──────────────────────────────────────────────────────────────

export default function PhotoUpload({ agentCode, agentName, onSuccess, children }) {
  const [user,       setUser]       = useState(null)
  const [cropFile,   setCropFile]   = useState(null)  // File waiting to be cropped
  const [uploading,  setUploading]  = useState(false)
  const [errorMsg,   setErrorMsg]   = useState(null)
  const inputRef = useRef(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user: u } }) => setUser(u ?? null))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    // Reset input so the same file can be re-selected
    if (inputRef.current) inputRef.current.value = ''
    setErrorMsg(null)
    setCropFile(file) // → opens CropModal
  }

  async function handleCropDone(blob) {
    setCropFile(null)
    setUploading(true)
    setErrorMsg(null)

    const { error } = await supabase.storage
      .from('agent-photos')
      .upload(`${agentCode}.jpg`, blob, { upsert: true, contentType: 'image/jpeg' })

    setUploading(false)

    if (error) {
      setErrorMsg('Upload failed: ' + error.message)
      return
    }

    onSuccess?.()
  }

  function handleCropCancel() {
    setCropFile(null)
    setErrorMsg(null)
  }

  return (
    <>
      <div className="relative inline-block">
        {/* Slight opacity during upload */}
        <div className={uploading ? 'opacity-50 pointer-events-none' : undefined}>
          {children}
        </div>

        {/* Camera button — only for authenticated users */}
        {user && (
          <>
            <button
              type="button"
              title={`Upload photo for ${agentName}`}
              onClick={() => inputRef.current?.click()}
              className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-white shadow flex items-center justify-center hover:bg-gray-100 transition-colors"
              style={{ transform: 'translate(25%, 25%)' }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 text-gray-600">
                <path fillRule="evenodd" d="M1 8a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 018.07 3h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0016.07 6H17a2 2 0 012 2v7a2 2 0 01-2 2H3a2 2 0 01-2-2V8zm13.5 3a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM10 14a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
              </svg>
            </button>

            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </>
        )}

        {/* Upload spinner overlay */}
        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <svg className="animate-spin w-4 h-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          </div>
        )}

        {/* Error message */}
        {errorMsg && (
          <div
            className="absolute left-0 right-0 text-center text-xs text-red-600 bg-white rounded shadow px-1 py-0.5"
            style={{ top: '100%', marginTop: 2, whiteSpace: 'nowrap', zIndex: 10 }}
          >
            {errorMsg}
          </div>
        )}
      </div>

      {/* Crop modal — rendered as a portal-like overlay */}
      {cropFile && (
        <CropModal
          file={cropFile}
          agentName={agentName}
          onDone={handleCropDone}
          onCancel={handleCropCancel}
        />
      )}
    </>
  )
}
