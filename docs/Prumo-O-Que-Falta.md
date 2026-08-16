# Prumo — o que falta para o produto se julgar completo

Levantamento de 15/08/2026, feito a partir do código real (não do plano).

**Diagnóstico:** o MVP está funcionalmente inteiro. O que falta separa
"funciona na minha máquina" de "roda no balcão de um depósito real".

Fora desta lista de propósito: nota fiscal, estoque, entrega/frete e
financeiro completo — decisão de escopo registrada no `CLAUDE.md`,
não esquecimento.

---

## Top 10

| # | Lacuna | Por que dói no mundo real | Esforço | Onde |
|---|---|---|---|---|
| 1 | ~~**Recibo/comprovante da venda**~~ ✅ **feito em 16/08/2026** | A venda era lançada e o cliente saía sem nada na mão. Agora sai recibo térmico (bobina 80mm) e por WhatsApp, com cabeçalho da loja, na confirmação da venda e como segunda via no detalhe. | M | `recibo.js` + `AcoesRecibo.jsx` |
| 2 | ~~**`/api/painel/*` aberta a qualquer autenticado**~~ ✅ **feito em 15/08/2026** | Dívida já registrada no `CLAUDE.md`: o vendedor via faturamento, ticket médio e o ranking dos colegas. Agora os seis indicadores da loja são `requireDono`, e o vendedor tem `meu-resumo`/`minha-evolucao` + a tela `MeuPainel.jsx`. | P | `painel.routes.js` |
| 3 | ~~**Sem middleware global de erro e sem rate limit no login**~~ ✅ **feito em 15/08/2026** | Login limitado a 10 tentativas malsucedidas por IP/15 min; os 17 pontos que devolviam `detalhe: erro.message` agora logam no servidor e respondem só a mensagem amigável; `app.js` ganhou 404 em JSON e middleware de erro. | P | `app.js` |
| 4 | ~~**Validação de entrada na borda**~~ ✅ **feito em 16/08/2026** | Era pior que o previsto: `quantidade: "abc"` **gravava venda com `valor_total = NaN`** e contaminava o faturamento. Corrigido com `config/validar.js` + 58 testes. | M | `config/validar.js` |
| 5 | ~~**Editar venda lançada**~~ ✅ **feito em 16/08/2026** | Só existia criar e cancelar. Agora "Corrigir venda" cancela a original e reabre a tela preenchida — sem redigitar nada, e sem reescrever histórico. | M | `venda.service.js` |
| 6 | ~~**Funcionar com internet caindo**~~ ✅ **feito em 16/08/2026** | A venda em andamento fica guardada no navegador e é oferecida de volta ao reabrir. Aviso em português no lugar de "Failed to fetch". Fila de reenvio automático ficou de fora — risco de venda duplicada. | M–G | `rascunhoVenda.js` |
| 7 | ~~**Log de auditoria**~~ ✅ **feito em 16/08/2026** | Produto e cliente passaram a registrar quem fez, o quê e o que mudou, com tela de histórico para o dono. Venda e fiado ficaram de fora: já têm autoria própria. | M | `auditoria/` |
| 8 | ~~**Cobrança de fiado é passiva**~~ ✅ **feito em 16/08/2026** | Agora há prazo padrão configurável, atrasados destacados e ordenados na tela, cobrança pronta no WhatsApp e alerta de vencido no painel. | M | `fiado` + `cobranca.js` |
| 9 | ~~**Nenhum teste do que o usuário vê**~~ ✅ **feito em 16/08/2026** | As contas de `NovaVenda.jsx` saíram para `utils/calculoVenda.js` com 63 testes. O front passou de 59 para 191 testes. Renderização segue sem cobertura — decisão consciente, ver abaixo. | M | `calculoVenda.js` |
| 10 | ~~**Sem caminho para produção**~~ 🟡 **parcial em 16/08/2026** | Migração e backup **feitos e testados**. O deploy em si (Neon + plataforma gerenciada) está documentado em `Prumo-Colocar-No-Ar.md`, aguardando decisão de hospedagem. | M–G | infra |

