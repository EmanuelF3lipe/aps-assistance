import { useState } from 'react'
import { FiArrowRight, FiTool, FiBook, FiCpu } from 'react-icons/fi'

const MODULES = [
  {
    id: 'aps',
    name: 'APS ASSISTANCE',
    subtitle: 'Catalogo de erros e solucoes',
    icon: <FiTool size={28} />,
    accent: '#3b82f6',
    tagline: 'Registre, busque e resolva erros do dia a dia'
  },
  {
    id: 'diario',
    name: 'DIARIO DE TURNO',
    subtitle: 'Registro de ocorrencias',
    icon: <FiBook size={28} />,
    accent: '#4a7c59',
    tagline: 'Comunique ocorrencias entre turnos'
  },
  {
    id: 'ferramentas',
    name: 'CAIXA DE FERRAMENTAS',
    subtitle: 'Utilidades do plantao',
    icon: <FiCpu size={28} />,
    accent: '#ef4444',
    tagline: 'Calculos, SEFAZ, codigos e CFOP na hora'
  }
]

export default function SplashScreen({ onEnter }) {
  const [fadeOut, setFadeOut] = useState(false)
  const [selected, setSelected] = useState(null)

  const handleEnter = (moduleId) => {
    setSelected(moduleId)
    setFadeOut(true)
    setTimeout(() => onEnter(moduleId), 600)
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
      <div className="splash-content" style={{ flexDirection: 'column', gap: '40px', alignItems: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <span className="splash-aps-main" style={{ fontSize: 'clamp(24px, 4vw, 36px)' }}>Bem vindo</span>
          <span className="splash-brand">APS tecnologia</span>
        </div>
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', justifyContent: 'center', maxWidth: '700px' }}>
          {MODULES.map(mod => (
            <div
              key={mod.id}
              onClick={() => handleEnter(mod.id)}
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: `1px solid ${mod.accent}30`,
                borderRadius: '16px',
                padding: '32px 28px',
                cursor: 'pointer',
                flex: '1 1 280px',
                maxWidth: '340px',
                minWidth: '240px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '14px',
                transition: 'all 0.3s ease',
                position: 'relative',
                overflow: 'hidden'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.border = `1px solid ${mod.accent}80`
                e.currentTarget.style.transform = 'translateY(-4px)'
                e.currentTarget.style.boxShadow = `0 8px 32px ${mod.accent}20`
              }}
              onMouseLeave={e => {
                e.currentTarget.style.border = `1px solid ${mod.accent}30`
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = 'none'
              }}
            >
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: mod.accent + '15',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: mod.accent
              }}>
                {mod.icon}
              </div>
              <span style={{
                fontSize: '17px',
                fontWeight: 700,
                color: '#e2e8f0',
                letterSpacing: '1.5px',
                textAlign: 'center'
              }}>
                {mod.name}
              </span>
              <span style={{ fontSize: '12px', color: mod.accent, fontWeight: 500 }}>
                {mod.subtitle}
              </span>
              <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', textAlign: 'center' }}>
                {mod.tagline}
              </span>
              <div style={{
                marginTop: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                color: mod.accent,
                fontSize: '13px',
                fontWeight: 600
              }}>
                Entrar <FiArrowRight size={14} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
