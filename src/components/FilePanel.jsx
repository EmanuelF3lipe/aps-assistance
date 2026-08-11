import { FiStar, FiPlus, FiDownload, FiTrash2, FiFolder } from 'react-icons/fi'

export default function FilePanel({
  currentFolder,
  files,
  onSelectFile,
  favorites,
  onToggleFavorite,
  onNewFile,
  sortBy,
  onSortChange,
  selectedFiles,
  onSelectBatch,
  onExportCSV,
  onBatchDelete,
  onBatchMove,
  folders
}) {
  const toggleSelect = (file, e) => {
    e.stopPropagation()
    const key = `${file.folder}-${file.filename || file.name}`
    if (selectedFiles.find(f => `${f.folder}-${f.filename || f.name}` === key)) {
      onSelectBatch(selectedFiles.filter(f => `${f.folder}-${f.filename || f.name}` !== key))
    } else {
      onSelectBatch([...selectedFiles, file])
    }
  }

  const toggleSelectAll = () => {
    if (selectedFiles.length === files.length) {
      onSelectBatch([])
    } else {
      onSelectBatch([...files])
    }
  }

  return (
    <div className="file-panel-vertical">
      <div className="file-panel-header">
        <div className="file-panel-header-left">
          <h2>{currentFolder || 'Selecione uma pasta'}</h2>
          <span className="file-count">{files.length} erro{files.length !== 1 ? 's' : ''}</span>
        </div>
        {currentFolder && !currentFolder.startsWith('[search]') && (
          <div style={{ display: 'flex', gap: '6px' }}>
            <button className="new-error-btn" onClick={onNewFile}>
              <FiPlus size={14} /> Novo Erro
            </button>
          </div>
        )}
      </div>

      {currentFolder && files.length > 0 && (
        <div className="sort-bar">
          <label>Ordenar:</label>
          <select value={sortBy} onChange={e => onSortChange(e.target.value)}>
            <option value="name">Nome</option>
            <option value="folder">Pasta</option>
            <option value="recent">Recente</option>
          </select>
          <label style={{ marginLeft: 'auto' }}>
            <input
              type="checkbox"
              className="batch-checkbox"
              checked={selectedFiles.length === files.length && files.length > 0}
              onChange={toggleSelectAll}
            />
            {' '} Todos
          </label>
          {selectedFiles.length > 0 && (
            <span style={{ color: 'var(--accent-blue)', fontSize: '12px', fontWeight: 600 }}>
              {selectedFiles.length} selecionado(s)
            </span>
          )}
        </div>
      )}

      {selectedFiles.length > 0 && (
        <div className="batch-bar">
          <span>{selectedFiles.length} selecionado(s)</span>
          <button onClick={onExportCSV}><FiDownload size={12} /> CSV</button>
          <button onClick={() => {
            const target = prompt('Mover para qual pasta?\n' + folders.map(f => f.name || f).join(', '))
            if (target) onBatchMove(target)
          }}><FiFolder size={12} /> Mover</button>
          <button className="danger" onClick={onBatchDelete}><FiTrash2 size={12} /> Excluir</button>
          <button onClick={() => onSelectBatch([])}>Cancelar</button>
        </div>
      )}

      {files.length === 0 ? (
        <div className="empty-state-vertical">
          <p>Nenhum erro encontrado</p>
          {currentFolder && !currentFolder.startsWith('[search]') && (
            <button onClick={onNewFile} className="empty-new-btn">
              <FiPlus size={16} /> Criar primeiro erro
            </button>
          )}
        </div>
      ) : (
        <div className="file-cards">
          {files.map((file) => {
            const filename = file.filename || file.name
            const name = file.name || filename.replace('.md', '')
            const isFav = favorites.find(fav => fav.filename === filename && fav.folder === file.folder)
            const isSelected = selectedFiles.find(f => `${f.folder}-${f.filename || f.name}` === `${file.folder}-${filename}`)
            const tags = file.tags || []

            return (
              <div
                key={`${file.folder}-${filename}`}
                className={`file-card ${isSelected ? 'selected' : ''}`}
                onClick={() => onSelectFile(file)}
              >
                <div className="file-card-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                    <input
                      type="checkbox"
                      className="batch-checkbox"
                      checked={!!isSelected}
                      onClick={e => toggleSelect(file, e)}
                      onChange={() => {}}
                    />
                    <h3 className="file-card-title">{name}</h3>
                  </div>
                  <FiStar
                    size={16}
                    className={`fav-star ${isFav ? 'active' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      onToggleFavorite(filename, file.folder)
                    }}
                    fill={isFav ? 'var(--accent-yellow)' : 'none'}
                  />
                </div>
                {tags.length > 0 && (
                  <div className="file-card-tags">
                    {tags.slice(0, 3).map((tag, i) => (
                      <span key={i} className="file-card-tag">{tag}</span>
                    ))}
                    {tags.length > 3 && <span className="file-card-tag-more">+{tags.length - 3}</span>}
                  </div>
                )}
                <div className="file-card-footer">
                  <span className="file-card-folder">{file.folder}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
