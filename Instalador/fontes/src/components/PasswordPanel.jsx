import { useState } from 'react'
import { FiCopy, FiCheck, FiLock } from 'react-icons/fi'

const sistemas = [
  {
    nome: 'SCG-WIN',
    cor: '#3b82f6',
    usuario: 'aps',
    getSenha: (mes, dia) => `aps${mes + 20}${dia + 5}`
  },
  {
    nome: 'CORPORE',
    cor: '#f97316',
    usuario: 'aps',
    getSenha: (mes, dia) => `aps${mes + 10}${dia + 10}`
  },
  {
    nome: 'OFICINA-WIN',
    cor: '#fb923c',
    usuario: 'aps',
    getSenha: (_, dia) => `aps${dia + 10}`
  },
  {
    nome: 'OPTIMUS',
    cor: '#92400e',
    usuario: 'aps',
    getSenha: (_, dia) => `aps${dia + 10}`
  },
  {
    nome: 'ÁGILIS',
    cor: '#60a5fa',
    usuario: 'aps',
    getSenha: (_, dia) => `aps${dia + 10}`
  },
  {
    nome: 'APURAÇÕES / DFE',
    cor: '#8b5cf6',
    usuario: 'APS',
    getSenha: (mes, dia) => `APS${mes + 10}${dia + 10}`
  },
  {
    nome: 'GÊNIX',
    cor: '#10b981',
    usuario: 'master',
    getSenha: (_, dia) => `master${dia + 10}`
  },
  {
    nome: 'CUMMINS',
    cor: '#e5e7eb',
    usuario: '1',
    getSenha: () => '1'
  }
]

export default function PasswordPanel() {
  const [copied, setCopied] = useState(null)

  const hoje = new Date()
  const mes = hoje.getMonth() + 1
  const dia = hoje.getDate()

  const handleCopy = (texto, index) => {
    navigator.clipboard.writeText(texto)
    setCopied(index)
    setTimeout(() => setCopied(null), 1500)
  }

  return (
    <div className="password-panel">
      <div className="password-header">
        <FiLock size={16} />
        <span>Senhas do Dia</span>
        <span className="password-date">{dia.toString().padStart(2, '0')}/{mes.toString().padStart(2, '0')}</span>
      </div>
      <div className="password-grid">
        {sistemas.map((sistema, index) => {
          const senha = sistema.getSenha(mes, dia)
          return (
            <div
              key={sistema.nome}
              className="password-card"
              style={{ borderColor: sistema.cor }}
            >
              <div className="password-card-header">
                <span className="password-nome" style={{ color: sistema.cor }}>
                  {sistema.nome}
                </span>
                <button
                  className="password-copy"
                  onClick={() => handleCopy(`${sistema.usuario}\n${senha}`, index)}
                  title="Copiar usuario e senha"
                >
                  {copied === index ? <FiCheck size={12} /> : <FiCopy size={12} />}
                </button>
              </div>
              <div className="password-creds">
                <div className="password-field">
                  <span className="password-label">Usuario:</span>
                  <span className="password-value">{sistema.usuario}</span>
                </div>
                <div className="password-field">
                  <span className="password-label">Senha:</span>
                  <span className="password-value">{senha}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
