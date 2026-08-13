import { FiStar } from 'react-icons/fi'

export default function FilePanel({
  currentFolder,
  files,
  currentFile,
  onSelectFile,
  favorites,
  onToggleFavorite
}) {
  return (
    <div className="file-panel">
      <div className="file-panel-header">
        <h2>{currentFolder || 'Dashboard'}</h2>
      </div>

      <ul className="file-list">
        {files.length === 0 ? (
          <li className="empty-state">
            <p>Nenhum erro</p>
          </li>
        ) : (
          files.map((file) => {
            const filename = file.filename || file.name
            const name = file.name || filename.replace('.md', '')
            const isFav = favorites.find(
              (fav) => fav.filename === filename && fav.folder === file.folder
            )
            const isActive = currentFile === filename

            return (
              <li
                key={`${file.folder}-${filename}`}
                className={isActive ? 'active' : ''}
                onClick={() => onSelectFile(file.folder, filename)}
              >
                <span>{name}</span>
                <FiStar
                  size={14}
                  className={`fav-star ${isFav ? 'active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    onToggleFavorite(filename, file.folder)
                  }}
                  fill={isFav ? 'var(--accent-yellow)' : 'none'}
                />
              </li>
            )
          })
        )}
      </ul>
    </div>
  )
}
