# Colocar o Prumo no ar

Guia para quando o sistema sair do computador de desenvolvimento. Escrito
em 16/08/2026, com o caminho que o Benedito considerou: **banco no Neon,
backend e frontend em plataforma gerenciada.**

O que já está pronto no repositório (migração e backup) vale em qualquer
cenário. O que está aqui é o passo que falta e depende de decisões de
custo — por isso está documentado em vez de executado.

---

## Antes de qualquer coisa: os segredos

O `docker-compose.yml` hoje tem, escritos em texto:

```
POSTGRES_PASSWORD: prumo
JWT_ACCESS_SECRET: dev-access-secret-prumo-troque-em-producao
JWT_REFRESH_SECRET: dev-refresh-secret-prumo-troque-em-producao
ADMIN_SENHA: prumo123
```

Eles são de desenvolvimento e **nenhum deles pode ir para produção**. Os
dois segredos de JWT são o que impede alguém de forjar um token e entrar
como dono. Gere novos:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Um para cada. Guarde no painel de variáveis da plataforma, nunca no Git.

**Troque também a senha do admin** antes de abrir o sistema para a
internet — `prumo123` está no repositório.

---

## 1. Banco no Neon

1. Crie o projeto em [neon.tech](https://neon.tech) (o plano gratuito
   basta para começar) e copie a *connection string*.
2. Rode o schema inicial uma vez:
   ```bash
   psql "<connection-string>" -f docs/schema.sql
   ```
3. Aplique as migrações:
   ```bash
   DATABASE_URL="<connection-string>" npm run migrar --prefix BackEnd
   ```

O Neon exige SSL. A `connectionString` do `pg` já entende o
`?sslmode=require` que vem na URL — não precisa mexer no `db.js`.

**O backup do Neon**: o plano gratuito guarda histórico de 24h
(*point-in-time restore*); os pagos guardam mais. Isso cobre a parte 2 do
item #10 sem esforço, mas **não substitui** o `npm run backup`: um dump
seu, num disco seu, é o que resta se a conta do Neon for perdida ou
encerrada. Rode o backup pelo menos antes de cada mudança grande.

---

## 2. Backend

Qualquer plataforma que rode Node 22 serve (Railway, Render, Fly.io).
Configuração:

| Variável | Valor |
|---|---|
| `DATABASE_URL` | a connection string do Neon |
| `NODE_ENV` | `production` |
| `JWT_ACCESS_SECRET` | o gerado acima |
| `JWT_REFRESH_SECRET` | outro, diferente |
| `ADMIN_EMAIL` / `ADMIN_SENHA` | credenciais reais do dono |
| `LOJA_NOME` / `LOJA_TELEFONE` / `LOJA_ENDERECO` | cabeçalho do recibo |
| `LOJA_PRAZO_FIADO_DIAS` | prazo do fiado (padrão 30) |
| `OPENROUTER_API_KEY` | opcional — sem ela o Zé responde 503 e o resto funciona |

Comando de start: `npm start`. As migrações rodam sozinhas no boot; se
alguma falhar, a API **não sobe** — é proposital, para o erro aparecer no
deploy e não no meio de uma venda.

**Falta um `Dockerfile` de produção.** Os dois existentes são
`Dockerfile.dev`: montam o código por volume e rodam `node --watch`. A
maioria das plataformas detecta um projeto Node e constrói sozinha, então
isso só vira problema se a escolhida exigir Docker.

**`NODE_ENV=production` importa:** é o que faz o cookie do refresh sair
com `secure: true` (`auth.controller.js`), ou seja, só trafegar em HTTPS.

---

## 3. Frontend

Build estático — Vercel, Netlify ou a mesma plataforma do backend:

```bash
cd FrontEnd && npm run build   # gera dist/
```

O `vite.config.js` faz proxy de `/api` para o backend **em
desenvolvimento**. Em produção o `dist/` é servido por outro host, então é
preciso apontar as chamadas para a URL real da API — hoje `services/api.js`
usa caminho relativo. Duas saídas:

- servir o `dist/` pelo mesmo domínio da API (um proxy na frente dos dois); ou
- introduzir uma variável tipo `VITE_API_URL` e usá-la no `api.js`.

A primeira evita mexer em código e mantém o cookie do refresh no mesmo
domínio, que é o desenho atual. **A segunda exige configurar CORS com a
origem exata** — `cors({ origin: true })` como está hoje reflete qualquer
origem, o que com `credentials: true` é permissivo demais para produção.

---

## 4. Depois de subir, confira

- [ ] `GET /api/health` responde `ok`
- [ ] Login funciona e **a senha antiga (`prumo123`) não**
- [ ] `npm run migrar:status` mostra tudo aplicado
- [ ] Uma venda de teste é lançada, aparece no painel e imprime recibo
- [ ] `npm run backup` gera arquivo, e `npm run restaurar` traz de volta
      (teste isso **antes** de precisar)
- [ ] O vendedor de teste não alcança `/api/painel/faturamento` (403)

---

## O que continua pendente

- **Dockerfile de produção** — só necessário se a plataforma exigir.
- **CORS restrito à origem real** — hoje `origin: true`.
- **Backup automático agendado** — os scripts existem; falta o cron da
  plataforma chamando `npm run backup` e guardando fora do servidor.
- **HTTPS e domínio** — as plataformas gerenciadas resolvem sozinhas.
