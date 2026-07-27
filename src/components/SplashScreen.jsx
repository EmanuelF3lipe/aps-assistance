import { useState } from 'react'
import { FiArrowRight } from 'react-icons/fi'

export default function SplashScreen({ onEnter }) {
  const [fadeOut, setFadeOut] = useState(false)

  const handleEnter = () => {
    setFadeOut(true)
    setTimeout(() => onEnter(), 600)
  }

  return (
    <div className={`splash-screen ${fadeOut ? 'fade-out' : ''}`}>
      <div className="splash-bg-effects">
        <div className="splash-orb splash-orb-1"></div>
        <div className="splash-orb splash-orb-2"></div>
        <div className="splash-orb splash-orb-3"></div>
        <div className="splash-grid"></div>
        <div className="splash-line splash-line-1"></div>
        <div className="splash-line splash-line-2"></div>
      </div>
      <div className="splash-content">
        <div className="splash-left">
          <span className="splash-aps-main">APS ASSISTANCE</span>
          <span className="splash-tagline">catalogo de erros e soluções</span>
          <span className="splash-brand">APS tecnologia™</span>
        </div>
        <div className="splash-right">
          <button className="splash-btn" onClick={handleEnter}>
            Entrar <FiArrowRight size={18} />
          </button>
        </div>
      </div>
    </div>
  )
}
