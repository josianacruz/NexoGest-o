-- =====================================================================================================
-- Trava anti-overbooking no PostgreSQL (Neon) para a tabela "Agendamentos".
--
-- NÃO é aplicado automaticamente (não está nas migrations do EF): rode você, com o backup feito, DEPOIS do PASSO 0.
-- Pode rodar mais de uma vez (não duplica nada). Tudo dentro de uma transação: se algo falhar, nada muda.
--
-- Como o banco real é hoje (diferente do rascunho do pedido):
--   * tabela "Agendamentos" (plural, PascalCase), ids inteiros (não UUID), uma agenda por empresa ("EmpresaId");
--     ainda não existe profissional;
--   * não há coluna de fim: o fim é "DataHora" + "DuracaoMinutos";
--   * "Status" é inteiro: 0 Agendado, 1 Confirmado, 2 Concluido, 3 Cancelado, 4 Faltou  (só 0 e 1 ocupam horário);
--   * o sistema deixa o dono marcar "Agendar mesmo assim" (sobreposição de propósito). Uma trava cega quebraria isso,
--     então existe a coluna "PermiteSobreposicao": só encaixes forçados ficam fora da trava.
-- Intervalo usado: [início, fim) — um horário que termina às 11:00 NÃO conflita com outro que começa às 11:00.
-- =====================================================================================================

-- ---------------------------------------------------------------------------------------------------
-- PASSO 0 (somente leitura, rode ANTES): lista agendamentos ativos que já se sobrepõem hoje.
-- O PASSO 2 marca esses como "sobreposição permitida" para a trava poder ser criada sem apagar nada,
-- mas vale você olhar a lista.
-- ---------------------------------------------------------------------------------------------------
-- SELECT a."EmpresaId", a."Id" AS "AgendamentoA", b."Id" AS "AgendamentoB", a."DataHora" AS "InicioA", b."DataHora" AS "InicioB"
-- FROM "Agendamentos" a
-- JOIN "Agendamentos" b
--   ON b."EmpresaId" = a."EmpresaId" AND b."Id" > a."Id"
--  AND a."Status" IN (0, 1) AND b."Status" IN (0, 1)
--  AND tsrange(a."DataHora" AT TIME ZONE 'UTC', (a."DataHora" AT TIME ZONE 'UTC') + a."DuracaoMinutos" * interval '1 minute')
--   && tsrange(b."DataHora" AT TIME ZONE 'UTC', (b."DataHora" AT TIME ZONE 'UTC') + b."DuracaoMinutos" * interval '1 minute')
-- ORDER BY a."EmpresaId", a."DataHora";

BEGIN;

-- PASSO 1: extensão que permite usar "=" (empresa) junto com "&&" (sobreposição) na mesma trava. O Neon já a oferece.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- PASSO 2: coluna que marca encaixes de propósito (padrão: não permite). Quem já se sobrepõe hoje vira "permitido":
-- é histórico que o dono aceitou ao usar "Agendar mesmo assim"; nada é apagado nem movido.
ALTER TABLE "Agendamentos" ADD COLUMN IF NOT EXISTS "PermiteSobreposicao" boolean NOT NULL DEFAULT false;

UPDATE "Agendamentos" a
SET "PermiteSobreposicao" = true
WHERE a."Status" IN (0, 1)
  AND NOT a."PermiteSobreposicao"
  AND EXISTS (
    SELECT 1 FROM "Agendamentos" b
    WHERE b."EmpresaId" = a."EmpresaId" AND b."Id" <> a."Id" AND b."Status" IN (0, 1)
      AND tsrange(a."DataHora" AT TIME ZONE 'UTC', (a."DataHora" AT TIME ZONE 'UTC') + a."DuracaoMinutos" * interval '1 minute')
       && tsrange(b."DataHora" AT TIME ZONE 'UTC', (b."DataHora" AT TIME ZONE 'UTC') + b."DuracaoMinutos" * interval '1 minute')
  );

-- PASSO 3: a trava. Para a mesma empresa, dois agendamentos ATIVOS (Agendado/Confirmado) e não-forçados não podem
-- ter intervalos que se sobreponham. Cancelado, Concluído, Faltou e encaixes forçados ficam de fora.
-- (timestamptz → timestamp UTC porque o índice só aceita expressões imutáveis.)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ex_agendamentos_sem_sobreposicao') THEN
    ALTER TABLE "Agendamentos"
      ADD CONSTRAINT "ex_agendamentos_sem_sobreposicao"
      EXCLUDE USING gist (
        "EmpresaId" WITH =,
        tsrange("DataHora" AT TIME ZONE 'UTC', ("DataHora" AT TIME ZONE 'UTC') + "DuracaoMinutos" * interval '1 minute') WITH &&
      )
      WHERE ("Status" IN (0, 1) AND NOT "PermiteSobreposicao");
  END IF;
END $$;

COMMIT;

-- ---------------------------------------------------------------------------------------------------
-- Para REMOVER a trava (volta ao comportamento anterior; a coluna pode ficar):
--   ALTER TABLE "Agendamentos" DROP CONSTRAINT IF EXISTS "ex_agendamentos_sem_sobreposicao";
--   -- e, se quiser, também: ALTER TABLE "Agendamentos" DROP COLUMN IF EXISTS "PermiteSobreposicao";
--
-- Quando a trava barra um insert, o PostgreSQL devolve o erro 23P01 (exclusion_violation). A API deve traduzir
-- isso em HTTP 409 "Esse horário acabou de ficar indisponível" (ver proposta no final da explicação).
-- ---------------------------------------------------------------------------------------------------
