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
| 4 | **Validação de entrada na borda** | Não há Zod/Joi; o service confia no shape do corpo. `quantidade: "abc"` chega ao SQL. Com dinheiro em `NUMERIC` e `Number()` manual, é fonte de bug silencioso. | M | `*/controller.js` |
| 5 | **Editar venda lançada** | Só existe criar e cancelar. Errou a quantidade? Cancela e refaz tudo. No papel se risca e corrige — aqui fica mais lento que o caderno, o que a meta proíbe. | M | `venda.service.js` |
| 6 | **Funcionar com internet caindo** | Depósito tem Wi-Fi ruim. Se cai no meio da venda, perde tudo. Rascunho em `localStorage` + fila de reenvio salva o núcleo sem virar PWA completo. | M–G | `NovaVenda.jsx` |
| 7 | **Log de auditoria** | O schema já prevê `log_auditoria` como fase futura e nunca saiu. Quem cancelou a venda de R$ 4.000? Quem mudou o preço? Com dinheiro fiado envolvido, é questão de tempo. | M | schema + services |
| 8 | **Cobrança de fiado é passiva** | O módulo registra e consolida, mas ninguém avisa. Falta vencimento + lista de atrasados + botão de mensagem no WhatsApp. Fiado esquecido é prejuízo direto. | M | `fiado` |
| 9 | **Nenhum teste do que o usuário vê** | `npm test` cobre services e tools; o ditado tem 59 testes. As 11 páginas React e todos os controllers HTTP têm zero. `NovaVenda.jsx` tem 791 linhas e é o coração do produto. | M | novo |
| 10 | **Sem caminho para produção** | Sem migração de banco (`down -v` para mudar schema é inviável com dado real), sem backup, sem CI, sem plano de deploy. Pronto para demo, não para o primeiro cliente. | M–G | infra |

---

## Ordem sugerida de ataque

1. ~~**#2 + #3**~~ ✅ **concluído em 15/08/2026** (ver "Parte 1" abaixo).
2. ~~**#1**~~ ✅ **concluído em 16/08/2026** (ver "Recibo" abaixo).
3. **#10** — sem migração, todo o resto vira retrabalho no dia que existir dado real.

Próximos candidatos: **#5** (corrigir venda lançada — hoje o sistema é mais lento que o papel para consertar um erro) e **#10**.

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
