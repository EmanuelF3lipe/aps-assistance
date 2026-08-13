import { useState } from 'react'
import { FiFolder, FiX } from 'react-icons/fi'

export default function MoveFileModal({ folders, currentFolder, onClose, onMove }) {
  const [targetFolder, setTargetFolder] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (targetFolder && targetFolder !== currentFolder) {
      onMove(targetFolder)
    }
  }

  return (
    <div className="modal active">
      <div className="modal-content">
        <h3><FiFolder size={20} /> Mover Arquivo</h3>
        <form onSubmit={handleSubmit}>
          <select value={targetFolder} onChange={(e) => setTargetFolder(e.target.value)}>
            <option value="">Selecione a pasta destino</option>
            {folders
              .filter((f) => f.path !== currentFolder)
              .map((f) => (
                <option key={f.path} value={f.path}>
                  {f.name}
                </option>
              ))}
          </select>
          <div className="modal-actions">
            <button type="button" className="secondary" onClick={onClose}>
              <FiX size={14} /> Cancelar
            </button>
            <button type="submit" disabled={!targetFolder}>
              <FiFolder size={14} /> Mover
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
