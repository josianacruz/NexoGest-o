"""
Testa tools/dev/anti-overbooking.sql num banco TEMPORÁRIO do PostgreSQL LOCAL (nunca toca Neon/produção).
Cria a tabela "Agendamentos" mínima (mesmos nomes e tipos do banco real), põe dados — inclusive sobreposições antigas —,
aplica o script (duas vezes, para provar que pode repetir) e confere as regras, incluindo uma corrida com 8 inserts
simultâneos no mesmo horário.

Uso: python tools/dev/testar-anti-overbooking.py
"""
import concurrent.futures, glob, os, re, subprocess, sys

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
API = os.path.join(RAIZ, "src", "NexoGestao.Api")
for p in glob.glob("C:/Program Files/PostgreSQL/*/bin"):
    os.environ["PATH"] += os.pathsep + p

out = subprocess.run(["dotnet", "user-secrets", "list", "--project", API], capture_output=True, text=True, encoding="utf-8").stdout
cs = re.search(r"ConnectionStrings:DefaultConnection = (.*)", out).group(1)
kv = dict(p.split("=", 1) for p in cs.split(";") if "=" in p)
assert kv.get("Host", "").lower() in ("localhost", "127.0.0.1"), "o banco configurado não é local; abortando"
env = dict(os.environ, PGPASSWORD=kv.get("Password", ""), PGCLIENTENCODING="UTF8")
BANCO = "nexo_antiover"
base = ["psql", "-h", kv["Host"], "-p", kv.get("Port", "5432"), "-U", kv["Username"], "-X", "-q", "-At", "-v", "VERBOSITY=verbose"]


def psql(sql=None, arquivo=None, banco=BANCO, check=True):
    cmd = base + ["-d", banco, "-v", "ON_ERROR_STOP=1"] + (["-f", arquivo] if arquivo else ["-c", sql])
    r = subprocess.run(cmd, env=env, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if check and r.returncode != 0:
        raise RuntimeError(r.stderr.strip())
    return r


falhas = []


def confere(nome, condicao, detalhe=""):
    print(("  ok   " if condicao else "  FALHOU ") + nome + (f"  [{detalhe}]" if detalhe and not condicao else ""))
    if not condicao:
        falhas.append(nome)


def insere(empresa, inicio, minutos, status=0, permite=False):
    return psql(
        f"""INSERT INTO "Agendamentos" ("EmpresaId","DataHora","DuracaoMinutos","Status"{', "PermiteSobreposicao"' if permite is not None and permite else ''})
            VALUES ({empresa}, '{inicio}+00', {minutos}, {status}{', true' if permite else ''})""",
        check=False,
    )


psql("DROP DATABASE IF EXISTS " + BANCO, banco="postgres")
psql("CREATE DATABASE " + BANCO, banco="postgres")
try:
    psql("""CREATE TABLE "Agendamentos" ("Id" serial PRIMARY KEY, "EmpresaId" int NOT NULL, "DataHora" timestamptz NOT NULL,
            "DuracaoMinutos" int NOT NULL, "Status" int NOT NULL DEFAULT 0)""")
    # dados "de antes": duas sobreposições que o sistema aceitou (encaixe forçado) + um normal + um cancelado em cima de outro
    for e, i, m, s in [(1, "2026-11-02 10:00", 60, 0), (1, "2026-11-02 10:30", 60, 0), (1, "2026-11-02 14:00", 30, 0),
                       (1, "2026-11-02 16:00", 60, 3), (1, "2026-11-02 16:00", 60, 0)]:
        insere(e, i, m, s)

    script = os.path.join(RAIZ, "tools", "dev", "anti-overbooking.sql")
    psql(arquivo=script)
    psql(arquivo=script)  # segunda vez: não pode falhar nem duplicar
    confere("script roda duas vezes sem erro", True)
    confere("só UMA trava criada", psql("SELECT count(*) FROM pg_constraint WHERE conname='ex_agendamentos_sem_sobreposicao'").stdout.strip() == "1")
    marcados = psql('SELECT string_agg("Id"::text, \',\' ORDER BY "Id") FROM "Agendamentos" WHERE "PermiteSobreposicao"').stdout.strip()
    confere("sobreposições antigas marcadas como permitidas (ids 1 e 2), nada apagado", marcados == "1,2" and psql('SELECT count(*) FROM "Agendamentos"').stdout.strip() == "5", marcados)

    r = insere(1, "2026-11-02 14:15", 30)
    confere("sobrepor horário ativo é barrado com o erro 23P01 (exclusion_violation)", r.returncode != 0 and "23P01" in r.stderr, r.stderr[:120])
    confere("mesmo horário exato é barrado", insere(1, "2026-11-02 14:00", 30).returncode != 0)
    confere("encaixado dentro de outro é barrado", insere(1, "2026-11-02 14:10", 5).returncode != 0)
    confere("horário colado (termina 14:30, começa 14:30) é permitido", insere(1, "2026-11-02 14:30", 30).returncode == 0)
    confere("horário colado antes (termina 14:00) é permitido", insere(1, "2026-11-02 13:30", 30).returncode == 0)
    confere("outra empresa no mesmo horário é permitido", insere(2, "2026-11-02 14:00", 30).returncode == 0)
    confere("cancelado não ocupa horário", insere(1, "2026-11-02 14:00", 30, status=3).returncode == 0)
    confere("sobreposição forçada de propósito é permitida", insere(1, "2026-11-02 14:00", 30, permite=True).returncode == 0)
    r = insere(1, "2026-11-02 16:15", 30, status=1)
    confere("Confirmado também ocupa horário (barrado sobre o Agendado das 16:00)", r.returncode != 0)
    # concluído/faltou liberam o horário
    confere("Concluído não bloqueia", insere(1, "2026-11-02 14:00", 30, status=2).returncode == 0)

    # corrida: 8 inserts simultâneos no mesmo horário livre
    def corrida(_):
        return insere(1, "2026-11-03 09:00", 45).returncode == 0

    with concurrent.futures.ThreadPoolExecutor(8) as ex:
        resultados = list(ex.map(corrida, range(8)))
    confere("corrida de 8 inserts simultâneos: exatamente 1 vence", sum(resultados) == 1, str(resultados))
    confere("e só 1 linha ficou no banco", psql("""SELECT count(*) FROM "Agendamentos" WHERE "DataHora"='2026-11-03 09:00+00'""").stdout.strip() == "1")

    # remoção documentada
    psql('ALTER TABLE "Agendamentos" DROP CONSTRAINT IF EXISTS "ex_agendamentos_sem_sobreposicao"')
    confere("sem a trava, a sobreposição volta a ser aceita (rollback funciona)", insere(1, "2026-11-03 09:10", 30).returncode == 0)
finally:
    psql("DROP DATABASE IF EXISTS " + BANCO, banco="postgres", check=False)
    print("Banco temporário removido.")

print("\nRESULTADO:", "TODOS OS TESTES PASSARAM" if not falhas else f"{len(falhas)} FALHA(S): {falhas}")
sys.exit(1 if falhas else 0)