---

## Ordem sugerida de ataque

1. ~~**#2 + #3**~~ ✅ **concluído em 15/08/2026** (ver "Parte 1" abaixo).
2. ~~**#1**~~ ✅ **concluído em 16/08/2026** (ver "Recibo" abaixo).
3. ~~**#5**~~ ✅ **concluído em 16/08/2026** (ver "Corrigir venda" abaixo).
4. ~~**#9** e **#8**~~ ✅ **concluídos em 16/08/2026** (ver as duas seções finais).
5. **#10** — sem migração, todo o resto vira retrabalho no dia que existir dado real.

**Resta:** #10 — só o deploy. Migração e backup estão feitos e testados; falta a decisão de hospedagem e trocar os segredos (ver `Prumo-Colocar-No-Ar.md`).

---

## Venda sobrevive à queda de internet (16/08/2026) — item #6

**O que escolhemos NÃO fazer:** fila que reenvia sozinha. Ela criaria risco de **venda duplicada** — a requisição pode ter chegado ao servidor antes da queda — e de venda gravada sem ninguém olhando. O remédio seria pior que a doença.

**O desenho:** a venda em andamento é salva no navegador a cada mudança. Se a internet cai, um aviso explica o que houve e diz que nada se perdeu. Ao reabrir a tela, o sistema **oferece** a venda de volta em vez de restaurá-la sozinho.

Também corrigimos um vazamento que ninguém tinha notado: quando a rede caía, a tela mostrava **"Failed to fetch"** — texto em inglês do navegador, no meio do balcão. Agora `services/api.js` traduz isso para "Sem conexão com o sistema", e o erro carrega uma flag que distingue falha de rede de erro de regra de negócio.

**Decisões que valem registrar:**

- `localStorage` **pode falhar** (modo privado, cota cheia). Todo acesso é protegido: rascunho é rede de segurança, não requisito, e um erro ali não pode derrubar a venda. Há teste com storage quebrado provando isso.
- **Validade de 30 minutos** — rascunho de ontem confundiria mais que ajudaria.
- **Não restaura sozinho:** quem abre a tela para vender estranharia encontrar itens que não colocou.
- O aviso de "sem conexão" some sozinho quando a internet volta (eventos `online`/`offline`), sem recarregar.

**Verificação:** 42/42 na suíte, e o ciclo inteiro no navegador real — venda lançada, rede derrubada, aviso correto, página recarregada do zero, venda oferecida de volta, restaurada e gravada, rascunho limpo no fim.

---

## Log de auditoria (16/08/2026) — item #7

**O que já existia de graça:** venda guarda `usuario_id`, pagamento de fiado guarda quem recebeu, e a correção de venda deixa as duas versões no histórico. Registrar isso de novo duplicaria o dado e faria a tabela crescer a cada venda.

**O buraco real era cadastro:** quem mudou o preço do cimento, quem editou o telefone do cliente, quem desativou o produto. É a pergunta que aparece quando o número do painel não bate com a memória de alguém.

**O que existe agora:** `log_auditoria` (migração 003 — aplicada sem apagar o banco, o sistema de ontem já pagando dividendos) e uma tela `/historico` para o dono, com filtro por tipo e por pessoa.

**Decisões que valem registrar:**

- **Registrar nunca derruba a operação.** Se o log falhar, a escrita já aconteceu — abortar trocaria um problema pequeno por um grande. `registrar()` engole o erro e grita no console.
- `usuario` entrou como **último parâmetro opcional** dos services, para não quebrar chamadas existentes. Controllers e as 4 tools de escrita do Zé foram atualizados para repassar — escrita por IA sem autoria seria o pior buraco possível, e há teste cobrindo isso.
- **Salvar sem mudar nada não vira linha.** O diff compara o que o banco gravou antes/depois, não o que foi pedido.
- Ativar/desativar tem ação própria, não vira "editar" com um booleano no meio.
- Nome do usuário e da entidade são **cópias congeladas**: o log continua legível depois que o produto for apagado.
- FK do usuário é `ON DELETE SET NULL` — apagar alguém não pode apagar o que essa pessoa fez.

