// Horário de trabalho da loja (Configurações): uma regra por dia da semana (0 = domingo … 6 = sábado).
// É a mesma regra que a página pública de agendamento usa; aqui ela também alimenta os horários rápidos do painel.

export interface DiaTrabalho {
  diaSemana: number;
  ativo: boolean;
  horaInicio: string; // "09:00"
  horaFim: string; // "18:00"
}

export const NOMES_DIAS = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
// Ordem mostrada na tela: a semana começa na segunda.
export const ORDEM_NA_TELA = [1, 2, 3, 4, 5, 6, 0];

// Padrão de quem ainda não configurou nada (igual ao do servidor): segunda a sábado, 08:00–18:00; domingo fechado.
export const SEMANA_PADRAO: DiaTrabalho[] = Array.from({ length: 7 }, (_, d) => ({ diaSemana: d, ativo: d !== 0, horaInicio: "08:00", horaFim: "18:00" }));

// Opções de horário em passos de 30 minutos (05:00 … 23:30) para escolher sem digitar.
export const OPCOES_HORA: string[] = Array.from({ length: 38 }, (_, i) => {
  const min = 5 * 60 + i * 30;
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
});

// Janela de um dia no formato "AAAA-MM-DD"; nulo = a loja não atende nesse dia.
export function janelaDoDia(semana: DiaTrabalho[] | null, isoDia: string): { inicio: string; fim: string } | null {
  const [a, m, d] = isoDia.split("-").map(Number);
  const diaSemana = new Date(a, m - 1, d).getDay();
  const regra = (semana ?? SEMANA_PADRAO).find((x) => x.diaSemana === diaSemana);
  if (!regra) return { inicio: "08:00", fim: "18:00" };
  return regra.ativo ? { inicio: regra.horaInicio, fim: regra.horaFim } : null;
}

export function validarSemana(semana: DiaTrabalho[]): string | null {
  for (const d of semana) {
    if (d.ativo && d.horaInicio >= d.horaFim) return `Em ${NOMES_DIAS[d.diaSemana].toLowerCase()}, o horário de saída precisa ser depois do de entrada.`;
  }
  if (!semana.some((d) => d.ativo)) return "Deixe pelo menos um dia aberto.";
  return null;
}
