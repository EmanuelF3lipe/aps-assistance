/* ============================================================
   AdvancedSearchPanel.jsx — Painel de busca avançada de erros
   Permite filtrar a busca por texto, sistema/pasta, tags e
   intervalo de datas de criação.
   ============================================================ */

// ===== Imports =====
import { useState, useEffect } from 'react'
import { FiSearch, FiX, FiCalendar, FiTag, FiFolder, FiFilter } from 'react-icons/fi'
import { api } from '../services/api'

// ===== Componente AdvancedSearchPanel =====
// Props: onSearch (executa a busca), onClose (fecha o painel) e onSearchByTag
export default function AdvancedSearchPanel({ onSearch, onClose, onSearchByTag }) {
  // ===== States do componente =====
  const [query, setQuery] = useState('')            // Texto de busca
  const [folder, setFolder] = useState('')          // Sistema/pasta selecionado
  const [tags, setTags] = useState('')              // Tags separadas por vírgula
  const [dateFrom, setDateFrom] = useState('')      // Data inicial do intervalo
  const [dateTo, setDateTo] = useState('')          // Data final do intervalo
  const [folders, setFolders] = useState([])        // Lista de pastas/sistemas

  // ===== Efeito: carrega as pastas disponíveis ao montar o painel =====
  useEffect(() => {
    const loadFolders = async () => {
      const data = await api.getFolders()
      setFolders(data)
    }
    loadFolders()
  }, [])

  // ===== Handler: dispara a busca com os filtros preenchidos =====
  const handleSearch = () => {
    onSearch({ query, folder, tags, dateFrom, dateTo })
  }

  // ===== Handler: limpa todos os filtros da busca =====
  const handleClear = () => {
    setQuery('')
    setFolder('')
    setTags('')
    setDateFrom('')
    setDateTo('')
  }

  // ===== Renderização do painel =====
  return (
    // Overlay que fecha o painel ao clicar fora
    <div className="advanced-search-overlay" onClick={onClose}>
      <div className="advanced-search-panel" onClick={e => e.stopPropagation()}>
        {/* ===== Cabeçalho do painel ===== */}
        <div className="advanced-search-header">
          <h3><FiFilter size={16} /> Busca Avançada</h3>
          <button onClick={onClose} className="close-btn">
            <FiX size={18} />
          </button>
        </div>

        {/* ===== Corpo: campos de filtro da busca ===== */}
        <div className="advanced-search-body">
          {/* Campo: texto de busca (título ou conteúdo) */}
          <div className="search-field">
            <label><FiSearch size={14} /> Texto</label>
            <input
              type="text"
              placeholder="Buscar no título ou conteúdo..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>

          {/* Campo: seleção do sistema/pasta */}
          <div className="search-field">
            <label><FiFolder size={14} /> Sistema/Pasta</label>
            <select value={folder} onChange={(e) => setFolder(e.target.value)}>
              <option value="">Todos os sistemas</option>
              {folders.map(f => (
                <option key={f.path} value={f.path}>{f.name}</option>
              ))}
            </select>
          </div>

          {/* Campo: tags separadas por vírgula */}
          <div className="search-field">
            <label><FiTag size={14} /> Tags</label>
            <input
              type="text"
              placeholder="Separar por vírgula: tag1, tag2"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>

          {/* Campo: intervalo de datas de criação */}
          <div className="search-field">
            <label><FiCalendar size={14} /> Data de Criação</label>
            <div className="date-range">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                placeholder="De"
              />
              <span>até</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                placeholder="Até"
              />
            </div>
          </div>
        </div>

        {/* ===== Rodapé: botões de limpar filtros e buscar ===== */}
        <div className="advanced-search-footer">
          <button onClick={handleClear} className="btn-secondary">
            <FiX size={14} /> Limpar
          </button>
          <button onClick={handleSearch} className="btn-primary">
            <FiSearch size={14} /> Buscar
          </button>
        </div>
      </div>
    </div>
  )
}
