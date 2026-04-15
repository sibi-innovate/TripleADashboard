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

function CropModal({ file, agentName, onDone, onCancel }) {
  const [imgUrl]          = useState(() => URL.createObjectURL(file))
  const [displaySize, setDisplaySize] = useState(null) // { w, h } of img in px
  const [offset, setOffset]           = useState({ x: 0, y: 0 })
  const [uploading, setUploading]     = useState(false)
  const imgRef      = useRef(null)
  const dragging    = useRef(false)
  const dragOrigin  = useRef({ x: 0, y: 0 })

  // Revoke object URL when modal unmounts
  useEffect(() => () => URL.revokeObjectURL(imgUrl), [imgUrl])

  function onImgLoad() {
    const img = imgRef.current
    if (!img) return
    const { naturalWidth: nw, naturalHeight: nh } = img
    // Scale to cover the crop square
    let w, h
    if (nw / nh > 1) { h = CROP_SIZE; w = CROP_SIZE * (nw / nh) }
    else              { w = CROP_SIZE; h = CROP_SIZE * (nh / nw) }
    setDisplaySize({ w, h })
  }

  const clamp = useCallback((ox, oy, dw, dh) => {
    const maxX = Math.max(0, (dw - CROP_SIZE) / 2)
    const maxY = Math.max(0, (dh - CROP_SIZE) / 2)
    return {
      x: Math.max(-maxX, Math.min(maxX, ox)),
      y: Math.max(-maxY, Math.min(maxY, oy)),
    }
  }, [])

  function startDrag(clientX, clientY) {
    dragging.current = true
    dragOrigin.current = { x: clientX - offset.x, y: clientY - offset.y }
  }
  function moveDrag(clientX, clientY) {
    if (!dragging.current || !displaySize) return
    const raw = { x: clientX - dragOrigin.current.x, y: clientY - dragOrigin.current.y }
    setOffset(clamp(raw.x, raw.y, displaySize.w, displaySize.h))
  }
  function endDrag() { dragging.current = false }

  // Mouse events
  const onMouseDown = e => { e.preventDefault(); startDrag(e.clientX, e.clientY) }
  const onMouseMove = e => moveDrag(e.clientX, e.clientY)
  const onMouseUp   = endDrag

  // Touch events
  const onTouchStart = e => { const t = e.touches[0]; startDrag(t.clientX, t.clientY) }
  const onTouchMove  = e => { e.preventDefault(); const t = e.touches[0]; moveDrag(t.clientX, t.clientY) }
  const onTouchEnd   = endDrag

  async function handleConfirm() {
    const img = imgRef.current
    if (!img || !displaySize) return
    setUploading(true)

    // Scale display → natural
    const scaleX = img.naturalWidth  / displaySize.w
    const scaleY = img.naturalHeight / displaySize.h

    // The image center in the container is at (CROP_SIZE/2 + offset.x, CROP_SIZE/2 + offset.y)
    // So the crop starts at image-local display coords:
    const cropXDisplay = displaySize.w / 2 - CROP_SIZE / 2 - offset.x
    const cropYDisplay = displaySize.h / 2 - CROP_SIZE / 2 - offset.y

    const canvas = document.createElement('canvas')
    canvas.width  = 400
    canvas.height = 400
    const ctx = canvas.getContext('2d')
    ctx.drawImage(
      img,
      cropXDisplay * scaleX,
      cropYDisplay * scaleY,
      CROP_SIZE    * scaleX,
      CROP_SIZE    * scaleY,
      0, 0, 400, 400,
    )

    canvas.toBlob(blob => {
      setUploading(false)
      onDone(blob)
    }, 'image/jpeg', 0.92)
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        {/* Header */}
        <div className="px-6 pt-5 pb-3">
          <p className="text-sm font-bold text-gray-800" style={{ fontFamily: 'AIA Everest' }}>
            Crop Photo
          </p>
          <p className="text-xs text-gray-400 mt-0.5" style={{ fontFamily: 'AIA Everest' }}>
            Drag to reposition · square crop
          </p>
        </div>

        {/* Crop frame */}
        <div className="px-6 pb-4">
          <div
            className="relative overflow-hidden rounded-xl mx-auto select-none"
            style={{
              width:  CROP_SIZE,
              height: CROP_SIZE,
              cursor: dragging.current ? 'grabbing' : 'grab',
              background: '#1C1C28',
            }}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            {displaySize ? (
              <img
                ref={imgRef}
                src={imgUrl}
                alt="Crop"
                onLoad={onImgLoad}
                draggable={false}
                style={{
                  position:        'absolute',
                  width:           displaySize.w,
                  height:          displaySize.h,
                  top:             '50%',
                  left:            '50%',
                  transform:       `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
                  userSelect:      'none',
                  pointerEvents:   'none',
                }}
              />
            ) : (
              /* Hidden img used only for onLoad measurement */
              <img
                ref={imgRef}
                src={imgUrl}
                alt=""
                onLoad={onImgLoad}
                draggable={false}
                style={{ opacity: 0, position: 'absolute' }}
              />
            )}
          </div>
          <p className="text-center text-[10px] text-gray-400 mt-2" style={{ fontFamily: 'AIA Everest' }}>
            Photo for {agentName}
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 px-6 pb-5">
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
