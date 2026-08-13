# PEDVENDPRAZOS - Valor difere 1 centavo

**Criado em:** 21 de julho de 2026
**Sistema:** SCG-win
**Contexto:** Caixa deu erro dizendo que falta 01 centavo para pagar. Na tabela PEDVENDPRAZOS estava 1 centavo a menos.

## Resolução

### 1. Verificar valores na tabela
```sql
SELECT
*
FROM
PEDVENDPRAZOS
WHERE
CODPEDVEND = [cod pedido]
```

### 2. Ajustar o valor
- Identificar onde está a diferença de 1 centavo
- Ajustar o valor para bater com o total da nota
- Tentar novamente a operação no caixa

## Tags
- PEDVENDPRAZOS
- 1 centavo
- Caixa
- Valor diferente
- Diferenca monetaria