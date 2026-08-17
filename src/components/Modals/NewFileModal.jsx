/* ============================================================
   NewFileModal.jsx — Modal para criar um novo registro de erro
   Solicita o nome do erro e a pasta/sistema onde será salvo.
   ============================================================ */

// ===== Imports =====
import { useState } from 'react'
import { FiFileText, FiX } from 'react-icons/fi'

// ===== Componente NewFileModal =====
// Props: folders (pastas disponíveis), onClose e onCreate (nome + pasta)
export default function NewFileModal({ folders, onClose, onCreate }) {
  // ===== States do componente =====
  const [name, setName] = useState('')                              // Nome do novo erro
  const [folder, setFolder] = useState(folders[0]?.path || '')      // Pasta selecionada (padrão: primeira)

  // ===== Handler: envia o formulário criando o erro =====
  const handleSubmit = (e) => {
    e.preventDefault()
    if (name.trim()) {
      onCreate(name.trim(), folder)
    }
  }

  // ===== Renderização do modal =====
  return (
    <div className="modal active">
      <div className="modal-content">
        {/* Título do modal */}
        <h3><FiFileText size={20} /> Novo Erro</h3>
        {/* ===== Formulário: nome do erro e pasta de destino ===== */}
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Nome do erro"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          {/* Seleção da pasta onde o erro será criado */}
          <select value={folder} onChange={(e) => setFolder(e.target.value)}>
            {folders.map((f) => (
              <option key={f.path} value={f.path}>
                {f.name}
              </option>
            ))}
          </select>
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
