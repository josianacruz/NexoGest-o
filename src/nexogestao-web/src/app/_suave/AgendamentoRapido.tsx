"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { criarLinkWhatsApp } from "../../lib/whatsapp";
import { janelaDoDia, type DiaTrabalho } from "../../lib/horarioTrabalho";
import { useEmpresa } from "./EmpresaContext";
import { SUAVE, brl, gerarHorarios, horarioOcupado, isoDoDia, minutosDe, pad, rotuloDoDia, somarDias } from "./tokens";

export interface ClienteResumo {
  id: number;
  nome: string;
  telefone: string | null;
}

interface Servico {
  id: number;
  nome: string;
  duracaoMinutos: number;
  preco: number;
}

interface AgendamentoDia {
  dataHora: string;
  duracaoMinutos: number;
  status?: string;
}

// Agendamento rápido. Tudo já vem escolhido (último serviço usado, próximo horário livre, cliente da linha em que
// você clicou): quem abre pelo cartão de um cliente confirma com UM clique em "Agendar". Para mudar, é só tocar na
// pastilha desejada; não há campo de data para digitar nem tela seguinte.
export default function AgendamentoRapido({
  aberto,
  aoFechar,
  aoCriar,
  clienteInicial,
  horarioInicial,
}: {
  aberto: boolean;
  aoFechar: () => void;
  aoCriar: () => void;
  clienteInicial?: ClienteResumo | null;
  horarioInicial?: { dia: string; hora: string } | null;
}) {
  const { empresa, api } = useEmpresa();
  const hoje = isoDoDia(new Date());

  const [clientes, setClientes] = useState<ClienteResumo[]>([]);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [semana, setSemana] = useState<DiaTrabalho[] | null>(null); // horário de trabalho (Configurações)
  const [carregado, setCarregado] = useState(false);

  const [clienteId, setClienteId] = useState<number | null>(null);
  const [busca, setBusca] = useState("");
  const [novoCliente, setNovoCliente] = useState(false);
  const [novoNome, setNovoNome] = useState("");
  const [novoTelefone, setNovoTelefone] = useState("");
  const [servicoId, setServicoId] = useState<number | null>(null);
  const [dia, setDia] = useState(hoje);
  const [hora, setHora] = useState<string | null>(null);
  const [doDia, setDoDia] = useState<AgendamentoDia[]>([]);

  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [conflito, setConflito] = useState<string | null>(null);
  const [pronto, setPronto] = useState<{ resumo: string; link: string | null } | null>(null);
  const botaoAgendar = useRef<HTMLButtonElement>(null);
  const pulouHoje = useRef(false);

  // Carrega clientes, serviços e expediente quando abre.
  useEffect(() => {
    if (!aberto || !empresa) return;
    setCarregado(false);
    setErro(null);
    setConflito(null);
    setPronto(null);
    setNovoCliente(false);
    setBusca("");
    setHora(horarioInicial?.hora ?? null);
    setDia(horarioInicial?.dia ?? hoje);
    pulouHoje.current = false;
    setClienteId(clienteInicial?.id ?? null);
    (async () => {
      const [rc, rs, rcfg] = await Promise.all([api("/clientes"), api("/servicos"), api("/agenda/perfil")]);
      if (rc.ok) setClientes(await rc.json());
      if (rs.ok) {
        const lista: Servico[] = await rs.json();
        setServicos(lista);
        const ultimo = Number(localStorage.getItem(`nexo_ultimo_servico_${empresa.id}`));
        setServicoId(lista.find((s) => s.id === ultimo)?.id ?? lista[0]?.id ?? null);
      }
      if (rcfg.ok) setSemana(await rcfg.json());
      setCarregado(true);
    })();
  }, [aberto, empresa?.id]);

  // Agenda do dia escolhido (para saber o que já está ocupado).
  useEffect(() => {
    if (!aberto || !empresa) return;
    (async () => {
      const r = await api(`/agendamentos?inicio=${dia}&fim=${dia}`);
      setDoDia(r.ok ? await r.json() : []);
    })();
  }, [aberto, dia, empresa?.id]);

  const servico = servicos.find((s) => s.id === servicoId) ?? null;
  const duracao = servico?.duracaoMinutos ?? 30;

  // Janela de trabalho do dia escolhido; nulo = a loja não atende nesse dia.
  const janela = useMemo(() => janelaDoDia(semana, dia), [semana, dia]);

  const livres = useMemo(() => {
    const agora = new Date();
    const horaAgora = `${pad(agora.getHours())}:${pad(agora.getMinutes())}`;
    if (!janela) return [];
    return gerarHorarios(janela.inicio, janela.fim, 30).filter(
      (h) => !(dia === hoje && h <= horaAgora) && !horarioOcupado(h, duracao, doDia) && minutosDe(h) + duracao <= minutosDe(janela.fim)
    );
  }, [janela, dia, hoje, duracao, doDia]);

  // Hoje já acabou o expediente (ou lotou)? Começa no dia seguinte, em vez de deixar a pessoa sem opção.
  useEffect(() => {
    if (!aberto || !carregado || horarioInicial || pulouHoje.current) return;
    if (dia === hoje && livres.length === 0) {
      pulouHoje.current = true;
      // hoje não tem mais horário: vai para o próximo dia em que a loja atende
      setDia([1, 2, 3, 4, 5, 6, 7].map((n) => isoDoDia(somarDias(new Date(), n))).find((d) => janelaDoDia(semana, d)) ?? isoDoDia(somarDias(new Date(), 1)));
      setHora(null);
    }
  }, [aberto, carregado, dia, hoje, livres.length, horarioInicial]);

  // Escolhe sozinho o primeiro horário livre quando ainda não há um (ou o escolhido deixou de estar livre).
  useEffect(() => {
    if (!aberto || !carregado) return;
    if (hora && (livres.includes(hora) || hora === horarioInicial?.hora)) return;
    setHora(livres[0] ?? null);
  }, [aberto, carregado, livres]);

  const clientesFiltrados = useMemo(() => {
    const t = busca.trim().toLowerCase();
    const base = t ? clientes.filter((c) => c.nome.toLowerCase().includes(t) || (c.telefone ?? "").includes(t)) : clientes;
    const escolhido = clientes.find((c) => c.id === clienteId);
    const lista = base.slice(0, 8);
    return escolhido && !lista.some((c) => c.id === escolhido.id) ? [escolhido, ...lista.slice(0, 7)] : lista;
  }, [clientes, busca, clienteId]);

  const dias = useMemo(() => [0, 1, 2, 3].map((n) => isoDoDia(somarDias(new Date(), n))), []);

  const clienteEscolhido = clientes.find((c) => c.id === clienteId) ?? (clienteInicial && clienteInicial.id === clienteId ? clienteInicial : null);
  const podeAgendar = !!servico && !!hora && (novoCliente ? novoNome.trim().length >= 2 : !!clienteId);

  useEffect(() => {
    if (!aberto) return;
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && aoFechar();
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [aberto, aoFechar]);

  async function agendar(forcar = false) {
    if (!podeAgendar || !servico || !hora || !empresa) return;
    setSalvando(true);
    setErro(null);
    try {
      let idCliente = clienteId;
      let telefone = clienteEscolhido?.telefone ?? null;
      let nomeCliente = clienteEscolhido?.nome ?? "";
      if (novoCliente) {
        const rc = await api("/clientes", { method: "POST", body: JSON.stringify({ nome: novoNome.trim(), telefone: novoTelefone.trim() || null, email: null }) });
        if (!rc.ok) {
          setErro("Não consegui cadastrar o cliente. Confira o nome e o telefone.");
          return;
        }
        const criado = await rc.json();
        idCliente = criado.id;
        telefone = novoTelefone.trim() || null;
        nomeCliente = novoNome.trim();
      }

      const res = await api("/agendamentos", {
        method: "POST",
        body: JSON.stringify({
          clienteId: idCliente,
          servicoId: servico.id,
          servicoNome: servico.nome,
          data: `${dia}T00:00:00Z`,
          hora,
          duracaoMinutos: servico.duracaoMinutos,
          valor: servico.preco,
          forcarComConflito: forcar,
        }),
      });
      if (res.status === 409) {
        const d = await res.json().catch(() => null);
        const c = d?.conflitos?.[0];
        setConflito(c ? `Já tem ${c.clienteNome} (${c.servicoNome}) nesse horário.` : "Já existe um agendamento nesse horário.");
        return;
      }
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        setErro(d?.mensagem ?? "Não foi possível agendar. Tente de novo.");
        return;
      }

      try {
        localStorage.setItem(`nexo_ultimo_servico_${empresa.id}`, String(servico.id));
      } catch {
        /* ignora */
      }
      const quando = `${rotuloDoDia(dia, hoje).toLowerCase()} às ${hora}`;
      const msg = `Oi, ${nomeCliente.split(" ")[0]}! Seu horário de ${servico.nome} está marcado para ${quando}. Até lá! 😊`;
      setPronto({ resumo: `${nomeCliente} · ${servico.nome} · ${quando}`, link: criarLinkWhatsApp(telefone, msg) });
      aoCriar();
    } finally {
      setSalvando(false);
    }
  }

  if (!aberto) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-slate-900/40 sm:place-items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Agendamento rápido">
      <div className={`${SUAVE.cartao} flex max-h-[94vh] w-full max-w-lg flex-col rounded-b-none sm:rounded-b-2xl`}>
        <div className="flex items-center justify-between px-5 pt-5">
          <h2 className="text-lg font-bold">Agendamento rápido</h2>
          <button type="button" onClick={aoFechar} aria-label="Fechar" className="grid h-9 w-9 place-items-center rounded-xl text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700">
            ✕
          </button>
        </div>

        {pronto ? (
          <div className="space-y-4 p-5">
            <div className={`rounded-2xl p-4 ${SUAVE.seloOk}`}>
              <p className="text-base font-bold">Agendado! ✅</p>
              <p className="mt-1 text-sm">{pronto.resumo}</p>
            </div>
            {pronto.link && (
              <a href={pronto.link} target="_blank" rel="noopener noreferrer" className={`${SUAVE.botaoSucesso} w-full`}>
                Avisar o cliente no WhatsApp
              </a>
            )}
            <button type="button" onClick={aoFechar} className={`${SUAVE.botaoSecundario} w-full`}>
              Fechar
            </button>
          </div>
        ) : !carregado ? (
          <p className={`p-5 text-sm ${SUAVE.textoSuave}`}>Carregando…</p>
        ) : (
          <>
            <div className="space-y-5 overflow-y-auto p-5">
              {/* 1. Cliente */}
              <div>
                <p className={SUAVE.rotulo}>Para quem?</p>
                {novoCliente ? (
                  <div className="space-y-2">
                    <input className={SUAVE.campo} placeholder="Nome do cliente" value={novoNome} onChange={(e) => setNovoNome(e.target.value)} autoFocus />
                    <input className={SUAVE.campo} placeholder="Celular com DDD (opcional)" inputMode="tel" value={novoTelefone} onChange={(e) => setNovoTelefone(e.target.value)} />
                    <button type="button" onClick={() => setNovoCliente(false)} className="text-xs font-semibold text-violet-700 underline dark:text-violet-200">
                      Escolher um cliente que já existe
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {!clienteInicial && (
                      <input className={SUAVE.campo} placeholder="Buscar pelo nome ou telefone" value={busca} onChange={(e) => setBusca(e.target.value)} />
                    )}
                    <div className="flex flex-wrap gap-2">
                      {clientesFiltrados.map((c) => (
                        <button key={c.id} type="button" onClick={() => setClienteId(c.id)} className={clienteId === c.id ? SUAVE.chipAtivo : SUAVE.chip} aria-pressed={clienteId === c.id}>
                          {c.nome}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                          setNovoCliente(true);
                          setNovoNome(busca.trim());
                        }}
                        className={SUAVE.chip}
                      >
                        + {busca.trim() && clientesFiltrados.length === 0 ? `Cadastrar “${busca.trim()}”` : "Cliente novo"}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* 2. Serviço */}
              <div>
                <p className={SUAVE.rotulo}>Qual serviço?</p>
                {servicos.length === 0 ? (
                  <p className={`text-sm ${SUAVE.textoFraco}`}>Nenhum serviço cadastrado ainda. Cadastre em Serviços.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {servicos.map((s) => (
                      <button key={s.id} type="button" onClick={() => setServicoId(s.id)} className={servicoId === s.id ? SUAVE.chipAtivo : SUAVE.chip} aria-pressed={servicoId === s.id}>
                        {s.nome}
                        <span className="text-xs font-normal opacity-80">
                          {s.duracaoMinutos} min · {brl(s.preco)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 3. Dia e horário */}
              <div>
                <p className={SUAVE.rotulo}>Quando?</p>
                <div className="mb-3 flex flex-wrap gap-2">
                  {dias.map((d) => (
                    <button key={d} type="button" onClick={() => { if (d !== dia) { setDia(d); setHora(null); } }} className={dia === d ? SUAVE.chipAtivo : SUAVE.chip} aria-pressed={dia === d}>
                      {rotuloDoDia(d, hoje)}
                    </button>
                  ))}
                </div>
                {!janela && !(horarioInicial && dia === horarioInicial.dia) ? (
                  <p className={`text-sm ${SUAVE.textoFraco}`}>Fechado nesse dia (horário de trabalho em Configurações). Escolha outro dia.</p>
                ) : livres.length === 0 && !(horarioInicial && dia === horarioInicial.dia) ? (
                  <p className={`text-sm ${SUAVE.textoFraco}`}>Sem horário livre nesse dia. Escolha outro dia.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {Array.from(new Set([...(horarioInicial && dia === horarioInicial.dia ? [horarioInicial.hora] : []), ...livres])).sort().slice(0, 14).map((h) => (
                      <button key={h} type="button" onClick={() => setHora(h)} className={hora === h ? SUAVE.chipAtivo : SUAVE.chip} aria-pressed={hora === h}>
                        {h}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {conflito && (
                <div className={`rounded-2xl p-3 text-sm ${SUAVE.seloAviso}`} role="alert">
                  {conflito}
                  <button type="button" onClick={() => agendar(true)} className="mt-2 block font-bold underline">
                    Agendar mesmo assim
                  </button>
                </div>
              )}
              {erro && (
                <p role="alert" className={`rounded-2xl p-3 text-sm ${SUAVE.seloErro}`}>
                  {erro}
                </p>
              )}
            </div>

            <div className="space-y-3 border-t border-slate-200 p-5 dark:border-slate-700">
              <p className={`text-sm ${SUAVE.textoSuave}`}>
                {podeAgendar && servico && hora ? (
                  <>
                    <strong className={SUAVE.texto}>{novoCliente ? novoNome.trim() : clienteEscolhido?.nome}</strong> · {servico.nome} · {rotuloDoDia(dia, hoje).toLowerCase()} às {hora} · {brl(servico.preco)}
                  </>
                ) : (
                  !servico ? "Cadastre um serviço para agendar." : !(novoCliente ? novoNome.trim().length >= 2 : clienteId) ? "Escolha o cliente para continuar." : "Escolha um horário livre para continuar."
                )}
              </p>
              <button ref={botaoAgendar} type="button" disabled={!podeAgendar || salvando} onClick={() => agendar(false)} className={`${SUAVE.botaoPrimario} w-full`}>
                {salvando ? "Agendando…" : "Agendar"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
