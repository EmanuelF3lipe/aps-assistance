# Total da NF difere do somatório dos valores

**Criado em:** 21/07/2026
**Sistema:** SGNFE / SCG-win
**Contexto:** Rejeição ao enviar nota fiscal eletrônica - O valor total da NF-e não bate com a soma dos itens.

## Resolução

Esse erro ocorre quando o **vlrTotal** da NF-e não é igual à soma de todos os campos de valores (produtos + frete + seguro + desconto + outras despesas).

### Causas mais comuns:

1. **Arredondamento** - Os valores dos itens somados dão centavos diferentes do total
2. **Frete/Seguro/Desconto** - Campos de rateio preenchidos incorretamente
3. **Campos não preenchidos** - `vProd`, `vFrete`, `vSeg`, `vDesc`, `vOutro` inconsistente

### Como corrigir:

1. **Verificar o total dos produtos:**
   - Somar `vProd` de todos os itens (CFOP 5102, 6102, etc.)
   - Verificar se `vProd = qCom × vUnCom` para cada item

2. **Verificar campos de rateio:**
   - `vFrete` (frete)
   - `vSeg` (seguro)
   - `vDesc` (desconto)
   - `vOutro` (outras despesas)
   
3. **Fórmula correta:**
   ```
   vProd (soma itens) + vFrete + vSeg - vDesc + vOutro = vNF
   ```

4. **No SCG-win:** Reabrir a NF-e e deixar o sistema recalcular automaticamente

5. **Se persistir:** Verificar se há itens com valor zero ou CST tributário que altera o cálculo

### SQL de verificação:

```sql
-- Verificar itens da NF
SELECT n.CODNFVENDA, n.DESCVLR, n.TOTALVLR, n.TOTALVLRNOTA,
       n.ODESP_VALOR, n.IPIDEVOLUCAO, n.FRETE_VLR, n.IPIVALOR
FROM nfvendaitem n
WHERE n.CODNFVENDA = 2628 AND n.serie = '2';

-- Verificar NF principal
SELECT ni.CODNFVENDA, ni.IPIDEVOLUCAO
FROM nfvenda ni
WHERE ni.CODNFVENDA = 2628 AND serie = '2';
```

### Caso real encontrado:
- NF 2628 - Série 2
- **Problema:** IPI estava preenchido em `nfvendaitem.IPIVALOR` mas **não estava** em `nfvendaitem.IPIDEVOLUCAO`
- O campo `IPIDEVOLUCAO` ficou zerado, causando a divergência no total

> **Nota:** Esse erro pode aparecer por diversas causas - IPI, frete, desconto, seguro, etc. Sempre verificar todos os campos de valores entre `nfvendaitem` e `nfvenda`.

## Tags
- rejeição
- NF-e
- valor total
- arredondamento
-.rateio
- frete
- desconto
