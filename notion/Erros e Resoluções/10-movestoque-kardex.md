# MOVESTOQUE, MOVESTOQUELOTE — Ficha Kardex / Movimentações

**Criado em:** 12/08/2026 08:21
**Sistema:** ScgWin / NUTRIMARCAS
**Contexto / Quando acontece:** Movimentações de estoque (ficha Kardex). Cada entrada ou saída de produto gera um registro em MOVESTOQUE, rastreando de onde veio (NFENTRADA, NFVENDA, CUPOM, transferência, etc.) e para onde foi. MOVESTOQUELOTE detalha por lote quando aplicável.

## Tabelas — Aplicação

### MOVESTOQUE
**PK:** `CODMOVESTOQUE` | **~16 colunas** | [Schema completo](schemas/movestoque.md)

Registro de movimentação de estoque.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| CODMOVESTOQUE | INTEGER | PK — código da movimentação |
| CODPRODFILHO | INTEGER | FK → PRODFILHO — produto |
| IDREGISTRO | INTEGER | ID do registro origem (CODNFVENDA, CODNFENTRADA, etc.) |
| IDREGISTROITEM | INTEGER | ID do item origem |
| DOCUMENTO | VARCHAR(40) | Número do documento |
| TIPODOC | VARCHAR(5) | Tipo do documento: NFV, NFE, CUP, PED, etc. |
| TIPOMOV | VARCHAR(1) | Tipo: E=Entrada, S=Saída |
| QTD | DOUBLE | Quantidade movimentada |
| QTDPECA | DOUBLE | Quantidade em peças |
| USUARIO | VARCHAR(45) | Usuário que fez a movimentação |
| DATA | TIMESTAMP | Data/hora da movimentação |
| SERIE | VARCHAR(3) | Série do documento |
| AVARIADO | CHAR(1) | Se produto avariado: S/N |
| CODCOMBINADO | INTEGER | Código combinado (agrupamento) |
| STATUS | SMALLINT | Status da movimentação |
| ORIGEM | VARCHAR(50) | Origem detalhada da movimentação |

### MOVESTOQUELOTE
**PK:** `CODMOVESTOQUELOTE` | **~8 colunas** | [Schema completo](schemas/movestoquelote.md)

Detalhamento da movimentação por lote.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| CODMOVESTOQUELOTE | INTEGER | PK — código do registro |
| CODMOVESTOQUE | INTEGER | FK → MOVESTOQUE — movimentação pai |
| LOTE | VARCHAR(12) | Número do lote |
| DATAFAB | DATE | Data de fabricação |
| DATAVAL | DATE | Data de validade |
| QTD | DOUBLE | Quantidade movimentada neste lote |
| OBS | VARCHAR(80) | Observação |
| CODENDERECO | INTEGER | FK → endereçamento |
