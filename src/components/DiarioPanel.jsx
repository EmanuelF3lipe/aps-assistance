/*
 * DiarioPanel — Painel "Diario de Turno".
 * Permite registrar ocorrencias, pendencias e informacoes do turno de trabalho,
 * com categorias, prioridades, turno, autor, busca por texto e filtro por data,
 * alem de marcar entradas como concluidas/resolvidas.
 *
 * Possui duas visoes alternaveis:
 *  - "Lista": visualizacao sequencial de todas as ocorrencias (com busca e filtro de data)
 *  - "Calendario": grade mensal onde cada dia mostra pontinhos coloridos (cores das
 *    categorias) e o total de ocorrencias; clicar em um dia filtra a lista abaixo
 */
import { useState, useEffect } from 'react'
import { FiPlus, FiCheck, FiClock, FiAlertTriangle, FiInfo, FiTrash2, FiSearch, FiCalendar, FiUser, FiChevronDown, FiChevronUp, FiChevronLeft, FiChevronRight, FiX, FiBook } from 'react-icons/fi'
import { api } from '../services/api'

// Categorias de ocorrencia disponiveis no diario (cada uma tem cor e icone proprio)
const CATEGORIES = [
  { value: 'ocorrencia', label: 'Ocorrencia', color: '#f59e0b', icon: FiAlertTriangle },
  { value: 'pendencia', label: 'Pendencia', color: '#ef4444', icon: FiClock },
  { value: 'informacao', label: 'Informacao', color: '#3b82f6', icon: FiInfo },
  { value: 'retornofora', label: 'Retorno Fora', color: '#8b5cf6', icon: FiClock },
  { value: 'entrega', label: 'Entrega', color: '#2563eb', icon: FiCheck },
]

// Prioridades possiveis para uma entrada (baixa, normal ou urgente)
const PRIORITIES = [
  { value: 'baixa', label: 'Baixa', color: '#6b7280' },
  { value: 'normal', label: 'Normal', color: '#3b82f6' },
  { value: 'urgente', label: 'Urgente', color: '#ef4444' },
]

// Turnos de trabalho disponiveis no cadastro da entrada
const SHIFTS = ['Manha', 'Tarde', 'Noite']

// Cores do tema: azul vibrante + branco (cores da empresa)
const COLOR_ACCENT = '#2563eb'
const COLOR_ACCENT_LIGHT = '#93c5fd'
const COLOR_ACCENT_BG = 'rgba(37, 99, 235, 0.25)'
const COLOR_ACCENT_BORDER = 'rgba(37, 99, 235, 0.40)'

