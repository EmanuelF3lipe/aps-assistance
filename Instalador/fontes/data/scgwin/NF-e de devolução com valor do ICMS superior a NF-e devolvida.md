# NF-e de devolução com valor do ICMS superior a NF-e devolvida

**Criado em:** 21 de julho de 2026
**Sistema:** SCG-win
**Contexto:** Nota fiscal de devolução com valor de ICMS maior que a nota original devolvida.

## Resolução

### 1. Extrair dados dos itens da nota de devolução
```sql
SELECT
ni.CODNFVENDA,
ni.CODPRODFILHO,
ni.ICMSBASE,
NI.ICMSPERC,
NI.ICMSVALOR
FROM
NFVENDAITEM NI
WHERE
ni.CODNFVENDA in (//) -- cod da nota de devolucao
```

### 2. Validar valores na NFVENDA
```sql
SELECT
n.CODNFVENDA,
n.ICMSBASE,
n.ICMSTOTAL
FROM
NFVENDA N
WHERE
n.CODNFVENDA in (//) -- cod da nota de devolucao
```

### 3. Comparar com NF original
- Comparar `NI.ICMSVALOR` da devolução com o ICMS da NF original
- Se o valor da devolução for superior, realizar UPDATE para corrigir

### 4. Corrigir (se necessário)
```sql
UPDATE NFVENDAITEM
SET ICMSBASE = [valor correto],
    ICMSPERC = [percentual correto],
    ICMSVALOR = [valor correto]
WHERE CODNFVENDA = [cod nota] AND CODPRODFILHO = [cod produto]
```

## Tags
- NF-e devolucao
- ICMS
- Valor superior
- Update nota