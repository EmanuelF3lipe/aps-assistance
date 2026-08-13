# Documento inexistente(amr)

Contexto / Quando acontece: boleto fica como documento inexistente
Criado em: 22 de maio de 2026 15:40
Sistema: SCG-win
Resolução (passo a passo): 1º Acessar a pasta do SCGWin.

2º Entrar no caminho:
`Boletos > Log > LogBoleto`.

3º Localizar o JSON referente ao boleto que não apareceu, utilizando o valor líquido para identificar corretamente o arquivo.

4º Abrir o JSON em um JSON Viewer.

5º Localizar e copiar o ID do boleto dentro do JSON.

6º Acessar o banco de dados.

7º Realizar um `SELECT` na tabela `PESSOA` utilizando o CNPJ do cliente para localizar o `CODPESSOA`.

8º Após localizar o `CODPESSOA`, realizar um `SELECT` na tabela `CONTA` utilizando o código encontrado.

9º Identificar o registro onde o campo do ID estiver vazio.

10º Inserir manualmente o ID obtido no JSON nesse campo vazio.

11º Salvar a alteração e validar se o boleto volta a aparecer corretamente no sistema.

Última edição: 22 de maio de 2026 15:40