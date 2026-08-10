import { FiSearch, FiPlus, FiTag, FiFileText, FiGrid, FiList, FiFilter, FiMenu, FiSun, FiMoon, FiCommand } from 'react-icons/fi'

export default function Header({ searchQuery, onSearch, onClearSearch, onNewFile, onShowDashboard, onShowTags, onShowRelatorios, mainView, onSwitchView, onShowAdvancedSearch, onToggleTheme, theme, onToggleSidebar, onShowShortcuts }) {

  const handleInputChange = (e) => {
    const value = e.target.value
    onSearch(value)
    if (value === '') {
      onClearSearch()
    }
  }

  return (
    <header>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button className="mobile-menu-btn" onClick={onToggleSidebar}>
          <FiMenu size={18} />
        </button>
        <div className="logo">
          <div className="logo-icon">
            <FiSearch size={20} />
          </div>
          <h1>
            APS Assistance
            <span>Catalogo de Erros e Solucoes</span>
          </h1>
        </div>
      </div>

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

      <div className="header-actions">
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
        <button onClick={onShowShortcuts} title="Atalhos">
          <FiCommand size={14} />
        </button>
        <button className="theme-toggle" onClick={onToggleTheme} title="Trocar tema">
          {theme === 'dark' ? <FiSun size={14} /> : <FiMoon size={14} />}
        </button>
        <button onClick={onNewFile}>
          <FiPlus size={14} /> <span>Novo Erro</span>
        </button>
      </div>
    </header>
  )
}
