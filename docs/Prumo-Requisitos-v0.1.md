# Documento de Requisitos — Sistema de Gestão para Depósito de Material de Construção

**Versão:** 0.1 (rascunho em construção)
**Data:** 24/07/2026
**Status:** Em elaboração — documento vivo, refinado a cada conversa

---

## 1. Contexto

Depósito de material de construção que hoje opera com controle **100% em papel** (caderno de vendas). O dono percebe que perde informação e não consegue responder perguntas básicas sobre o próprio negócio: quem compra mais, quanto compra em média, o que vai vender mês que vem.

Não existe sistema anterior. Não há base de dados histórica digitalizada.

## 2. Objetivo

Dar ao dono **visibilidade sobre o negócio** por meio de uma interface simples e visual, sustentada por um registro de vendas que seja rápido o bastante para substituir o caderno de papel no dia a dia.

## 3. Usuários

| Fase | Usuário | Observação |
|---|---|---|
| MVP | Apenas o dono | Único operador e único consumidor dos indicadores |
| Futuro | Vendedores de balcão, caixa, estoque | Exige perfis de acesso e identificação de quem vendeu |

**Implicação de arquitetura:** mesmo que o MVP tenha um usuário só, o modelo de dados já deve registrar **quem realizou a venda**. Caso contrário, o indicador "quem vendeu quanto" fica impossível de reconstruir depois.

## 4. Prioridades

Prioridade declarada pelo cliente:

1. Painel com os indicadores
2. Cadastro e histórico de clientes
3. Controle de estoque
4. Previsão de demanda

**Prioridade ajustada para execução** (mesma intenção, ordem viável):

| Ordem | Entrega | Por quê |
|---|---|---|
| 1 | Registro de venda + cadastro de cliente e produto | Pré-requisito de tudo. Sem dado de entrada, não há painel. |
| 2 | Painel com indicadores | Entrega o valor percebido. Fica útil já na 1ª semana de uso. |
| 3 | Controle de estoque | Depende de inventário inicial e disciplina de entrada de nota. |
| 4 | Previsão de demanda | Exige 12–24 meses de histórico. Só faz sentido depois. |

## 5. Requisitos Funcionais

### 5.1 Cadastro de Clientes
- RF01 — Cadastrar cliente com nome, telefone e tipo (consumidor final, pedreiro/mestre de obra, construtora, revenda)
- RF02 — Cadastro mínimo obrigatório: **apenas nome e telefone**. Campos extras são opcionais para não travar o atendimento no balcão.
- RF03 — Permitir venda avulsa sem cliente identificado ("Consumidor"), com o sistema sugerindo o cadastro ao final
- RF04 — Consultar histórico completo de compras de um cliente
- RF05 — Buscar cliente por nome parcial ou telefone

### 5.2 Cadastro de Produtos
- RF06 — Cadastrar produto com nome, unidade de medida e preço de venda
- RF07 — Suportar as unidades típicas do ramo: saco, milheiro, m³, peça, barra, kg, metro, carrada
- RF08 — Permitir preço de custo (necessário para margem — *a confirmar se é escopo do MVP*)
- RF09 — Agrupar produtos por categoria (cimento, cerâmica, hidráulica, elétrica, agregados, ferro, etc.)

### 5.3 Registro de Vendas — *núcleo do MVP*
- RF10 — Lançar venda com: cliente, itens (produto + quantidade + preço), forma de pagamento, data
- RF11 — **Meta de usabilidade: lançar uma venda simples em menos de 30 segundos**
- RF12 — Permitir alterar o preço no momento da venda (negociação é regra no ramo, não exceção)
- RF13 — Registrar automaticamente quem efetuou a venda
- RF14 — Editar ou cancelar venda lançada errado
- RF15 — *A definir:* controle de venda fiado / caderneta

### 5.4 Painel de Indicadores
- RF16 — Faturamento do mês corrente, com comparação ao mês anterior
- RF17 — Ranking dos clientes que mais compraram no mês (por valor e por volume)
- RF18 — Ticket médio geral e ticket médio por cliente
- RF19 — Produtos mais vendidos no período
- RF20 — Vendas por vendedor (relevante na fase de expansão)
- RF21 — Filtro por período: hoje, semana, mês, ano, intervalo customizado
- RF22 — Gráficos simples e legíveis: evolução do faturamento e composição das vendas

### 5.5 Inteligência de Clientes
- RF23 — Frequência média de compra por cliente
- RF24 — **Alerta de cliente sumido**: clientes que costumavam comprar com regularidade e ultrapassaram o intervalo habitual sem retornar
- RF25 — Curva ABC de clientes (quais poucos clientes representam a maior parte do faturamento)

### 5.6 Estoque *(fase 2)*
- RF26 — Saldo atual por produto
- RF27 — Baixa automática de estoque na venda
- RF28 — Entrada de mercadoria por compra/nota
- RF29 — Alerta de estoque mínimo

### 5.7 Previsão de Demanda *(fase 3)*
- RF30 — Projeção de venda por produto para o mês seguinte com base em histórico
- RF31 — Identificação de sazonalidade (período chuvoso reduz obra; 13º e férias aquecem reforma)
- RF32 — Exibir a previsão sempre com margem de erro e base de cálculo, nunca como número absoluto

## 6. Requisitos Não-Funcionais

- RNF01 — Interface visual e autoexplicativa, para usuário sem familiaridade com sistemas
- RNF02 — Uso confortável em celular (o balcão raramente tem computador livre)
- RNF03 — Backup automático dos dados
- RNF04 — Funcionamento aceitável com internet instável
- RNF05 — Arquitetura preparada para múltiplos usuários e perfis de acesso, mesmo que o MVP não os exponha

## 7. Riscos

| Risco | Impacto | Mitigação |
|---|---|---|
| Lançamento mais lento que o caderno → abandono do sistema | **Crítico** | Otimizar obsessivamente o fluxo de venda; testar cronometrado |
| Ausência de histórico digital | Alto | Previsão de demanda só na fase 3; considerar digitalizar cadernos antigos |
| Cadastro de produtos com unidades erradas | Médio | Definir bem as unidades antes de qualquer lançamento |
| Estoque descolado da realidade | Médio | Só ativar o módulo após inventário físico completo |
| Escopo crescendo para virar um ERP completo | Alto | Manter o MVP restrito às fases 1 e 2 |

## 8. Fora de Escopo (por ora)

- Emissão de nota fiscal
- Financeiro completo (contas a pagar/receber, fluxo de caixa)
- Controle de entrega e frete
- Integração com balança ou PDV

## 9. Pontos em Aberto

1. O depósito vende **fiado**? Se sim, a caderneta entra no MVP?
2. **Entrega/frete** é parte relevante da operação e deve ser registrada?
3. Existe **tabela de preço** ou o preço é sempre negociado?
4. Trabalha com **orçamento** antes da venda?
5. Quantos produtos distintos existem no catálogo, aproximadamente?
6. Existem cadernos antigos que valeria a pena digitalizar?
7. Volume médio de vendas por dia?

---

## Histórico de Versões

| Versão | Data | Alterações |
|---|---|---|
| 0.1 | 24/07/2026 | Versão inicial a partir da conversa de levantamento |
