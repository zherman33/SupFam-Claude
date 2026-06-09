import { useState, useEffect } from 'react'

export function InstallPrompt() {
  const [show, setShow] = useState(false)
  const [showInstructions, setShowInstructions] = useState(false)

  useEffect(() => {
    // Only show on iOS Safari (where standalone is available)
    // and only if NOT in standalone mode (not installed)
    const isIos = /ipad|iphone|ipod/i.test(navigator.userAgent.toLowerCase())
    // @ts-expect-error iOS specific property
    const isStandalone = window.navigator.standalone === true
    
    if (!isIos || isStandalone) {
      return
    }

    try {
      const dismissData = localStorage.getItem('supfam-install-dismissData')
      if (dismissData) {
        const { count, nextShowTime } = JSON.parse(dismissData)
        if (Date.now() < nextShowTime || count >= 3) {
          // Still waiting for the timeout, or they dismissed it 3 times already
          return
        }
      }
    } catch {
      // Ignore parse errors
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShow(true)
  }, [])

  if (!show) return null

  const handleDismiss = () => {
    try {
      const dismissData = localStorage.getItem('supfam-install-dismissData')
      let count = 0
      if (dismissData) {
        count = JSON.parse(dismissData).count || 0
      }
      
      count += 1
      let waitDays = 7
      if (count === 1) waitDays = 7      // 1 week after 1st dismissal
      else if (count === 2) waitDays = 30 // 1 month after 2nd dismissal
      else waitDays = 365 * 10           // Never show after 3rd dismissal

      const nextShowTime = Date.now() + waitDays * 24 * 60 * 60 * 1000
      
      localStorage.setItem('supfam-install-dismissData', JSON.stringify({
        count,
        nextShowTime
      }))
    } catch {
      // fallback
    }
    setShow(false)
  }

  return (
    <>
      <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-2 py-2.5 bg-[#f4f4f4]/90 backdrop-blur-md border-b border-[#c8c7cc] shadow-sm font-sans" style={{ paddingTop: 'max(env(safe-area-inset-top), 10px)' }}>
        
        {/* Left Side: Close + Icon + Text */}
        <div className="flex items-center gap-2.5 overflow-hidden">
          <button 
            onClick={handleDismiss}
            className="flex-shrink-0 p-1.5 text-[#8e8e93]"
            aria-label="Close install prompt"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          
          <img 
            src="/apple-touch-icon.png" 
            alt="Sup Fam icon" 
            className="w-[42px] h-[42px] rounded-lg shadow-[0_1px_3px_rgba(0,0,0,0.1)] flex-shrink-0 object-cover border border-[#e5e5ea]" 
          />
          
          <div className="flex flex-col min-w-0">
            <span className="text-[14px] leading-tight font-semibold text-black truncate">Sup Fam</span>
            <span className="text-[12px] leading-tight text-[#8e8e93] truncate mt-0.5">Family Planner</span>
          </div>
        </div>

        {/* Right Side: Button */}
        <button 
          onClick={() => setShowInstructions(true)}
          className="flex-shrink-0 ml-2 px-3.5 py-1 bg-[#efeff0] text-[#007aff] font-bold text-[13px] rounded-full active:bg-[#e5e5ea] transition-colors"
        >
          GET
        </button>
      </div>

      {/* Instructions Modal */}
      {showInstructions && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setShowInstructions(false)}>
          <div 
            className="bg-white rounded-2xl p-6 shadow-xl max-w-sm w-full text-center relative animate-in fade-in zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
          >
            <button 
              onClick={() => setShowInstructions(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            
            <div className="mx-auto w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                <polyline points="16 6 12 2 8 6" />
                <line x1="12" y1="2" x2="12" y2="15" />
              </svg>
            </div>
            
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Add to Home Screen</h3>
            <p className="text-gray-500 text-sm mb-6">
              To install Sup Fam, tap the <strong className="text-gray-700">Share</strong> icon at the bottom of your screen and select <strong className="text-gray-700">Add to Home Screen</strong>.
            </p>
            
            <button 
              onClick={() => setShowInstructions(false)}
              className="w-full py-3 bg-[#007aff] text-white font-semibold rounded-xl hover:bg-blue-600 active:bg-blue-700 transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  )
}
