import { FiSearch, FiPlus, FiTag, FiFileText, FiGrid, FiList, FiFilter, FiMenu, FiSun, FiMoon, FiCommand, FiBook, FiArrowLeft, FiCpu } from 'react-icons/fi'

const MODULE_META = {
  diario: {
    title: 'Diario de Turno',
    subtitle: 'Registro de Ocorrencias',
    icon: <FiBook size={20} />,
    gradient: 'linear-gradient(135deg, #2d5a3d, #4a7c59)'
  },
  ferramentas: {
    title: 'Caixa de Ferramentas',
    subtitle: 'Utilidades do Plantao',
    icon: <FiCpu size={20} />,
    gradient: 'linear-gradient(135deg, #7f1d1d, #dc2626)'
  }
}

export default function Header({ currentModule, searchQuery, onSearch, onClearSearch, onNewFile, onShowDashboard, onShowTags, onShowRelatorios, mainView, onSwitchView, onShowAdvancedSearch, onToggleTheme, theme, onToggleSidebar, onShowShortcuts, onGoHome }) {

  const handleInputChange = (e) => {
    const value = e.target.value
    onSearch(value)
    if (value === '') {
      onClearSearch()
    }
  }

  const meta = MODULE_META[currentModule]
  const isAps = !meta

  return (
    <header>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
