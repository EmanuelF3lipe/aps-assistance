# CONTA, CONTA_BX, CONTA_EXC — Financeiro

**Criado em:** 12/08/2026 08:21
**Sistema:** ScgWin / NUTRIMARCAS
**Contexto / Quando acontece:** Controle financeiro de contas a pagar e receber. Cada parcela gerada por vendas (NFVENDA), compras (PEDCPR/NFENTRADA) ou lançamentos manuais gera um registro na tabela CONTA. O status controla o ciclo de vida: aberto → baixado → (opcionalmente) excluído.

## Tabelas — Aplicação

### CONTA
**PK:** `CODCONTA` | **~128 colunas** | [Schema completo](schemas/conta.md)

Tabela principal do financeiro. Cada linha é uma parcela (conta a pagar ou receber).

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| CODCONTA | INTEGER | PK — identificador da parcela |
| STATUS | VARCHAR(10) | Situação: ABERTA, BAIXADA, CANCELADA, etc. |
| TIPO | VARCHAR(10) | Tipo: PAGAR, RECEBER |
| DESCRICAO | VARCHAR(60) | Descrição da conta |
| NRDOCUMENTO | VARCHAR(30) | Número do documento (NF, boleto, etc.) |
| CODPESSOA | INTEGER | FK → PESSOA — cliente/fornecedor |
| DT_EMISSAO | TIMESTAMP | Data de emissão |
| DT_VENCIM | TIMESTAMP | Data de vencimento |
| PARCELA | VARCHAR(5) | Número da parcela (1/3, 2/3, etc.) |
| VLPARCELA | DOUBLE | Valor da parcela |
| VLTOTAL | DOUBLE | Valor total do documento |
| CODNFVENDA | INTEGER | FK → NFVENDA — nota de venda origem |
| CODNFENTRADA | INTEGER | FK → NFENTRADA — nota de entrada origem |
| CODTIPOPAG | INTEGER | FK → TIPOPAG — forma de pagamento |
| CODVENDEDOR | INTEGER | FK → VENDEDOR — vendedor associado |
| CODOPERACAO | INTEGER | FK → OPERACOES — tipo de operação |
| US_CADAST | VARCHAR(45) | Usuário que criou |
| DT_CADAST | TIMESTAMP | Data de criação |
| US_MODIFI | VARCHAR(45) | Último usuário que modificou |
| DT_MODIFI | TIMESTAMP | Última modificação |

### CONTA_BX
**⚠️ Tabela não encontrada no catálogo do sistema.**

Pode ser uma tabela temporária, view ou ter sido removida.

### CONTA_EXC
**PK:** Nenhuma | **~69 colunas** | [Schema completo](schemas/conta_exc.md)

Tabela de backup/histórico de contas excluídas. Estrutura espelhada à CONTA, utilizada para rastreabilidade de exclusões.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| CODCONTA | INTEGER | Cópia do CODCONTA original |
| STATUS | VARCHAR(10) | Status antes da exclusão |
| TIPO | VARCHAR(10) | Tipo da conta |
| DESCRICAO | VARCHAR(60) | Descrição |
| US_EXCLUSAO | VARCHAR(45) | Usuário que realizou a exclusão |
| *(demais colunas)* | | Espelho da tabela CONTA |
