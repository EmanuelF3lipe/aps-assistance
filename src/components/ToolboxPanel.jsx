/*
 * ToolboxPanel — Painel "Caixa de Ferramentas".
 * Agrupa utilitarios do dia a dia de suporte em 6 abas:
 *   1. Descontos e %  -> calculos de desconto, valor original e percentual
 *   2. 1 Centavo      -> diferenca de centavos e parcelas com resto (PEDVENDPRAZOS)
 *   3. SEFAZ / NFe    -> verifica disponibilidade dos autorizadores SEFAZ + links
 *   4. Codigos        -> consulta de CFOP e CSTs (PIS, COFINS, IPI, ICMS) via fiscalTables
 *   5. CNPJ           -> consulta de CNPJ (BrasilAPI/ReceitaWS + opcional SINTEGRA)
 *   6. NFe            -> valida e decodifica chave de acesso de 44 digitos
 */
import { useEffect, useState } from 'react'
import { FiPercent, FiHash, FiServer, FiCopy, FiCheck, FiRefreshCw, FiExternalLink, FiSave, FiAlertCircle, FiUser, FiFileText } from 'react-icons/fi'
import { api } from '../services/api'
import { CFOP_LIST, CST_PIS, CST_COFINS, CST_IPI, CST_ICMS } from '../data/fiscalTables'

// Links diretos para o portal nacional NFe e para as SEFAZ de cada UF
const SEFAZ_LINKS = [
  { uf: 'BR', nome: 'Portal Nacional NFe', url: 'https://www.nfe.fazenda.gov.br/portal/disponibilidade.aspx' },
  { uf: 'RS', nome: 'SEFAZ RS', url: 'https://www.sefaz.rs.gov.br/' },
  { uf: 'SP', nome: 'SEFAZ SP', url: 'https://portal.fazenda.sp.gov.br/' },
  { uf: 'MG', nome: 'SEFAZ MG', url: 'https://www.fazenda.mg.gov.br/' },
  { uf: 'PR', nome: 'SEFAZ PR', url: 'https://www.fazenda.pr.gov.br/' },
  { uf: 'SC', nome: 'SEFAZ SC', url: 'https://www.sefaz.sc.gov.br/' },
  { uf: 'RJ', nome: 'SEFAZ RJ', url: 'http://www.fazenda.rj.gov.br/sefaz/' },
  { uf: 'BA', nome: 'SEFAZ BA', url: 'http://www.sefaz.ba.gov.br/' },
  { uf: 'GO', nome: 'SEFAZ GO', url: 'https://www.goias.gov.br/servico/sefaz' },
  { uf: 'MT', nome: 'SEFAZ MT', url: 'https://www5.sefaz.mt.gov.br/' },
  { uf: 'MS', nome: 'SEFAZ MS', url: 'https://www.sefaz.ms.gov.br/' },
  { uf: 'PE', nome: 'SEFAZ PE', url: 'https://www.sefaz.pe.gov.br/' }
]

// SQL pronto para consultar parcelas no PEDVENDPRAZOS (aba "1 Centavo")
const SQL_PEDVEND = `SELECT * FROM PEDVENDPRAZOS WHERE CODPEDVEND = [COD_PEDIDO]`

// Formata um numero como moeda brasileira (R$)
function fmtMoney(v) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// Botao padrao das abas da caixa de ferramentas (destaca a aba ativa)
function TabButton({ active, onClick, icon, label }) {
  return (
    <button className={`toolbox-tab ${active ? 'active' : ''}`} onClick={onClick}>
      {icon} {label}
    </button>
  )
}

// Caixa de resultado com cor condicional (ok = verde, warn = amarelo)
function ResultBox({ ok, children }) {
  return <div className={`toolbox-result ${ok ? 'ok' : 'warn'}`}>{children}</div>
}

// Cores por status de disponibilidade (verde/amarelo/vermelho)
const STATUS_COLORS = { verde: '#10b981', amarelo: '#f59e0b', vermelho: '#ef4444' }

// Ponto colorido que indica o status de um servico/autorizador
function StatusDot({ status }) {
  return (
    <span
      title={status ? (status === 'verde' ? 'Online' : status === 'amarelo' ? 'Instavel' : 'Offline') : 'Sem dados'}
      style={{
        display: 'inline-block',
        width: '10px',
        height: '10px',
        borderRadius: '50%',
        background: STATUS_COLORS[status] || 'rgba(255,255,255,0.15)'
      }}
    />
  )
}

// Celula da tabela SEFAZ: bolinha de status + rotulo (Online/Instavel/Offline)
function SefaStatusCell({ status }) {
  return (
    <td>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>
        <StatusDot status={status} />
        {status ? (status === 'verde' ? 'Online' : status === 'amarelo' ? 'Instavel' : 'Offline') : '-'}
      </span>
    </td>
  )
}

