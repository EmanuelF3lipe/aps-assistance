/*
 * TagsPanel — Painel "Gerenciar Tags".
 * Lista as tags catalogadas e os arquivos associados a cada uma. Permite renomear
 * uma tag (atualizando a referencia em todos os arquivos), excluir uma tag (removendo
 * a linha dos arquivos), buscar por nome e abrir arquivos direto da lista.
 * A criacao de tags em si e feita dentro do editor de erros (botao "+ Tag").
 */
import { useState, useEffect } from 'react'
import { api } from '../services/api'
import { FiTag, FiPlus, FiEdit2, FiTrash2, FiX, FiCheck, FiSearch, FiFile } from 'react-icons/fi'

export default function TagsPanel({ onSelectFile }) {
  // Estados do painel: mapa de tags -> arquivos, carga, criacao/edicao de tag,
  // busca e confirmacao de exclusao
  const [tags, setTags] = useState({})
  const [loading, setLoading] = useState(true)
  const [newTagName, setNewTagName] = useState('')
  const [showNewTagInput, setShowNewTagInput] = useState(false)
  const [editingTag, setEditingTag] = useState(null)
  const [editTagName, setEditTagName] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [showConfirmDelete, setShowConfirmDelete] = useState(null)

  // Carrega o mapa de tags (nome -> lista de arquivos) da API
  const loadTags = async () => {
    try {
      setLoading(true)
      const data = await api.getTags()
      setTags(data || {})
    } catch (err) {
      console.error('Erro ao carregar tags:', err)
      setTags({})
    } finally {
      setLoading(false)
    }
  }

  // Carrega as tags ao montar o painel
  useEffect(() => {
    loadTags()
  }, [])

  // Criacao de tag redireciona para o editor de erros (tags so sao criadas la)
  const handleCreateTag = async () => {
    if (!newTagName.trim()) return
    alert('Para criar uma nova tag, abra um erro e clique em "+ Tag" para adicioná-la.')
    setNewTagName('')
    setShowNewTagInput(false)
  }

  // Renomeia uma tag: percorre todos os arquivos associados e troca a linha "- <tag>"
  // em cada conteudo, depois recarrega as tags
  const handleRenameTag = async (oldName) => {
    if (!editTagName.trim() || editTagName === oldName) {
      setEditingTag(null)
      return
    }

    const filesToUpdate = tags[oldName] || []
    
    for (const file of filesToUpdate) {
      const fileData = await api.getFile(file.folder, file.filename)
      const content = fileData.content
      
      const newContent = content.replace(
        new RegExp(`^- ${oldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'gm'),
        `- ${editTagName}`
      )
      
      await api.updateFile(file.folder, file.filename, newContent)
    }

    setEditingTag(null)
    await loadTags()
  }

  // Exclui uma tag: remove a linha "- <tag>" de todos os arquivos associados
  // e limpa as linhas em branco duplicadas
  const handleDeleteTag = async (tagName) => {
    const filesToUpdate = tags[tagName] || []
    
    for (const file of filesToUpdate) {
      const fileData = await api.getFile(file.folder, file.filename)
      const content = fileData.content
      
      const newContent = content.replace(
        new RegExp(`^- ${tagName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'gm'),
        ''
      ).replace(/\n{3,}/g, '\n\n')
      
      await api.updateFile(file.folder, file.filename, newContent)
    }

    setShowConfirmDelete(null)
    await loadTags()
  }

  // Abre um arquivo no visualizador principal atraves do callback recebido como prop
  const handleFileClick = (folder, filename) => {
    onSelectFile({ folder, filename })
  }

  // Filtra as tags pelo termo de busca e ordena alfabeticamente
  const filteredTags = Object.keys(tags).filter(tag =>
    tag.toLowerCase().includes(searchTerm.toLowerCase())
  ).sort()

  // Total de arquivos catalogados em todas as tags
  const totalFiles = Object.values(tags).reduce((acc, files) => acc + files.length, 0)

  return (
    <div className="dashboard">
      {/* Cabecalho: titulo + contagem de tags/arquivos + botao Nova Tag */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
          <FiTag size={24} /> Gerenciar Tags
        </h2>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
            {filteredTags.length} tags · {totalFiles} arquivos
          </span>
          <button onClick={() => setShowNewTagInput(!showNewTagInput)}>
            <FiPlus size={14} /> Nova Tag
          </button>
        </div>
      </div>

      {/* Formulario de nova tag: informa que a criacao real ocorre no editor de erros */}
      {showNewTagInput && (
        <div style={{ 
          display: 'flex', 
          gap: '10px', 
          marginBottom: '20px',
          padding: '16px',
          background: 'var(--bg-card)',
          borderRadius: '12px',
          border: '1px solid var(--border-color)'
        }}>
          <FiTag size={16} style={{ color: 'var(--text-muted)', marginTop: '10px' }} />
          <input
            type="text"
            placeholder="Nome da nova tag..."
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && newTagName.trim()) {
                alert('Para adicionar esta tag, abra um erro e clique em "+ Tag".')
                setNewTagName('')
                setShowNewTagInput(false)
              }
            }}
            autoFocus
            style={{
              flex: 1,
              padding: '10px 14px',
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              borderRadius: '8px',
              fontSize: '14px'
            }}
          />
          <button onClick={() => {
            if (newTagName.trim()) {
              alert('Para adicionar esta tag, abra um erro e clique em "+ Tag".')
              setNewTagName('')
              setShowNewTagInput(false)
            }
          }}>
            <FiCheck size={14} /> Criar
          </button>
          <button className="secondary" onClick={() => { setShowNewTagInput(false); setNewTagName('') }}>
            <FiX size={14} />
          </button>
        </div>
      )}

      {/* Barra de busca de tags por nome */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <FiSearch size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Buscar tags..."
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

      {/* Estados de carga e vazio: carregando ou nenhuma tag encontrada */}
      {/* Com tags encontradas, exibe a grade de cards (um por tag) */}
      {loading ? (
        <div className="empty-state" style={{ height: 'auto', padding: '48px' }}>
          <FiTag size={48} style={{ opacity: 0.3, marginBottom: 16 }} />
          <p>Carregando tags...</p>
        </div>
      ) : filteredTags.length === 0 ? (
        <div className="empty-state" style={{ height: 'auto', padding: '48px' }}>
          <FiTag size={48} style={{ opacity: 0.3, marginBottom: 16 }} />
          <p>{searchTerm ? 'Nenhuma tag encontrada' : 'Nenhuma tag criada ainda'}</p>
          <p style={{ fontSize: '12px', marginTop: '8px', color: 'var(--text-muted)' }}>
            Clique em "Nova Tag" para criar ou abra um erro e clique em "+ Tag"
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
          {/* Card de uma tag: nome + contagem e botoes renomear/excluir (com confirmacao) */}
          {filteredTags.map((tag) => (
            <div
              key={tag}
              className="recent-item"
              style={{
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: '12px',
                padding: '18px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                {/* Formulario inline de renomeacao da tag */}
                {editingTag === tag ? (
                  <div style={{ display: 'flex', gap: '8px', flex: 1 }}>
                    <input
                      type="text"
                      value={editTagName}
                      onChange={(e) => setEditTagName(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleRenameTag(tag)}
                      autoFocus
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        background: 'var(--bg-tertiary)',
                        border: '1px solid var(--accent-blue)',
                        color: 'var(--text-primary)',
                        borderRadius: '8px',
                        fontSize: '14px'
                      }}
                    />
                    <button
                      className="success"
                      onClick={() => handleRenameTag(tag)}
                      style={{ padding: '8px 12px' }}
                    >
                      <FiCheck size={14} />
                    </button>
                    <button
                      className="secondary"
                      onClick={() => { setEditingTag(null); setEditTagName('') }}
                      style={{ padding: '8px 12px' }}
                    >
                      <FiX size={14} />
                    </button>
                  </div>
                ) : (
                  <>
                    <div>
                      <span style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)' }}>
                        {tag}
                      </span>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                        {tags[tag].length} arquivo{tags[tag].length > 1 ? 's' : ''}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        className="secondary"
                        onClick={() => { setEditingTag(tag); setEditTagName(tag) }}
                        style={{ padding: '6px 10px' }}
                      >
                        <FiEdit2 size={12} />
                      </button>
                      {showConfirmDelete === tag ? (
                        <>
                          <button
                            className="danger"
                            onClick={() => handleDeleteTag(tag)}
                            style={{ padding: '6px 10px' }}
                          >
                            <FiCheck size={12} /> Sim
                          </button>
                          <button
                            className="secondary"
                            onClick={() => setShowConfirmDelete(null)}
                            style={{ padding: '6px 10px' }}
                          >
                            <FiX size={12} />
                          </button>
                        </>
                      ) : (
                        <button
                          className="danger"
                          onClick={() => setShowConfirmDelete(tag)}
                          style={{ padding: '6px 10px' }}
                        >
                          <FiTrash2 size={12} />
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Lista de arquivos da tag (ate 5): clicaveis para abrir, com "mais" se houver mais */}
              {!editingTag && tags[tag].length > 0 && (
                <div style={{ 
                  display: 'flex', 
                  flexDirection: 'column',
                  gap: '6px', 
                  width: '100%',
                  borderTop: '1px solid var(--border-color)',
                  paddingTop: '12px',
                  marginTop: '4px'
                }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Arquivos com esta tag:
                  </span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {tags[tag].slice(0, 5).map((file, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleFileClick(file.folder, file.filename)}
                        style={{
                          background: 'var(--bg-tertiary)',
                          padding: '6px 12px',
                          borderRadius: '8px',
                          fontSize: '12px',
                          color: 'var(--accent-blue-light)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <FiFile size={12} />
                        {file.filename.replace('.md', '')}
                      </button>
                    ))}
                    {tags[tag].length > 5 && (
                      <span
                        style={{
                          padding: '6px 12px',
                          borderRadius: '8px',
                          fontSize: '12px',
                          color: 'var(--text-muted)'
                        }}
                      >
                        +{tags[tag].length - 5} mais
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
