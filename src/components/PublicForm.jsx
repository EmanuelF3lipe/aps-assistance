/* ============================================================
   PublicForm.jsx — Formulário público de cadastro de erros
   Usado tanto em modo standalone (página própria) quanto
   embutido (modal). Carrega pastas e tags da API e envia o
   novo erro para o endpoint público.
   ============================================================ */

// ===== Imports =====
import { useState, useEffect, useRef } from 'react'
import { FiSend, FiCheck, FiAlertCircle, FiX, FiChevronDown, FiSearch } from 'react-icons/fi'

// ===== Componente PublicForm =====
// Props: onClose (fecha se embutido), folders/allTags (dados), onSuccess e onLoadTags
export default function PublicForm({ onClose, folders: foldersProp, allTags: allTagsProp, onSuccess, onLoadTags }) {
  // ===== States do componente =====
  const isEmbedded = !!onClose                          // True quando renderizado dentro de um modal
  const [folders, setFolders] = useState(foldersProp || [])       // Pastas/sistemas disponíveis
  const [allTags, setAllTags] = useState(allTagsProp || [])       // Todas as tags disponíveis
  const [selectedTags, setSelectedTags] = useState([])            // Tags selecionadas pelo usuário
  const [form, setForm] = useState({ title: '', sistema: '', contexto: '', resolucao: '' })
  const [status, setStatus] = useState(isEmbedded ? 'ready' : 'loading') // Estado: loading/ready/success/error/submitting
  const [message, setMessage] = useState('')                      // Mensagem de feedback (sucesso/erro)
  const [tagSearch, setTagSearch] = useState('')                  // Texto de busca de tags
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false)   // Abre/fecha o dropdown de tags
  const tagRef = useRef(null)                                     // Referência para detectar clique fora do dropdown

  // ===== Efeito: carrega pastas e tags da API (modo standalone) =====
  useEffect(() => {
    if (isEmbedded) {
      // No modo embutido os dados vêm das props
      setFolders(foldersProp || [])
      setAllTags(allTagsProp || [])
      return
    }
    // No modo standalone busca os dados da API
    fetch('/api/public/folders-tags')
      .then(r => r.json())
      .then(data => {
        setFolders(data.folders || [])
        setAllTags(data.tags || [])
        setStatus('ready')
      })
      .catch(() => setStatus('error'))
  }, [isEmbedded, foldersProp, allTagsProp])

  // ===== Efeito: fecha o dropdown ao clicar fora dele =====
  useEffect(() => {
    const handleClick = (e) => {
      if (tagRef.current && !tagRef.current.contains(e.target)) {
        setTagDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // ===== Handler: adiciona ou remove uma tag da seleção =====
  const toggleTag = (tag) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    )
  }

  // ===== Dados derivados: tags filtradas pela busca (sem as já selecionadas) =====
  const filteredTags = allTags.filter(t =>
    t.toLowerCase().includes(tagSearch.toLowerCase()) && !selectedTags.includes(t)
  )

  // ===== Dados derivados: nomes das pastas em formato de texto =====
  const folderNames = folders
    .map(f => (typeof f === 'string' ? f : (f.name || f.path)))
    .filter(Boolean)

  // ===== Handler: envia o formulário para a API pública =====
  const handleSubmit = async () => {
    // Validação dos campos obrigatórios
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
        // Em modo embutido chama o callback onSuccess; em standalone mostra a tela de sucesso
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

  // ===== Handler: limpa o formulário para um novo cadastro =====
  const handleReset = () => {
    setForm({ title: '', sistema: '', contexto: '', resolucao: '' })
    setSelectedTags([])
    setMessage('')
    setStatus('ready')
  }

  // ===== Renderização: tela de carregamento (modo standalone) =====
  if (!isEmbedded && status === 'loading') {
    return (
      <div className="public-form-page">
        <div className="public-form-card">
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px' }}>Carregando...</p>
        </div>
      </div>
    )
  }

  // ===== Renderização: tela de sucesso após cadastro (modo standalone) =====
  if (!isEmbedded && status === 'success') {
    return (
      <div className="public-form-page">
        <div className="public-form-card" style={{ textAlign: 'center', padding: '60px 32px' }}>
          {/* Ícone de sucesso */}
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#10b98120', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <FiCheck size={32} color="#10b981" />
          </div>
          <h2 style={{ margin: '0 0 8px', color: 'var(--text-primary)' }}>Erro Cadastrado!</h2>
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>Obrigado por reportar. O erro foi salvo no sistema.</p>
          {/* Botão para cadastrar outro erro */}
          <button className="public-submit-btn" style={{ marginTop: '24px', maxWidth: '200px' }} onClick={handleReset}>
            Cadastrar outro
          </button>
        </div>
      </div>
    )
  }

  // ===== Conteúdo principal do formulário (usado nos dois modos) =====
  const formContent = (
    <>
      {/* ===== Cabeçalho do formulário com logo e botão de fechar (se embutido) ===== */}
      <div className="public-form-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ textAlign: 'center', flex: 1 }}>
            <img src="/logo.png" alt="APS | Negocios Digitais" style={{ height: '48px', marginBottom: '8px' }} />
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>Preencha os dados do erro</p>
          </div>
          {isEmbedded && (
            <button onClick={onClose} style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-muted)', borderRadius: '8px', padding: '8px', cursor: 'pointer', position: 'absolute', right: '16px', top: '16px' }}>
              <FiX size={18} />
            </button>
          )}
        </div>
      </div>

      <div className="public-form-body">
        {/* ===== Campo: título do erro (obrigatório) ===== */}
        <div className="public-field">
          <label>Titulo do erro *</label>
          <input
            type="text"
            placeholder="Ex: Erro ao emitir NF"
            value={form.title}
            onChange={e => setForm({ ...form, title: e.target.value })}
          />
        </div>

        {/* ===== Campo: sistema (obrigatório) com seleção por rádio ===== */}
          <div className="public-field">
            <label>Sistema *</label>
            <div className="public-radio-group">
              {folderNames.map(f => (
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

        {/* ===== Campo: contexto / quando o erro acontece ===== */}
        <div className="public-field">
          <label>Contexto / Quando acontece</label>
          <textarea
            placeholder="Descreva em que situacao o erro ocorre..."
            rows={3}
            value={form.contexto}
            onChange={e => setForm({ ...form, contexto: e.target.value })}
          />
        </div>

        {/* ===== Campo: resolução passo a passo ===== */}
        <div className="public-field">
          <label>Resolucao (passo a passo)</label>
          <textarea
            placeholder="Descreva como resolver o erro..."
            rows={5}
            value={form.resolucao}
            onChange={e => setForm({ ...form, resolucao: e.target.value })}
          />
        </div>

        {/* ===== Campo: seleção de tags (combobox com busca) ===== */}
        <div className="public-field" ref={tagRef}>
          <label>Tags</label>
          {/* Chips das tags já selecionadas */}
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
            {/* Campo de busca que abre o dropdown de tags */}
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
            {/* Dropdown com as tags filtradas */}
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

        {/* ===== Mensagem de feedback (sucesso ou erro) ===== */}
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

        {/* ===== Botão de envio do formulário ===== */}
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

  // ===== Renderização final conforme o modo (embutido ou página) =====
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
