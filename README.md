# APS Assistance

Catálogo de erros e soluções para sistemas ERP fiscais brasileiros.

## O que é

O APS Assistance é um aplicativo web para catalogar, buscar e compartilhar erros e suas soluções em sistemas como SCGWIN, AGILIS, CORPORE, SGNFE e outros. O app possui três módulos:

- **APS** — Catálogo principal de erros organizados por pastas (sistemas), com dashboard, buscas avançadas, tags, favoritos, lixeira e relatórios.
- **Diário** — Registro de ocorrências do dia a dia com categorias, prioridades, turnos e autores.
- **Ferramentas** — Utilitários fiscais: códigos de observação, status SEFAZ (NFe), consulta de CNPJ, decodificador de chave de acesso NFe, tabelas de referência (CFOP, CST).

## Pré-requisitos

- [Node.js](https://nodejs.org/) 18+
- npm (vem com o Node)
- Python 3 (apenas para gerar a documentação técnica .docx)

## Instalação

```bash
cd pas-interface
npm install
```

## Como rodar

### Desenvolvimento

```bash
npm run dev
```

Inicia o servidor backend (porta 3000) e o Vite dev server (porta 5173) simultaneamente.

### Produção

```bash
npm run build
npm start
```

Ou execute o script `Iniciar.bat` no Windows, que faz tudo automaticamente:

1. Verifica se o Node.js está instalado
2. Instala dependências se necessário
3. Pergunta o token do bot Telegram (opcional)
4. Mata processos node existentes
5. Faz o build de produção
6. Inicia o servidor

Acesse: **http://localhost:3000**

## Atalhos de teclado

| Atalho | Ação |
|--------|------|
| `Ctrl+K` | Buscar |
| `Ctrl+N` | Novo erro |
| `Ctrl+/` | Ver atalhos |
| `Esc` | Fechar popup/painel |

## Tema

O app possui tema **escuro** (padrão) e **claro**. Alterne pelo botão de tema no header.

## Formulário público

Acesse `/cadastrar` para permitir que outros usuários registrem erros sem precisar abrir o app. O formulário salva os erros diretamente no catálogo.

## Bot Telegram

Configure o bot Telegram para receber notificações, buscar erros e criar registros direto pelo chat.

1. Crie um bot via [@BotFather](https://t.me/BotFather)
2. No app, vá em **Ferramentas > Configurações** e insira o token
3. Inicie o bot no Telegram com `/start`

## Stack

| Camada | Tecnologia |
|--------|------------|
| Frontend | React 18, Vite 5 |
| Backend | Express 4, Socket.IO |
| Ícones | react-icons |
| Bot | node-telegram-bot-api |
| Persistência | Arquivos .md e JSON (sem banco de dados) |

## Estrutura do projeto

```
pas-interface/
├── src/                    # Frontend React
│   ├── App.jsx             # Componente raiz (orquestra tudo)
│   ├── main.jsx            # Ponto de entrada
│   ├── services/api.js     # Cliente HTTP para o backend
│   ├── styles/global.css   # Estilos + temas
│   ├── data/               # Tabelas fiscais (CFOP, CST)
│   └── components/         # Todos os painéis e componentes
├── server/                 # Backend
│   ├── index.js            # Servidor Express + Socket.IO
│   └── telegram-bot.js     # Bot Telegram
├── public/                 # Assets estáticos
├── dist/                   # Build de produção
├── Iniciar.bat             # Launcher Windows
└── package.json
```
