import { FiCheckCircle, FiAlertCircle } from 'react-icons/fi'

export default function Toast({ show, message, type }) {
  return (
    <div className={`toast ${show ? 'show' : ''} ${type === 'error' ? 'error' : ''}`}>
      {type === 'error' ? <FiAlertCircle size={16} /> : <FiCheckCircle size={16} />}
      {message}
    </div>
  )
}
