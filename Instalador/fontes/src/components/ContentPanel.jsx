import { useState, useEffect, useRef } from 'react'
import { api } from '../services/api'
import { FiEdit3, FiTrash2, FiCopy, FiFolder, FiEdit, FiX, FiPlus, FiTag, FiImage, FiUpload } from 'react-icons/fi'

export default function ContentPanel({
  currentFile,
  currentFolder,
  fileContent,
  isEditing,
  onStartEdit,
  onCancelEdit,
  onSave,
  onDelete,
  onCopy,
  onRename,
  onMove,
  onUpdateTags,
  onUpdateContent
}) {
  const [editContent, setEditContent] = useState('')
  const [editTitle, setEditTitle] = useState('')
  const [tags, setTags] = useState([])
  const [showTagInput, setShowTagInput] = useState(false)
  const [newTag, setNewTag] = useState('')
  const [images, setImages] = useState([])
  const [uploading, setUploading] = useState(false)
  const [showImagePreview, setShowImagePreview] = useState(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    setEditContent(fileContent || '')
    setEditTitle(currentFile?.replace('.md', '') || '')
    // Extrair tags
    const tagMatch = fileContent?.match(/## Tags\n([\s\S]*?)$/)
    if (tagMatch) {
      const extractedTags = tagMatch[1]
        .split('\n')
        .filter(t => t.startsWith('-'))
        .map(t => t.replace('- ', '').trim())
      setTags(extractedTags)
    } else {
      setTags([])
    }
    // Carregar imagens
    loadImages()
  }, [fileContent, currentFile, currentFolder])

  const loadImages = async () => {
    if (!currentFile || !currentFolder) return
    try {
      const imgs = await api.getImages(currentFolder, currentFile)
      setImages(imgs || [])
    } catch (err) {
      setImages([])
    }
  }

  if (!currentFile) {
    return (
      <div id="contentEmpty" className="empty-state">
        <FiEdit3 size={48} style={{ opacity: 0.3, marginBottom: 16 }} />
        <p>Selecione um erro para ver a resolução</p>
      </div>
    )
  }

  const renderContent = (content) => {
    if (!content) return ''
    let html = content
      .replace(/^### (.*$)/gm, '<h3>$1</h3>')
      .replace(/^## (.*$)/gm, '<h2>$1</h2>')
      .replace(/^# (.*$)/gm, '<h1>$1</h1>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/^- (.*$)/gm, '• $1')
      .replace(/\n/g, '<br>')
    
    // Renderizar imagens inline
    html = html.replace(
      /!\[(.*?)\]\((\/_images\/[^)]+)\)/g,
      '<img src="$2" alt="$1" class="content-image" onclick="window.open(\'$2\', \'_blank\')" />'
    )
    
    return html
  }

  const handleAddTag = async () => {
    if (!newTag.trim()) return
    const updatedTags = [...tags, newTag.trim()]
    await onUpdateTags(currentFolder, currentFile, updatedTags)
    setTags(updatedTags)
    setNewTag('')
    setShowTagInput(false)
  }

  const handleRemoveTag = async (tagToRemove) => {
    const updatedTags = tags.filter(t => t !== tagToRemove)
    await onUpdateTags(currentFolder, currentFile, updatedTags)
    setTags(updatedTags)
  }

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files)
    if (files.length === 0) return

    setUploading(true)

    for (const file of files) {
      const reader = new FileReader()
      reader.onload = async (ev) => {
        const imageData = ev.target.result
        await api.uploadImage(currentFolder, currentFile, imageData, file.name)
        await loadImages()
        // Recarregar conteúdo para mostrar a referência da imagem
        const data = await api.getFile(currentFolder, currentFile)
        if (data.content) {
          setEditContent(data.content)
          if (onUpdateContent) onUpdateContent(data.content)
        }
      }
      reader.readAsDataURL(file)
    }

    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleDeleteImage = async (imageName) => {
    if (!confirm('Remover esta imagem?')) return
    await api.deleteImage(currentFolder, imageName)
    await loadImages()
    // Recarregar conteúdo para remover a referência da imagem
    const data = await api.getFile(currentFolder, currentFile)
    if (data.content) {
      setEditContent(data.content)
      if (onUpdateContent) onUpdateContent(data.content)
    }
  }

  return (
    <div id="contentActive" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="content-header">
        <div>
          <h3 id="contentTitle">{currentFile.replace('.md', '')}</h3>
          <div className="meta" id="contentMeta">
            <FiFolder size={12} /> {currentFolder}
          </div>
          <div className="tags-container">
            {tags.map((tag, idx) => (
              <span key={idx} className="tag-item">
                {tag}
                <button className="tag-remove" onClick={() => handleRemoveTag(tag)}>
                  <FiX size={12} />
                </button>
              </span>
            ))}
            <button className="tag-add-btn" onClick={() => setShowTagInput(true)}>
              <FiPlus size={12} /> Tag
            </button>
          </div>
        </div>
        <div className="actions">
          <button className="secondary" onClick={() => fileInputRef.current?.click()}>
            <FiImage size={14} /> {uploading ? 'Enviando...' : 'Imagem'}
          </button>
          <button className="secondary" onClick={onMove}>
            <FiFolder size={14} /> Mover
          </button>
          <button className="secondary" onClick={onCopy}>
            <FiCopy size={14} /> Copiar
          </button>
          <button className="success" onClick={onStartEdit}>
            <FiEdit3 size={14} /> Editar
          </button>
          <button className="danger" onClick={onDelete}>
            <FiTrash2 size={14} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: 'none' }}
            onChange={handleImageUpload}
          />
        </div>
      </div>

      {showTagInput && (
        <div className="tag-input-container">
          <input
            type="text"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            placeholder="Nova tag..."
            autoFocus
            onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
          />
          <button className="success" onClick={handleAddTag}>
            <FiPlus size={14} /> Adicionar
          </button>
          <button className="secondary" onClick={() => { setShowTagInput(false); setNewTag('') }}>
            <FiX size={14} /> Cancelar
          </button>
        </div>
      )}

      <div className="content-body">
        {!isEditing ? (
          <>
            <div
              className="content-view"
              dangerouslySetInnerHTML={{ __html: renderContent(fileContent) }}
            />

            {images.length > 0 && (
              <div className="images-section">
                <div className="images-header">
                  <FiImage size={16} />
                  <span>Imagens Anexadas ({images.length})</span>
                </div>
                <div className="images-grid">
                  {images.map((img, idx) => (
                    <div key={idx} className="image-card">
                      <img
                        src={img.url}
                        alt={img.name}
                        onClick={() => setShowImagePreview(img.url)}
                      />
                      <button
                        className="image-delete"
                        onClick={() => handleDeleteImage(img.name)}
                      >
                        <FiTrash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="edit-view active">
            <div className="edit-title-container">
              <label style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Titulo do Erro</label>
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  borderRadius: '8px',
                  fontSize: '14px',
                  marginBottom: '12px'
                }}
              />
            </div>
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              autoFocus
            />
            <div className="edit-actions">
              <button className="success" onClick={async () => {
                if (editTitle && editTitle !== currentFile?.replace('.md', '')) {
                  await onRename(editTitle)
                }
                onSave(editContent)
              }}>
                Salvar
              </button>
              <button className="secondary" onClick={onCancelEdit}>
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>

      {showImagePreview && (
        <div className="image-preview-overlay" onClick={() => setShowImagePreview(null)}>
          <img src={showImagePreview} alt="Preview" />
          <button className="image-preview-close">
            <FiX size={24} />
          </button>
        </div>
      )}
    </div>
  )
}
