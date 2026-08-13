# NFVENDA, NFVENDAITEM — Nota de venda

**Criado em:** 12/08/2026 08:21
**Sistema:** ScgWin / NUTRIMARCAS
**Contexto / Quando acontece:** Notas fiscais de venda (NF-e). Geradas a partir do faturamento de PEDVEND. Cada NFVENDA contém os dados do cabeçalho da nota e NFVENDAITEM os itens. A nota é transmitida à SEFAZ e gerando CHAVE, PROTOCOLO e STATUSCHAVE.

## Tabelas — Aplicação

### NFVENDA
**PK:** `CODNFVENDA` + `NFV_TIPO` + `SERIE` (composta) | **~129 colunas** | [Schema completo](schemas/nfvenda.md)

Cabeçalho da nota fiscal de venda.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| CODNFVENDA | INTEGER | PK — número da NF |
| NFV_TIPO | CHAR(1) | PK — tipo da nota |
| SERIE | VARCHAR(3) | PK — série da NF |
| STATUS | CHAR(1) | Status da nota |
| TIPONOTA | CHAR(1) | Tipo: normal, complementar, devolução |
| DT_EMISSAO | TIMESTAMP | Data de emissão |
| CODPEDVEND | INTEGER | FK → PEDVEND — pedido origem |
| CODPESSOA | INTEGER | FK → PESSOA — cliente |
| CODVENDEDOR | INTEGER | FK → VENDEDOR |
| CODCFOP | INTEGER | FK → CFOP |
| CODTIPOPAG | INTEGER | FK → TIPOPAG |
| TOTALPRODUTOS | DOUBLE | Total dos produtos |
| TOTALNOTA | DOUBLE | Valor total da nota |
| CHAVE | VARCHAR(44) | Chave de acesso NF-e |
| PROTOCOLO | VARCHAR(15) | Protocolo SEFAZ |
| STATUSCHAVE | INTEGER | Status da chave |
| CODOPERACAO | INTEGER | FK → OPERACOES — tipo de operação |
| NUMNFCE | INTEGER | Número NFCe (se aplicável) |
| SERIENFCE | VARCHAR(10) | Série NFCe |
| CODEMPRESA | INTEGER | FK → EMPRESA |
| US_CADAST | VARCHAR(45) | Usuário de criação |
| DT_CADAST | TIMESTAMP | Data de criação |

### NFVENDAITEM
**PK:** `CODNFVENDAITEM` | **~109 colunas** | [Schema completo](schemas/nfvendaitem.md)

Itens da nota fiscal de venda.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| CODNFVENDAITEM | INTEGER | PK — item da NF |
| CODNFVENDA | INTEGER | FK → NFVENDA — nota pai |
| NFV_TIPO | CHAR(1) | Tipo da nota |
| SERIE | VARCHAR(3) | Série da nota |
| CODPRODFILHO | INTEGER | FK → PRODFILHO — produto |
| CODUNIDADE | INTEGER | FK → UNIDADE |
| CODCFOP | INTEGER | FK → CFOP |
| QTDE | DOUBLE | Quantidade |
| PRECOVEND | DOUBLE | Preço de venda |
| DESCPERC | DOUBLE | Desconto percentual |
| DESCVLR | DOUBLE | Desconto em valor |
| CST | VARCHAR(4) | Código Situação Tributária |
| ICMSBASE | DOUBLE | Base de cálculo ICMS |
| ICMSPERC | DOUBLE | Alíquota ICMS |
| ICMSVALOR | DOUBLE | Valor ICMS |
| TOTALVLR | DOUBLE | Total do item |
| TOTALVLRNOTA | DOUBLE | Total para a nota |
| ATUALIZOU_ESTOQUE | CHAR(1) | Se já baixou estoque (S/N) |
