/**
 * SplashScreen.jsx - Tela inicial de seleção de módulo.
 * Apresenta os 3 cards (APS Assistance, Diario de Turno e Caixa de Ferramentas)
 * com animação de entrada e efeitos visuais de fundo.
 */
import { useState } from 'react'
import { FiArrowRight, FiTool, FiBook, FiCpu } from 'react-icons/fi'

// ===== MÓDULOS =====
// Definição dos 3 cards de módulo: id, nome, subtítulo, ícone, cor de destaque e chamada
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
    accent: '#3b82f6',
    tagline: 'Comunique ocorrencias entre turnos'
  },
  {
    id: 'ferramentas',
    name: 'CAIXA DE FERRAMENTAS',
    subtitle: 'Utilidades do plantao',
    icon: <FiCpu size={28} />,
    accent: '#3b82f6',
    tagline: 'Calculos, SEFAZ, codigos e CFOP na hora'
  }
]

export default function SplashScreen({ onEnter }) {
  // Controla a animação de saída e qual módulo foi escolhido
  const [fadeOut, setFadeOut] = useState(false)
  const [selected, setSelected] = useState(null)

  // Aplica o fade-out e chama onEnter com o módulo escolhido após 600ms
  const handleEnter = (moduleId) => {
    setSelected(moduleId)
    setFadeOut(true)
    setTimeout(() => onEnter(moduleId), 600)
  }

  return (
    <div className={`splash-screen ${fadeOut ? 'fade-out' : ''}`}>
      {/* ===== RENDERIZAÇÃO ===== */}
      {/* Efeitos visuais de fundo: orbs, grade e linhas */}
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
          <img src="/logo.png" alt="APS | Negocios Digitais" className="splash-logo" style={{ height: 'clamp(60px, 10vw, 100px)' }} />
        </div>
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', justifyContent: 'center', maxWidth: '700px' }}>
          {/* Os 3 cards de módulo: clique escolhe o módulo e entra no aplicativo */}
          {MODULES.map(mod => (
            <div
              key={mod.id}
              onClick={() => handleEnter(mod.id)}
              style={{
                background: 'var(--splash-card-bg)',
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
                color: 'var(--splash-card-text)',
                letterSpacing: '1.5px',
                textAlign: 'center'
              }}>
                {mod.name}
              </span>
              <span style={{ fontSize: '12px', color: mod.accent, fontWeight: 500 }}>
                {mod.subtitle}
              </span>
              <span style={{ fontSize: '12px', color: 'var(--splash-card-muted)', textAlign: 'center' }}>
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