`utils/historico.js` (33 testes) traduz o log para português: `preco_venda` vira "Preço de venda", `"42.00"` vira "R$ 42,00", `null` vira "vazio". Sem isso a tela seria um dump de banco. A suíte pegou um bug real ali — categoria vazia aparecia como "vazio" em vez de "sem categoria".

**Verificação:** 24/24 contra a API (incluindo o 403 do vendedor e o nome sobrevivendo ao delete), 7/7 nas escritas do Zé, 33/33 na tradução, 165/165 no Zé, 218/218 no front, lint e build limpos.

---

## Validação de entrada (16/08/2026) — item #4

**O bug era pior do que a lista dizia.** Sondei a API antes de escrever qualquer coisa, e `quantidade: "abc"` **não era rejeitado: gravava a venda**.

A raiz: a checagem era `Number(item.quantidade) <= 0`, e `NaN` não é menor nem maior que zero — a comparação dá `false` e o item passa. E o `NUMERIC` do Postgres **aceita `NaN` como valor válido**. Resultado confirmado no banco:

```
valor_total no banco: NaN
entra no faturamento como: NaN
aparece na lista de vendas: SIM (total NaN)
```

Como `NaN + qualquer coisa = NaN`, **uma venda dessas zeraria o painel inteiro** — sem erro, sem log, sem pista.

**O que mudou:** `config/validar.js`, módulo puro com 58 testes. A regra que ele encapsula: `Number(x)` não valida nada (devolve `NaN` para lixo, `Infinity` para `"1e400"`, `0` para `''`, `null`, `[]` e `false`).

Aplicado em venda, cliente e produto. Na borda HTTP, `app.js` ganhou limite de 256 KB no corpo e tradução de JSON malformado para 400.

**Antes → depois** (sondagem contra a API real):

| Entrada | Antes | Depois |
|---|---|---|
| `quantidade: "abc"` | ✅ grava NaN | 400 "Quantidade precisa ser um número válido" |
| `preco_unitario: "abc"` | ✅ grava NaN | 400 |
| `desconto: "abc"` | ✅ aceita | 400 |
| `nome: 12345` | ✅ vira `"12345"` | 400 "Nome precisa ser um texto" |
| `quantidade: 1e12` | 500 cru | 400 "Quantidade é grande demais" |
| `cliente_id: "xxx"` | 500 cru | 400 "Cliente inválido" |
| nome com 5000 chars | 500 cru | 400 com o limite |
| 5000 itens | 500 cru | 413 |
| JSON quebrado | 500 cru | 400 "Requisição malformada" |

**Detalhe de produto, não de código:** as mensagens começam com maiúscula, não citam nome de coluna (`forma de pagamento`, não `forma_pagamento`), não falam em UUID, e concordam em gênero — "unidade inválida", não "unidade inválido". Quem lê é o balconista.

**Verificação:** 58/58 na suíte nova, 165/165 no Zé (11 asserções precisaram ser alinhadas às mensagens novas), 191/191 no front, build limpo.

---

## Migração e backup (16/08/2026) — item #10, primeira metade

**O que travava:** `docs/schema.sql` só roda na primeira subida do volume. Alterar tabela exigia `docker compose down -v` — apagar o banco. Isso já tinha custado duas decisões: o vencimento do fiado virou variável de ambiente em vez de coluna, e a tela de configuração da loja não foi feita.

**Migrações** (`BackEnd/migracoes/`, sem dependência nova): arquivos `.sql` numerados, aplicados no boot da API, uma vez cada. Cada uma roda em transação, e o registro acontece na mesma transação — separados, uma queda no meio deixaria a migração aplicada e não registrada. Um advisory lock impede duas instâncias migrando juntas. Migração que falha derruba o boot: melhor o erro aparecer no deploy que no meio de uma venda.

