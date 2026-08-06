<div align="center">

# 🧱 PRUMO

### *Seu depósito no prumo.*

**Sistema de gestão para depósito de material de construção**
Registro de vendas rápido no balcão · Painel visual com os indicadores do negócio

<br>

![Status](https://img.shields.io/badge/status-em_elabora%C3%A7%C3%A3o-C42E1E?style=for-the-badge)
![Versão](https://img.shields.io/badge/vers%C3%A3o-0.1-16191D?style=for-the-badge)
![Plataforma](https://img.shields.io/badge/mobile-first-1B7A46?style=for-the-badge)
![Foco](https://img.shields.io/badge/venda_em-%3C_30s-FFC400?style=for-the-badge&labelColor=16191D)

<br>

`📄 Documento vivo` · `📅 Atualizado em 24/07/2026`

</div>

---

## 📋 Sumário

- [🎯 O problema](#-o-problema)
- [💡 A proposta](#-a-proposta)
- [✨ Princípios de design](#-princípios-de-design)
- [🗺️ Roadmap](#️-roadmap)
- [⚙️ Funcionalidades](#️-funcionalidades)
- [🚫 Fora de escopo](#-fora-de-escopo)
- [🎨 Identidade visual](#-identidade-visual)
- [📚 Documentação](#-documentação)
- [❓ Pontos em aberto](#-pontos-em-aberto)

---

## 🎯 O problema

O depósito opera hoje **100% no papel** 📓 (caderno de vendas). O dono perde informação e não consegue responder perguntas básicas sobre o próprio negócio:

> *Quem compra mais? Quanto compra em média? O que vou vender mês que vem?*

Não há sistema anterior nem base histórica digitalizada. **Ponto zero.**

---

## 💡 A proposta

Dar ao dono **visibilidade sobre o negócio** por meio de uma interface simples e visual, sustentada por um registro de vendas **rápido o bastante para substituir o caderno** no dia a dia.

<div align="center">

### ⏱️ A meta que define o produto

> **Lançar uma venda simples em menos de 30 segundos.**
> Se for mais lento que o caderno, o sistema é abandonado.
> **Tudo se subordina a isso.**

</div>

---

## ✨ Princípios de design

O Prumo tem identidade própria — o **fio de prumo** 📐 como elemento de marca, que marca hierarquia e não enfeite.

| | Princípio | O que significa |
|:---:|---|---|
| 👀 | **Visual e autoexplicativo** | Feito para quem não tem familiaridade com sistemas |
| 📱 | **Mobile-first** | O balcão raramente tem PC livre — a mão que usa o Prumo está segurando outra coisa *(alvos de toque de 56–64px)* |
| 🛡️ | **Resiliente** | Funciona com internet instável e faz backup automático |

---

## 🗺️ Roadmap

*Execução por fases — a ordem viável, não a ordem dos desejos.*

```
FASE 1 ──▶ FASE 2 ──▶ FASE 3 ──▶ FASE 4
 vendas    painel    estoque   previsão
```

| Fase | Entrega | Por quê |
|:---:|---|---|
| 🟢 **1** | Registro de venda + cadastro de cliente e produto | Pré-requisito de tudo. Sem dado de entrada, não há painel. |
| 🔵 **2** | Painel com indicadores | Entrega o valor percebido já na 1ª semana de uso. |
| ⚪ **3** | Controle de estoque | Depende de inventário inicial e disciplina de entrada de nota. |
| ⚪ **4** | Previsão de demanda | Exige 12–24 meses de histórico. Só faz sentido depois. |

---

## ⚙️ Funcionalidades

### 🔥 Núcleo (MVP)
- 🧾 Registro de vendas com itens, forma de pagamento e **preço editável na hora** *(negociação é regra no ramo)*
- 👤 Cadastro mínimo de cliente (só nome e telefone) e venda avulsa para *"Consumidor"*
- ✍️ Registro automático de **quem efetuou a venda** *(mesmo com um único operador hoje)*

### 📊 Painel de indicadores
- 💰 Faturamento do mês com comparação ao anterior, ticket médio e produtos mais vendidos
- 🏆 Ranking de clientes (por valor e volume) e curva ABC
- 🔔 **Alerta de cliente sumido** — quem comprava com regularidade e não voltou

### 🔮 Fases futuras
- 📦 **Estoque:** saldo, baixa automática na venda, entrada por nota e alerta de mínimo
- 📈 **Previsão de demanda:** com sazonalidade, sempre com margem de erro e base de cálculo

---

## 🚫 Fora de escopo

> *Manter o MVP enxuto é uma decisão, não um esquecimento.*

🧾 Emissão de nota fiscal &nbsp;·&nbsp; 💵 Financeiro completo (contas a pagar/receber) &nbsp;·&nbsp; 🚚 Controle de entrega e frete &nbsp;·&nbsp; ⚖️ Integração com balança/PDV

---

## 🎨 Identidade visual

<div align="center">

| Token | Amostra | Hex | Uso |
|---|:---:|---|---|
| **Vermelho prumo** | 🟥 | `#C42E1E` | Texto, fio de prumo, cabeçalhos, alertas |
| **Trena** | 🟨 | `#FFC400` | Destaque / ação primária |
| **Nível** | 🟩 | `#1B7A46` | Estados positivos |
| **Grafite** | ⬛ | `#16191D` | Texto principal |
| **Concreto** | ⬜ | `#E6E9EB` | Fundo |

</div>

**🔤 Tipografia:** `Archivo` (UI) · `Archivo Black` (display e números)

---

## 📚 Documentação

| Documento | Descrição |
|---|---|
| 📄 [`docs/Prumo-Requisitos-v0.1.md`](docs/Prumo-Requisitos-v0.1.md) | Requisitos completos — contexto, requisitos funcionais e não-funcionais, riscos e pontos em aberto |
| 🎨 [`docs/prumo-design-system.html`](docs/prumo-design-system.html) | Design system v0.1 — cores, tipografia e componentes *(abra no navegador)* |
| 🤖 [`docs/Prumo-Assistente-IA-Plano.md`](docs/Prumo-Assistente-IA-Plano.md) | Plano de integração do assistente de IA — arquitetura em camadas, catálogo de tools, permissões e ordem de execução |

---

## ❓ Pontos em aberto

- 📒 O depósito vende **fiado**? A caderneta entra no MVP?
- 🏷️ Existe **tabela de preço** ou é sempre negociado?
- 🗂️ Vale a pena **digitalizar os cadernos antigos**?

> 👉 Detalhes na seção 9 do [documento de requisitos](docs/Prumo-Requisitos-v0.1.md).

---

<div align="center">

**🧱 Prumo** — construído para o balcão, no ritmo do balcão.

*Feito com foco em quem tem as mãos ocupadas.*

</div>
