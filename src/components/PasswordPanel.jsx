/**
 * PasswordPanel.jsx - Painel de Senhas do Dia.
 * Calcula e exibe as senhas rotativas de cada sistema. A senha muda todo dia,
 * pois é derivada do mês e do dia atuais por uma função própria de cada sistema.
 */
import { useState } from 'react'
import { FiCopy, FiCheck, FiLock } from 'react-icons/fi'

// ===== SISTEMAS =====
// Base de sistemas com usuário e a função geradora da senha rotativa do dia.
// Exemplo: SCG-WIN usa "aps" + (mês + 20) + (dia + 5); o resultado muda diariamente.
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
  // Índice do sistema copiado, para mostrar o "check" de copiado por 1,5s
  const [copied, setCopied] = useState(null)

  // Data atual: mês e dia alimentam a geração das senhas rotativas
  const hoje = new Date()
  const mes = hoje.getMonth() + 1
  const dia = hoje.getDate()

  // Copia usuário + senha para a área de transferência e exibe o check temporário
  const handleCopy = (texto, index) => {
    navigator.clipboard.writeText(texto)
    setCopied(index)
    setTimeout(() => setCopied(null), 1500)
  }

  return (
    <div className="password-panel">
      {/* ===== RENDERIZAÇÃO ===== */}
      {/* Cabeçalho do painel com a data de hoje */}
      <div className="password-header">
        <FiLock size={16} />
        <span>Senhas do Dia</span>
        <span className="password-date">{dia.toString().padStart(2, '0')}/{mes.toString().padStart(2, '0')}</span>
      </div>
      {/* Grid com o card de cada sistema: usuário e senha gerada para o dia */}
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
