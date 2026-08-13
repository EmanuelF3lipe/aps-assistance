import { useState } from 'react'
import { FiArrowRight } from 'react-icons/fi'

export default function SplashScreen({ onEnter }) {
  const [fadeOut, setFadeOut] = useState(false)

  const handleEnter = () => {
    setFadeOut(true)
    setTimeout(() => onEnter(), 500)
  }

  return (
    <div className={`splash-screen ${fadeOut ? 'fade-out' : ''}`}>
      <div className="splash-content">
        <div className="splash-logo-container">
          <img src="/logo.png" alt="APS Assistance" className="splash-logo" />
        </div>
        <h1 className="splash-title">APS Assistance</h1>
        <p className="splash-subtitle">Catálogo de Erros e Soluções</p>
        <button className="splash-btn" onClick={handleEnter}>
          Entrar <FiArrowRight size={18} />
        </button>
      </div>
    </div>
  )
}
