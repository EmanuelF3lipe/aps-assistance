# Pedidos Presos no Ágilis com NF já Emitida(disphel)

Contexto / Quando acontece: Quando o pedido de venda perde o vínculo com a nota fiscal emitida, fazendo com que o Ágilis continue listando o pedido para importação e emissão de cupom de forma indevida.
Criado em: 15 de junho de 2026 07:32
Sistema: SCG-win
Resolução (passo a passo): Identificou-se que o campo codnfvenda estava em branco/nulo na tabela de pedidos (pedvend).

Localize o código da Nota Fiscal de Venda correspondente ao pedido.

Insira/vincule manualmente o código da NF (codnfvenda) diretamente no respectivo pedido de venda (pedvend) para atualizar o status e sumir da lista do Ágilis.
Tags: Informação
Última edição: 15 de julho de 2026 08:33