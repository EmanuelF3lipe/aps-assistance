/* ============================================================
   NewFolderModal.jsx — Modal para criar uma nova pasta/sistema
   Solicita apenas o nome da nova pasta.
   ============================================================ */

// ===== Imports =====
import { useState } from 'react'
import { FiFolderPlus, FiX } from 'react-icons/fi'

// ===== Componente NewFolderModal =====
// Props: onClose e onCreate (nome da nova pasta)
export default function NewFolderModal({ onClose, onCreate }) {
  // ===== States do componente =====
  const [name, setName] = useState('')   // Nome da nova pasta

  // ===== Handler: envia o formulário criando a pasta =====
  const handleSubmit = (e) => {
    e.preventDefault()
    if (name.trim()) {
      onCreate(name.trim())
    }
  }

  // ===== Renderização do modal =====
  return (
    <div className="modal active">
      <div className="modal-content">
        {/* Título do modal */}
        <h3><FiFolderPlus size={20} /> Nova Pasta</h3>
        {/* ===== Formulário: nome da nova pasta ===== */}
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Nome da pasta"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          {/* ===== Ações: cancelar e criar ===== */}
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
