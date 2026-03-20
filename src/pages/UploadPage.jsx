import { useRef, useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useData } from '../context/DataContext'

export default function UploadPage() {
  const { loadData, clearData, isLoaded, isLoading, error, data } = useData()
  const navigate = useNavigate()
  const inputRef = useRef(null)
  const [isDragging, setIsDragging] = useState(false)
  const [localError, setLocalError] = useState(null)

  // Navigate to overview once data is successfully loaded
  useEffect(() => {
    if (isLoaded && !isLoading && !error) {
      // Only auto-navigate if we just loaded (not on initial mount with stored data)
    }
  }, [isLoaded, isLoading, error])

  const handleFile = useCallback(
    async (file) => {
      setLocalError(null)

      if (!file) return

      if (
        !file.name.endsWith('.xlsx') &&
        file.type !==
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      ) {
        setLocalError('Only .xlsx files are accepted. Please upload a valid AIA report file.')
        return
      }

      const reader = new FileReader()
      reader.onload = async (e) => {
        await loadData(e.target.result)
      }
      reader.onerror = () => {
        setLocalError('Failed to read the file. Please try again.')
      }
      reader.readAsArrayBuffer(file)
    },
    [loadData]
  )

  // Navigate to /overview once loading completes successfully
  useEffect(() => {
    if (!isLoading && isLoaded && !error) {
      navigate('/overview')
    }
  }, [isLoading, isLoaded, error, navigate])

  const onInputChange = (e) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    // Reset input so the same file can be re-selected
    e.target.value = ''
  }

  const onDragOver = (e) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const onDragLeave = (e) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const onDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  const onDropZoneClick = () => {
    if (!isLoading) inputRef.current?.click()
  }

  const displayError = error || localError

  const uploadDate = data?.uploadDate
    ? new Date(data.uploadDate).toLocaleDateString('en-PH', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FAFAFA] via-white to-[#FFF0F3] flex flex-col items-center justify-center p-4 sm:p-6">
      {/* Main Card */}
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-[0_20px_60px_-15px_rgba(211,17,69,0.15),0_8px_24px_-8px_rgba(0,0,0,0.08)] overflow-hidden animate-scale-in">
        {/* Header Band */}
        <div className="relative bg-aia-red px-8 pt-8 pb-16 overflow-hidden">
          {/* Subtle radial glow */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#e8134f] via-aia-red to-[#a80d37] opacity-100" />

          {/* Header Content */}
          <div className="relative z-10 flex items-center gap-4 animate-fade-in-up delay-1">
            {/* AIA Logo */}
            <div className="flex-shrink-0 w-16 h-16 bg-white rounded-xl flex items-center justify-center shadow-lg shadow-red-900/20">
              <span className="text-aia-red font-extrabold text-2xl tracking-tight leading-none">
                AIA
              </span>
            </div>
            <div>
              <h1 className="text-white font-extrabold text-xl sm:text-2xl leading-tight tracking-tight">
                Amora Assurance Agency
              </h1>
              <p className="text-red-200 text-xs font-semibold mt-0.5 tracking-wide">
                of AIA Philippines · Production Dashboard
              </p>
            </div>
          </div>

          {/* Moving Mountains SVG */}
          <svg
            viewBox="0 0 1080 120"
            className="absolute bottom-0 left-0 w-full h-[60px]"
            preserveAspectRatio="none"
          >
            <polygon points="0,120 160,30 320,120" fill="white" opacity="0.12" />
            <polygon points="160,120 380,10 600,120" fill="white" opacity="0.45" />
            <polygon points="420,120 660,20 900,120" fill="white" opacity="0.7" />
            <polygon points="680,120 900,0 1080,120" fill="white" opacity="1" />
          </svg>
        </div>

        {/* Body */}
        <div className="px-8 py-8 flex flex-col gap-6">
          {/* Already loaded state */}
          {isLoaded && (
            <div className="flex flex-col gap-4 animate-fade-in-up delay-2">
              {uploadDate && (
                <div className="flex items-center justify-center animate-fade-in-up delay-2">
                  <span className="inline-flex items-center gap-2 bg-red-50 text-aia-red text-xs font-semibold px-4 py-2 rounded-full border border-red-100">
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                    Last uploaded: {uploadDate}
                  </span>
                </div>
              )}

              <button
                onClick={() => navigate('/overview')}
                className="animate-fade-in-up delay-3 w-full bg-aia-red hover:bg-[#b80e3b] active:scale-[0.98] text-white font-bold py-4 px-6 rounded-xl transition-all duration-200 text-base shadow-lg shadow-red-200/50 flex items-center justify-center gap-2.5 group"
              >
                <svg
                  className="w-5 h-5 transition-transform duration-200 group-hover:scale-110"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
                View Dashboard
              </button>

              <div className="relative flex items-center py-1 animate-fade-in-up delay-3">
                <div className="flex-1 border-t border-gray-200" />
                <span className="px-3 text-xs text-gray-400 font-medium">or</span>
                <div className="flex-1 border-t border-gray-200" />
              </div>

              <p className="text-center text-sm text-gray-500 animate-fade-in-up delay-4">
                <button
                  onClick={() => {
                    clearData()
                    setLocalError(null)
                  }}
                  className="text-aia-red hover:text-[#b80e3b] font-semibold underline underline-offset-2 transition-colors duration-200"
                >
                  Upload new report
                </button>{' '}
                to replace current data
              </p>
            </div>
          )}

          {/* Upload zone */}
          {(!isLoaded || isLoading) && (
            <div
              role="button"
              tabIndex={isLoading ? -1 : 0}
              aria-label="Upload XLSX file"
              onClick={onDropZoneClick}
              onKeyDown={(e) => e.key === 'Enter' && onDropZoneClick()}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              className={[
                'animate-fade-in-up delay-2',
                'flex flex-col items-center justify-center gap-4',
                'border-2 border-dashed rounded-2xl px-8 py-14',
                'select-none transition-all duration-200',
                isLoading
                  ? 'border-gray-200 bg-gray-50/50 cursor-not-allowed'
                  : isDragging
                  ? 'border-aia-red bg-red-50/60 shadow-inner scale-[1.01]'
                  : 'border-gray-300 hover:border-aia-red/60 hover:bg-red-50/30 cursor-pointer',
              ].join(' ')}
            >
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="hidden"
                onChange={onInputChange}
                disabled={isLoading}
              />

              {isLoading ? (
                /* Spinner state */
                <div className="flex flex-col items-center gap-4">
                  <div className="relative">
                    <svg
                      className="w-14 h-14 text-aia-red animate-spin"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-20"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="3"
                      />
                      <path
                        className="opacity-80"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                  </div>
                  <div className="text-center">
                    <p className="text-aia-red font-bold text-base">
                      Parsing report...
                    </p>
                    <p className="text-gray-400 text-sm mt-1">This may take a moment</p>
                  </div>
                </div>
              ) : (
                /* Idle / drag state */
                <>
                  <div
                    className={[
                      'w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-200',
                      isDragging
                        ? 'bg-aia-red/10 scale-110'
                        : 'bg-gray-100',
                    ].join(' ')}
                  >
                    <svg
                      className={[
                        'w-8 h-8 transition-colors duration-200',
                        isDragging ? 'text-aia-red' : 'text-gray-400',
                      ].join(' ')}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                      />
                    </svg>
                  </div>
                  <div className="text-center">
                    <p
                      className={[
                        'font-bold text-base transition-colors duration-200',
                        isDragging ? 'text-aia-red' : 'text-gray-700',
                      ].join(' ')}
                    >
                      Drag &amp; drop your AIA report here
                    </p>
                    <p className="text-gray-400 text-sm mt-1.5">
                      or{' '}
                      <span className="text-aia-red font-semibold underline underline-offset-2 decoration-aia-red/40">
                        click to browse
                      </span>
                    </p>
                  </div>
                  <span className="text-xs text-gray-400 bg-gray-50 border border-gray-100 px-4 py-1.5 rounded-full font-medium">
                    .xlsx files only
                  </span>
                </>
              )}
            </div>
          )}

          {/* Error message */}
          {displayError && (
            <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3.5 animate-fade-in-up">
              <svg
                className="w-5 h-5 text-aia-red flex-shrink-0 mt-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="text-sm text-aia-red font-medium leading-snug">
                {displayError}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-8 py-4 bg-gradient-to-r from-gray-50 to-gray-50/80 border-t border-gray-100 flex items-center justify-between animate-fade-in delay-4">
          <p className="text-xs text-gray-400 font-medium">
            AIA Philippines
          </p>
          <p className="text-xs text-gray-300 font-mono tracking-wider">v1.0</p>
        </div>
      </div>

      {/* Privacy note outside card */}
      <p className="mt-8 text-xs text-gray-400 text-center max-w-sm leading-relaxed animate-fade-in delay-4">
        <svg className="w-3.5 h-3.5 inline-block mr-1 -mt-0.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        Your data is processed locally in the browser and never sent to any server.
      </p>
    </div>
  )
}