A `002` já pagou a primeira dívida: `venda.vence_em` existe. Anulável de propósito — NULL significa "usa o prazo padrão da loja", então o comportamento atual segue idêntico e as vendas antigas continuam válidas sem backfill inventado.

**Backup** (`scripts/backup-docker.sh`): dump `.sql` completo, mantendo os 7 mais recentes, fora do Git. Formato texto e não binário de propósito — um `.sql` pode ser lido e restaurado por qualquer ferramenta na hora do aperto; o dump binário exige exatamente o `pg_restore` da versão certa.

Descoberta durante o teste: **`pg_dump` não existe no container da API** (`node:22-alpine`). Quem tem é o container do banco, e o script passou a usá-lo.

**Verificação — o teste que importava:** backup gerado (46 KB), `DELETE` em todas as vendas, itens e pagamentos, restauração, **16 vendas, 18 itens, 2 pagamentos e 3 clientes de volta**, com o controle de migrações preservado. As duas migrações rodaram no banco existente sem apagar nada. 165/165 no Zé e 191/191 no front depois de tudo.

**O que falta do #10:** o deploy. Documentado em `docs/Prumo-Colocar-No-Ar.md` com o caminho que o Benedito considerou (Neon + plataforma gerenciada), incluindo os segredos que precisam ser trocados (`JWT_*` e `ADMIN_SENHA` estão em texto no compose), o CORS que hoje é `origin: true`, e a questão de como o front alcança a API em produção. Não executado porque envolve custo mensal e decisão de hospedagem.

---

## Testes do front (16/08/2026) — item #9

**O caminho escolhido:** extrair, não instalar framework. As contas de `NovaVenda.jsx` (subtotal, desconto, troco, montagem do payload, validação, adicionar item) saíram para `utils/calculoVenda.js` — módulo puro, testável em Node, **zero dependências novas**. O `CLAUDE.md` registra a ausência de framework como decisão, e não havia motivo para reabri-la.

O front foi de **59 para 191 testes** (63 novos aqui + 42 do recibo + 27 da cobrança + 59 do ditado).

**O que a suíte trava:**
- `<input type="number">` devolve string — `"315" + "425"` viraria `"315425"` se alguém somasse sem converter.
- `emReais` da tela espelha o do backend; se divergirem, a tela mostra um total e o banco grava outro.
- Desconto maior que a venda é limitado no cliente, não só recusado pelo servidor depois do clique.
- O payload **não** leva `usuario_id` — quem vendeu sai do token.

**Melhoria de comportamento no caminho:** o troco aparecia como "Falta R$ 300,00" com o campo de recebido ainda vazio. Agora é `null` até alguém digitar.

**Fora de escopo, conscientemente:** renderização e clique continuam sem cobertura. Testar isso exige Vitest + Testing Library (~4 dependências num projeto com 6). Se um bug de renderização aparecer, a decisão se reabre — hoje não havia sintoma que justificasse.

---

## Vencimento e cobrança de fiado (16/08/2026) — item #8

**Prazo padrão, não data por venda.** `LOJA_PRAZO_FIADO_DIAS` (30 por padrão) aplicado sobre a data da venda. Data por venda exigiria coluna nova, e sem ferramenta de migração isso significa recriar o banco — inviável com dado real. O prazo geral também reflete melhor como depósito combina ("pra semana que vem"), e vale retroativamente para as dívidas que já existem.

**O que existe agora:**
- Tela de Fiados ordena por **atraso primeiro**, não por valor: ordenar por valor faria a conta grande e nova esconder a pequena e velha, que é justamente a que precisa de cobrança.
- Selo de "45d de atraso" no nome, filtro "ver só os atrasados", KPI de vencido separado do total a receber.
- Botão de cobrar que abre o WhatsApp com texto pronto.
- Alerta no painel quando há vencido, levando direto para a cobrança.

