# POP - Venda Futura e Remessa F (Disphel)

**Criado em:** 21 de julho de 2026
**Sistema:** MaxSale/SCG-win
**Cliente:** Disphel
**Contexto:** Procedimento Operacional Padrão para emissão de pedidos FUTURA e REMESSA F.

## Conceito

O processo ocorre em duas etapas:

### 1ª Etapa - FUTURA
- Registra compromisso de venda ao cliente
- Gera financeiro da operação
- **NÃO** movimenta estoque
- **NÃO** realiza tributação de ICMS

### 2ª Etapa - REMESSA F
- Concretiza a venda (entrega da mercadoria)
- Baixa o estoque
- Aplica tributação conforme cadastro do produto
- **NÃO** gera novo financeiro

## Fluxo Operacional

| Item | FUTURA | REMESSA F |
|------|--------|-----------|
| Tipo de Pedido | FUTURA | REMESSA F |
| CFOP | 5.922 / 6.922 | 5.117 / 6.117 |
| CST | 90 | Conforme cadastro |
| Gera Financeiro | ✔ Sim | ✘ Não |
| Baixa Estoque | ✘ Não | ✔ Sim |
| Tributa ICMS | ✘ Não | ✔ Sim |

## Checklist Operacional

### Pedido FUTURA
- [ ] Tipo de pedido: FUTURA
- [ ] CFOP 5.922 ou 6.922
- [ ] CST 90
- [ ] Financeiro gerado
- [ ] Estoque não movimentado
- [ ] Sem tributação de ICMS

### Pedido REMESSA F
- [ ] Tipo de pedido: REMESSA F
- [ ] CFOP 5.117 ou 6.117
- [ ] Tributação aplicada conforme cadastro
- [ ] Estoque baixado
- [ ] Sem geração de novo financeiro

## Observações
- FUTURA = apenas compromisso comercial (sem entrega)
- REMESSA F = efetiva entrega (movimenta estoque e tributa)

## Tags
- POP
- Venda futura
- Remessa F
- Disphel
- CFOP
- Tributacao