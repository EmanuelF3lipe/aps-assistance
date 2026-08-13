# CUPOM, CUPOMPAG, CUPOMITEM — (Agilis) Cupom

**Criado em:** 12/08/2026 08:21
**Sistema:** ScgWin / NUTRIMARCAS (módulo Agilis PDV)
**Contexto / Quando acontece:** Cupons fiscais emitidos no PDV (Agilis). Cada venda no caixa gera um CUPOM (cabeçalho), CUPOMITEM (itens) e CUPOMPAG (formas de pagamento). Pode gerar NFCe (NUMNFCE) e NFVENDA.

## Tabelas — Aplicação

### CUPOM
**PK:** `CODCUPOM` | **~98 colunas** | [Schema completo](schemas/cupom.md)

Cabeçalho do cupom fiscal.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| CODCUPOM | INTEGER | PK — código do cupom |
| CODPEDVEND | INTEGER | FK → PEDVEND — pedido associado |
| EMISSAO | TIMESTAMP | Data/hora de emissão |
| CODVENDEDOR | INTEGER | FK → VENDEDOR |
| VALOR_TOTAL | DOUBLE | Valor total do cupom |
| STATUSCUPOM | SMALLINT | Status: 0=aberto, 1=fechado, 2=cancelado |
| CODTIPOPAG | INTEGER | FK → TIPOPAG |
| CODPESSOA | INTEGER | FK → PESSOA — cliente |
| COO | VARCHAR(10) | COO do ECF |
| ECF | VARCHAR(10) | Número do ECF |
| CODNFVENDA | INTEGER | FK → NFVENDA — NF gerada |
| SERIE | VARCHAR(3) | Série da NF |
| NUMNFCE | INTEGER | Número NFCe |
| CHAVE_ACESSO | VARCHAR(44) | Chave NFCe |
| ESPELHO_CUPOM | BLOB | Espelho do cupom (imagem/texto) |
| CODEMPRESA | INTEGER | FK → EMPRESA |
| US_CADAST | VARCHAR(45) | Usuário de criação |
| DT_CADAST | TIMESTAMP | Data de criação |

### CUPOMPAG
**PK:** `CODCUPOMPAG` | **~38 colunas** | [Schema completo](schemas/cupompag.md)

Formas de pagamento do cupom (múltiplas por cupom).

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| CODCUPOMPAG | INTEGER | PK — registro do pagamento |
| CODCUPOM | INTEGER | FK → CUPOM — cupom pai |
| FORMA_PAGAMENTO | VARCHAR(30) | Descrição: DINHEIRO, CARTÃO, etc. |
| VALOR | DOUBLE | Valor pago nesta forma |
| CODCARTAOCRED | INTEGER | FK → CARTAOCRED — cartão |
| CODTIPOPAG | INTEGER | FK → TIPOPAG |
| BANDEIRA | VARCHAR(30) | Bandeira do cartão |
| PARCELAS | INTEGER | Número de parcelas |
| AUTORIZACAO | VARCHAR(30) | Código de autorização |
| TROCO | DOUBLE | Troco |
| NSU | VARCHAR(20) | NSU da transação |
| CODEMPRESA | INTEGER | FK → EMPRESA |

### CUPOMITEM
**PK:** `CODCUPOMITEM` | **~124 colunas** | [Schema completo](schemas/cupomitem.md)

Itens do cupom fiscal.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| CODCUPOMITEM | INTEGER | PK — item do cupom |
| CODCUPOM | INTEGER | FK → CUPOM — cupom pai |
| CONTITEM | INTEGER | Sequência do item |
| CODPRODFILHO | INTEGER | FK → PRODFILHO — produto |
| DESCR_PRODUTO | VARCHAR(60) | Descrição do produto |
| CODPESQUISA | VARCHAR(30) | Código de pesquisa/barras |
| PRECOPROD | DOUBLE | Preço de custo |
| PRECOVEND | DOUBLE | Preço de venda |
| QTDE | DOUBLE | Quantidade |
| DESCONTO | DOUBLE | Desconto % |
| DESC_VALOR | DOUBLE | Desconto em valor |
| CST | VARCHAR(3) | Código Situação Tributária |
| CFOP | INTEGER | CFOP |
| CANCELADO | CHAR(1) | Se o item foi cancelado |
| FLAG_BAIXOU_ESTOQUE | SMALLINT | Se já baixou estoque |
| CODEMPRESA | INTEGER | FK → EMPRESA |