// Tabela de disponibilidade dos autorizadores SEFAZ: resume servicos com problema,
// contingencias (SVC-AN/SVC-RS) e mostra o status de cada autorizador por operacao
function SefaStatusTable({ data }) {
  const problems = data.rows.filter(r =>
    ['autorizacao', 'retorno', 'inutilizacao', 'consultaProtocolo', 'statusServico', 'consultaCadastro', 'recepcaoEvento']
      .some(k => r[k] === 'vermelho' || r[k] === 'amarelo')
  )
  const allGreen = data.rows.length > 0 && problems.length === 0
  const hasContingencia = !!(data.contingencia && (data.contingencia.svcan || data.contingencia.svcrs))
  return (
    <div className="toolbox-sefa">
      <div className="toolbox-sefa-meta">
        <div>
          {allGreen ? (
            <span className="toolbox-chip chip-ok"><StatusDot status="verde" /> Todos os autorizadores online</span>
          ) : (
            <span className="toolbox-chip chip-warn"><StatusDot status="amarelo" /> {problems.length} autorizador(es) com servico instavel ou offline</span>
          )}
        </div>
        {data.checkedAt && <div className="toolbox-sefa-time">Ultima verificacao: <strong>{data.checkedAt}</strong></div>}
      </div>
      {problems.length > 0 && (
        <div className="toolbox-sefa-problems">
          {problems.map(p => (
            <div className="toolbox-sefa-problem" key={p.uf}>
              <strong>{p.uf}</strong>:{' '}
              {['autorizacao', 'retorno', 'inutilizacao', 'consultaProtocolo', 'statusServico', 'consultaCadastro', 'recepcaoEvento']
                .filter(k => p[k] === 'vermelho' || p[k] === 'amarelo')
                .map(k => `${k} (${p[k]})`)
                .join(', ')}
            </div>
          ))}
        </div>
      )}
      {hasContingencia && (
        <div className="toolbox-sefa-cont">
          {data.contingencia.svcan && <div><strong>SVC-AN:</strong> {data.contingencia.svcan}</div>}
          {data.contingencia.svcrs && <div><strong>SVC-RS:</strong> {data.contingencia.svcrs}</div>}
        </div>
      )}
      <table className="toolbox-sefa-table">
        <thead>
          <tr>
            <th>Autorizador</th>
            <th>Autorizacao</th>
            <th>Retorno</th>
            <th>Inutilizacao</th>
            <th>Cons. Protocolo</th>
            <th>Status Servico</th>
            <th>Tempo Med.</th>
            <th>Cons. Cadastro</th>
            <th>Rec. Evento</th>
          </tr>
        </thead>
        <tbody>
          {data.rows.map(r => (
            <tr key={r.uf}>
              <td className="toolbox-sefa-uf">{r.uf}</td>
              <SefaStatusCell status={r.autorizacao} />
              <SefaStatusCell status={r.retorno} />
              <SefaStatusCell status={r.inutilizacao} />
              <SefaStatusCell status={r.consultaProtocolo} />
              <SefaStatusCell status={r.statusServico} />
              <td style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{r.tempoMedio && r.tempoMedio !== '-' ? r.tempoMedio : '-'}</td>
              <SefaStatusCell status={r.consultaCadastro} />
              <SefaStatusCell status={r.recepcaoEvento} />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function ToolboxPanel() {
  // Aba ativa da caixa de ferramentas (calculo | diferenca | sefaz | cfop | cnpj | nfe)
  const [tab, setTab] = useState('calculo')

  // Tab 1 - calculos (entradas dos 3 cards: desconto, valor original, X % de Y)
  const [v1, setV1] = useState('')
  const [p1, setP1] = useState('')
  const [v2, setV2] = useState('')
  const [p2, setP2] = useState('')
  const [v3, setV3] = useState('')
  const [y3, setY3] = useState('')

  // Tab 2 - 1 centavo (valores esperado/informado, parcelas e flag do SQL copiado)
  const [esp, setEsp] = useState('')
  const [inf, setInf] = useState('')
  const [totParc, setTotParc] = useState('')
  const [nParc, setNParc] = useState('')
  const [sqlCopied, setSqlCopied] = useState(false)

  // Tab 3 - SEFAZ (resultado da verificacao de disponibilidade + flag de carregamento)
  const [sefaStatus, setSefaStatus] = useState(null)
  const [sefaLoading, setSefaLoading] = useState(false)

  // Tab 4 - Codigos (CFOP + CST): filtro de CFOP, subaba ativa e filtro de CST
  const [cfopFilter, setCfopFilter] = useState('')
  const [codSubTab, setCodSubTab] = useState('cfop')
  const [cstFilter, setCstFilter] = useState('')

  // Tab 5 - CNPJ (entrada, carregamento, resultado, erro, chave SINTEGRA e mensagem de salvamento)
  const [cnpjInput, setCnpjInput] = useState('')
  const [cnpjLoading, setCnpjLoading] = useState(false)
  const [cnpjResult, setCnpjResult] = useState(null)
  const [cnpjError, setCnpjError] = useState('')
  const [sintegraKey, setSintegraKey] = useState('')
  const [sintegraConfigured, setSintegraConfigured] = useState(false)
  const [keySavedMsg, setKeySavedMsg] = useState('')

  // Tab 6 - NFe (chave de acesso, resultado decodificado, erro e flag da chave copiada)
  const [nfeInput, setNfeInput] = useState('')
  const [nfeResult, setNfeResult] = useState(null)
  const [nfeError, setNfeError] = useState('')
  const [chaveCopied, setChaveCopied] = useState(false)

  // Ao montar o painel, verifica se a chave SINTEGRA ja foi configurada
  useEffect(() => {
    api.getToolboxConfig().then(cfg => {
      setSintegraConfigured(!!cfg.sintegraConfigured)
    }).catch(() => {})
  }, [])

  // Consulta a disponibilidade dos servicos SEFAZ/NFe na API
  const checkSefa = async () => {
    setSefaLoading(true)
    setSefaStatus(null)
    const res = await api.getSefaStatus().catch(e => ({ ok: false, error: e.message }))
    setSefaStatus(res)
    setSefaLoading(false)
  }

  // Copia texto para a area de transferencia e mostra "Copiado!" por 2 segundos
  const copyText = (text) => {
    navigator.clipboard?.writeText(text)
    setSqlCopied(true)
    setTimeout(() => setSqlCopied(false), 2000)
  }

  // Calculos da aba "1 Centavo": diferenca entre valores e resto das parcelas
  const diff = (Number(esp) || 0) - (Number(inf) || 0)
  const diffOk = Math.abs(diff) < 0.005

  const parcela = nParc > 0 ? (Number(totParc) || 0) / Number(nParc) : 0
  const resto = parcela > 0 ? Number(totParc) - (Math.round(parcela * 100) / 100) * Number(nParc) : 0

  // Filtra os CFOPs pelo codigo, descricao ou aplicacao (ignora pontos e espacos)
  const filteredCfops = CFOP_LIST.filter(c => {
    const q = cfopFilter.trim().toLowerCase().replace(/\./g, '')
    if (!q) return true
    return c.num.includes(q) || c.desc.toLowerCase().includes(q) || c.aplicacao.toLowerCase().includes(q)
  })

  // Filtra listas de CST (PIS/COFINS/IPI/ICMS) por codigo, descricao ou grupo
  const filteredCsts = (list) => {
    const q = cstFilter.trim().toLowerCase()
    if (!q) return list
    return list.filter(c => c.cst.includes(q) || c.desc.toLowerCase().includes(q) || (c.grupo && c.grupo.toLowerCase().includes(q)))
  }

  // Consulta CNPJ na API (valida 14 digitos; forceRefresh ignora o cache local)
  const consultaCnpj = async (forceRefresh = false) => {
    const digits = cnpjInput.replace(/\D/g, '')
    if (digits.length !== 14) {
      setCnpjError('Digite o CNPJ com 14 digitos (somente numeros)')
      return
    }
    setCnpjLoading(true)
    setCnpjError('')
    setCnpjResult(null)
    const r = await api.getCnpj(digits, forceRefresh).catch(e => ({ ok: false, error: e.message }))
    if (r.ok) {
      setCnpjResult(r)
    } else {
      setCnpjError(r.error || 'Falha na consulta')
    }
    setCnpjLoading(false)
  }

  // Valida e decodifica a chave de acesso NFe (exige 44 digitos)
  const consultaNfe = async () => {
    const chave = nfeInput.replace(/\D/g, '')
    if (chave.length !== 44) {
      setNfeError('A chave de acesso deve ter 44 digitos')
      return
    }
    setNfeError('')
    setNfeResult(null)
    const r = await api.getNfeChave(chave).catch(e => ({ ok: false, error: e.message }))
    if (r.ok) setNfeResult(r)
    else setNfeError(r.error || 'Falha ao validar a chave')
  }

  // Formata CNPJ (00.000.000/0000-00) e chave NFe (grupos de 4) para exibicao
  const formatCnpj = (c) => c ? c.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : ''
  const formatChave = (c) => c ? c.replace(/^(\d{4})(\d{4})(\d{4})(\d{4})(\d{4})(\d{4})(\d{4})(\d{4})(\d{4})(\d{4})(\d{4})$/, '$1 $2 $3 $4 $5 $6 $7 $8 $9 $10 $11') : ''

  // Salva a chave SINTEGRA na configuracao da API e mostra mensagem de sucesso/erro
  const saveSintegraKey = async () => {
    const key = sintegraKey.trim()
    if (!key) return
    const r = await api.setToolboxConfig(key).catch(() => null)
    setSintegraConfigured(!!(r && r.sintegraConfigured))
    setKeySavedMsg(r && r.sintegraConfigured ? 'Chave Sintegra salva!' : 'Falha ao salvar a chave')
    setTimeout(() => setKeySavedMsg(''), 3000)
  }

  return (
    <div className="dashboard toolbox">
      {/* Barra com as 6 abas da caixa de ferramentas: Descontos, 1 Centavo, SEFAZ, Codigos, CNPJ e NFe */}
      <div className="toolbox-tabs">
        <TabButton active={tab === 'calculo'} onClick={() => setTab('calculo')} icon={<FiPercent size={14} />} label="Descontos e %" />
        <TabButton active={tab === 'diferenca'} onClick={() => setTab('diferenca')} icon={<FiHash size={14} />} label="1 Centavo" />
        <TabButton active={tab === 'sefaz'} onClick={() => setTab('sefaz')} icon={<FiServer size={14} />} label="SEFAZ / NFe" />
        <TabButton active={tab === 'cfop'} onClick={() => setTab('cfop')} icon={<FiHash size={14} />} label="Codigos" />
        <TabButton active={tab === 'cnpj'} onClick={() => setTab('cnpj')} icon={<FiUser size={14} />} label="CNPJ" />
        <TabButton active={tab === 'nfe'} onClick={() => setTab('nfe')} icon={<FiFileText size={14} />} label="NFe" />
      </div>

            {/* Aba 1 - Descontos e %: desconto sobre valor, valor original e X % de Y */}
      {tab === 'calculo' && (
        <div className="toolbox-grid">
          <div className="toolbox-card">
            <h3>Desconto sobre valor</h3>
            <label>Valor (R$)</label>
            <input type="number" step="0.01" value={v1} onChange={e => setV1(e.target.value)} placeholder="0,00" />
            <label>Percentual (%)</label>
            <input type="number" step="0.01" value={p1} onChange={e => setP1(e.target.value)} placeholder="0,00" />
            {v1 !== '' && p1 !== '' && (
              <ResultBox ok>
                <div>Desconto: <strong>{fmtMoney((Number(v1) * Number(p1)) / 100)}</strong></div>
                <div>Total a pagar: <strong>{fmtMoney(Number(v1) - (Number(v1) * Number(p1)) / 100)}</strong></div>
              </ResultBox>
            )}
          </div>

          <div className="toolbox-card">
            <h3>Valor original (com % ja aplicado)</h3>
            <label>Valor com desconto (R$)</label>
            <input type="number" step="0.01" value={v2} onChange={e => setV2(e.target.value)} placeholder="0,00" />
            <label>Percentual aplicado (%)</label>
            <input type="number" step="0.01" value={p2} onChange={e => setP2(e.target.value)} placeholder="0,00" />
            {v2 !== '' && p2 !== '' && Number(p2) < 100 && (
              <ResultBox ok>
                <div>Valor original: <strong>{fmtMoney((Number(v2) * 100) / (100 - Number(p2)))}</strong></div>
              </ResultBox>
            )}
          </div>

          <div className="toolbox-card">
            <h3>X e quantos % de Y</h3>
            <label>X (parte)</label>
            <input type="number" step="0.01" value={v3} onChange={e => setV3(e.target.value)} placeholder="0,00" />
            <label>Y (total)</label>
            <input type="number" step="0.01" value={y3} onChange={e => setY3(e.target.value)} placeholder="0,00" />
            {v3 !== '' && y3 !== '' && Number(y3) !== 0 && (
              <ResultBox ok>
                <div>X representa <strong>{(Number(v3) / Number(y3)) * 100}%</strong> de Y</div>
              </ResultBox>
            )}
          </div>
        </div>
      )}

      {/* Aba 2 - 1 Centavo: diferenca de valores, parcelas com resto e passo a passo PEDVENDPRAZOS */}
      {tab === 'diferenca' && (
        <div className="toolbox-grid">
          <div className="toolbox-card">
            <h3>Diferenca de valor (1 centavo)</h3>
            <label>Valor esperado (R$)</label>
            <input type="number" step="0.01" value={esp} onChange={e => setEsp(e.target.value)} placeholder="0,00" />
            <label>Valor informado (R$)</label>
            <input type="number" step="0.01" value={inf} onChange={e => setInf(e.target.value)} placeholder="0,00" />
            {esp !== '' && inf !== '' && (
              <ResultBox ok={diffOk}>
                {diffOk ? (
                  <div>Valores conferem! <strong>{fmtMoney(diff)}</strong> de diferenca.</div>
                ) : (
                  <div>Diferenca de <strong>{fmtMoney(diff)}</strong> — nao fecha.</div>
                )}
              </ResultBox>
            )}
          </div>

          <div className="toolbox-card">
            <h3>Parcelas com resto</h3>
            <label>Valor total (R$)</label>
            <input type="number" step="0.01" value={totParc} onChange={e => setTotParc(e.target.value)} placeholder="0,00" />
            <label>Quantidade de parcelas</label>
            <input type="number" step="1" value={nParc} onChange={e => setNParc(e.target.value)} placeholder="0" />
            {totParc !== '' && nParc > 0 && (
              <ResultBox ok={Math.abs(resto) < 0.005}>
                <div>Valor por parcela: <strong>{fmtMoney(Math.round(parcela * 100) / 100)}</strong></div>
                <div>Resto nao distribuido: <strong>{fmtMoney(resto)}</strong> {Math.abs(resto) >= 0.005 && <span>(soma das parcelas nao fecha com o total)</span>}</div>
              </ResultBox>
            )}
          </div>

          <div className="toolbox-card toolbox-card-wide">
            <h3>PEDVENDPRAZOS — valor difere 1 centavo</h3>
            <p className="toolbox-hint">
              Quando o caixa recusa o pagamento alegando diferenca de centavos, confira o cadastro do parcelamento:
              o total das parcelas do pedido pode divergir do total da nota por arredondamento.
            </p>
            <ol className="toolbox-steps">
              <li>Descubra o codigo do pedido no SCG-win (fatura / PEDVENDPRAZOS)</li>
              <li>Consulte os valores cadastrados:</li>
            </ol>
            <div className="toolbox-sql">
              <code>{SQL_PEDVEND}</code>
              <button className="toolbox-copy" onClick={() => copyText(SQL_PEDVEND)}>
                {sqlCopied ? <FiCheck size={13} /> : <FiCopy size={13} />} {sqlCopied ? 'Copiado!' : 'Copiar SQL'}
              </button>
            </div>
            <ol className="toolbox-steps" start={3}>
              <li>Ajuste o valor da parcela divergente para bater com o total da nota</li>
              <li>Tente novamente no caixa — normalmente resolve sem alterar o restante</li>
            </ol>
            <p className="toolbox-note">
              <FiAlertCircle size={13} /> Detalhes completos no catalogo: pasta <em>scgwin</em>, arquivo{' '}
              <em>&quot;PEDVENDPRAZOS - Valor difere 1 centavo&quot;</em>.
            </p>
          </div>
        </div>
      )}

      {/* Aba 3 - SEFAZ/NFe: verificacao de disponibilidade dos autorizadores + links das SEFAZ */}
      {tab === 'sefaz' && (
        <div className="toolbox-grid">
          <div className="toolbox-card toolbox-card-wide">
            <h3>Disponibilidade SEFAZ / NFe</h3>
            <p className="toolbox-hint">
              Verifique o portal nacional antes de abrir chamado: muitos erros de NFe (autorizador, retorno de lotes,
              timeout) sao consequencia de indisponibilidade da SEFAZ.
            </p>
            <button className="toolbox-sefa-btn" onClick={checkSefa} disabled={sefaLoading}>
              <FiRefreshCw size={14} className={sefaLoading ? 'spin' : ''} /> {sefaLoading ? 'Verificando...' : 'Verificar disponibilidade'}
            </button>
            {sefaStatus && (
              sefaStatus.ok && sefaStatus.rows ? (
                <SefaStatusTable data={sefaStatus} />
              ) : (
                <ResultBox warn>
                  <div>
                    <div><strong>Indisponivel / sem resposta: {sefaStatus.error}</strong></div>
                    <div className="toolbox-hint">Confirme manualmente no Portal Nacional NFe (link abaixo).</div>
                  </div>
                </ResultBox>
              )
            )}
            <div className="toolbox-links">
              {SEFAZ_LINKS.map(l => (
                <a key={l.uf} className="toolbox-link" href={l.url} target="_blank" rel="noopener noreferrer">
                  <FiExternalLink size={12} /> {l.uf} — {l.nome}
                </a>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Aba 4 - Codigos: subabas CFOP / PIS / COFINS / IPI / CST(ICMS) com filtro de busca */}
      {tab === 'cfop' && (
        <div className="toolbox-grid">
          <div className="toolbox-card toolbox-card-wide">
            <h3>Codigos fiscais</h3>
            <p className="toolbox-hint">
              Todos os CFOPs aceitos pela SEFAZ e os CST de PIS, COFINS, IPI e ICMS (notas), conforme tabelas oficiais.
            </p>
            // Subabas da aba Codigos: define qual tabela fiscal (do fiscalTables.js) sera exibida
            <div className="toolbox-subtabs">
              {[
                { id: 'cfop', label: 'CFOP' },
                { id: 'pis', label: 'PIS' },
                { id: 'cofins', label: 'COFINS' },
                { id: 'ipi', label: 'IPI' },
                { id: 'cst', label: 'CST (ICMS)' }
              ].map(s => (
                <button key={s.id} className={`toolbox-subtab ${codSubTab === s.id ? 'active' : ''}`} onClick={() => setCodSubTab(s.id)}>
                  {s.label}
                </button>
              ))}
            </div>
            <input
              className="toolbox-cfop-filter"
              value={cfopFilter}
              onChange={e => setCfopFilter(e.target.value)}
              placeholder={codSubTab === 'cfop' ? 'Filtrar por codigo ou descricao...' : 'Filtrar por CST ou descricao...'}
            />
            {/* Lista de CFOPs filtrados por codigo/descricao/aplicacao */}
            {codSubTab === 'cfop' && (
              <div className="toolbox-cfop-list">
                {filteredCfops.map((c, i) => (
                  <div className="toolbox-cfop-row" key={i} title={c.aplicacao || c.desc}>
                    <span className="toolbox-cfop-code">{c.cfop}</span>
                    <span className="toolbox-cfop-desc">{c.desc}</span>
                  </div>
                ))}
                {filteredCfops.length === 0 && <div className="toolbox-empty">Nenhum CFOP encontrado.</div>}
              </div>
            )}
            {/* Lista de CSTs de PIS, COFINS e IPI (filtradas por codigo/descricao) */}
            {codSubTab === 'pis' && (
              <div className="toolbox-cfop-list">
                {filteredCsts(CST_PIS).map((c, i) => (
                  <div className="toolbox-cfop-row" key={i}>
                    <span className="toolbox-cfop-code">{c.cst}</span>
                    <span className="toolbox-cfop-desc">{c.desc}</span>
                  </div>
                ))}
                {filteredCsts(CST_PIS).length === 0 && <div className="toolbox-empty">Nenhum CST de PIS encontrado.</div>}
              </div>
            )}
            {codSubTab === 'cofins' && (
              <div className="toolbox-cfop-list">
                {filteredCsts(CST_COFINS).map((c, i) => (
                  <div className="toolbox-cfop-row" key={i}>
                    <span className="toolbox-cfop-code">{c.cst}</span>
                    <span className="toolbox-cfop-desc">{c.desc}</span>
                  </div>
                ))}
                {filteredCsts(CST_COFINS).length === 0 && <div className="toolbox-empty">Nenhum CST de COFINS encontrado.</div>}
              </div>
            )}
            {codSubTab === 'ipi' && (
              <div className="toolbox-cfop-list">
                {filteredCsts(CST_IPI).map((c, i) => (
                  <div className="toolbox-cfop-row" key={i}>
                    <span className="toolbox-cfop-code">{c.cst}</span>
                    <span className="toolbox-cfop-desc">{c.desc}</span>
                  </div>
                ))}
                {filteredCsts(CST_IPI).length === 0 && <div className="toolbox-empty">Nenhum CST de IPI encontrado.</div>}
              </div>
            )}
            {/* Lista de CSTs do ICMS separada em dois grupos: regra normal e Simples Nacional (CSOSN) */}
            {codSubTab === 'cst' && (
              <>
                <div className="toolbox-cst-grupos">
                  <span className="toolbox-cst-grupos-title">Regra normal (tributacao integral):</span>
                  {filteredCsts(CST_ICMS.filter(c => c.grupo !== 'CSOSN')).map((c, i) => (
                    <div className="toolbox-cfop-row" key={i}>
                      <span className="toolbox-cfop-code">{c.cst}</span>
                      <span className="toolbox-cfop-desc">{c.desc} <span className="toolbox-cfop-grupo">[grupo {c.grupo}]</span></span>
                    </div>
                  ))}
                  {filteredCsts(CST_ICMS.filter(c => c.grupo !== 'CSOSN')).length === 0 && <div className="toolbox-empty">Nenhum CST encontrado.</div>}
                </div>
                <div className="toolbox-cst-grupos">
                  <span className="toolbox-cst-grupos-title">Simples Nacional (CSOSN):</span>
                  {filteredCsts(CST_ICMS.filter(c => c.grupo === 'CSOSN')).map((c, i) => (
                    <div className="toolbox-cfop-row" key={i}>
                      <span className="toolbox-cfop-code">{c.cst}</span>
                      <span className="toolbox-cfop-desc">{c.desc}</span>
                    </div>
                  ))}
                  {filteredCsts(CST_ICMS.filter(c => c.grupo === 'CSOSN')).length === 0 && <div className="toolbox-empty">Nenhum CSOSN encontrado.</div>}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Aba 5 - CNPJ: configuracao SINTEGRA, consulta e detalhes cadastrais */}
      {tab === 'cnpj' && (
        <div className="toolbox-grid">
          <div className="toolbox-card toolbox-card-wide">
            <h3>Consulta CNPJ</h3>
            <p className="toolbox-hint">
              Consulte razao social, situacao cadastral (ativa/baixada), inscricao estadual, endereco e atividades.
            </p>
            {/* Status e formulario da chave SINTEGRA (usada para obter a Inscricao Estadual) */}
            <div className="toolbox-sintegra-config">
              <span className="toolbox-sintegra-status">
                {sintegraConfigured ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#6ee7b7', fontSize: 12 }}>
                    <StatusDot status="verde" /> Sintegra configurado — IE via SINTEGRA (fonte oficial)
                  </span>
                ) : (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#fcd34d', fontSize: 12 }}>
                    <StatusDot status="amarelo" /> Sintegra nao configurado — IE pode ficar indisponivel
                  </span>
                )}
              </span>
              <div className="toolbox-code-form" style={{ flexWrap: 'wrap' }}>
                <input
                  type="password"
                  value={sintegraKey}
                  onChange={e => setSintegraKey(e.target.value)}
                  placeholder="Colar chave gratuita do SINTEGRA (X-Api-Key)"
                  style={{ flex: 1, minWidth: 220 }}
                />
                <button className="toolbox-add" onClick={saveSintegraKey} disabled={!sintegraKey.trim()}>
                  <FiSave size={13} /> Salvar chave
                </button>
              </div>
              {keySavedMsg && <div style={{ fontSize: 12, color: keySavedMsg.includes('salva') ? '#6ee7b7' : '#fca5a5' }}>{keySavedMsg}</div>}
              <a className="toolbox-link" href="https://www.sintegrabrasil.com.br/api/painel" target="_blank" rel="noopener noreferrer">
                <FiExternalLink size={12} /> Criar chave gratuita (10 req/min, 2.000/dia) — so com email
              </a>
            </div>
            <div className="toolbox-code-form" style={{ marginTop: '8px' }}>
              <input
                value={cnpjInput}
                onChange={e => setCnpjInput(e.target.value)}
                onKeyPress={e => e.key === 'Enter' && consultaCnpj()}
                placeholder="Digite o CNPJ (14 digitos)"
                style={{ maxWidth: 260 }}
              />
              <button className="toolbox-sefa-btn" onClick={consultaCnpj} disabled={cnpjLoading}>
                <FiRefreshCw size={14} className={cnpjLoading ? 'spin' : ''} /> {cnpjLoading ? 'Consultando...' : 'Consultar'}
              </button>
            </div>
            {cnpjError && <ResultBox warn><div><strong>{cnpjError}</strong></div></ResultBox>}
            {/* Resultado da consulta CNPJ: dados cadastrais, IEs, socios e fonte dos dados */}
            {cnpjResult && cnpjResult.data && (
              <div className="toolbox-cnpj-result">
                <div className="toolbox-cnpj-head">
                  <div>
                    <div className="toolbox-cnpj-nome">{cnpjResult.data.razaoSocial}</div>
                    {cnpjResult.data.fantasia && <div className="toolbox-cnpj-fantasia">{cnpjResult.data.fantasia}</div>}
                  </div>
                  <span className={`toolbox-situacao ${String(cnpjResult.data.situacao || '').toUpperCase() === 'ATIVA' ? 'situacao-ativa' : ''}`}>
                    {cnpjResult.data.situacao || 'Desconhecida'}
                  </span>
                </div>
                <div className="toolbox-cnpj-grid">
                  <div className="toolbox-cnpj-item">
                    <span className="toolbox-cnpj-key">CNPJ</span>
                    <span className="toolbox-cnpj-val">{formatCnpj(cnpjResult.data.cnpj) || cnpjResult.data.cnpj}</span>
                  </div>
                  <div className="toolbox-cnpj-item">
                    <span className="toolbox-cnpj-key">Inscricao Estadual {cnpjResult.data.ieFonte ? `(${cnpjResult.data.ieFonte})` : ''}</span>
                    {cnpjResult.data.inscricoes && cnpjResult.data.inscricoes.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {cnpjResult.data.inscricoes.map((ins, i) => (
                          <div key={i} className="toolbox-ie-row">
                            <span className="toolbox-cnpj-val ie-existe" style={{ fontSize: 14 }}>{ins.ie}</span>
                            <span className="toolbox-ie-uf">{ins.uf || '-'}</span>
                            <span className={`toolbox-ie-badge ${ins.ativa ? 'ie-ativa' : 'ie-inativa'}`}>
                              {ins.ativa ? 'Ativa' : 'Inativa'}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : cnpjResult.data.ie ? (
                      <span className="toolbox-cnpj-val ie-existe">{cnpjResult.data.ie}</span>
                    ) : (
                      <span className="toolbox-cnpj-val ie-ausente">IE nao retornada pela fonte</span>
                    )}
                    {!cnpjResult.data.ie && !cnpjResult.data.inscricoes && (
                      <button
                        className="toolbox-copy"
                        style={{ alignSelf: 'flex-start', marginTop: '4px' }}
                        onClick={() => consultaCnpj(true)}
                        disabled={cnpjLoading}
                      >
                        <FiRefreshCw size={12} className={cnpjLoading ? 'spin' : ''} /> Tentar obter IE
                      </button>
                    )}
                  </div>
                  {cnpjResult.data.im && (
                    <div className="toolbox-cnpj-item">
                      <span className="toolbox-cnpj-key">Inscricao Municipal</span>
                      <span className="toolbox-cnpj-val">{cnpjResult.data.im}</span>
                    </div>
                  )}
                  <div className="toolbox-cnpj-item">
                    <span className="toolbox-cnpj-key">Abertura</span>
                    <span className="toolbox-cnpj-val">{cnpjResult.data.dataAbertura}</span>
                  </div>
                  <div className="toolbox-cnpj-item">
                    <span className="toolbox-cnpj-key">Situacao desde</span>
                    <span className="toolbox-cnpj-val">{cnpjResult.data.dataSituacao}</span>
                  </div>
                  <div className="toolbox-cnpj-item">
                    <span className="toolbox-cnpj-key">Porte</span>
                    <span className="toolbox-cnpj-val">{cnpjResult.data.porte || '-'}</span>
                  </div>
                  <div className="toolbox-cnpj-item">
                    <span className="toolbox-cnpj-key">Natureza Juridica</span>
                    <span className="toolbox-cnpj-val">{cnpjResult.data.naturezaJuridica || '-'}</span>
                  </div>
                  <div className="toolbox-cnpj-item">
                    <span className="toolbox-cnpj-key">Capital Social</span>
                    <span className="toolbox-cnpj-val">
                      {cnpjResult.data.capitalSocial ? 'R$ ' + Number(cnpjResult.data.capitalSocial).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '-'}
                    </span>
                  </div>
                </div>
                <div className="toolbox-cnpj-linha">
                  <span className="toolbox-cnpj-key">Atividade principal {cnpjResult.data.cnaePrincipal ? `(CNAE ${cnpjResult.data.cnaePrincipal})` : ''}</span>
                  <span className="toolbox-cnpj-val">{cnpjResult.data.atividadePrincipal || '-'}</span>
                </div>
                {cnpjResult.data.cnaesSecundarios && cnpjResult.data.cnaesSecundarios.length > 0 && (
                  <div className="toolbox-cnpj-linha">
                    <span className="toolbox-cnpj-key">Atividades secundarias</span>
                    <span className="toolbox-cnpj-val">{cnpjResult.data.cnaesSecundarios.join('; ')}</span>
                  </div>
                )}
                <div className="toolbox-cnpj-linha">
                  <span className="toolbox-cnpj-key">Endereco</span>
                  <span className="toolbox-cnpj-val">{cnpjResult.data.endereco || '-'}</span>
                </div>
                <div className="toolbox-cnpj-grid">
                  {cnpjResult.data.telefone && (
                    <div className="toolbox-cnpj-item">
                      <span className="toolbox-cnpj-key">Telefone</span>
                      <span className="toolbox-cnpj-val">{cnpjResult.data.telefone}</span>
                    </div>
                  )}
                  {cnpjResult.data.email && (
                    <div className="toolbox-cnpj-item">
                      <span className="toolbox-cnpj-key">Email</span>
                      <span className="toolbox-cnpj-val">{cnpjResult.data.email}</span>
                    </div>
                  )}
                </div>
                {cnpjResult.data.socios && cnpjResult.data.socios.length > 0 && (
                  <div className="toolbox-cnpj-linha">
                    <span className="toolbox-cnpj-key">Quadro societario</span>
                    <span className="toolbox-cnpj-val">{cnpjResult.data.socios.join('; ')}</span>
                  </div>
                )}
                <div className="toolbox-cnpj-fonte">
                  Fonte: {cnpjResult.source === 'cache' ? 'cache local (consulta anterior)' : cnpjResult.source === 'brasilapi' ? 'BrasilAPI' : 'ReceitaWS'}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Aba 6 - NFe: validacao e decodificacao da chave de acesso de 44 digitos */}
      {tab === 'nfe' && (
        <div className="toolbox-grid">
          <div className="toolbox-card toolbox-card-wide">
            <h3>Consulta NFe por chave de acesso</h3>
            <p className="toolbox-hint">
              Cole a chave de 44 digitos (ou o QR Code da NFe) para validar e decodificar a nota. A confirmacao
              oficial do documento e feita no portal da SEFAZ (exige captcha).
            </p>
            <div className="toolbox-code-form">
              <input
                value={nfeInput}
                onChange={e => setNfeInput(e.target.value)}
                onKeyPress={e => e.key === 'Enter' && consultaNfe()}
                placeholder="44 digitos (espacos sao ignorados)"
                style={{ fontFamily: 'Consolas, monospace' }}
              />
              <button className="toolbox-sefa-btn" onClick={consultaNfe}>
                <FiCheck size={14} /> Validar
              </button>
            </div>
            {nfeError && <ResultBox warn><div><strong>{nfeError}</strong></div></ResultBox>}
            {/* Resultado da chave NFe: validade do digito verificador, chave formatada e dados decodificados */}
            {nfeResult && (
              <>
                <ResultBox ok={nfeResult.valida}>
                  {nfeResult.valida ? (
                    <div>Chave valida (digito verificador correto).</div>
                  ) : (
                    <div><strong>Atencao: chave invalida</strong> — digito verificador nao confere. Verifique se digitou a chave corretamente.</div>
                  )}
                </ResultBox>
                <div className="toolbox-sql">
                  <code style={{ fontSize: '13px' }}>{formatChave(nfeResult.chave)}</code>
                  <button className="toolbox-copy" onClick={() => { navigator.clipboard?.writeText(nfeResult.chave); setChaveCopied(true); setTimeout(() => setChaveCopied(false), 2000) }}>
                    {chaveCopied ? <FiCheck size={13} /> : <FiCopy size={13} />} {chaveCopied ? 'Copiado!' : 'Copiar'}
                  </button>
                </div>
                <div className="toolbox-cnpj-grid">
                  <div className="toolbox-cnpj-item">
                    <span className="toolbox-cnpj-key">UF do emitente</span>
                    <span className="toolbox-cnpj-val">{nfeResult.uf.sigla} (codigo {nfeResult.uf.codigo})</span>
                  </div>
                  <div className="toolbox-cnpj-item">
                    <span className="toolbox-cnpj-key">Mes/Ano emissao</span>
                    <span className="toolbox-cnpj-val">{nfeResult.dataEmissao}</span>                  </div>
                  <div className="toolbox-cnpj-item">
                    <span className="toolbox-cnpj-key">CNPJ do emitente</span>
                    <span className="toolbox-cnpj-val">{formatCnpj(nfeResult.cnpjEmitente)}</span>
                  </div>
                  <div className="toolbox-cnpj-item">
                    <span className="toolbox-cnpj-key">Modelo</span>
                    <span className="toolbox-cnpj-val">{nfeResult.modelo} ({nfeResult.modelo === '55' ? 'NF-e' : nfeResult.modelo === '65' ? 'NFC-e' : 'outro'})</span>
                  </div>
                  <div className="toolbox-cnpj-item">
                    <span className="toolbox-cnpj-key">Serie</span>
                    <span className="toolbox-cnpj-val">{nfeResult.serie}</span>
                  </div>
                  <div className="toolbox-cnpj-item">
                    <span className="toolbox-cnpj-key">Numero da nota</span>
                    <span className="toolbox-cnpj-val">{Number(nfeResult.numero)}</span>
                  </div>
                  <div className="toolbox-cnpj-item">
                    <span className="toolbox-cnpj-key">Tipo de emissao</span>
                    <span className="toolbox-cnpj-val">{nfeResult.tipoEmissao}</span>
                  </div>
                </div>
                <div className="toolbox-note">
                  <FiAlertCircle size={13} /> Para confirmar a nota fiscal na SEFAZ, abra o portal oficial (ha captcha).
                </div>
                <div className="toolbox-links">
                  <a className="toolbox-sefa-btn" href={`https://www.nfe.fazenda.gov.br/portal/consultaRecaptcha.aspx?tipoConsulta=resumo`} target="_blank" rel="noopener noreferrer">
                    <FiExternalLink size={12} /> Consultar no site da SEFAZ
                  </a>
                  {SEFAZ_LINKS.filter(l => l.uf === nfeResult.uf.sigla && l.uf !== 'BR').map(l => (
                    <a key={l.uf} className="toolbox-link" href={l.url} target="_blank" rel="noopener noreferrer">
                      <FiExternalLink size={12} /> SEFAZ {l.uf}
                    </a>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}