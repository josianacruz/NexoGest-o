"""
Teste de ponta a ponta do worker + isolamento (rodar na máquina de desenvolvimento, com a API local no ar).

Cria duas empresas descartáveis (A e B) e um usuário Atendente no banco LOCAL, importa um CSV do painel de
afiliados, enfileira 3 vídeos, liga o NexoWorker de verdade, confere os arquivos gerados e verifica:
restrição ao Dono, isolamento entre empresas, autenticação/revogação do token, recuperação de tarefa interrompida
e limite de tentativas. Recusa rodar se o banco não for localhost.

Uso:  python tools/worker/teste_e2e.py <caminho do CSV do painel> [pasta para salvar os MP4 baixados]
Limpe os dados de teste depois (empresas "Loja Worker ... Teste" e usuários teste.*@exemplo.com).
Pré-requisitos: dotnet build do Worker, user-secrets com Videos:Worker:* e psql no PATH.
"""
import glob, json, os, re, subprocess, sys, tempfile, time, urllib.request

B = "http://localhost:5104"
RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
TEMP = tempfile.gettempdir()
CSV = sys.argv[1] if len(sys.argv) > 1 else sys.exit(__doc__)
SCRATCH = sys.argv[2] if len(sys.argv) > 2 else TEMP
for _p in glob.glob("C:/Program Files/PostgreSQL/*/bin"):
    os.environ["PATH"] += os.pathsep + _p


def req(metodo, caminho, corpo=None, token=None, extra=None, bruto=False):
    dados = json.dumps(corpo).encode("utf-8") if corpo is not None else None
    r = urllib.request.Request(B + caminho, data=dados, method=metodo)
    r.add_header("Content-Type", "application/json")
    if token:
        r.add_header("Authorization", "Bearer " + token)
    for k, v in (extra or {}).items():
        r.add_header(k, v)
    try:
        with urllib.request.urlopen(r, timeout=120) as resp:
            c = resp.read()
            if bruto:
                return resp.status, c
            t = c.decode("utf-8")
            return resp.status, (json.loads(t) if t else None)
    except urllib.error.HTTPError as e:
        t = e.read().decode("utf-8")
        try:
            return e.code, json.loads(t)
        except Exception:
            return e.code, t


def segredos():
    out = subprocess.run(["dotnet", "user-secrets", "list", "--project", RAIZ + "/src/NexoGestao.Api"],
                         capture_output=True, text=True, encoding="utf-8").stdout
    return {m.group(1): m.group(2).strip() for m in re.finditer(r"^(\S+) = (.*)$", out, re.M)}


SEG = segredos()
KV = dict(p.split("=", 1) for p in SEG["ConnectionStrings:DefaultConnection"].split(";") if "=" in p)
assert KV.get("Host", "").lower() in ("localhost", "127.0.0.1"), "não é banco local"


