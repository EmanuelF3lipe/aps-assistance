import { useState, useEffect } from 'react'
import { api } from '../services/api'
import { FiPlus, FiCheck, FiClock, FiAlertTriangle, FiInfo, FiTrash2, FiSearch, FiCalendar, FiUser, FiChevronDown, FiChevronUp } from 'react-icons/fi'

const CATEGORIES = [
  { value: 'ocorrencia', label: 'Ocorrencia', color: '#f59e0b', icon: FiAlertTriangle },
  { value: 'pendencia', label: 'Pendencia', color: '#ef4444', icon: FiClock },
  { value: 'informacao', label: 'Informacao', color: '#3b82f6', icon: FiInfo },
  { value: 'retornofora', label: 'Retorno Fora', color: '#8b5cf6', icon: FiClock },
  { value: 'entrega', label: 'Entrega', color: '#10b981', icon: FiCheck },
]

const PRIORITIES = [
  { value: 'baixa', label: 'Baixa', color: '#6b7280' },
  { value: 'normal', label: 'Normal', color: '#3b82f6' },
  { value: 'urgente', label: 'Urgente', color: '#ef4444' },
]

const SHIFTS = ['Manha', 'Tarde', 'Noite']

export default function DiarioPanel() {
  const [entries, setEntries] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterDate, setFilterDate] = useState('')
  const [expandedEntry, setExpandedEntry] = useState(null)
  const [form, setForm] = useState({ title: '', content: '', category: 'ocorrencia', priority: 'normal', author: '', shift: 'Manha' })

  const loadEntries = async () => {
    const filters = {}
    if (filterDate) filters.date = filterDate
    if (searchTerm) filters.search = searchTerm
    const data = await api.getDiary(filters)
    setEntries(data)
  }

  useEffect(() => { loadEntries() }, [filterDate, searchTerm])

  const handleSubmit = async () => {
    if (!form.title.trim() || !form.content.trim()) return
    await api.createDiaryEntry(form)
    setForm({ title: '', content: '', category: 'ocorrencia', priority: 'normal', author: '', shift: 'Manha' })
    setShowForm(false)
    await loadEntries()
  }

  const toggleResolved = async (entry) => {
    await api.updateDiaryEntry(entry.id, { resolved: !entry.resolved })
    await loadEntries()
  }

  const handleDelete = async (id) => {
    if (!confirm('Excluir esta entrada?')) return
    await api.deleteDiaryEntry(id)
    await loadEntries()
  }

  const getCat = (val) => CATEGORIES.find(c => c.value === val) || CATEGORIES[0]
  const getPri = (val) => PRIORITIES.find(p => p.value === val) || PRIORITIES[1]

  const today = new Date().toLocaleDateString('pt-BR')
  const todayCount = entries.filter(e => e.date === today).length

  return (
    <div className="dashboard" style={{ '--accent': '#4a7c59' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
          📓 Diario de Turno
        </h2>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
            Hoje: {todayCount} registro(s)
          </span>
          <button onClick={() => setShowForm(!showForm)}>
            <FiPlus size={14} /> Nova Entrada
          </button>
        </div>
      </div>

      {showForm && (
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid #2d5a3d',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '20px'
        }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#6db57e' }}>Nova Entrada</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <input
              type="text"
              placeholder="Titulo..."
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              style={{
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                padding: '10px 14px',
                borderRadius: '8px',
                fontSize: '14px',
                gridColumn: '1 / -1'
              }}
            />
            <select
              value={form.category}
              onChange={e => setForm({ ...form, category: e.target.value })}
              style={{
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                padding: '10px 14px',
                borderRadius: '8px',
                fontSize: '14px'
              }}
            >
              {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            <select
              value={form.shift}
              onChange={e => setForm({ ...form, shift: e.target.value })}
              style={{
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                padding: '10px 14px',
                borderRadius: '8px',
                fontSize: '14px'
              }}
            >
              {SHIFTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select
              value={form.priority}
              onChange={e => setForm({ ...form, priority: e.target.value })}
              style={{
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                padding: '10px 14px',
                borderRadius: '8px',
                fontSize: '14px'
              }}
            >
              {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
            <input
              type="text"
              placeholder="Seu nome..."
              value={form.author}
              onChange={e => setForm({ ...form, author: e.target.value })}
              style={{
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                padding: '10px 14px',
                borderRadius: '8px',
                fontSize: '14px'
              }}
            />
          </div>
          <textarea
            placeholder="Descreva a ocorrencia..."
            value={form.content}
            onChange={e => setForm({ ...form, content: e.target.value })}
            rows={4}
            style={{
              width: '100%',
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              padding: '10px 14px',
              borderRadius: '8px',
              fontSize: '14px',
              resize: 'vertical',
              marginBottom: '12px'
            }}
          />
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button className="secondary" onClick={() => setShowForm(false)}>Cancelar</button>
            <button className="success" onClick={handleSubmit}>Salvar</button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '200px', position: 'relative' }}>
          <FiSearch size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Buscar no diario..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 14px 10px 42px',
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              borderRadius: '8px',
              fontSize: '14px'
            }}
          />
        </div>
        <div style={{ position: 'relative' }}>
          <FiCalendar size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <input
            type="date"
            value={filterDate}
            onChange={e => setFilterDate(e.target.value)}
            style={{
              padding: '10px 14px 10px 42px',
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              borderRadius: '8px',
              fontSize: '14px'
            }}
          />
        </div>
        {(filterDate || searchTerm) && (
          <button className="secondary" onClick={() => { setFilterDate(''); setSearchTerm('') }}>
            Limpar
          </button>
        )}
      </div>

      {entries.length === 0 ? (
        <div className="empty-state" style={{ height: 'auto', padding: '48px' }}>
          <span style={{ fontSize: '48px', opacity: 0.3 }}>📓</span>
          <p>Nenhuma entrada no diario</p>
          <p style={{ fontSize: '12px', marginTop: '8px', color: 'var(--text-muted)' }}>
            Clique em "Nova Entrada" para registrar uma ocorrencia
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {entries.map(entry => {
            const cat = getCat(entry.category)
            const pri = getPri(entry.priority)
            const CatIcon = cat.icon
            const isExpanded = expandedEntry === entry.id
            return (
              <div
                key={entry.id}
                style={{
                  background: 'var(--bg-card)',
                  border: `1px solid ${entry.resolved ? 'var(--border-color)' : cat.color + '40'}`,
                  borderLeft: `4px solid ${cat.color}`,
                  borderRadius: '10px',
                  padding: '14px 16px',
                  opacity: entry.resolved ? 0.6 : 1
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                      <span style={{
                        background: cat.color + '20',
                        color: cat.color,
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '10px',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        <CatIcon size={10} /> {cat.label}
                      </span>
                      <span style={{
                        background: pri.color + '20',
                        color: pri.color,
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '10px',
                        fontWeight: 600,
                        textTransform: 'uppercase'
                      }}>
                        {pri.label}
                      </span>
                      {entry.shift && (
                        <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                          🕐 {entry.shift}
                        </span>
                      )}
                      {entry.resolved && (
                        <span style={{ color: 'var(--accent-green)', fontSize: '11px', fontWeight: 600 }}>
                          ✓ Resolvido
                        </span>
                      )}
                    </div>
                    <h4 style={{ margin: '0 0 4px 0', fontSize: '14px', color: 'var(--text-primary)', textDecoration: entry.resolved ? 'line-through' : 'none' }}>
                      {entry.title}
                    </h4>
                    {isExpanded && (
                      <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                        {entry.content}
                      </p>
                    )}
                    <div style={{ display: 'flex', gap: '12px', marginTop: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>
                      <span>📅 {entry.date}</span>
                      {entry.author && <span><FiUser size={10} /> {entry.author}</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                    <button
                      onClick={() => setExpandedEntry(isExpanded ? null : entry.id)}
                      style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-muted)', borderRadius: '6px', padding: '6px 8px', cursor: 'pointer' }}
                    >
                      {isExpanded ? <FiChevronUp size={14} /> : <FiChevronDown size={14} />}
                    </button>
                    <button
                      onClick={() => toggleResolved(entry)}
                      style={{
                        background: entry.resolved ? 'var(--accent-green)' : 'var(--bg-tertiary)',
                        border: `1px solid ${entry.resolved ? 'var(--accent-green)' : 'var(--border-color)'}`,
                        color: entry.resolved ? '#fff' : 'var(--text-muted)',
                        borderRadius: '6px',
                        padding: '6px 8px',
                        cursor: 'pointer'
                      }}
                    >
                      <FiCheck size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(entry.id)}
                      style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--accent-red)', borderRadius: '6px', padding: '6px 8px', cursor: 'pointer' }}
                    >
                      <FiTrash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
