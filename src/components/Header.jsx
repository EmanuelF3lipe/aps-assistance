/**
 * Header.jsx - Cabeçalho do aplicativo.
 * Contém o logo, a busca de erros e as ações principais (views, tags, tema,
 * atalhos e botão "Novo Erro"). Também exibe o título dos módulos diario/ferramentas.
 */
import { FiSearch, FiPlus, FiTag, FiFileText, FiGrid, FiList, FiFilter, FiMenu, FiSun, FiMoon, FiCommand, FiBook, FiArrowLeft, FiCpu } from 'react-icons/fi'

// Metadados visuais dos módulos: título, subtítulo, ícone e gradiente de cor
const MODULE_META = {
  diario: {
    title: 'Diario de Turno',
    subtitle: 'Registro de Ocorrencias',
    icon: <FiBook size={20} />,
    gradient: 'linear-gradient(135deg, #2563eb, #3b82f6)'
  },
  ferramentas: {
    title: 'Caixa de Ferramentas',
    subtitle: 'Utilidades do Plantao',
    icon: <FiCpu size={20} />,
    gradient: 'linear-gradient(135deg, #2563eb, #3b82f6)'
  }
}

export default function Header({ currentModule, searchQuery, onSearch, onClearSearch, onNewFile, onShowDashboard, onShowTags, onShowRelatorios, mainView, onSwitchView, onShowAdvancedSearch, onToggleTheme, theme, onToggleSidebar, onShowShortcuts, onGoHome }) {

  // Dispara a busca a cada tecla digitada; limpa a busca quando o campo esvazia
  const handleInputChange = (e) => {
    const value = e.target.value
    onSearch(value)
    if (value === '') {
      onClearSearch()
    }
  }

  // Define se está num módulo específico (diario/ferramentas) ou no módulo APS
  const meta = MODULE_META[currentModule]
  const isAps = !meta

  // ===== RENDERIZAÇÃO =====
  // Barra do topo: menu mobile, logo e identificação do módulo
  return (
    <header>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {/* Botão que abre/fecha a sidebar no mobile */}
        <button className="mobile-menu-btn" onClick={onToggleSidebar}>
          <FiMenu size={18} />
        </button>
        {!isAps && (
          <button
            onClick={onGoHome}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-muted)',
              borderRadius: '8px',
              padding: '6px 10px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '12px'
            }}
          >
            <FiArrowLeft size={14} /> Voltar
          </button>
        )}
        <button onClick={onGoHome} className="logo" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          <div className="logo-icon" style={meta ? { background: meta.gradient } : {}}>
            {meta ? meta.icon : <FiSearch size={20} />}
          </div>
          <h1>
            {meta ? meta.title : 'APS Assistance'}
            <span>{meta ? meta.subtitle : 'Catalogo de Erros e Solucoes'}</span>
          </h1>
        </button>
      </div>

      {/* Caixa de busca (somente no módulo APS): busca rápida e busca avançada */}
      {isAps && (
        <div className="search-box">
          <input
            id="searchInput"
            type="text"
            placeholder="Buscar erros... (Ctrl+K)"
            value={searchQuery}
            onChange={handleInputChange}
            onKeyPress={(e) => e.key === 'Enter' && onSearch(searchQuery)}
          />
          <button onClick={() => onSearch(searchQuery)}>
            <FiSearch size={14} /> <span>Buscar</span>
          </button>
          <button onClick={onShowAdvancedSearch} className="advanced-search-btn">
            <FiFilter size={14} /> <span>Avançada</span>
          </button>
        </div>
      )}

      {/* Ações do cabeçalho: alternar dashboard/erros, relatorios, tags, atalhos, tema e novo erro */}
      <div className="header-actions">
        {isAps && (
          <>
            <button onClick={onSwitchView} className={mainView === 'erros' ? 'active-view-btn' : ''}>
              {mainView === 'erros' ? <><FiGrid size={14} /> <span>Dashboard</span></> : <><FiList size={14} /> <span>Ver Erros</span></>}
            </button>
            <button onClick={onShowRelatorios} className={mainView === 'relatorios' ? 'active-view-btn' : ''}>
              <FiFileText size={14} /> <span>Relatorios</span>
            </button>
            {mainView === 'erros' && (
              <button onClick={onShowTags}>
                <FiTag size={14} /> <span>Tags</span>
              </button>
            )}
          </>
        )}
        <button onClick={onShowShortcuts} title="Atalhos">
          <FiCommand size={14} />
        </button>
        <button className="theme-toggle" onClick={onToggleTheme} title="Trocar tema">
          {theme === 'dark' ? <FiSun size={14} /> : <FiMoon size={14} />}
        </button>
        {isAps && (
          <button onClick={onNewFile}>
            <FiPlus size={14} /> <span>Novo Erro</span>
          </button>
        )}
      </div>
    </header>
  )
}
