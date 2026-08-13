import { useState } from 'react'
import { FiFolderPlus, FiX } from 'react-icons/fi'

export default function NewFolderModal({ onClose, onCreate }) {
  const [name, setName] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (name.trim()) {
      onCreate(name.trim())
    }
  }

  return (
    <div className="modal active">
      <div className="modal-content">
        <h3><FiFolderPlus size={20} /> Nova Pasta</h3>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Nome da pasta"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          <div className="modal-actions">
            <button type="button" className="secondary" onClick={onClose}>
              <FiX size={14} /> Cancelar
            </button>
            <button type="submit">Criar</button>
          </div>
        </form>
      </div>
    </div>
  )
}
