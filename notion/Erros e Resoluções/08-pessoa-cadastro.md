# PESSOA — Cadastro de clientes/fornecedores

**Criado em:** 12/08/2026 08:21
**Sistema:** ScgWin / NUTRIMARCAS
**Contexto / Quando acontece:** Cadastro unificado de pessoas (clientes, fornecedores, transportadoras, vendedores). Usado em todo o sistema: vendas, compras, financeiro, estoque.

## Tabelas — Aplicação

### PESSOA
**PK:** `CODPESSOA` | **~271 colunas** | [Schema completo](schemas/pessoa.md)

Cadastro completo da pessoa com dados cadastrais, fiscais, comerciais e de contato.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| CODPESSOA | INTEGER | PK — código da pessoa |
| NOME | VARCHAR(60) | Nome / Razão Social |
| PESSOA | SMALLINT | Tipo: 1=Física, 2=Jurídica |
| CPFCGC | VARCHAR(18) | CPF ou CNPJ |
| RG | VARCHAR(30) | RG (pessoa física) |
| IE | VARCHAR(30) | Inscrição Estadual |
| IM | VARCHAR(30) | Inscrição Municipal |
| DT_NASC | TIMESTAMP | Data de nascimento / fundação |
| EMAIL | VARCHAR(45) | E-mail principal |
| FONES | VARCHAR(120) | Telefones (múltiplos) |
| LOGRADOURO_1 | VARCHAR(60) | Endereço |
| BAIRRO_1 | VARCHAR(45) | Bairro |
| CIDADE_1 | VARCHAR(45) | Cidade |
| UF_1 | CHAR(2) | UF |
| CEP_1 | VARCHAR(9) | CEP |
| CELULAR | VARCHAR(14) | Celular |
| TIPOPESSOA | VARCHAR(14) | Tipo: CLIENTE, FORNECEDOR, AMBOS |
| LIMITECRED | DOUBLE | Limite de crédito |
| ATIVO | SMALLINT | Se ativo: 1=Sim, 0=Não |
| NOMEFANTAZIA | VARCHAR(60) | Nome fantasia |
| CODVENDEDOR | INTEGER | FK → VENDEDOR — vendedor padrão |
| CODTIPOPAG | INTEGER | FK → TIPOPAG — forma de pagamento padrão |
| ENTREGADORPADRAO | CHAR(1) | Se é entregador padrão |
| US_CADAST | VARCHAR(45) | Usuário de criação |
| DT_CADAST | TIMESTAMP | Data de criação |