**O tom da cobrança é requisito testado.** Quem deve no depósito é cliente que vai voltar; cobrança ríspida resolve uma conta e perde um cliente. A suíte falha se aparecerem "dívida", "devedor", "inadimplente", "juros", "multa", "nome sujo" ou "urgente".

**Decisões de UX que valem registrar:** o KPI de vencido só fica vermelho quando há valor vencido, e o alerta do painel só aparece quando existe — um alarme permanente marcando R$ 0,00 treina a pessoa a ignorar a cor no dia em que ela importa.

**Verificação:** 27/27 na suíte de cobrança, 16/16 contra a API com datas controladas (5 dias, 30 exatos, 75 dias), 165/165 na suíte do Zé, lint e build limpos.

---

## Parte 1 — Segurança (concluída em 15/08/2026)

**O que mudou**

- Os seis indicadores da loja passaram a exigir `dono`. O vendedor ganhou `/painel/meu-resumo` e `/painel/minha-evolucao`, que filtram por `req.usuario.id` (nunca por id da query), e a tela `MeuPainel.jsx` — sem trocar o backend e o front juntos, trancar a rota deixaria o vendedor com erro na entrada.
- `POST /api/auth/login` limitado a 10 tentativas **malsucedidas** por IP a cada 15 min. Login certo não consome cota, para que a loja inteira num IP só não se autobloqueie.
- Os **17 pontos** que devolviam `detalhe: erro.message` foram corrigidos — inclusive `/api/health`, que é pública, e o assistente, cuja resposta volta como contexto para o modelo. O detalhe agora vai para `console.error`.
- `app.js`: `trust proxy = 1`, 404 em JSON e middleware de erro de 4 argumentos.

**Verificação:** 165/165 na suíte de tools, 18/18 num script de ponta a ponta contra a API (vendedor barrado nas seis rotas, liberado nas próprias, força bruta cortada com 429, nenhuma resposta com `detalhe`), 8/8 confirmando que o dono não foi barrado junto, e `npm run lint` sem avisos novos.

**Fica registrado:** o contador do rate limit é em memória, então reiniciar a API zera as tentativas. Para várias instâncias ou reinício frequente, isso precisa de um store compartilhado — decisão que pertence ao item #10 (produção).

### Parte 1b — o recorte por papel nas demais telas (16/08/2026)

Continuação da mesma linha, decidida depois de rever o que o vendedor enxergava:

- **Vendas:** ele vê só as que lançou. O filtro vem do token e sobrescreve a query; abrir venda de outro pelo id responde 404 (não 403 — "existe, mas não é sua" já confirmaria a venda).
- **Clientes:** a tela sai do menu dele. A **busca** continua aberta (mín. 2 caracteres, máx. 8 resultados) porque sem ela toda venda viraria "Consumidor", que some do histórico e não dá para corrigir. Ele cadastra cliente novo; não edita nem apaga.
- **Fiados:** a tela sai do menu. No lugar dela, ao escolher o cliente em Nova Venda aparece **"Este cliente tem R$ X em aberto"** com botão de abater — ideia do Benedito, melhor que as opções que eu havia proposto: o vendedor sabe da conta de quem está atendendo, sem receber o mapa de quem deve à loja. De quebra, a dívida é cobrada com o devedor presente, em vez de esperar alguém abrir uma tela.
- `RotaProtegida` ganhou `soDono`, aplicado também em `/usuarios` — o back já barrava, mas a tela abria e quebrava em 403.

**Verificação:** 17/17 no recorte por papel (vendas, clientes, fiados, com tentativa de burla por query string e por id), 13/13 no ciclo completo do aviso de fiado (vende fiado → aviso → paga parcial → paga o resto → aviso some), 165/165 na suíte do Zé, lint e build limpos.

---

## Recibo da venda (16/08/2026) — item #1

**O que existe agora**

