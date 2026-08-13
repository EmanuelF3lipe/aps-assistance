# MaxSale - Principais Store Procedures e Relatórios

**Criado em:** 21 de julho de 2026
**Sistema:** MaxSale
**Contexto:** Referência das principais store procedures e relatórios do sistema MaxSale.

## Store Procedures Principais

### Clientes
- `DFL_ST_BUSCARCLIENTE` - Listagem de cliente

### Pagamento
- `DFL_ST_CONDICAOPAG` - Listagem da Forma de Pagamento

### Produtos
- `DFL_ST_INFOPROD` - Detalhamento do Produto
- `DFL_ST_LISTAGEMPRODUTO` - Listagem do Produto
- `DFL_ITENS_RECOMENDADOS` - Lista de Recomendações do produto
- `DFL_ST_PRODUTOSIMILAR` - Lista de produtos similares
- `DFL_ST_PRODUTOPOLITICAS` - Lista das politicas comerciais do produto
- `DFL_INFOTECNICA` - Especificações tecnicas do produto
- `DFL_ST_ESTOQUEFILIAL` - Estoque por lote
- `DFL_ST_ULTIMASCOMPRAS` - Ultimas compras do produto

### Filtros
- `SMNDFLFILTROCLIENTE` - Tabela de filtro dinamico do cliente
- `SMNDFLFILTROPRODUTO` - Tabela de filtro dinamico do produto

### Carrinho/Vendas
- `DFL_CARRINHO_UI` - Executada quando inicia um novo atendimento
- `DFL_CARRINHO_ATUALIZAR` - Executada ao atualizar os campos do carrinho (Cabeçalho)
- `DFL_CARRINHO_FINALIZAR` - Executada ao finalizar o carrinho
- `DFL_CARRINHO_COPIA` - Copiar um atendimento
- `DFL_CARRINHO_COPIA_PEDIDO` - Copiar um pedido gerando um novo atendimento
- `DFL_CARRINHO_ITEM_UI` - Inserir ou alterar um item do carrinho
- `DFL_CARRINHO_REABRIR` - Ao editar um pedido
- `DFL_CARRINHO_VIRAPED` - Executada quando finalização do carrinho for do tipo pedido

## Relatórios Principais

### Vendas
- **1.2** - Vendas Por Período (Sintética/Analítica)
- **1.10** - Comissão de Vendedores - Alíquota Produtos (`STP_COMISSPROD`)
- **1.15** - Notas Fiscais Emitidas
- **1.53** - Relatório de Pedidos/Produtos/Financeiro
- **1.55** - Clientes sem movimentação
- **1.60** - Relatório de Gestão de Vendas
- **1.93** - Mapa de vendas e positivação
- **1.103** - Relatório de Curva ABC (`R_1103GERAL`)
- **1.108** - Produtos sem venda

### Financeiro
- **2.7** - Extrato Bancário
- **2.45** - Centro de custo - Vários centros
- **2.47** - Títulos por tipo de pagamento
- **2.51** - Relatório de Conferência de Baixas

### Estoque
- **3.3** - Listagem de Produtos
- **3.14** - Listagem de Produtos por ajuste
- **3.24** - Ficha Kardex
- **3.32** - Tabela de preço por grupo e subgrupo

### Compras
- **5.1** - Notas Fiscais Emitidas (Aquisições por terceiros)

### Gerenciais
- **6.8** - Exercício para Inventário
- **6.19** - Cfops por notas
- **6.42** - Kardex de preço do produto (parâmetro: "ROTINA DE PRECO")

### Clientes
- **7.6** - Por vendedor

## Tags
- MaxSale
- Store procedures
- Relatorios
- Referencia