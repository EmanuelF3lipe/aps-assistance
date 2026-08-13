import { useState } from 'react'
import { FiFileText, FiX } from 'react-icons/fi'

export default function NewFileModal({ folders, onClose, onCreate }) {
  const [name, setName] = useState('')
  const [folder, setFolder] = useState(folders[0]?.path || '')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (name.trim()) {
      onCreate(name.trim(), folder)
    }
  }

  return (
    <div className="modal active">
      <div className="modal-content">
        <h3><FiFileText size={20} /> Novo Erro</h3>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Nome do erro"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          <select value={folder} onChange={(e) => setFolder(e.target.value)}>
            {folders.map((f) => (
              <option key={f.path} value={f.path}>
                {f.name}
              </option>
            ))}
          </select>
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
