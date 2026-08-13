# Boleto não fica como impresso

Contexto / Quando acontece: Boleto está com Nosso número e remessa porem não está marcado como impresso
Criado em: 11 de maio de 2026 09:38
Sistema: SCG-win
Resolução (passo a passo): select
*
from
conta n
where
n.codpendvend = 128362 <--- Numero do Boleto
Última edição: 22 de maio de 2026 15:35