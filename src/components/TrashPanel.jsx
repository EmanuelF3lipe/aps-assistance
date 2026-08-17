/* ============================================================
   TrashPanel.jsx — Painel de erros não catalogados (lixeira)
   Lista os erros excluídos, permitindo restaurar, excluir
   individualmente ou esvaziar tudo.
   ============================================================ */

// ===== Imports =====
import { useState, useEffect } from 'react'
import { api } from '../services/api'
import { FiRotateCcw, FiTrash2, FiArrowLeft, FiInbox } from 'react-icons/fi'

// ===== Componente TrashPanel =====
// Props: callbacks onRestore, onDelete, onEmpty e onBack (voltar ao dashboard)
export default function TrashPanel({ onRestore, onDelete, onEmpty, onBack }) {
  // ===== States do componente =====
  const [trashFiles, setTrashFiles] = useState([])   // Lista de erros na lixeira
  const [loading, setLoading] = useState(true)       // Estado de carregamento

  // ===== Função: carrega a lista de erros da lixeira =====
  const loadTrash = async () => {
    setLoading(true)
    const data = await api.getTrash()
    setTrashFiles(data)
    setLoading(false)
  }

  // ===== Efeito: carrega a lixeira ao montar o painel =====
  useEffect(() => {
    loadTrash()
  }, [])

  // ===== Handler: restaura um erro da lixeira e recarrega a lista =====
  const handleRestore = async (filename) => {
    await onRestore(filename)
    await loadTrash()
  }

  // ===== Handler: exclui definitivamente um erro e recarrega a lista =====
  const handleDelete = async (filename) => {
    await onDelete(filename)
    await loadTrash()
  }

  // ===== Handler: esvazia toda a lixeira e recarrega a lista =====
  const handleEmpty = async () => {
    await onEmpty()
    await loadTrash()
  }

  // ===== Renderização do painel =====
  return (
    <div className="dashboard">
      {/* ===== Cabeçalho: título e botões de ação ===== */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
          <FiInbox size={24} /> Erros Não Catalogados
        </h2>
        <div style={{ display: 'flex', gap: '10px' }}>
          {/* Botão voltar para o dashboard */}
          <button className="secondary" onClick={onBack}>
            <FiArrowLeft size={14} /> Voltar
          </button>
          {/* Botão esvaziar tudo (apenas se houver itens) */}
          {trashFiles.length > 0 && (
            <button className="danger" onClick={handleEmpty}>
              <FiTrash2 size={14} /> Esvaziar Tudo
            </button>
          )}
        </div>
      </div>

      {/* ===== Conteúdo: carregando, vazio ou lista de erros ===== */}
      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Carregando...</p>
      ) : trashFiles.length === 0 ? (
        // ===== Estado vazio =====
        <div className="empty-state" style={{ height: 'auto', padding: '48px' }}>
          <FiInbox size={48} style={{ opacity: 0.3, marginBottom: 16 }} />
          <p>Lixeira vazia</p>
        </div>
      ) : (
        // ===== Lista de erros com ações de restaurar/excluir =====
        <div className="recent-list" style={{ gridTemplateColumns: '1fr' }}>
          {trashFiles.map((file) => (
            <div key={file.filename} className="recent-item" style={{ justifyContent: 'space-between' }}>
              <div>
                <span className="name">{file.name}</span>
                <span className="folder" style={{ marginLeft: '12px' }}>
                  {file.originalFolder}
                </span>
              </div>
              {/* Ações por item: restaurar e excluir */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="success"
                  onClick={() => handleRestore(file.filename)}
                  style={{ padding: '6px 14px' }}
                >
                  <FiRotateCcw size={14} /> Restaurar
                </button>
                <button
                  className="danger"
                  onClick={() => handleDelete(file.filename)}
                  style={{ padding: '6px 14px' }}
                >
                  <FiTrash2 size={14} /> Excluir
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
