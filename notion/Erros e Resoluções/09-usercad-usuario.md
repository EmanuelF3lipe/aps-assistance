# USERCAD — Cadastro de usuários

**Criado em:** 12/08/2026 08:21
**Sistema:** ScgWin / NUTRIMARCAS
**Contexto / Quando acontece:** Cadastro de usuários do sistema. Controla acesso, permissões e funcionalidades de cada operador. Cada usuário tem um NIVEL/PODER que define o que pode fazer no sistema.

## Tabelas — Aplicação

### USERCAD
**PK:** `CODUSERCAD` | **~181 colunas** | [Schema completo](schemas/usercad.md)

Cadastro do usuário com dados pessoais, credenciais de acesso e dezenas de flags de permissão.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| CODUSERCAD | INTEGER | PK — código do usuário |
| NOME | VARCHAR(60) | Nome completo |
| CPF | VARCHAR(14) | CPF |
| IDLOGIN | VARCHAR(45) | Login de acesso |
| SENHA | VARCHAR(20) | Senha |
| PODER | VARCHAR(15) | Nível de acesso: ADMIN, GERENTE, VENDEDOR, CAIXA, etc. |
| LOGRADOURO | VARCHAR(60) | Endereço |
| BAIRRO | VARCHAR(45) | Bairro |
| CIDADE | VARCHAR(45) | Cidade |
| UF | CHAR(2) | UF |
| CEP | VARCHAR(9) | CEP |
| FONES | VARCHAR(42) | Telefones |
| EMAIL | VARCHAR(60) | E-mail |
| DEPART | VARCHAR(45) | Departamento |
| FUNCAO | VARCHAR(45) | Função cargo |
| CELULAR | VARCHAR(14) | Celular |
| VALID_SENHA | TIMESTAMP | Data de validade da senha |
| CODUSERGRUPO | INTEGER | FK → USERGRUPO — grupo de usuários |
| CODVENDEDOR | INTEGER | FK → VENDEDOR — vendedor vinculado |
| DESCPEDIDO | VARCHAR(3) | Descrição/prefixo do pedido |
| LIB_TROCA | INTEGER | Permissão de troca (0=limitada) |
| PERMITIRALTERARCOMISAO | CHAR(1) | Pode alterar comissão (S/N) |
| CODMONTADOR | INTEGER | FK → MONTADOR — montador vinculado |
| US_CADAST | VARCHAR(45) | Usuário que criou |
| DT_CADAST | TIMESTAMP | Data de criação |

### Flags de permissão (colunas ~24-179)
O USERCAD contém dezenas de flags de permissão (tipicamente VARCHAR(1) ou CHAR(1) com valores 'S'/'N'), como:
- Permissões de venda, compra, estoque
- Permissões de relatórios
- Permissões de cadastros
- Permissões de cancelamento
- Permissões de desconto
- Etc.
