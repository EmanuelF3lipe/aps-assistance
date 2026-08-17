/**
 * Dashboard.jsx - Visão geral do módulo APS.
 * Exibe as senhas rotativas do dia, as estatísticas por pasta (com cor
 * personalizável) e a lista dos erros mais recentes.
 */
import { useState, useEffect } from 'react'
import { api } from '../services/api'
import { FiTag, FiEdit3, FiCheck, FiX } from 'react-icons/fi'
import PasswordPanel from './PasswordPanel'

// Paleta padrão usada nos cards de estatística quando a pasta não tem cor própria
const DEFAULT_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444',
  '#06b6d4', '#f97316', '#ec4899', '#14b8a6', '#6366f1'
]

export default function Dashboard({ onSelectFile }) {
  // ===== ESTADOS =====
  // Estatísticas, pastas e cores vindas do servidor + controle do seletor de cor
  const [stats, setStats] = useState(null)
  const [folders, setFolders] = useState([])
  const [folderColors, setFolderColors] = useState({})
  const [editingFolder, setEditingFolder] = useState(null)
  const [selectedColor, setSelectedColor] = useState('#3b82f6')

  // Carrega os dados do dashboard assim que o componente monta
  useEffect(() => {
    loadData()
  }, [])

  // Faz as três chamadas à API em paralelo para montar o dashboard
  const loadData = async () => {
    const [statsData, foldersData, colorsData] = await Promise.all([
      api.getStats(),
      api.getFolders(),
      api.getFolderColors()
    ])
    setStats(statsData)
    setFolders(foldersData)
    setFolderColors(colorsData)
  }

  // Evita renderizar enquanto os dados ainda não chegaram do servidor
  if (!stats) return null

  // Persiste a cor escolhida para a pasta e fecha o seletor
  const handleSaveColor = async (folder) => {
    await api.setFolderColor(folder, selectedColor)
    setFolderColors({ ...folderColors, [folder]: selectedColor })
    setEditingFolder(null)
  }

  // Remove a cor personalizada da pasta (volta à cor padrão)
  const handleRemoveColor = async (folder) => {
    await api.removeFolderColor(folder)
    const newColors = { ...folderColors }
    delete newColors[folder]
    setFolderColors(newColors)
    setEditingFolder(null)
  }

  return (
    <div className="dashboard">
      {/* ===== RENDERIZAÇÃO ===== */}
      <h2>Visao Geral</h2>

      {/* Painel com as senhas rotativas geradas a partir da data atual */}
      <PasswordPanel />

      {/* Grid de estatísticas: um card por pasta, com cor, contagem e botão de editar cor */}
      <div className="stats-grid">
        {folders.map((folder) => {
          const color = folderColors[folder.name] || DEFAULT_COLORS[folders.indexOf(folder) % DEFAULT_COLORS.length]
          const count = stats.byFolder[folder.name] || 0
          const isEditing = editingFolder === folder.name

          return (
            <div key={folder.name} className="stat-card" style={{ borderColor: color }}>
              <div className="label" style={{ color }}>{folder.name.toUpperCase()}</div>
              <div className="value" style={{ color }}>{count}</div>
              <button
                className="edit-color-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  setEditingFolder(isEditing ? null : folder.name)
                  setSelectedColor(folderColors[folder.name] || color)
                }}
                title="Escolher cor"
              >
                <FiEdit3 size={12} />
              </button>
              {/* Seletor de cores inline, exibido ao clicar no lápis do card */}
              {isEditing && (
                <div className="color-picker-inline" onClick={(e) => e.stopPropagation()}>
                  <div className="color-options">
                    {DEFAULT_COLORS.map((c) => (
                      <button
                        key={c}
                        className={`color-option ${selectedColor === c ? 'selected' : ''}`}
                        style={{ background: c }}
                        onClick={() => setSelectedColor(c)}
                      />
                    ))}
                  </div>
                  <div className="color-actions">
                    <button className="success" onClick={() => handleSaveColor(folder.name)}>
                      <FiCheck size={12} />
                    </button>
                    <button className="secondary" onClick={() => handleRemoveColor(folder.name)}>
                      <FiX size={12} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="section-title">
        <FiTag size={14} /> Recentes
      </div>
      {/* Lista dos arquivos mais recentes; clique abre o erro */}
      <div className="recent-list">
        {stats.recentFiles.map((file) => (
          <div
            key={`${file.folder}-${file.filename}`}
            className="recent-item"
            onClick={() => onSelectFile({ folder: file.folder, filename: file.filename })}
          >
            <span className="name">{file.name}</span>
            <span className="folder">{file.folder}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
