/* ============================================================
   RenameFolderModal.jsx — Modal para renomear uma pasta/sistema
   Exibe o nome atual da pasta pré-preenchido no campo.
   ============================================================ */

// ===== Imports =====
import { useState } from 'react'
import { FiEdit2, FiX } from 'react-icons/fi'

// ===== Componente RenameFolderModal =====
// Props: currentName (nome atual da pasta), onClose e onRename
export default function RenameFolderModal({ currentName, onClose, onRename }) {
  // ===== States do componente =====
  const [name, setName] = useState(currentName)   // Novo nome (inicializado com o atual)

  // ===== Handler: envia o formulário renomeando a pasta =====
  const handleSubmit = (e) => {
    e.preventDefault()
    onRename(name.trim())
  }

  // ===== Renderização do modal =====
  return (
    <div className="modal active">
      <div className="modal-content">
        {/* Título do modal */}
        <h3><FiEdit2 size={20} /> Renomear Pasta</h3>
        {/* ===== Formulário: novo nome da pasta ===== */}
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Novo nome"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          {/* ===== Ações: cancelar e salvar ===== */}
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
