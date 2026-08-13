# Conversion error from string - procedure mpequisaproduto

**Criado em:** 21 de julho de 2026
**Sistema:** SCG-win
**Contexto:** Erro de conversão de string ao executar a procedure mpequisaproduto.

## Resolução

### Script para rodar no Ctrl+F12:

```sql
ALTER TABLE nfentradaitens_xml ADD CODCFOP INTEGER;
ALTER TABLE nfentradaitens_xml ADD CODNFENTRADA_XML INTEGER;
ALTER TABLE nfentradaitens_xml ADD CODUNIDADE INTEGER;
ALTER TABLE nfentradaitens_xml ADD GEN_TEMPESTOQTEMP VARCHAR(40);
```

### Alternativa (se acima não resolver):
```sql
ALTER TABLE TABELA_PRECO_ITEM ADD CODEMPRESA INTEGER;
ALTER TABLE TABELA_PRECO_ITEM ADD US_CADAST VARCHAR(45);
ALTER TABLE TABELA_PRECO_ITEM ADD DT_CADAST TIMESTAMP;
ALTER TABLE TABELA_PRECO_ITEM ADD US_MODIFI VARCHAR(45);
ALTER TABLE TABELA_PRECO_ITEM ADD DT_MODIFI TIMESTAMP;
```

### Ou também:
```sql
-- Verificar se CODPRODFILHOSTR existe em PRODFILHO
-- Se nao, adicionar:
ALTER TABLE PRODFILHO ADD CODPRODFILHOSTR VARCHAR(30);
```

## Tags
- Conversion error
- String
- mpequisaproduto
- Alter table
- Ctrl+F12