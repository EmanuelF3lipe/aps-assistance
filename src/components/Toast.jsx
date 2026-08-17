/* ============================================================
   Toast.jsx — Notificação de feedback visual (sucesso/erro)
   Exibe uma mensagem temporária no canto da tela.
   ============================================================ */

// ===== Imports =====
import { FiCheckCircle, FiAlertCircle } from 'react-icons/fi'

// ===== Componente Toast =====
// Recebe as props: show (visibilidade), message (texto) e type (sucesso/erro)
export default function Toast({ show, message, type }) {
  return (
    // ===== Renderização da notificação =====
    // Aplica a classe 'show' para exibir e 'error' para estilizar erros
    <div className={`toast ${show ? 'show' : ''} ${type === 'error' ? 'error' : ''}`}>
      {/* Ícone conforme o tipo da mensagem (erro ou sucesso) */}
      {type === 'error' ? <FiAlertCircle size={16} /> : <FiCheckCircle size={16} />}
      {message}
    </div>
  )
}
