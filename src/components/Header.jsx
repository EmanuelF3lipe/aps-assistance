import { FiSearch, FiX, FiPlus, FiTag, FiFileText, FiList, FiGrid, FiFilter } from 'react-icons/fi'

export default function Header({ searchQuery, onSearch, onClearSearch, onNewFile, onShowDashboard, onShowTags, onShowRelatorios, onSearchByTag, mainView, onSwitchView, onShowAdvancedSearch }) {

  const handleInputChange = (e) => {
    const value = e.target.value
    onSearch(value)
    if (value === '') {
      onClearSearch()
    }
  }

  return (
    <header>
      <div className="logo">
        <div className="logo-icon">
          <FiSearch size={20} />
        </div>
        <h1>
          APS Assistance
          <span>Catalogo de Erros e Solucoes</span>
        </h1>
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
          <FiSearch size={14} /> Buscar
        </button>
        <button onClick={onShowAdvancedSearch} className="advanced-search-btn">
          <FiFilter size={14} /> Avançada
        </button>
      </div>

      <div className="header-actions">
        <button onClick={onSwitchView} className={mainView === 'erros' ? 'active-view-btn' : ''}>
          {mainView === 'erros' ? <><FiGrid size={14} /> Dashboard</> : <><FiList size={14} /> Ver Erros</>}
        </button>
        <button onClick={onShowRelatorios} className={mainView === 'relatorios' ? 'active-view-btn' : ''}>
          <FiFileText size={14} /> Relatorios
        </button>
        {mainView === 'erros' && (
          <button onClick={onShowTags}>
            <FiTag size={14} /> Tags
          </button>
        )}
        <button onClick={onNewFile}>
          <FiPlus size={14} /> Novo Erro
        </button>
      </div>
    </header>
  )
}
