# PEDCPR, PEDCPRITEM — Pedido de compra

**Criado em:** 12/08/2026 08:21
**Sistema:** ScgWin / NUTRIMARCAS
**Contexto / Quando acontece:** Pedidos de compra junto a fornecedores. Gerado manualmente ou automaticamente quando estoque atinge ponto de pedido. Pode gerar NFENTRADA quando a mercadoria é recebida.

## Tabelas — Aplicação

### PEDCPR
**PK:** `CODPEDCPR` | **~61 colunas** | [Schema completo](schemas/pedcpr.md)

Cabeçalho do pedido de compra.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| CODPEDCPR | INTEGER | PK — número do pedido de compra |
| CODPESSOA | INTEGER | FK → PESSOA — fornecedor |
| DT_EMISSAO | TIMESTAMP | Data de emissão |
| SOLICITANTE | VARCHAR(20) | Nome do solicitante |
| STATUS | VARCHAR(10) | Status: ABERTO, FATURADO, CANCELADO |
| CODTRANSPORT | INTEGER | FK → TRANSPORT — transportadora |
| CODCONDPAGCPR | INTEGER | FK → CONDPAG — condição de pagamento |
| VALORFRETE | DOUBLE | Valor do frete |
| TIPOFRETE | CHAR(1) | Tipo: CIF, FOB |
| CODEMPRESA | INTEGER | FK → EMPRESA |
| CODPEDVEND | INTEGER | FK → PEDVEND — pedido de venda associado (compra casada) |
| TIPOPEDIDO | VARCHAR(15) | Tipo: COMPRA, COMPRA_CASADA |
| US_CADAST | VARCHAR(45) | Usuário de criação |
| DT_CADAST | TIMESTAMP | Data de criação |

### PEDCPRITEM
**⚠️ Tabela não encontrada no catálogo do sistema.**

Pode ter nome diferente no banco (ex: PEDCPRITENS interno) ou ser uma view.
