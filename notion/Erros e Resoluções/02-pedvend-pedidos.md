# PEDVEND, PEDVENDITEM — Pedidos

**Criado em:** 12/08/2026 08:21
**Sistema:** ScgWin / NUTRIMARCAS
**Contexto / Quando acontece:** Pedidos de venda. Quando um vendedor registra uma venda no sistema, é gerado um PEDVEND (cabeçalho) e vários PEDVENDITEM (itens). O pedido pode ser faturado gerando NFVENDA, ou servir como base para pedido de compra (PEDCPR).

## Tabelas — Aplicação

### PEDVEND
**PK:** `CODPEDVEND` | **~232 colunas** | [Schema completo](schemas/pedvend.md)

Cabeçalho do pedido de venda.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| CODPEDVEND | INTEGER | PK — número do pedido |
| CODPESSOA | INTEGER | FK → PESSOA — cliente |
| CODVENDEDOR | INTEGER | FK → VENDEDOR — vendedor |
| DT_SAIDA | TIMESTAMP | Data de saída/entrega |
| DESCONTO | DOUBLE | Desconto total |
| ACRESCIMO | DOUBLE | Acréscimo total |
| CODTIPOPAG | INTEGER | FK → TIPOPAG — forma de pagamento |
| VALOR_TOTAL | DOUBLE | Valor total do pedido |
| STATUSPED | VARCHAR(10) | Status: ABERTO, FATURADO, CANCELADO |
| TIPOPED | VARCHAR(10) | Tipo: VENDA, ORCAMENTO |
| CODNFVENDA | INTEGER | FK → NFVENDA — nota gerada (se faturado) |
| SERIENF | VARCHAR(3) | Série da NF |
| CODEMPRESA | INTEGER | FK → EMPRESA |
| US_CADAST | VARCHAR(45) | Usuário de criação |
| DT_CADAST | TIMESTAMP | Data de criação |

### PEDVENDITEM
**PK:** `CODPEDVENDITEM` | **~185 colunas** | [Schema completo](schemas/pedvenditem.md)

Itens do pedido de venda.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| CODPEDVENDITEM | INTEGER | PK — item do pedido |
| CODPEDVEND | INTEGER | FK → PEDVEND — pedido pai |
| CODPRODFILHO | INTEGER | FK → PRODFILHO — produto |
| PRECOPROD | DOUBLE | Preço de custo/do fornecedor |
| PRECOVEND | DOUBLE | Preço de venda |
| DESCONTO | DOUBLE | Desconto no item |
| QTDE | DOUBLE | Quantidade |
| CODUNIDADE | INTEGER | FK → UNIDADE |
| CODCFOP | INTEGER | FK → CFOP — natureza da operação |
| SEQ | INTEGER | Sequência do item |
| CODEMPRESA | INTEGER | FK → EMPRESA |
