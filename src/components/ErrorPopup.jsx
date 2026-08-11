import { useState, useEffect, useRef } from 'react'
import { api } from '../services/api'
import { FiX, FiEdit2, FiTag, FiPaperclip, FiTrash2, FiCopy, FiFolder, FiPlus, FiFile, FiFileText, FiFilm, FiMusic, FiPackage, FiBarChart2 } from 'react-icons/fi'

export default function ErrorPopup({ file, onClose, onEdit, onMove, folders }) {
  const [fadeOut, setFadeOut] = useState(false)
  const [content, setContent] = useState('')
  const [tags, setTags] = useState([])
  const [attachments, setAttachments] = useState([])
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState('')
  const [editTitle, setEditTitle] = useState('')
  const [showTagInput, setShowTagInput] = useState(false)
  const [newTag, setNewTag] = useState('')
  const [uploading, setUploading] = useState(false)
  const [showPreview, setShowPreview] = useState(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    if (file) {
      loadData()
    }
  }, [file])

  const loadData = async () => {
    if (!file || !file.folder) return
    const filename = file.filename || file.name + '.md'
    const res = await api.getFile(file.folder, filename)
    const fileContent = res.content || ''
    setContent(fileContent)
    setEditContent(fileContent)
    setEditTitle(filename.replace('.md', ''))

    const tagMatch = fileContent.match(/## Tags\n([\s\S]*?)$/)
    if (tagMatch) {
      setTags(tagMatch[1].split('\n').filter(t => t.startsWith('-')).map(t => t.replace('- ', '').trim()))
    } else {
      setTags([])
    }

    try {
      const atts = await api.getAttachments(file.folder, filename)
      setAttachments(atts || [])
    } catch {
      setAttachments([])
    }
  }

  const handleClose = () => {
    setFadeOut(true)
    setTimeout(() => onClose(), 300)
  }

  const renderContent = (md) => {
    if (!md) return ''
    let html = md
      .replace(/^### (.*$)/gm, '<h3>$1</h3>')
      .replace(/^## (.*$)/gm, '<h2>$1</h2>')
      .replace(/^# (.*$)/gm, '<h1>$1</h1>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/^- (.*$)/gm, '• $1')
      .replace(/\n/g, '<br>')

    html = html.replace(
      /!\[(.*?)\]\((\/_images\/[^)]+)\)/g,
      '<img src="$2" alt="$1" class="content-image" onclick="window.open(\'$2\', \'_blank\')" />'
    )

    html = html.replace(
      /\[\s*(.*?)\s*\]\((\/_images\/[^)]+)\)/g,
      '<a href="$2" target="_blank" class="attachment-link">$1</a>'
    )

    return html
  }

  const handleAddTag = async () => {
    if (!newTag.trim()) return
    const updatedTags = [...tags, newTag.trim()]
    const filename = file.filename || file.name + '.md'
    await api.updateTags(file.folder, filename, updatedTags)
    setTags(updatedTags)
    setNewTag('')
    setShowTagInput(false)
  }

  const handleRemoveTag = async (tagToRemove) => {
    const updatedTags = tags.filter(t => t !== tagToRemove)
    const filename = file.filename || file.name + '.md'
    await api.updateTags(file.folder, filename, updatedTags)
    setTags(updatedTags)
  }

  const handleSave = async () => {
    const filename = file.filename || file.name + '.md'
    if (editTitle && editTitle !== filename.replace('.md', '')) {
      await api.renameFile(file.folder, filename, editTitle)
    }
    await api.updateFile(file.folder, filename, editContent)
    setContent(editContent)
    setIsEditing(false)
    loadData()
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(content)
  }

  const handleDelete = async () => {
    if (!confirm('Excluir este erro?')) return
    const filename = file.filename || file.name + '.md'
    await api.deleteFile(file.folder, filename)
    handleClose()
  }

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files)
    if (files.length === 0) return
    setUploading(true)
    const filename = file.filename || file.name + '.md'
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

  const handleDeleteAttachment = async (fileName) => {
    if (!confirm('Remover este anexo?')) return
    await api.deleteAttachment(file.folder, fileName)
    await loadData()
  }

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

  const handleMove = async (targetFolder) => {
    if (!targetFolder || targetFolder === file.folder) return
    if (onMove) {
      onMove(targetFolder)
    } else {
      const filename = file.filename || file.name + '.md'
      await api.moveFile(file.folder, filename, targetFolder)
      handleClose()
    }
  }

  return (
    <div className={`error-popup-overlay ${fadeOut ? 'fade-out' : ''}`} onClick={handleClose}>
      <div className={`error-popup ${fadeOut ? 'zoom-out' : ''}`} onClick={e => e.stopPropagation()}>

        <div className="error-popup-header">
          <div className="error-popup-title">
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
          <div className="error-popup-actions">
            {isEditing ? (
              <>
                <button onClick={() => setIsEditing(false)} className="btn-cancel">
                  <FiX size={16} /> Cancelar
                </button>
                <button onClick={handleSave} className="btn-save">
                  Salvar
                </button>
              </>
            ) : (
              <>
                <button onClick={() => fileInputRef.current?.click()} className="btn-icon" title="Anexar">
                  <FiPaperclip size={14} />
                </button>
                <button onClick={handleCopy} className="btn-icon" title="Copiar">
                  <FiCopy size={14} />
                </button>
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

        <div className="error-popup-info">
          <span className="error-popup-folder">
            <FiFolder size={12} /> {file?.folder}
          </span>
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

        <div className="error-popup-body">
          {isEditing ? (
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
            <>
              <div
                className="error-popup-content"
                dangerouslySetInnerHTML={{ __html: renderContent(content) }}
              />

              {attachments.length > 0 && (
                <div className="attachments-section">
                  <div className="attachments-header">
                    <FiPaperclip size={16} />
                    <span>Anexos ({attachments.length})</span>
                  </div>
                  <div className="attachments-grid">
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
