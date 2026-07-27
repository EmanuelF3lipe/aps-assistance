import { useState, useEffect } from 'react'
import { api } from '../services/api'
import { FiRotateCcw, FiTrash2, FiArrowLeft, FiInbox } from 'react-icons/fi'

export default function TrashPanel({ onRestore, onDelete, onEmpty, onBack }) {
  const [trashFiles, setTrashFiles] = useState([])
  const [loading, setLoading] = useState(true)

  const loadTrash = async () => {
    setLoading(true)
    const data = await api.getTrash()
    setTrashFiles(data)
    setLoading(false)
  }

  useEffect(() => {
    loadTrash()
  }, [])

  const handleRestore = async (filename) => {
    await onRestore(filename)
    await loadTrash()
  }

  const handleDelete = async (filename) => {
    await onDelete(filename)
    await loadTrash()
  }

  const handleEmpty = async () => {
    await onEmpty()
    await loadTrash()
  }

  return (
    <div className="dashboard">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
          <FiInbox size={24} /> Erros Não Catalogados
        </h2>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="secondary" onClick={onBack}>
            <FiArrowLeft size={14} /> Voltar
          </button>
          {trashFiles.length > 0 && (
            <button className="danger" onClick={handleEmpty}>
              <FiTrash2 size={14} /> Esvaziar Tudo
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Carregando...</p>
      ) : trashFiles.length === 0 ? (
        <div className="empty-state" style={{ height: 'auto', padding: '48px' }}>
          <FiInbox size={48} style={{ opacity: 0.3, marginBottom: 16 }} />
          <p>Lixeira vazia</p>
        </div>
      ) : (
        <div className="recent-list" style={{ gridTemplateColumns: '1fr' }}>
          {trashFiles.map((file) => (
            <div key={file.filename} className="recent-item" style={{ justifyContent: 'space-between' }}>
              <div>
                <span className="name">{file.name}</span>
                <span className="folder" style={{ marginLeft: '12px' }}>
                  {file.originalFolder}
                </span>
              </div>
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
