/* ============================================================
   main.jsx — Ponto de entrada da aplicação APS Assistance
   Responsável por montar o React na raiz do HTML e carregar
   os estilos globais da aplicação.
   ============================================================ */

// ===== Imports necessários =====
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/global.css'

// ===== Renderização da aplicação =====
// Monta o componente App dentro do elemento #root do index.html
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
