import { useState, useEffect } from 'react'
import { FiSearch, FiX, FiCalendar, FiTag, FiFolder, FiFilter } from 'react-icons/fi'
import { api } from '../services/api'

export default function AdvancedSearchPanel({ onSearch, onClose, onSearchByTag }) {
  const [query, setQuery] = useState('')
  const [folder, setFolder] = useState('')
  const [tags, setTags] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [folders, setFolders] = useState([])

  useEffect(() => {
    const loadFolders = async () => {
      const data = await api.getFolders()
      setFolders(data)
    }
    loadFolders()
  }, [])

  const handleSearch = () => {
    onSearch({ query, folder, tags, dateFrom, dateTo })
  }

  const handleClear = () => {
    setQuery('')
    setFolder('')
    setTags('')
    setDateFrom('')
    setDateTo('')
  }

  return (
    <div className="advanced-search-overlay" onClick={onClose}>
      <div className="advanced-search-panel" onClick={e => e.stopPropagation()}>
        <div className="advanced-search-header">
          <h3><FiFilter size={16} /> Busca Avançada</h3>
          <button onClick={onClose} className="close-btn">
            <FiX size={18} />
          </button>
        </div>

        <div className="advanced-search-body">
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

          <div className="search-field">
            <label><FiFolder size={14} /> Sistema/Pasta</label>
            <select value={folder} onChange={(e) => setFolder(e.target.value)}>
              <option value="">Todos os sistemas</option>
              {folders.map(f => (
                <option key={f.path} value={f.path}>{f.name}</option>
              ))}
            </select>
          </div>

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
