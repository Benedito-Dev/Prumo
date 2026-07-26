import { Botao, Campo, Kpi, Selo, Aviso, EstadoVazio, Lista, Item, Fio } from './components';

// Showcase provisório: valida os componentes base traduzidos do
// design system. Será substituído pelo roteamento das telas reais.
function Secao({ num, titulo, children }) {
  return (
    <section className="mb-14">
      <div className="flex gap-4 mb-7">
        <Fio />
        <div>
          <div className="font-display text-[13px] text-grafite-medio tracking-[0.05em]">{num}</div>
          <h2 className="text-[26px] font-bold mt-0.5 tracking-[-0.01em]">{titulo}</h2>
        </div>
      </div>
      {children}
    </section>
  );
}

function Bloco({ rotulo, children }) {
  return (
    <div className="bg-superficie border border-linha rounded-g p-[26px] mb-[18px]">
      <p className="text-[12px] font-bold tracking-[0.1em] uppercase text-grafite-medio mb-4">
        {rotulo}
      </p>
      {children}
    </div>
  );
}

export default function App() {
  return (
    <div>
      {/* capa */}
      <div className="bg-grafite text-superficie px-5 py-14">
        <div className="max-w-[1040px] mx-auto flex gap-[26px]">
          <Fio claro />
          <div>
            <h1 className="font-display text-[clamp(52px,11vw,92px)] leading-[0.92] tracking-[-0.02em] m-0">
              PRUMO
            </h1>
            <p className="text-[17px] text-[#A8B0B8] mt-[14px] max-w-[48ch]">
              Componentes do design system em React — a fundação das telas.
            </p>
            <span className="inline-block mt-6 bg-trena text-grafite font-bold text-[13px] tracking-[0.09em] uppercase px-[14px] py-[7px]">
              Seu depósito no prumo
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-[1080px] mx-auto px-5 pb-24 pt-14">
        <Secao num="01" titulo="Botões">
          <Bloco rotulo="Variantes">
            <div className="max-w-[420px]">
              <Botao variante="primario">Salvar venda</Botao>
            </div>
            <div className="flex flex-wrap gap-[14px] items-center mt-[14px]">
              <Botao variante="secundario">Adicionar item</Botao>
              <Botao variante="perigo">Cancelar venda</Botao>
              <Botao variante="texto">Ver histórico completo</Botao>
            </div>
          </Bloco>
        </Secao>

        <Secao num="02" titulo="Campos">
          <Bloco rotulo="Formulário">
            <div className="max-w-[420px]">
              <Campo rotulo="Cliente" defaultValue="José Ferreira — pedreiro"
                ajuda="Digite o nome ou o telefone para buscar." />
              <Campo rotulo="Quantidade (sacos)" numero defaultValue="40" />
              <Campo rotulo="Preço unitário" numero defaultValue="0,00"
                erro="Informe um preço maior que zero." />
            </div>
          </Bloco>
        </Secao>

        <Secao num="03" titulo="Indicadores">
          <div className="grid grid-cols-[repeat(auto-fit,minmax(230px,1fr))] gap-[14px]">
            <Kpi rotulo="Faturamento · julho" valor="R$ 48.230" variacao="12% sobre junho" sentido="sobe" />
            <Kpi rotulo="Ticket médio" valor="R$ 386" variacao="4% sobre junho" sentido="desce" />
            <Kpi rotulo="Vendas no mês" valor="125" variacao="9 vendas" sentido="sobe" />
          </div>
        </Secao>

        <Secao num="04" titulo="Selos de situação">
          <Bloco rotulo="Situações">
            <div className="flex flex-wrap gap-[14px]">
              <Selo variante="pago">Pago</Selo>
              <Selo variante="fiado">Fiado</Selo>
              <Selo variante="vencido">Vencido</Selo>
              <Selo variante="sumido">Sumido</Selo>
            </div>
          </Bloco>
        </Secao>

        <Secao num="05" titulo="Lista de ranking">
          <Lista className="max-w-[520px]">
            <Item posicao={1} nome="Construtora Vale Verde" meta="8 compras · última em 21/07" valor="R$ 9.840" onClick={() => {}} />
            <Item posicao={2} nome="José Ferreira" meta="14 compras · última em 23/07" valor="R$ 6.215" onClick={() => {}} />
            <Item posicao={3} nome="Marcos Andrade" meta="5 compras · última em 18/07" valor="R$ 4.070" onClick={() => {}} />
          </Lista>
        </Secao>

        <Secao num="06" titulo="Avisos e estado vazio">
          <div className="max-w-[520px] flex flex-col gap-[14px]">
            <Aviso variante="atencao" titulo="José Ferreira está sumido">
              Comprava a cada 9 dias, em média. Faz 26 dias que não aparece.
            </Aviso>
            <Aviso variante="erro" titulo="A venda não foi salva">
              Sem internet no momento. Ela fica guardada e sobe sozinha quando a conexão voltar.
            </Aviso>
            <EstadoVazio titulo="Nenhuma venda hoje"
              acao={<div className="max-w-[280px] mx-auto"><Botao variante="primario">Nova venda</Botao></div>}>
              Lance a primeira venda do dia e os números do painel começam a aparecer.
            </EstadoVazio>
          </div>
        </Secao>
      </div>
    </div>
  );
}
