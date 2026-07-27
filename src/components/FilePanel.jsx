import { FiStar, FiPlus } from 'react-icons/fi'

export default function FilePanel({
  currentFolder,
  files,
  currentFile,
  onSelectFile,
  favorites,
  onToggleFavorite,
  onNewFile
}) {
  return (
    <div className="file-panel-vertical">
      <div className="file-panel-header">
        <div className="file-panel-header-left">
          <h2>{currentFolder || 'Selecione uma pasta'}</h2>
          <span className="file-count">{files.length} erro{files.length !== 1 ? 's' : ''}</span>
        </div>
        {currentFolder && !currentFolder.startsWith('🔍') && (
          <button className="new-error-btn" onClick={onNewFile}>
            <FiPlus size={14} /> Novo Erro
          </button>
        )}
      </div>

      {files.length === 0 ? (
        <div className="empty-state-vertical">
          <p>Nenhum erro encontrado</p>
          {currentFolder && !currentFolder.startsWith('🔍') && (
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
            const isFav = favorites.find(
              (fav) => fav.filename === filename && fav.folder === file.folder
            )
            const tags = file.tags || []

            return (
              <div
                key={`${file.folder}-${filename}`}
                className="file-card"
                onClick={() => onSelectFile(file)}
              >
                <div className="file-card-header">
                  <h3 className="file-card-title">{name}</h3>
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
