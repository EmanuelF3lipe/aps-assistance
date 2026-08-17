/* ============================================================
   MoveFileModal.jsx — Modal para mover um erro para outra pasta
   Permite selecionar a pasta de destino (excluindo a atual).
   ============================================================ */

// ===== Imports =====
import { useState } from 'react'
import { FiFolder, FiX } from 'react-icons/fi'

// ===== Componente MoveFileModal =====
// Props: folders (pastas), currentFolder (pasta atual do erro), onClose e onMove
export default function MoveFileModal({ folders, currentFolder, onClose, onMove }) {
  // ===== States do componente =====
  const [targetFolder, setTargetFolder] = useState('')   // Pasta de destino selecionada

  // ===== Handler: envia o formulário movendo o arquivo =====
  const handleSubmit = (e) => {
    e.preventDefault()
    if (targetFolder && targetFolder !== currentFolder) {
      onMove(targetFolder)
    }
  }

  // ===== Renderização do modal =====
  return (
    <div className="modal active">
      <div className="modal-content">
        {/* Título do modal */}
        <h3><FiFolder size={20} /> Mover Arquivo</h3>
        {/* ===== Formulário: seleção da pasta de destino ===== */}
        <form onSubmit={handleSubmit}>
          {/* Lista as pastas, ocultando a pasta atual do arquivo */}
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
          {/* ===== Ações: cancelar e mover ===== */}
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
