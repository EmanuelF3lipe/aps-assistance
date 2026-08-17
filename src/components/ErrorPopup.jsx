/* ============================================================
   ErrorPopup.jsx — Popup de visualização/edição de um erro
   Exibe o conteúdo do erro em Markdown, permite editar o título
   e o conteúdo, gerenciar tags e anexos, mover, copiar ou
   excluir o registro do erro.
   ============================================================ */

// ===== Imports =====
import { useState, useEffect, useRef } from 'react'
import { api } from '../services/api'
import { FiX, FiEdit2, FiTag, FiPaperclip, FiTrash2, FiCopy, FiFolder, FiPlus, FiFile, FiFileText, FiFilm, FiMusic, FiPackage, FiBarChart2 } from 'react-icons/fi'

// ===== Componente ErrorPopup =====
// Recebe o arquivo (erro) selecionado e callbacks: onClose, onEdit, onMove e a lista de pastas
export default function ErrorPopup({ file, onClose, onEdit, onMove, folders }) {
  // ===== States do componente =====
  const [fadeOut, setFadeOut] = useState(false)          // Controla a animação de fechamento
  const [content, setContent] = useState('')             // Conteúdo Markdown do erro
  const [tags, setTags] = useState([])                   // Lista de tags do erro
  const [attachments, setAttachments] = useState([])     // Lista de anexos do erro
  const [isEditing, setIsEditing] = useState(false)      // Modo de edição ativo/inativo
  const [editContent, setEditContent] = useState('')     // Conteúdo em edição
  const [editTitle, setEditTitle] = useState('')         // Título em edição
  const [showTagInput, setShowTagInput] = useState(false) // Exibe o campo de nova tag
  const [newTag, setNewTag] = useState('')               // Texto da nova tag
  const [uploading, setUploading] = useState(false)      // Estado de upload de anexos
  const [showPreview, setShowPreview] = useState(null)   // URL da imagem em preview
  const [fileName, setFileName] = useState(file?.filename || (file?.name ? file.name + '.md' : ''))
  const fileInputRef = useRef(null)                      // Referência ao input de arquivo (oculto)

  // ===== Efeito: carrega os dados quando o arquivo muda =====
  useEffect(() => {
    if (file) {
      setFileName(file.filename || (file.name ? file.name + '.md' : ''))
      loadData()
    }
  }, [file])

  // ===== Função: carrega conteúdo, tags e anexos do arquivo =====
  const loadData = async (name) => {
    if (!file || !file.folder) return
    const filename = name || fileName || file.filename || (file.name ? file.name + '.md' : '')
    if (!filename) return
    const res = await api.getFile(file.folder, filename)
    const fileContent = res.content || ''
    setContent(fileContent)
    setEditContent(fileContent)
    setEditTitle(filename.replace('.md', ''))

    // Extrai as tags da seção "## Tags" do Markdown
    const tagMatch = fileContent.match(/## Tags\n([\s\S]*?)$/)
    if (tagMatch) {
      setTags(tagMatch[1].split('\n').filter(t => t.startsWith('-')).map(t => t.replace('- ', '').trim()))
    } else {
      setTags([])
    }

    // Carrega os anexos do arquivo
    try {
      const atts = await api.getAttachments(file.folder, filename)
      setAttachments(atts || [])
    } catch {
      setAttachments([])
    }
  }

  // ===== Handler: fecha o popup com animação =====
  const handleClose = () => {
    setFadeOut(true)
    setTimeout(() => onClose(), 300)
  }

  // ===== Função: converte Markdown simples em HTML para exibição =====
  const renderContent = (md) => {
    if (!md) return ''
    // Converte títulos, negrito, código e listas
    let html = md
      .replace(/^### (.*$)/gm, '<h3>$1</h3>')
      .replace(/^## (.*$)/gm, '<h2>$1</h2>')
      .replace(/^# (.*$)/gm, '<h1>$1</h1>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/^- (.*$)/gm, '• $1')
      .replace(/\n/g, '<br>')

    // Converte imagens anexadas em <img> clicável
    html = html.replace(
      /!\[(.*?)\]\((\/_images\/[^)]+)\)/g,
      '<img src="$2" alt="$1" class="content-image" onclick="window.open(\'$2\', \'_blank\')" />'
    )

    // Converte links de anexos em <a> clicável
    html = html.replace(
      /\[\s*(.*?)\s*\]\((\/_images\/[^)]+)\)/g,
      '<a href="$2" target="_blank" class="attachment-link">$1</a>'
    )

    return html
  }

  // ===== Handler: adiciona uma nova tag ao erro =====
  const handleAddTag = async () => {
    if (!newTag.trim()) return
    const updatedTags = [...tags, newTag.trim()]
    const filename = fileName || file.filename || (file.name ? file.name + '.md' : '')
    await api.updateTags(file.folder, filename, updatedTags)
    setTags(updatedTags)
    setNewTag('')
    setShowTagInput(false)
  }

  // ===== Handler: remove uma tag do erro =====
  const handleRemoveTag = async (tagToRemove) => {
    const updatedTags = tags.filter(t => t !== tagToRemove)
    const filename = fileName || file.filename || (file.name ? file.name + '.md' : '')
    await api.updateTags(file.folder, filename, updatedTags)
    setTags(updatedTags)
  }

  // ===== Handler: salva as alterações (renomeia se necessário e atualiza conteúdo) =====
  const handleSave = async () => {
    const filename = fileName || file.filename || (file.name ? file.name + '.md' : '')
    if (!filename) return
    const baseName = filename.replace(/\.md$/i, '')
    let finalFilename = filename
    // Renomeia o arquivo caso o título tenha sido alterado
    if (editTitle && editTitle !== baseName) {
      const cleanTitle = editTitle.trim()
      const newName = cleanTitle.endsWith('.md') ? cleanTitle : cleanTitle + '.md'
      await api.renameFile(file.folder, filename, newName)
      finalFilename = newName
    }
    // Atualiza o conteúdo do arquivo
    await api.updateFile(file.folder, finalFilename, editContent)
    setFileName(finalFilename)
    setContent(editContent)
    setIsEditing(false)
    loadData(finalFilename)
  }

  // ===== Handler: copia o conteúdo do erro para a área de transferência =====
  const handleCopy = () => {
    navigator.clipboard.writeText(content)
  }

  // ===== Handler: exclui definitivamente o erro (com confirmação) =====
  const handleDelete = async () => {
    if (!confirm('Excluir este erro?')) return
    const filename = fileName || file.filename || (file.name ? file.name + '.md' : '')
    await api.deleteFile(file.folder, filename)
    handleClose()
  }

  // ===== Handler: faz upload de anexos para o erro =====
  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files)
    if (files.length === 0) return
    setUploading(true)
    const filename = fileName || file.filename || (file.name ? file.name + '.md' : '')
    // Lê cada arquivo como DataURL e envia como anexo
    for (const f of files) {
      const reader = new FileReader()
      reader.onload = async (ev) => {
        await api.uploadAttachment(file.folder, filename, ev.target.result, f.name)
        await loadData()
      }
      reader.readAsDataURL(f)
    }
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ===== Handler: remove um anexo (com confirmação) =====
  const handleDeleteAttachment = async (fileName) => {
    if (!confirm('Remover este anexo?')) return
    await api.deleteAttachment(file.folder, fileName)
    await loadData()
  }

  // ===== Função: retorna o ícone adequado conforme a extensão do anexo =====
  const getFileIcon = (fileName) => {
    const ext = fileName.split('.').pop().toLowerCase()
    const icons = {
      pdf: <FiFile size={16} />,
      doc: <FiFileText size={16} />, docx: <FiFileText size={16} />,
      xls: <FiBarChart2 size={16} />, xlsx: <FiBarChart2 size={16} />,
      zip: <FiPackage size={16} />, rar: <FiPackage size={16} />,
      txt: <FiFileText size={16} />,
      mp4: <FiFilm size={16} />, mp3: <FiMusic size={16} />
    }
    return icons[ext] || <FiPaperclip size={16} />
  }

  // ===== Handler: move o erro para outra pasta =====
  const handleMove = async (targetFolder) => {
    if (!targetFolder || targetFolder === file.folder) return
    if (onMove) {
      onMove(targetFolder)
    } else {
      const filename = fileName || file.filename || (file.name ? file.name + '.md' : '')
      await api.moveFile(file.folder, filename, targetFolder)
      handleClose()
    }
  }

  // ===== Renderização do popup =====
  return (
    // Overlay que fecha o popup ao clicar fora
    <div className={`error-popup-overlay ${fadeOut ? 'fade-out' : ''}`} onClick={handleClose}>
      <div className={`error-popup ${fadeOut ? 'zoom-out' : ''}`} onClick={e => e.stopPropagation()}>

        {/* ===== Cabeçalho: título (editável) e ações da barra superior ===== */}
        <div className="error-popup-header">
          <div className="error-popup-title">
            {/* Em modo edição exibe um input; caso contrário, o nome do erro */}
            {isEditing ? (
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="error-popup-name-input"
              />
            ) : (
              <h2>{file?.name?.replace('.md', '') || file?.filename?.replace('.md', '')}</h2>
            )}
          </div>
          {/* Botões de ação: anexar, copiar, mover, editar, excluir e fechar */}
          <div className="error-popup-actions">
            {isEditing ? (
              // ===== Ações no modo edição: cancelar e salvar =====
              <>
                <button onClick={() => setIsEditing(false)} className="btn-cancel">
                  <FiX size={16} /> Cancelar
                </button>
                <button onClick={handleSave} className="btn-save">
                  Salvar
                </button>
              </>
            ) : (
              // ===== Ações no modo visualização =====
              <>
                <button onClick={() => fileInputRef.current?.click()} className="btn-icon" title="Anexar">
                  <FiPaperclip size={14} />
                </button>
                <button onClick={handleCopy} className="btn-icon" title="Copiar">
                  <FiCopy size={14} />
                </button>
                {/* Move para outra pasta via prompt */}
                <button onClick={() => {
                  const target = prompt('Mover para qual pasta?\n\nPastas: ' + (folders || []).map(f => f.name || f).join(', '))
                  if (target && target !== file.folder) handleMove(target)
                }} className="btn-icon" title="Mover">
                  <FiFolder size={14} />
                </button>
                <button onClick={() => setIsEditing(true)} className="btn-edit">
                  <FiEdit2 size={14} /> Editar
                </button>
                <button onClick={handleDelete} className="btn-icon btn-danger-icon" title="Excluir">
                  <FiTrash2 size={14} />
                </button>
                <button onClick={handleClose} className="btn-close">
                  <FiX size={18} />
                </button>
                {/* Input de arquivo oculto usado para o upload de anexos */}
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  style={{ display: 'none' }}
                  onChange={handleFileUpload}
                />
              </>
            )}
          </div>
        </div>

        {/* ===== Barra de informações: pasta e tags do erro ===== */}
        <div className="error-popup-info">
          <span className="error-popup-folder">
            <FiFolder size={12} /> {file?.folder}
          </span>
          {/* Lista de tags com botão de remoção e botão para adicionar nova tag */}
          <div className="error-popup-tags">
            {tags.map((tag, i) => (
              <span key={i} className="error-popup-tag">
                <FiTag size={10} /> {tag}
                <button onClick={() => handleRemoveTag(tag)} className="tag-remove">
                  <FiX size={10} />
                </button>
              </span>
            ))}
            <button className="tag-add-btn" onClick={() => setShowTagInput(true)}>
              <FiPlus size={10} /> Tag
            </button>
          </div>
        </div>

        {/* ===== Campo para digitar e adicionar uma nova tag ===== */}
        {showTagInput && (
          <div className="tag-input-row">
            <input
              type="text"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              placeholder="Nova tag..."
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
            />
            <button onClick={handleAddTag} className="btn-save">Adicionar</button>
            <button onClick={() => { setShowTagInput(false); setNewTag('') }} className="btn-cancel">Cancelar</button>
          </div>
        )}

        {/* ===== Corpo do popup: editor ou conteúdo do erro ===== */}
        <div className="error-popup-body">
          {isEditing ? (
            // ===== Modo edição: referência de formatação + textarea =====
            <div className="error-popup-editor">
              <div className="markdown-reference">
                <span className="markdown-reference-title">Formatacao:</span>
                <span><code>#</code> Titulo</span>
                <span><code>##</code> Subtitulo</span>
                <span><code>**</code> Negrito</span>
                <span><code>-</code> Lista</span>
              </div>
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                autoFocus
              />
            </div>
          ) : (
            // ===== Modo visualização: conteúdo renderizado + seção de anexos =====
            <>
              {/* Conteúdo do erro convertido de Markdown para HTML */}
              <div
                className="error-popup-content"
                dangerouslySetInnerHTML={{ __html: renderContent(content) }}
              />

              {/* ===== Seção de anexos do erro ===== */}
              {attachments.length > 0 && (
                <div className="attachments-section">
                  <div className="attachments-header">
                    <FiPaperclip size={16} />
                    <span>Anexos ({attachments.length})</span>
                  </div>
                  <div className="attachments-grid">
                    {/* Cada anexo: imagem com preview ou arquivo com ícone por extensão */}
                    {attachments.map((att, idx) => (
                      <div key={idx} className={`attachment-card ${att.isImage ? 'is-image' : 'is-file'}`}>
                        {att.isImage ? (
                          <img
                            src={att.url}
                            alt={att.originalName}
                            onClick={() => setShowPreview(att.url)}
                          />
                        ) : (
                          <div className="attachment-file" onClick={() => window.open(att.url, '_blank')}>
                            <span className="attachment-icon">{getFileIcon(att.originalName)}</span>
                            <span className="attachment-name">{att.originalName}</span>
                          </div>
                        )}
                        {/* Botão para excluir o anexo */}
                        <button
                          className="attachment-delete"
                          onClick={() => handleDeleteAttachment(att.name)}
                        >
                          <FiTrash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ===== Preview de imagem em tela cheia ===== */}
      {showPreview && (
        <div className="image-preview-overlay" onClick={() => setShowPreview(null)}>
          <img src={showPreview} alt="Preview" />
          <button className="image-preview-close">
            <FiX size={24} />
          </button>
        </div>
      )}
    </div>
  )
}
