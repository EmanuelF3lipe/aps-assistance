# NFENTRADA, NFENTRADAITEM — Nota de entrada

**Criado em:** 12/08/2026 08:21
**Sistema:** ScgWin / NUTRIMARCAS
**Contexto / Quando acontece:** Notas fiscais de entrada (compras, devoluções de venda, transferências). Geradas a partir do recebimento de PEDCPR. Cada NFENTRADA atualiza estoque e gera financeiro (CONTA).

## Tabelas — Aplicação

### NFENTRADA
**PK:** `CODNFENTRADA` | **~95 colunas** | [Schema completo](schemas/nfentrada.md)

Cabeçalho da nota fiscal de entrada.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| CODNFENTRADA | INTEGER | PK — número da entrada |
| CODPEDCOMPRA | INTEGER | FK → PEDCPR — pedido de compra origem |
| DTEMISSAO | TIMESTAMP | Data de emissão do fornecedor |
| CODPESSOA | INTEGER | FK → PESSOA — fornecedor |
| SERIE | VARCHAR(3) | Série da NF |
| DOCUMENTO | VARCHAR(15) | Número do documento |
| BASEICMSVLR | DOUBLE | Base ICMS |
| ICMSPERC | DOUBLE | Alíquota ICMS |
| ICMSVLR | DOUBLE | Valor ICMS |
| IPIVLR | DOUBLE | Valor IPI |
| TOTNOTVLR | DOUBLE | Total da nota |
| TOTPRODVLR | DOUBLE | Total dos produtos |
| FRETEVLR | DOUBLE | Valor do frete |
| DESCVLR | DOUBLE | Desconto |
| CODCFOP | INTEGER | FK → CFOP |
| STATUS | CHAR(1) | Status: ABERTA, BAIXADA, CANCELADA |
| CHAVENFE | VARCHAR(54) | Chave de acesso NFe |
| CODEMPRESA | INTEGER | FK → EMPRESA |
| DTENTRADA | TIMESTAMP | Data de entrada no estoque |
| US_CADAST | VARCHAR(45) | Usuário de criação |
| DT_CADAST | TIMESTAMP | Data de criação |

### NFENTRADAITEM
**⚠️ Tabela não encontrada no catálogo do sistema.**

Pode ter nome diferente (ex: NFENTRADAITEM interno) ou ser uma view. Verificar tabelas com prefixo "NFENT" no banco.