def sql(texto):
    r = subprocess.run(["psql", "-h", KV["Host"], "-p", KV.get("Port", "5432"), "-U", KV["Username"], "-d", KV["Database"],
                        "-v", "ON_ERROR_STOP=1", "-At", "-c", texto],
                       env=dict(os.environ, PGPASSWORD=KV.get("Password", "")), capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(r.stderr)
    return r.stdout.strip()


def novo_usuario(prefixo):
    email = f"teste.{prefixo}.{int(time.time()*1000)}@exemplo.com"
    req("POST", "/api/auth/registrar", {"email": email, "senha": "Teste@123"})
    _, login = req("POST", "/api/auth/login", {"email": email, "senha": "Teste@123"})
    return email, login["token"]


resultados = []


def checa(nome, ok, detalhe=""):
    resultados.append((nome, bool(ok)))
    print(("[ok]    " if ok else "[FALHA] ") + nome + (f" — {detalhe}" if detalhe else ""), flush=True)


# ------------------------------------------------------------------ empresas A e B + Atendente em A
emailA, tokA = novo_usuario("wA")
emailB, tokB = novo_usuario("wB")
emailC, tokC = novo_usuario("wAtend")
_, empA = req("POST", "/api/empresas", {"nome": "Loja Worker A Teste", "segmento": "Comercio"}, tokA)
_, empB = req("POST", "/api/empresas", {"nome": "Loja Worker B Teste", "segmento": "Comercio"}, tokB)
ea, eb = empA["id"], empB["id"]


def habilita_afiliados(eid, tok):
    # Afiliados não vem ligado sozinho: o Dono liga (mantendo os módulos que a empresa já tem).
    _, minhas = req("GET", "/api/empresas/minhas", None, tok)
    atuais = next(e for e in minhas if e["id"] == eid)["modulos"]
    corpo = {"modulos": [{"modulo": m, "habilitado": True} for m in dict.fromkeys(atuais + ["Afiliados"])]}
    req("PUT", f"/api/empresas/{eid}/modulos", corpo, tok)


habilita_afiliados(ea, tokA)
habilita_afiliados(eb, tokB)
uid_c = sql(f"SELECT \"Id\" FROM \"AspNetUsers\" WHERE \"Email\"='{emailC}'")
sql(f"INSERT INTO \"MembrosEmpresa\" (\"UsuarioId\",\"EmpresaId\",\"Papel\") VALUES ('{uid_c}',{ea},2)")  # 2 = Atendente
A, Bb = f"/api/empresas/{ea}/afiliados", f"/api/empresas/{eb}/afiliados"
json.dump({"emailA": emailA, "emailB": emailB, "emailC": emailC, "empresas": [ea, eb]}, open(TEMP + "/worker_ctx.json", "w"))
print("empresas A/B:", ea, eb)

# ------------------------------------------------------------------ restrição ao Dono e isolamento (JWT)
checa("Dono de A lista produtos de A", req("GET", A + "/produtos", None, tokA)[0] == 200)
checa("Atendente de A é barrado em produtos (403)", req("GET", A + "/produtos", None, tokC)[0] == 403)
checa("Atendente de A é barrado em vídeos (403)", req("GET", A + "/videos", None, tokC)[0] == 403)
checa("Atendente de A não cria credencial de worker (403)", req("POST", A + "/worker/credenciais", {"nome": "x"}, tokC)[0] == 403)
checa("Dono de A não acessa afiliados de B (403)", req("GET", Bb + "/produtos", None, tokA)[0] == 403)
checa("Sem login (401)", req("GET", A + "/produtos")[0] == 401)

# ------------------------------------------------------------------ credenciais do worker
_, credA = req("POST", A + "/worker/credenciais", {"nome": "PC de teste A"}, tokA)
_, credB = req("POST", Bb + "/worker/credenciais", {"nome": "PC de teste B"}, tokB)
TA, TB = credA["token"], credB["token"]
checa("Token mostrado uma vez e com prefixo", TA.startswith("nxw_") and credA["prefixo"] == TA[:8])
hash_ok = sql(f"SELECT count(*) FROM \"WorkerCredenciais\" WHERE \"TokenHash\" LIKE '%{TA[:20]}%'") == "0"
checa("Token em texto NÃO está gravado no banco (só o hash)", hash_ok)
checa("Sem token → 401", req("POST", "/api/worker/proxima", {})[0] == 401)
checa("Token inventado → 401", req("POST", "/api/worker/proxima", {}, extra={"X-Worker-Token": "nxw_" + "a" * 43})[0] == 401)
checa("Token válido de A → ping 200", req("GET", "/api/worker/ping", extra={"X-Worker-Token": TA})[0] == 200)

# ------------------------------------------------------------------ dados: A importa o CSV; B importa o mesmo CSV (isolamento)
arq = CSV
csv = open(arq, encoding="utf-8").read()
s, r = req("POST", A + "/produtos/importar-relatorio", {"conteudoCsv": csv, "nomeArquivo": os.path.basename(arq)}, tokA)
checa("A importa o CSV (12 produtos)", s == 200 and r["criados"] == 12, str(r.get("criados")))
s, r = req("POST", Bb + "/produtos/importar-relatorio", {"conteudoCsv": csv, "nomeArquivo": os.path.basename(arq)}, tokB)
checa("B importa o mesmo CSV sem conflito com A", s == 200 and r["criados"] == 12)
s, r = req("POST", A + "/produtos/lote", {"links": ["https://shopee.com.br/product/1506519047/44265373159",
                                                    "https://shopee.com.br/product/1232265157/44424394569"]}, tokA)
checa("A cola 2 links (calça e kit)", s == 200 and r["criados"] == 2)

_, prods = req("GET", A + "/produtos", None, tokA)
achar = lambda t: next(p for p in prods if t.lower() in p["nome"].lower())
motor, calca, kit = achar("Motor Arranque"), achar("Cal"), achar("Kit Limpa")
_, prodsB = req("GET", Bb + "/produtos", None, tokB)
motorB = next(p for p in prodsB if "Motor Arranque" in p["nome"])

s, r = req("POST", A + "/videos/gerar", {"produtoIds": [motor["id"], calca["id"], kit["id"]],
                                          "observacoesRevisao": {str(motor["id"]): "As fotos mostram marcas de uso"}}, tokA)
checa("A enfileira 3 vídeos", s == 200 and r["criadas"] == 3)
checa("Resposta de gerar informa se há worker conectado (aviso quando não há)", (r.get("workerAtivo") is True) == (r.get("aviso") is None))
s, r = req("POST", Bb + "/videos/gerar", {"produtoIds": [motorB["id"]]}, tokB)
checa("B enfileira 1 vídeo (só B vai poder pegar)", s == 200 and r["criadas"] == 1)
_, vidsB = req("GET", Bb + "/videos", None, tokB)
video_b = vidsB[0]["id"]

# ------------------------------------------------------------------ worker real (processo separado)
cfg = {
    "apiUrl": B, "python": SEG["Videos:Worker:Python"], "gerador": SEG["Videos:Worker:Gerador"],
    "pastaFfmpeg": SEG["Videos:Worker:PastaFfmpeg"], "fonte": SEG["Videos:Worker:Fonte"], "musica": SEG["Videos:Worker:Musica"],
    "musicaCredito": SEG["Videos:Worker:MusicaCredito"], "pastaSaida": SEG["Videos:Worker:PastaSaida"], "intervaloSegundos": 3,
}
os.makedirs(TEMP + "/nexo_worker_cfg", exist_ok=True)
CFG = TEMP + "/nexo_worker_cfg/config.json"
json.dump(cfg, open(CFG, "w"))
EXE = RAIZ + "/src/NexoGestao.Worker/bin/Debug/net10.0/NexoWorker.exe"
assert os.path.exists(EXE), "compile o worker antes: dotnet build src/NexoGestao.Worker"
env = dict(os.environ, NEXO_WORKER_CONFIG=CFG, NEXO_WORKER_TOKEN=TA)

v = subprocess.run([EXE, "--verificar"], env=env, capture_output=True, text=True, timeout=60)
print(v.stdout)
checa("--verificar: tudo certo (Python, FFmpeg, edge-tts, API, token)", v.returncode == 0)

env_ruim = dict(env, NEXO_WORKER_TOKEN="nxw_" + "b" * 43)
v2 = subprocess.run([EXE, "--uma-vez"], env=env_ruim, capture_output=True, text=True, timeout=60)
checa("Worker com token inválido encerra com código 3 e não processa nada", v2.returncode == 3, f"código {v2.returncode}")

proc = subprocess.Popen([EXE], env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, encoding="utf-8")
pico = 0


def memoria():
    r = subprocess.run(["powershell", "-NoProfile", "-Command",
                        "(Get-Process NexoWorker,python,ffmpeg -ErrorAction SilentlyContinue | Measure-Object WorkingSet64 -Sum).Sum"],
                       capture_output=True, text=True)
    try:
        return int(r.stdout.strip() or 0)
    except ValueError:
        return 0


inicio = time.time()
online_visto = False
while time.time() - inicio < 600:
    time.sleep(6)
    pico = max(pico, memoria())
    _, vids = req("GET", A + "/videos", None, tokA)
    est = {x["id"]: x["status"] for x in vids}
    st, est_cfg = req("GET", A + "/worker", None, tokA)
    online_visto = online_visto or any(c["online"] for c in est_cfg["credenciais"])
    print(f"  t={int(time.time()-inicio)}s {est}", flush=True)
    if all(x not in ("Pendente", "Processando") for x in est.values()):
        break
total = time.time() - inicio
proc.terminate()
try:
    proc.wait(timeout=10)
except Exception:
    proc.kill()

checa("A tela do Dono vê o worker online com pasta e espaço", online_visto and est_cfg["credenciais"][0]["pasta"] is not None)
checa("Os 3 vídeos de A ficaram Pronto", all(x["status"] == "Pronto" for x in vids), str({x["id"]: x["status"] for x in vids}))
_, vidsB = req("GET", Bb + "/videos", None, tokB)
checa("O vídeo de B continuou Pendente (worker de A não pegou)", vidsB[0]["status"] == "Pendente")

print()
for x in vids:
    print(f"[{x['id']}] {x['produto']['nome'][:50]} | {x['status']} | {x['categoriaDetectada']} | {x['duracaoSegundos']}s "
          f"{x['tamanhoBytes']}B proc={x['tempoProcessamentoSegundos']}s")
    print("     arquivo:", x["arquivoLocal"])
    print("     legenda:", x["legenda"], "|", x["hashtags"])
    if x["arquivoLocal"]:
        existe = os.path.exists(x["arquivoLocal"]) and os.path.exists(x["arquivoLocal"].replace(".mp4", ".txt"))
        checa(f"Arquivo e .txt do vídeo {x['id']} existem em disco", existe)
    s, dados = req("GET", A + f"/videos/{x['id']}/arquivo", None, tokA, bruto=True)
    checa(f"Dono baixa o vídeo {x['id']} pela API (mesmo PC)", s == 200 and len(dados) == x["tamanhoBytes"])
    if s == 200:
        destino = f"{SCRATCH}/e2e_{x['categoriaDetectada']}.mp4"
        open(destino, "wb").write(dados)
    checa(f"Atendente não baixa o vídeo {x['id']} (403)", req("GET", A + f"/videos/{x['id']}/arquivo", None, tokC)[0] == 403)
    checa(f"Dono de B não baixa o vídeo {x['id']} de A (404)", req("GET", Bb + f"/videos/{x['id']}/arquivo", None, tokB)[0] == 404)
print(f"\nPico de memória (NexoWorker + Python + FFmpeg somados): {pico/1024/1024:.0f} MB; total para 3 vídeos: {total:.0f}s")

# ------------------------------------------------------------------ B pega o dele; recuperação de tarefa interrompida
hB = {"X-Worker-Token": TB}
s, r = req("POST", "/api/worker/proxima", {"versao": "t", "maquina": "teste"}, extra=hB)
checa("Worker de B recebe só a tarefa de B", s == 200 and r["tarefa"] and r["tarefa"]["id"] == video_b and r["tarefa"]["empresaId"] == eb)
s, r = req("POST", f"/api/worker/{vids[0]['id']}/concluir", {"roteiroJson": "{}", "legenda": "x", "hashtags": "x", "categoria": "x", "versaoRoteiro": "x"}, extra=hB)
checa("Worker de B não mexe na tarefa de A (404)", s == 404)
sql(f"UPDATE \"VideosAfiliados\" SET \"LeaseAte\"=now() - interval '10 minutes' WHERE \"Id\"={video_b}")
s, r = req("POST", "/api/worker/proxima", {"versao": "t"}, extra=hB)
checa("Tarefa interrompida volta pra fila e é entregue de novo (tentativa 2)", s == 200 and r["tarefa"] and r["tarefa"]["tentativas"] == 2)
s, r = req("POST", f"/api/worker/{video_b}/falhar", {"tipo": "Erro", "mensagem": "falha simulada"}, extra=hB)
_, vidsB = req("GET", Bb + "/videos", None, tokB)
checa("Depois de 2 tentativas a tarefa vira Erro (não fica em laço)", vidsB[0]["status"] == "Erro", vidsB[0]["status"])

# ------------------------------------------------------------------ revogação
_, est_cfg = req("GET", A + "/worker", None, tokA)
cid = est_cfg["credenciais"][0]["id"]
checa("Atendente não revoga credencial (403)", req("DELETE", A + f"/worker/credenciais/{cid}", None, tokC)[0] == 403)
checa("Dono revoga a credencial", req("DELETE", A + f"/worker/credenciais/{cid}", None, tokA)[0] == 200)
checa("Token revogado → 401 imediatamente", req("GET", "/api/worker/ping", extra={"X-Worker-Token": TA})[0] == 401)

falhas = [n for n, ok in resultados if not ok]
print(f"\n{len(resultados)-len(falhas)}/{len(resultados)} verificações ok")
for n in falhas:
    print("  FALHOU:", n)
sys.exit(1 if falhas else 0)
