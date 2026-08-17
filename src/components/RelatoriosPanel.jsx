/*
 * RelatoriosPanel — Painel "Relatorios do Sistema".
 * Lista relatorios organizados por categoria (vendas, financeiro, estoque, etc.),
 * com busca por titulo/conteudo, criacao, edicao, exclusao e copia para a area
 * de transferencia. As categorias e os itens podem ser expandidos/colapsados.
 */
import { useState, useEffect } from 'react'
import { api } from '../services/api'
import { FiFileText, FiSearch, FiPlus, FiEdit3, FiTrash2, FiX, FiCheck, FiChevronDown, FiChevronRight } from 'react-icons/fi'

// Cor de destaque de cada categoria de relatorio
const COLORS = {
  vendas: 'var(--accent-blue)',
  financeiro: 'var(--accent-green)',
  estoque: 'var(--accent-yellow)',
  compras: 'var(--accent-violet)',
  gerenciais: 'var(--accent-cyan)',
  clientes: '#f472b6',
  geral: 'var(--text-muted)'
}

// Rotulo exibido para cada categoria
const CATEGORY_LABELS = {
  vendas: 'Vendas',
  financeiro: 'Financeiro',
  estoque: 'Estoque',
  compras: 'Compras',
  gerenciais: 'Gerenciais',
  clientes: 'Clientes',
  geral: 'Geral'
}

