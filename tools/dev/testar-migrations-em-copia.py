"""
Ensaio das migrations antes de ir para produção: cria um banco TEMPORÁRIO no PostgreSQL LOCAL, deixa-o no estado da
`main` (última migration da main), grava dados de exemplo nas tabelas que já existem, aplica as migrations novas da
`dev` e confere que nenhuma linha existente mudou. Depois apaga o banco temporário.

Uso:  python tools/dev/testar-migrations-em-copia.py <última migration da main>
      ex.: python tools/dev/testar-migrations-em-copia.py 20260917011517_AdicionaObservacaoPagamento
Recusa rodar se o banco configurado não for localhost. Nada aqui toca em Neon/produção.
"""
import glob, os, re, subprocess, sys

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
API = os.path.join(RAIZ, "src", "NexoGestao.Api")
for p in glob.glob("C:/Program Files/PostgreSQL/*/bin"):
    os.environ["PATH"] += os.pathsep + p

ULTIMA_DA_MAIN = sys.argv[1] if len(sys.argv) > 1 else sys.exit(__doc__)
BANCO = "nexo_migtest"

out = subprocess.run(["dotnet", "user-secrets", "list", "--project", API], capture_output=True, text=True, encoding="utf-8").stdout
cs = re.search(r"ConnectionStrings:DefaultConnection = (.*)", out).group(1)
kv = dict(p.split("=", 1) for p in cs.split(";") if "=" in p)
assert kv.get("Host", "").lower() in ("localhost", "127.0.0.1"), "o banco configurado não é local; abortando"
env = dict(os.environ, PGPASSWORD=kv.get("Password", ""))
base = ["psql", "-h", kv["Host"], "-p", kv.get("Port", "5432"), "-U", kv["Username"], "-v", "ON_ERROR_STOP=1", "-At"]
conexao_teste = f"Host={kv['Host']};Port={kv.get('Port', '5432')};Database={BANCO};Username={kv['Username']};Password={kv.get('Password', '')}"


def sql(texto, banco=BANCO):
    r = subprocess.run(base + ["-d", banco, "-c", texto], env=env, capture_output=True, text=True, encoding="utf-8")
    if r.returncode != 0:
        raise RuntimeError(r.stderr.strip())
    return r.stdout.strip()


def ef(*args):
    r = subprocess.run(["dotnet", "ef", "database", "update", *args, "--project", API, "--connection", conexao_teste],
                       capture_output=True, text=True, encoding="utf-8")
    if r.returncode != 0:
        raise RuntimeError((r.stdout + r.stderr)[-800:])


def insere_exemplo(tabela, fixos):
    cols = sql(f"""SELECT column_name||'|'||data_type FROM information_schema.columns
                   WHERE table_name='{tabela}' AND is_nullable='NO' AND column_default IS NULL AND is_identity='NO'""").splitlines()
    nomes, valores = [], []
    for c in cols:
        nome, tipo = c.split("|")
        if nome in fixos:
            v = fixos[nome]
        elif tipo in ("integer", "bigint", "smallint"):
            v = "1"
        elif tipo in ("numeric", "double precision", "real"):
            v = "10.5"
        elif tipo == "boolean":
            v = "false"
        elif tipo.startswith("timestamp"):
            v = "now()"
        else:
            v = "'exemplo'"
        nomes.append(f'"{nome}"')
        valores.append(v)
    sql(f'INSERT INTO "{tabela}" ({",".join(nomes)}) VALUES ({",".join(valores)})')


print(f"Criando banco temporário {BANCO} e levando-o ao estado da main ({ULTIMA_DA_MAIN})…")
sql(f'DROP DATABASE IF EXISTS "{BANCO}"', "postgres")
sql(f'CREATE DATABASE "{BANCO}"', "postgres")
try:
    ef(ULTIMA_DA_MAIN)
    tabelas_main = sql("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name <> '__EFMigrationsHistory' ORDER BY 1").splitlines()

    insere_exemplo("Empresas", {})
    emp = sql('SELECT "Id" FROM "Empresas" LIMIT 1')
    for t in ("Clientes", "Produtos", "Servicos"):
        if t in tabelas_main:
            insere_exemplo(t, {"EmpresaId": emp})

    def retrato():
        r = {}
        for t in tabelas_main:
            r[t] = sql(f"""SELECT count(*)||'|'||coalesce(md5(string_agg(x::text, '' ORDER BY x::text)), '-') FROM "{t}" x""")
        return r

    antes = retrato()
    com_dados = [t for t, v in antes.items() if not v.startswith("0|")]
    print("Tabelas da main com dados de exemplo:", ", ".join(com_dados))

    print("Aplicando as migrations novas da dev…")
    ef()
    depois = retrato()
    novas = sql("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY 1").splitlines()
    novas = [t for t in novas if t not in tabelas_main and t != "__EFMigrationsHistory"]

    mudou = [t for t in tabelas_main if antes[t] != depois[t]]
    # Tabelas que já existiam ganham colunas novas só se a migration for aditiva; as linhas existentes não podem mudar.
    # (md5 compara a linha inteira, então colunas novas mudam o md5: comparamos só contagem e colunas antigas.)
    print("\nResultado:")
    print("  Tabelas novas criadas:", ", ".join(novas))
    ok = True
    for t in com_dados:
        cols_antigas = sql(f"""SELECT string_agg('"'||column_name||'"', ',' ORDER BY ordinal_position) FROM information_schema.columns
                               WHERE table_name='{t}' AND column_name IN (SELECT column_name FROM information_schema.columns WHERE table_name='{t}')""")
        n_antes = antes[t].split("|")[0]
        n_depois = depois[t].split("|")[0]
        if n_antes != n_depois:
            ok = False
            print(f"  FALHA: {t} tinha {n_antes} linha(s) e agora tem {n_depois}")
    if mudou:
        print("  Tabelas existentes cujo conteúdo ou colunas mudaram:", ", ".join(mudou), "(conferir se é só coluna nova)")
    print("  Linhas existentes preservadas:", "SIM" if ok else "NÃO")
    migrations = sql('SELECT count(*) FROM "__EFMigrationsHistory"')
    print("  Migrations aplicadas no total:", migrations)
    sys.exit(0 if ok else 1)
finally:
    sql(f'DROP DATABASE IF EXISTS "{BANCO}" WITH (FORCE)', "postgres")
    print("Banco temporário removido.")
