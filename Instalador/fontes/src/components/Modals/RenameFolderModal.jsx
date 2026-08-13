import { useState } from 'react'
import { FiEdit2, FiX } from 'react-icons/fi'

export default function RenameFolderModal({ currentName, onClose, onRename }) {
  const [name, setName] = useState(currentName)

  const handleSubmit = (e) => {
    e.preventDefault()
    onRename(name.trim())
  }

  return (
    <div className="modal active">
      <div className="modal-content">
        <h3><FiEdit2 size={20} /> Renomear Pasta</h3>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Novo nome"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          <div className="modal-actions">
            <button type="button" className="secondary" onClick={onClose}>
              <FiX size={14} /> Cancelar
            </button>
            <button type="submit">Salvar</button>
          </div>
        </form>
      </div>
    </div>
  )
}