Dois formatos, escolhidos com o Benedito: **térmico** (bobina 80mm, 32 colunas) e **WhatsApp** (texto com marcação, link `wa.me` já preenchido). Com cabeçalho da loja — nome, telefone e endereço vindos de variável de ambiente (`LOJA_NOME`, `LOJA_TELEFONE`, `LOJA_ENDERECO`), não do banco, porque não há ferramenta de migração e são três campos.

Aparece em dois lugares: na **confirmação da venda** (com o cliente ainda no balcão) e no **detalhe da venda**, como segunda via para quem volta com dúvida. Venda cancelada não oferece recibo.

**Decisões que valem registrar**

- `utils/recibo.js` é módulo puro, testável em Node sem impressora — mesmo princípio do corretor de ditado.
- **Nenhum valor é recalculado na tela:** o item traz `subtotal` congelado do banco. O papel na mão do cliente é a versão que vale numa discussão, e ele não pode discordar do sistema.
- A suíte falha se qualquer linha passar de 32 colunas. Foi ela que pegou o caso do nome de cliente longo, que era truncado em vez de quebrado.
- `SELECT_VENDA` passou a trazer `cliente_telefone`, senão cada envio no WhatsApp exigiria procurar o contato na lista do celular.

**Verificação:** 42/42 na suíte do recibo (largura, contas, fiado, loja sem cadastro, links de WhatsApp, entrada malformada), 14/14 contra a API rodando — incluindo montar o recibo com dados vindos do banco e conferir o total, 165/165 na suíte do Zé, lint e build limpos.

**Fica registrado:** não há tela para editar os dados da loja — hoje é variável de ambiente, e mudar exige reiniciar o container. Quando existir tela de configuração, `config/loja.js` vira o valor padrão dela.

---

## Corrigir venda (16/08/2026) — item #5

**O caminho escolhido:** cancelar e reabrir preenchido, não editar. `POST /vendas/:id/corrigir` cancela a venda e devolve um molde; a tela abre `Nova Venda` já com cliente, itens, desconto e forma de pagamento. O vendedor ajusta o que errou e salva — a correção entra como venda nova, pelo `POST /vendas` de sempre.

Isso concilia duas coisas que pareciam brigar: o `CLAUDE.md` manda o histórico ser imutável (`item_venda` congelado, RF12), e a meta dos 30 segundos proíbe que consertar um erro seja mais lento que riscar o caderno. Nada é reescrito; as duas versões existem, e o rastro sai de graça.

**Regras:** o dono corrige qualquer venda; o vendedor só as dele e só no mesmo dia do calendário. Venda de outro vendedor responde 404 (não 403 — "existe, mas não é sua" já confirmaria a venda).

**Dois problemas encontrados e corrigidos de passagem:**

1. **Pagamento de fiado órfão.** Cancelar uma venda fiado que já recebeu pagamento fazia a dívida sumir da lista (as consultas de fiado só veem vendas `concluida`) enquanto os registros em `pagamento_fiado` continuavam apontando para ela. O dinheiro entregue pelo cliente sumia do sistema sem que ninguém notasse. Agora é recusado com a mensagem de devolver o valor antes. Isso existia independente da correção de venda — ficou mais provável de acontecer depois que o vendedor ganhou o botão de receber fiado na tela de venda.

2. **`PATCH /vendas/:id/cancelar` estava aberta a qualquer vendedor**, enquanto a tool `cancelar_venda` do Zé sempre foi `['dono']` — a mesma assimetria do painel, em outro lugar. Agora é só do dono; o vendedor usa "Corrigir venda".

**Verificação:** 25/25 contra a API rodando — caminho feliz com molde completo, item congelado da original intacto, corrigir duas vezes recusado, venda de outro vendedor, venda de outro dia, cancelar por papel, e o ciclo do fiado pago confirmando que a dívida continua íntegra depois das recusas. Mais 165/165 na suíte do Zé, lint e build limpos.