export default function DiarioPanel() {
  // Estados do painel: lista de entradas, formulario (aberto/fechado), busca,
  // filtro de data, entrada expandida e dados do formulario
  const [entries, setEntries] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterDate, setFilterDate] = useState('')
  const [expandedEntry, setExpandedEntry] = useState(null)
  const [form, setForm] = useState({ title: '', content: '', category: 'ocorrencia', priority: 'normal', author: '', shift: 'Manha' })

  // Estados da visao de calendario: modo ativo (lista x calendario), mes exibido
  // (primeiro dia do mes) e dia selecionado (chave no formato dd/mm/aaaa)
  const [viewMode, setViewMode] = useState('lista')
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const [selectedDate, setSelectedDate] = useState('')

  // Busca as entradas do diario na API (todas, sem filtro — o filtro passa a ser local,
  // para o calendario precisar dos dados completos na grade mensal)
  const loadEntries = async () => {
    const data = await api.getDiary({})
    setEntries(data)
  }

  // Recarrega a lista sempre que o modo de visao muda ou algo novo e salvo
  useEffect(() => { loadEntries() }, [viewMode])

  // Salva uma nova entrada no diario (valida titulo/conteudo, limpa o form e recarrega)
  const handleSubmit = async () => {
    if (!form.title.trim() || !form.content.trim()) return
    await api.createDiaryEntry(form)
    setForm({ title: '', content: '', category: 'ocorrencia', priority: 'normal', author: '', shift: 'Manha' })
    setShowForm(false)
    await loadEntries()
  }

  // Marca/desmarca uma entrada como resolvida (pede confirmacao ao concluir)
  const toggleResolved = async (entry) => {
    if (!entry.resolved) {
      if (!confirm('Confirmar conclusao desta tarefa?')) return
    }
    await api.updateDiaryEntry(entry.id, { resolved: !entry.resolved })
    await loadEntries()
  }

  // Exclui uma entrada do diario (com confirmacao)
  const handleDelete = async (id) => {
    if (!confirm('Excluir esta entrada?')) return
    await api.deleteDiaryEntry(id)
    await loadEntries()
  }

  // Helpers para resolver categoria e prioridade da entrada (com fallback padrao)
  const getCat = (val) => CATEGORIES.find(c => c.value === val) || CATEGORIES[0]
  const getPri = (val) => PRIORITIES.find(p => p.value === val) || PRIORITIES[1]

  // Entradas visiveis na lista: aplica filtro de texto sempre; filtro de data
  // usa o dia selecionado no calendario (quando em modo calendario) ou o input de data
  const entriesToShow = entries.filter(e => {
    const q = searchTerm.toLowerCase()
    const matchText = !searchTerm ||
      e.title.toLowerCase().includes(q) ||
      (e.content || '').toLowerCase().includes(q) ||
      (e.author || '').toLowerCase().includes(q)
    const targetDate = viewMode === 'calendario' ? selectedDate : filterDate
    const matchDate = !targetDate || e.date === targetDate
    return matchText && matchDate
  })

  // Helpers do calendario: chave dia dd/mm/aaaa, primeiro dia util do mes (segunda-feira
  // por padrao no Brasil), total de dias do mes e grade de celulas (null = espaco vazio)
  const pad2 = (n) => String(n).padStart(2, '0')
  const dateKey = (y, m, d) => `${pad2(d)}/${pad2(m + 1)}/${y}`
  const calYear = calendarMonth.getFullYear()
  const calMonth = calendarMonth.getMonth()
  const firstWeekday = (new Date(calYear, calMonth, 1).getDay() + 6) % 7
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate()
  const todayKey = new Date().toLocaleDateString('pt-BR')
  const calendarCells = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(calYear, calMonth, i + 1))
  ]

  // Resumo por dia usado na grade: total de ocorrencias + cores das categorias presentes
  const countsByDate = {}
  const colorsByDate = {}
  entries.forEach(e => {
    countsByDate[e.date] = (countsByDate[e.date] || 0) + 1
    const colorSet = colorsByDate[e.date] || (colorsByDate[e.date] = new Set())
    colorSet.add(getCat(e.category).color)
  })

  // Alterna a visao lista/calendario, limpando o dia selecionado ao voltar para a lista
  const switchView = (mode) => {
    setViewMode(mode)
    if (mode === 'lista') setSelectedDate('')
  }

  // Contagem de registros de hoje exibida no cabecalho
  const today = new Date().toLocaleDateString('pt-BR')
  const todayCount = entries.filter(e => e.date === today).length

  // Pula o calendario para o mes corrente e seleciona o dia de hoje (se estiver no mes)
  const goToToday = () => {
    const now = new Date()
    setCalendarMonth(new Date(now.getFullYear(), now.getMonth(), 1))
    if (firstWeekday >= 0 && todayKey.startsWith(pad2(now.getDate()) + '/')) {
      setSelectedDate(todayKey)
    }
  }

  return (
    <div className="dashboard" style={{ '--accent': COLOR_ACCENT }}>
      {/* Cabecalho do painel: titulo + contagem de registros de hoje + botao Nova Entrada */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <FiBook size={24} /> Diario de Turno
        </h2>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
            Hoje: {todayCount} registro(s)
          </span>
          {/* Seletor de visao: Lista ou Calendario */}
          <div style={{ display: 'flex', background: 'var(--bg-tertiary)', borderRadius: '8px', padding: '3px', gap: '2px' }}>
            <button
              onClick={() => switchView('lista')}
              style={{
                border: 'none', background: 'transparent', cursor: 'pointer', padding: '6px 12px', borderRadius: '6px',
                fontSize: '13px', color: 'var(--text-muted)', fontWeight: 500,
                ...(viewMode === 'lista' ? { background: COLOR_ACCENT, color: '#fff' } : {})
              }}
            >
              Lista
            </button>
            <button
              onClick={() => switchView('calendario')}
              style={{
                border: 'none', background: 'transparent', cursor: 'pointer', padding: '6px 12px', borderRadius: '6px',
                fontSize: '13px', color: 'var(--text-muted)', fontWeight: 500,
                ...(viewMode === 'calendario' ? { background: COLOR_ACCENT, color: '#fff' } : {})
              }}
            >
              <FiCalendar size={13} style={{ verticalAlign: '-2px', marginRight: '4px' }} />Calendario
            </button>
          </div>
          <button onClick={() => setShowForm(!showForm)}>
            <FiPlus size={14} /> Nova Entrada
          </button>
        </div>
      </div>

            {/* Formulario "Nova Entrada": titulo, categoria, turno, prioridade, autor e descricao */}
      {showForm && (
        <div style={{
          background: 'var(--bg-card)',
          border: `1px solid ${COLOR_ACCENT}`,
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '20px'
        }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '14px', color: COLOR_ACCENT_LIGHT }}>Nova Entrada</h3>
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

            {/* Barra de filtros: busca por texto + filtro por data + botao Limpar */}
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
          <button className="secondary" onClick={() => { setFilterDate(''); setSearchTerm(''); setSelectedDate('') }}>
            Limpar
          </button>
        )}
      </div>

      {/* Calendario mensal: grade de dias do mes, cada um com total e cores das
          categorias das ocorrencias daquele dia; clique seleciona o dia */}
      {viewMode === 'calendario' && (
        <div style={{
          background: 'var(--bg-card)',
          border: `1px solid ${COLOR_ACCENT}`,
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '20px'
        }}>
          {/* Navegacao do mes: setas, nome do mes/ano e botao Ir para hoje */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', gap: '8px' }}>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <button
                onClick={() => setCalendarMonth(new Date(calYear, calMonth - 1, 1))}
                style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-muted)', borderRadius: '6px', padding: '5px 9px', cursor: 'pointer' }}
              >
                <FiChevronLeft size={15} />
              </button>
              <h3 style={{ margin: 0, fontSize: '15px', color: 'var(--text-primary)', textTransform: 'capitalize', minWidth: '130px', textAlign: 'center' }}>
                {calendarMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
              </h3>
              <button
                onClick={() => setCalendarMonth(new Date(calYear, calMonth + 1, 1))}
                style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-muted)', borderRadius: '6px', padding: '5px 9px', cursor: 'pointer' }}
              >
                <FiChevronRight size={15} />
              </button>
            </div>
            <button className="secondary" onClick={goToToday} style={{ fontSize: '12px' }}>
              Hoje
            </button>
          </div>

          {/* Grade do calendario: cabecalho com os dias da semana + celulas do mes */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '5px' }}>
            {['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB', 'DOM'].map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', padding: '4px 0', letterSpacing: '1px' }}>{d}</div>
            ))}
            {calendarCells.map((day, i) => {
              if (!day) return <div key={`empty-${i}`} />
              const key = dateKey(day.getFullYear(), day.getMonth(), day.getDate())
              const count = countsByDate[key] || 0
              const colors = [...(colorsByDate[key] || [])]
              const isSelected = viewMode === 'calendario' && selectedDate === key
              const isToday = key === todayKey
              return (
                <div
                  key={key}
                  onClick={() => setSelectedDate(isSelected ? '' : key)}
                  style={{
                    minHeight: '44px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '3px',
                    padding: '4px',
                    background: isSelected ? 'rgba(74,124,89,0.25)' : (count ? 'rgba(74,124,89,0.08)' : 'var(--bg-tertiary)'),
                    border: `1px solid ${isSelected ? '#3b82f6' : (count ? COLOR_ACCENT : 'var(--border-color)')}`,
                    transition: 'all 0.15s'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#3b82f6' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = isSelected ? '#3b82f6' : (count ? COLOR_ACCENT : 'var(--border-color)') }}
                >
                  <span style={{
                    fontSize: '13px',
                    color: 'var(--text-primary)',
                    fontWeight: isSelected ? 700 : 400,
                    textDecoration: isToday ? 'underline' : 'none',
                    textUnderlineOffset: '2px'
                  }}>
                    {day.getDate()}
                  </span>
                  {count > 0 && (
                    <span style={{ fontSize: '9px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                      {colors.map(c => <span key={c} style={{ width: '6px', height: '6px', borderRadius: '50%', background: c, display: 'inline-block' }} />)}
                      {count}
                    </span>
                  )}
                </div>
              )
            })}
          </div>

          {/* Indicador do dia selecionado: mostra o dia escolhido e permite limpar */}
          {selectedDate && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 600 }}>
                Ocorrencias de <span style={{ color: COLOR_ACCENT_LIGHT }}>{selectedDate}</span>
              </span>
              <button className="secondary" onClick={() => setSelectedDate('')} style={{ fontSize: '12px' }}>
                <FiX size={12} style={{ verticalAlign: '-1px', marginRight: '3px' }} />Limpar dia
              </button>
            </div>
          )}
        </div>
      )}

            {/* Estado vazio: nenhuma entrada cadastrada */}
      {entriesToShow.length === 0 ? (
        <div className="empty-state" style={{ height: 'auto', padding: '48px' }}>
          <span style={{ fontSize: '48px', opacity: 0.3 }}><FiBook size={48} /></span>
          <p>Nenhuma entrada no diario</p>
          <p style={{ fontSize: '12px', marginTop: '8px', color: 'var(--text-muted)' }}>
            Clique em "Nova Entrada" para registrar uma ocorrencia
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {entriesToShow.map(entry => {
            const cat = getCat(entry.category)
            const pri = getPri(entry.priority)
            const CatIcon = cat.icon
            const isExpanded = expandedEntry === entry.id
            // Cartao de cada entrada: destaca se resolvida (verde) ou pela cor da categoria
            return (
              <div
                key={entry.id}
                style={{
                  background: entry.resolved ? 'rgba(59, 130, 246, 0.07)' : 'var(--bg-card)',
                  border: `1px solid ${entry.resolved ? '#3b82f660' : cat.color + '40'}`,
                  borderLeft: `4px solid ${entry.resolved ? '#3b82f6' : cat.color}`,
                  borderRadius: '10px',
                  padding: '14px 16px',
                  opacity: entry.resolved ? 0.85 : 1
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                  {/* Conteudo da entrada: titulo, descricao expandida e metadados (data/autor/conclusao) */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Badges da entrada: categoria, prioridade, turno e selo "Concluido" */}
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
                          <FiClock size={12} /> {entry.shift}
                        </span>
                      )}
                      {entry.resolved && (
                        <span style={{
                          background: 'rgba(59, 130, 246, 0.12)',
                          color: COLOR_ACCENT_LIGHT,
                          padding: '2px 10px',
                          borderRadius: '4px',
                          fontSize: '10px',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          border: '1px solid rgba(59, 130, 246, 0.4)'
                        }}>
                          <FiCheck size={10} /> Concluido
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
                    <div style={{ display: 'flex', gap: '12px', marginTop: '6px', fontSize: '11px', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                      <span><FiCalendar size={12} /> {entry.date}</span>
                      {entry.author && <span><FiUser size={10} /> {entry.author}</span>}
                      {entry.resolved && entry.resolvedAt && (
                        <span style={{ color: COLOR_ACCENT_LIGHT }}><FiCheck size={10} /> Concluido em {new Date(entry.resolvedAt).toLocaleDateString('pt-BR')}</span>
                      )}
                    </div>
                  </div>
                  {/* Botoes de acao: expandir/ocultar, marcar como concluido (ou reabrir) e excluir */}
                  <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                    <button
                      onClick={() => setExpandedEntry(isExpanded ? null : entry.id)}
                      style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-muted)', borderRadius: '6px', padding: '6px 8px', cursor: 'pointer' }}
                    >
                      {isExpanded ? <FiChevronUp size={14} /> : <FiChevronDown size={14} />}
                    </button>
                    <button
                      onClick={() => toggleResolved(entry)}
                      title={entry.resolved ? 'Reabrir tarefa' : 'Marcar como concluida'}
                      style={{
                        background: entry.resolved ? 'linear-gradient(135deg, #3b82f6, #2563eb)' : 'var(--bg-tertiary)',
                        border: `1px solid ${entry.resolved ? '#3b82f6' : 'var(--border-color)'}`,
                        color: entry.resolved ? '#fff' : 'var(--accent-blue)',
                        borderRadius: '6px',
                        padding: '6px 12px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        fontSize: '12px',
                        fontWeight: entry.resolved ? 600 : 500
                      }}
                    >
                      <FiCheck size={14} /> {entry.resolved ? 'Reabrir' : 'Concluir'}
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
