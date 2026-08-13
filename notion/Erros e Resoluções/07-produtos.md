# PRODFILHO, PRODFILHOLOTES — Produtos

**Criado em:** 12/08/2026 08:21
**Sistema:** ScgWin / NUTRIMARCAS
**Contexto / Quando acontece:** Cadastro de produtos (itens). PRODFILHO é o produto filial (variação por empresa/filial), com preços, estoque e tributação. PRODFILHOLOTES controla lotes por validade.

## Tabelas — Aplicação

### PRODFILHO
**PK:** `CODPRODFILHO` | **~300 colunas** | [Schema completo](schemas/prodfilho.md)

Produto filial — unidade vendável com preço, estoque e regras fiscais.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| CODPRODFILHO | INTEGER | PK — código do produto filial |
| CODPRODUTO | INTEGER | FK → PRODUTO — produto pai |
| DESCRICAO | VARCHAR(60) | Descrição do produto |
| LOCALIZACAO | VARCHAR(60) | Localização no estoque |
| ALIQCOMISSAO | DOUBLE | Alíquota de comissão |
| ESTQMAX | DOUBLE | Estoque máximo |
| ESTQMIN | DOUBLE | Estoque mínimo |
| QTDEMBALAGEM | DOUBLE | Quantidade na embalagem |
| PRECOPRATICADO1-6 | DOUBLE | Tabela de preços (1 a 6) |
| CODUNIDADE | INTEGER | FK → UNIDADE |
| ESTQATUAL | DOUBLE | Estoque atual |
| CODPESQ1 | VARCHAR(30) | Código de barras/pesquisa 1 |
| CODPESQ2 | VARCHAR(30) | Código de barras/pesquisa 2 |
| PRECOFORNEC | DOUBLE | Preço do fornecedor |
| CUSTOREPOSI | DOUBLE | Custo de reposição |
| CUSTOMEDIO | DOUBLE | Custo médio |
| ALIQUOTAICMS | DOUBLE | Alíquota ICMS |
| STATUS | VARCHAR(10) | Status: ATIVO, INATIVO |
| CODEMPRESA | INTEGER | FK → EMPRESA |

### PRODFILHOLOTES
**PK:** `CODIGO` | **~20 colunas** | [Schema completo](schemas/prodfilholotes.md)

Controle de lotes por validade do produto.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| CODIGO | INTEGER | PK — código do lote |
| CODPRODFILHO | INTEGER | FK → PRODFILHO — produto |
| DATAFAB | TIMESTAMP | Data de fabricação |
| LOTE | VARCHAR(200) | Número do lote |
| DATAVAL | TIMESTAMP | Data de validade |
| QTD | DOUBLE | Quantidade no lote |
| QTDMOV | DOUBLE | Quantidade movimentada |
| RESERVADO | DOUBLE | Quantidade reservada |
| VLUNIT | DOUBLE | Valor unitário |
| CODENDERECAMENTO | INTEGER | FK → endereçamento |