export default function RelatoriosPanel() {
  // Estados do painel: lista de relatorios, busca, categorias/itens expandidos,
  // formulario de edicao (id + dados) e formulario de novo relatorio
  const [reports, setReports] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedCats, setExpandedCats] = useState(Object.keys(COLORS))
  const [expandedItem, setExpandedItem] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({ title: '', category: 'geral', content: '' })
  const [showNewForm, setShowNewForm] = useState(false)
  const [newForm, setNewForm] = useState({ title: '', category: 'geral', content: '' })

  // Carrega os relatorios uma unica vez ao montar o painel
  useEffect(() => {
    loadReports()
  }, [])

  // Busca a lista de relatorios na API
  const loadReports = async () => {
    const data = await api.getReports()
    setReports(data)
  }

  // Expande/colapsa uma categoria na listagem
  const toggleCategoria = (cat) => {
    setExpandedCats(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    )
  }

  // Expande/colapsa um relatorio (apenas um aberto por vez)
  const toggleItem = (id) => {
    setExpandedItem(prev => prev === id ? null : id)
  }

  // Preenche o formulario com os dados do relatorio e entra em modo edicao
  const startEdit = (report) => {
    setEditingId(report.id)
    setEditForm({ title: report.title, category: report.category, content: report.content })
  }

  // Sai do modo edicao e limpa o formulario
  const cancelEdit = () => {
    setEditingId(null)
    setEditForm({ title: '', category: 'geral', content: '' })
  }

  // Salva as alteracoes do relatorio em edicao e recarrega a lista
  const saveEdit = async () => {
    if (!editForm.title.trim()) return
    await api.updateReport(editingId, editForm.title, editForm.category, editForm.content)
    cancelEdit()
    await loadReports()
  }

  // Cria um novo relatorio na API, fecha o formulario e recarrega a lista
  const handleCreate = async () => {
    if (!newForm.title.trim()) return
    await api.createReport(newForm.title, newForm.category, newForm.content)
    setShowNewForm(false)
    setNewForm({ title: '', category: 'geral', content: '' })
    await loadReports()
  }

  // Exclui um relatorio (com confirmacao)
  const handleDelete = async (id) => {
    if (!confirm('Excluir este relatorio?')) return
    await api.deleteReport(id)
    await loadReports()
  }

  // Monta o texto do relatorio (titulo + categoria + conteudo) e copia para a area de transferencia
  const copiarRelatorio = (rel) => {
    let texto = `${rel.title}\nCategoria: ${CATEGORY_LABELS[rel.category] || rel.category}\n\n${rel.content}`
    navigator.clipboard.writeText(texto)
  }

  // Agrupa os relatorios por categoria e aplica o filtro de busca (titulo ou conteudo)
  const grouped = {}
  reports.forEach(r => {
    const cat = r.category || 'geral'
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(r)
  })

  const filteredGrouped = Object.entries(grouped).map(([cat, items]) => ({
    category: cat,
    color: COLORS[cat] || COLORS.geral,
    label: CATEGORY_LABELS[cat] || cat,
    items: items.filter(item =>
      item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.content.toLowerCase().includes(searchTerm.toLowerCase())
    )
  })).filter(cat => cat.items.length > 0)

  // Total de relatorios visiveis apos o filtro (exibido no cabecalho)
  const totalRelatorios = filteredGrouped.reduce((acc, cat) => acc + cat.items.length, 0)

  return (
    <div className="dashboard">
      {/* Cabecalho: titulo + total de relatorios + botao Novo Relatorio */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
          <FiFileText size={24} /> Relatorios do Sistema
        </h2>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
            {totalRelatorios} relatorios
          </span>
          <button className="success" onClick={() => setShowNewForm(true)}>
            <FiPlus size={14} /> Novo Relatorio
          </button>
        </div>
      </div>

      {/* Formulario de novo relatorio: titulo, categoria e conteudo */}
      {showNewForm && (
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--accent-blue)',
          borderRadius: '16px',
          padding: '20px',
          marginBottom: '20px'
        }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '14px', color: 'var(--text-primary)' }}>Novo Relatorio</h3>
          <input
            type="text"
            placeholder="Titulo do relatorio"
            value={newForm.title}
            onChange={(e) => setNewForm({ ...newForm, title: e.target.value })}
            style={{
              width: '100%',
              padding: '10px 14px',
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              borderRadius: '8px',
              fontSize: '13px',
              marginBottom: '10px'
            }}
          />
          <select
            value={newForm.category}
            onChange={(e) => setNewForm({ ...newForm, category: e.target.value })}
            style={{
              width: '100%',
              padding: '10px 14px',
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              borderRadius: '8px',
              fontSize: '13px',
              marginBottom: '10px'
            }}
          >
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <textarea
            placeholder="Descricao / Conteudo do relatorio"
            value={newForm.content}
            onChange={(e) => setNewForm({ ...newForm, content: e.target.value })}
            rows={4}
            style={{
              width: '100%',
              padding: '10px 14px',
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              borderRadius: '8px',
              fontSize: '13px',
              marginBottom: '12px',
              resize: 'vertical',
              fontFamily: 'inherit'
            }}
          />
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="success" onClick={handleCreate}>
              <FiCheck size={14} /> Salvar
            </button>
            <button className="secondary" onClick={() => { setShowNewForm(false); setNewForm({ title: '', category: 'geral', content: '' }) }}>
              <FiX size={14} /> Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Barra de busca por titulo ou conteudo */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <FiSearch size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Buscar relatorio por titulo ou conteudo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '12px 16px 12px 42px',
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              borderRadius: '10px',
              fontSize: '14px'
            }}
          />
        </div>
      </div>

      {/* Listagem por categoria: cabecalho com toggle de expansao + contagem de itens */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Bloco de uma categoria: cabecalho clicavel + lista de relatorios */}
              {filteredGrouped.map((cat) => (
        <div
            key={cat.category}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: '16px',
              overflow: 'hidden'
            }}
          >
            {/* Cabecalho da categoria: expande/colapsa ao clicar, com cor e contagem */}
            <div
              onClick={() => toggleCategoria(cat.category)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '16px 20px',
                cursor: 'pointer',
                borderBottom: expandedCats.includes(cat.category) ? '1px solid var(--border-color)' : 'none',
                transition: 'background 0.15s'
              }}
            >
              <span style={{ color: cat.color, width: '20px', height: '20px' }}>
                <FiFileText size={20} />
              </span>
              <span style={{ flex: 1, fontWeight: '600', fontSize: '15px', color: 'var(--text-primary)' }}>
                {cat.label}
              </span>
              <span style={{
                background: 'var(--bg-tertiary)',
                padding: '4px 10px',
                borderRadius: '12px',
                fontSize: '12px',
                color: 'var(--text-muted)'
              }}>
                {cat.items.length}
              </span>
              {expandedCats.includes(cat.category) ?
                <FiChevronDown size={18} style={{ color: 'var(--text-muted)' }} /> :
                <FiChevronRight size={18} style={{ color: 'var(--text-muted)' }} />
              }
            </div>

            {/* Itens da categoria (visiveis quando expandida): linha clicavel com editar/copiar/excluir */}
            {expandedCats.includes(cat.category) && (
              <div style={{ padding: '8px' }}>
                {cat.items.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      borderRadius: '10px',
                      marginBottom: '4px',
                      overflow: 'hidden',
                      border: expandedItem === item.id ? `1px solid ${cat.color}` : '1px solid transparent',
                      transition: 'all 0.15s'
                    }}
                  >
                    <div
                      onClick={() => toggleItem(item.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '12px 16px',
                        cursor: 'pointer',
                        background: expandedItem === item.id ? 'var(--bg-tertiary)' : 'transparent',
                        borderRadius: '10px',
                        transition: 'background 0.15s'
                      }}
                    >
                      <span style={{
                        background: cat.color,
                        color: '#fff',
                        padding: '3px 10px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: '700'
                      }}>
                        {cat.label.slice(0, 3).toUpperCase()}
                      </span>
                      <span style={{
                        flex: 1,
                        fontSize: '13px',
                        color: 'var(--text-primary)',
                        fontWeight: '500'
                      }}>
                        {editingId === item.id ? (
                          <input
                            value={editForm.title}
                            onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              background: 'var(--bg-primary)',
                              border: '1px solid var(--accent-blue)',
                              color: 'var(--text-primary)',
                              padding: '4px 8px',
                              borderRadius: '6px',
                              fontSize: '13px',
                              width: '100%'
                            }}
                          />
                        ) : (
                          item.title
                        )}
                      </span>
                      {/* Acoes do relatorio: copiar, editar/salvar/cancelar e excluir */}
                      <div style={{ display: 'flex', gap: '4px' }} onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => copiarRelatorio(item)}
                          className="secondary"
                          style={{ padding: '6px 10px', fontSize: '11px' }}
                          title="Copiar"
                        >
                          Copiar
                        </button>
                        {editingId === item.id ? (
                          <>
                            <button onClick={saveEdit} className="success" style={{ padding: '6px 10px', fontSize: '11px' }}>
                              <FiCheck size={12} />
                            </button>
                            <button onClick={cancelEdit} className="secondary" style={{ padding: '6px 10px', fontSize: '11px' }}>
                              <FiX size={12} />
                            </button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => startEdit(item)} className="secondary" style={{ padding: '6px 10px', fontSize: '11px' }}>
                              <FiEdit3 size={12} />
                            </button>
                            <button onClick={() => handleDelete(item.id)} className="danger" style={{ padding: '6px 10px', fontSize: '11px' }}>
                              <FiTrash2 size={12} />
                            </button>
                          </>
                        )}
                      </div>
                      {expandedItem === item.id ?
                        <FiChevronDown size={16} style={{ color: 'var(--text-muted)' }} /> :
                        <FiChevronRight size={16} style={{ color: 'var(--text-muted)' }} />
                      }
                    </div>

                    {/* Conteudo do relatorio expandido (ou formulario de edicao de categoria/conteudo) */}
                    {expandedItem === item.id && (
                      <div style={{
                        padding: '12px 16px 16px 72px',
                        fontSize: '13px',
                        color: 'var(--text-secondary)',
                        lineHeight: '1.7',
                        background: 'var(--bg-tertiary)'
                      }}>
                        {editingId === item.id ? (
                          <>
                            <select
                              value={editForm.category}
                              onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                              style={{
                                width: '100%',
                                padding: '8px 12px',
                                background: 'var(--bg-primary)',
                                border: '1px solid var(--border-color)',
                                color: 'var(--text-primary)',
                                borderRadius: '8px',
                                fontSize: '12px',
                                marginBottom: '8px'
                              }}
                            >
                              {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                                <option key={key} value={key}>{label}</option>
                              ))}
                            </select>
                            <textarea
                              value={editForm.content}
                              onChange={(e) => setEditForm({ ...editForm, content: e.target.value })}
                              rows={4}
                              style={{
                                width: '100%',
                                padding: '8px 12px',
                                background: 'var(--bg-primary)',
                                border: '1px solid var(--border-color)',
                                color: 'var(--text-primary)',
                                borderRadius: '8px',
                                fontSize: '12px',
                                resize: 'vertical',
                                fontFamily: 'inherit'
                              }}
                            />
                          </>
                        ) : (
                          item.content
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
