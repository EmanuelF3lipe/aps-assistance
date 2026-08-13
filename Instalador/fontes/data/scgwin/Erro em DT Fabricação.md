# Erro em DT_FABRICAÇÃO

**Criado em:** 21 de julho de 2026
**Sistema:** SCG-win
**Contexto:** Erro relacionado a data de fabricação nos lotes dos itens da nota fiscal.

## Resolução

### 1. Verificar lotes do item da nota
```sql
SELECT
*
FROM
NFVENDAITEMLOTE NIL
WHERE
NIL.CODNFVENDAITEM IN (
    SELECT
    NI.CODNFVENDAITEM
    FROM
    NFVENDAITEM NI
    WHERE
    NI.CODNFVENDA = 87986 -- cod da nota
)
```

### 2. Verificar campos de data
- `DTFABRICACAO` - Data de fabricação
- `DTVALIDADE` - Data de validade
- Verificar se as datas estão corretas ou preenchidas

### 3. Corrigir (se necessário)
- Atualizar a data de fabricação no cadastro do lote
- Verificar se o lote está correto na tabela `LOTE` ou `PRODFILHOLOTE`

## Tags
- DT fabricacao
- Lote
- NFVENDAITEMLOTE
- Data invalida