import { useState, useEffect } from 'react'
import { api } from '../services/api'
import { FiSend, FiCheck, FiAlertCircle, FiTool } from 'react-icons/fi'

export default function PublicForm() {
  const [folders, setFolders] = useState([])
  const [allTags, setAllTags] = useState([])
  const [selectedTags, setSelectedTags] = useState([])
  const [form, setForm] = useState({ title: '', sistema: '', contexto: '', resolucao: '' })
  const [status, setStatus] = useState('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetch('/api/public/folders-tags')
      .then(r => r.json())
      .then(data => {
        setFolders(data.folders || [])
        setAllTags(data.tags || [])
        setStatus('ready')
      })
      .catch(() => setStatus('error'))
  }, [])

  const toggleTag = (tag) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    )
  }

  const handleSubmit = async () => {
    if (!form.title.trim() || !form.sistema) {
      setMessage('Preencha titulo e sistema')
      return
    }
    setStatus('submitting')
    try {
      const res = await fetch('/api/public/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, tags: selectedTags })
      })
      const data = await res.json()
      if (data.success) {
        setStatus('success')
        setMessage('Erro cadastrado com sucesso!')
      } else {
        setStatus('ready')
        setMessage(data.error || 'Erro ao cadastrar')
      }
    } catch (e) {
      setStatus('ready')
      setMessage('Erro de conexao')
    }
  }

  if (status === 'loading') {
    return (
      <div className="public-form-page">
        <div className="public-form-card">
          <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>Carregando...</p>
        </div>
      </div>
    )
  }

  if (status === 'success') {
    return (
      <div className="public-form-page">
        <div className="public-form-card" style={{ textAlign: 'center', padding: '60px 32px' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#10b98120', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <FiCheck size={32} color="#10b981" />
          </div>
          <h2 style={{ margin: '0 0 8px', color: 'var(--text-primary)' }}>Erro Cadastrado!</h2>
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>Obrigado por reportar. O erro foi salvo no sistema.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="public-form-page">
      <div className="public-form-card">
        <div className="public-form-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'linear-gradient(135deg, #3b82f6, #2563eb)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FiTool size={20} color="#fff" />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: '20px' }}>Cadastrar Erro</h1>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>APS Assistance</p>
            </div>
          </div>
        </div>

        <div className="public-form-body">
          <div className="public-field">
            <label>Titulo do erro *</label>
            <input
              type="text"
              placeholder="Ex: Erro ao emitir NF"
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
            />
          </div>

          <div className="public-field">
            <label>Sistema *</label>
            <div className="public-radio-group">
              {folders.map(f => (
                <label key={f} className={`public-radio ${form.sistema === f ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="sistema"
                    value={f}
                    checked={form.sistema === f}
                    onChange={e => setForm({ ...form, sistema: e.target.value })}
                  />
                  {f}
                </label>
              ))}
            </div>
          </div>

          <div className="public-field">
            <label>Contexto / Quando acontece</label>
            <textarea
              placeholder="Descreva em que situacao o erro ocorre..."
              rows={3}
              value={form.contexto}
              onChange={e => setForm({ ...form, contexto: e.target.value })}
            />
          </div>

          <div className="public-field">
            <label>Resolucao (passo a passo)</label>
            <textarea
              placeholder="Descreva como resolver o erro..."
              rows={5}
              value={form.resolucao}
              onChange={e => setForm({ ...form, resolucao: e.target.value })}
            />
          </div>

          <div className="public-field">
            <label>Tags</label>
            <div className="public-tags-group">
              {allTags.length === 0 && (
                <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Nenhuma tag disponivel</span>
              )}
              {allTags.map(tag => (
                <label key={tag} className={`public-tag ${selectedTags.includes(tag) ? 'selected' : ''}`}>
                  <input
                    type="checkbox"
                    checked={selectedTags.includes(tag)}
                    onChange={() => toggleTag(tag)}
                  />
                  {tag}
                </label>
              ))}
            </div>
          </div>

          {message && (
            <div style={{
              padding: '10px 14px',
              borderRadius: '8px',
              fontSize: '13px',
              background: message.includes('sucesso') ? '#10b98115' : '#ef444415',
              color: message.includes('sucesso') ? '#10b981' : '#ef4444',
              border: `1px solid ${message.includes('sucesso') ? '#10b98130' : '#ef444430'}`,
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              {message.includes('sucesso') ? <FiCheck size={14} /> : <FiAlertCircle size={14} />}
              {message}
            </div>
          )}

          <button
            className="public-submit-btn"
            onClick={handleSubmit}
            disabled={status === 'submitting'}
          >
            <FiSend size={16} />
            {status === 'submitting' ? 'Enviando...' : 'Cadastrar Erro'}
          </button>
        </div>
      </div>
    </div>
  )
}
