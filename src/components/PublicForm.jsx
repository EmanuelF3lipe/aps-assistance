import { useState, useEffect, useRef } from 'react'
import { FiSend, FiCheck, FiAlertCircle, FiTool, FiX, FiChevronDown, FiSearch } from 'react-icons/fi'

export default function PublicForm({ onClose, folders: foldersProp, allTags: allTagsProp, onSuccess, onLoadTags }) {
  const isEmbedded = !!onClose
  const [folders, setFolders] = useState(foldersProp || [])
  const [allTags, setAllTags] = useState(allTagsProp || [])
  const [selectedTags, setSelectedTags] = useState([])
  const [form, setForm] = useState({ title: '', sistema: '', contexto: '', resolucao: '' })
  const [status, setStatus] = useState(isEmbedded ? 'ready' : 'loading')
  const [message, setMessage] = useState('')
  const [tagSearch, setTagSearch] = useState('')
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false)
  const tagRef = useRef(null)

  useEffect(() => {
    if (isEmbedded) {
      setFolders(foldersProp || [])
      setAllTags(allTagsProp || [])
      return
    }
    fetch('/api/public/folders-tags')
      .then(r => r.json())
      .then(data => {
        setFolders(data.folders || [])
        setAllTags(data.tags || [])
        setStatus('ready')
      })
      .catch(() => setStatus('error'))
  }, [isEmbedded, foldersProp, allTagsProp])

  useEffect(() => {
    const handleClick = (e) => {
      if (tagRef.current && !tagRef.current.contains(e.target)) {
        setTagDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const toggleTag = (tag) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    )
  }

  const filteredTags = allTags.filter(t =>
    t.toLowerCase().includes(tagSearch.toLowerCase()) && !selectedTags.includes(t)
  )

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
        if (isEmbedded && onSuccess) {
          onSuccess()
        } else {
          setStatus('success')
          setMessage('Erro cadastrado com sucesso!')
        }
      } else {
        setStatus(isEmbedded ? 'ready' : 'ready')
        setMessage(data.error || 'Erro ao cadastrar')
      }
    } catch (e) {
      setStatus(isEmbedded ? 'ready' : 'ready')
      setMessage('Erro de conexao')
    }
  }

  const handleReset = () => {
    setForm({ title: '', sistema: '', contexto: '', resolucao: '' })
    setSelectedTags([])
    setMessage('')
    setStatus('ready')
  }

  if (!isEmbedded && status === 'loading') {
    return (
      <div className="public-form-page">
        <div className="public-form-card">
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px' }}>Carregando...</p>
        </div>
      </div>
    )
  }

  if (!isEmbedded && status === 'success') {
    return (
      <div className="public-form-page">
        <div className="public-form-card" style={{ textAlign: 'center', padding: '60px 32px' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#10b98120', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <FiCheck size={32} color="#10b981" />
          </div>
          <h2 style={{ margin: '0 0 8px', color: 'var(--text-primary)' }}>Erro Cadastrado!</h2>
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>Obrigado por reportar. O erro foi salvo no sistema.</p>
          <button className="public-submit-btn" style={{ marginTop: '24px', maxWidth: '200px' }} onClick={handleReset}>
            Cadastrar outro
          </button>
        </div>
      </div>
    )
  }

  const formContent = (
    <>
      <div className="public-form-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'linear-gradient(135deg, #3b82f6, #2563eb)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <FiTool size={20} color="#fff" />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: '18px' }}>Cadastrar Erro</h1>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>Preencha os dados do erro</p>
            </div>
          </div>
          {isEmbedded && (
            <button onClick={onClose} style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-muted)', borderRadius: '8px', padding: '8px', cursor: 'pointer' }}>
              <FiX size={18} />
            </button>
          )}
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

        <div className="public-field" ref={tagRef}>
          <label>Tags</label>
          {selectedTags.length > 0 && (
            <div className="public-tags-selected">
              {selectedTags.map(tag => (
                <span key={tag} className="public-tag-chip">
                  {tag}
                  <FiX size={12} style={{ cursor: 'pointer' }} onClick={() => toggleTag(tag)} />
                </span>
              ))}
            </div>
          )}
          <div className="public-combobox">
            <div
              className="public-combobox-trigger"
              onClick={() => setTagDropdownOpen(!tagDropdownOpen)}
            >
              <FiSearch size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              <input
                type="text"
                placeholder={selectedTags.length ? 'Adicionar mais tag...' : 'Buscar tag...'}
                value={tagSearch}
                onChange={e => { setTagSearch(e.target.value); setTagDropdownOpen(true) }}
                onFocus={() => setTagDropdownOpen(true)}
                style={{ background: 'none', border: 'none', color: 'var(--text-primary)', outline: 'none', flex: 1, fontSize: '13px' }}
              />
              <FiChevronDown size={14} style={{ color: 'var(--text-muted)', transform: tagDropdownOpen ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }} />
            </div>
            {tagDropdownOpen && filteredTags.length > 0 && (
              <div className="public-combobox-dropdown">
                {filteredTags.slice(0, 20).map(tag => (
                  <div
                    key={tag}
                    className="public-combobox-option"
                    onClick={() => { toggleTag(tag); setTagSearch(''); setTagDropdownOpen(false) }}
                  >
                    {tag}
                  </div>
                ))}
              </div>
            )}
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
    </>
  )

  if (isEmbedded) {
    return (
      <div className="public-form-embedded">
        <div className="public-form-card">
          {formContent}
        </div>
      </div>
    )
  }

  return (
    <div className="public-form-page">
      <div className="public-form-card">
        {formContent}
      </div>
    </div>
  )
}
