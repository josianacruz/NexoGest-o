#!/usr/bin/env python3
"""Gerador de vídeo de afiliado v4.

Roteiro falado -> narração por cena -> cenas com recortes de fotos REAIS do
anúncio -> legendas grandes em blocos curtos -> música com redução automática.

Layout 9:16 (1080x1920), pensado pro Shopee Vídeo:
  - foto grande na "janela" superior (JANELA_H), com pouquíssimo fundo desfocado;
  - legenda numa faixa escura logo abaixo da foto, sem cobrir a peça;
  - zona inferior (~300 px) e borda direita livres pros botões/descrição do app.

Cada shot do roteiro aceita:
  imagem  : arquivo da foto
  crop    : "W:H:X:Y" opcional (detalhe real recortado da própria foto)
  modo    : "grande" (padrão: preenche a janela, cortando só ~14% do lado maior)
            ou "inteiro" (foto inteira, sem cortar nada — pode sobrar fundo desfocado)
  foco    : 0..1 posição do recorte horizontal/vertical do modo "grande" (0.5 = centro)
  fracao  : fatia do tempo da cena
Nunca mostra ângulo/detalhe que a foto não tenha de verdade.
"""
import json
import os
import re
import subprocess
import sys
import textwrap

FFMPEG = os.environ.get("FFMPEG_BIN", "ffmpeg")
FFPROBE = os.environ.get("FFPROBE_BIN", "ffprobe")
FONTE = os.environ.get("FONTE_TTF", "fonte.ttf")
MUSICA = os.environ.get("MUSICA_FUNDO", "musica_fundo.wav")

W, H = 1080, 1920
JANELA_Y, JANELA_H = 90, 1270          # foto: y 90..1360
LEGENDA_Y = 1410                       # faixa da legenda: abaixo da foto, acima da zona dos botões
FONTE_TAM = 62
CHARS_POR_LINHA = 24                   # ~820 px de largura útil com fonte 62 negrito
MAX_LINHAS = 2
MARGEM_DIREITA = 100                   # reserva à direita pros botões do app (legenda desloca metade disso pra esquerda)
MIN_FRAGMENTO = 14                     # bloco de legenda menor que isso é fragmento: junta com o vizinho
MAX_AUMENTO = 2.0                      # nunca amplia a foto mais que 2x (acima disso perde nitidez)
PERDA_MAX_GRANDE = 0.08                # modo "grande" só se cortar até 8% da foto (evita cortar texto/detalhe da própria foto); senão mostra inteira

# Ritmo/tom por tipo de fala: pergunta um pouco mais viva, explicação neutra,
# fechamento mais pausado.
TOM = {
    "pergunta": {"rate": "+4%", "pitch": "+15Hz"},
    "explicacao": {"rate": "+0%", "pitch": "+0Hz"},
    "fechamento": {"rate": "-6%", "pitch": "-10Hz"},
}


def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print("ERRO ao rodar:", " ".join(cmd))
        print(r.stderr[-3000:])
        sys.exit(1)
    return r


def duracao(arquivo):
    r = run([FFPROBE, "-v", "error", "-show_entries", "format=duration",
             "-of", "default=noprint_wrappers=1:nokey=1", arquivo])
    return float(r.stdout.strip())


def gerar_narracao(texto, tom, saida, voz="pt-BR-FranciscaNeural"):
    ajuste = TOM.get(tom, TOM["explicacao"])
    run([sys.executable, "-m", "edge_tts", "--voice", voz, "--text", texto,
         "--rate", ajuste["rate"], "--pitch", ajuste["pitch"], "--write-media", saida])
    return duracao(saida)


def silencio(saida, segundos=0.25):
    run([FFMPEG, "-y", "-f", "lavfi", "-i", "anullsrc=r=24000:cl=mono",
         "-t", str(segundos), "-c:a", "libmp3lame", saida])


def _proteger_unidades(texto):
    # Nunca separa número de unidade ("500 ml", "2 kg") entre linhas.
    return re.sub(r"(\d) (ml|mL|l|g|kg|cm|mm|m|W|V|GB|MB|%)(?![A-Za-zÀ-ú])", "\\1\u00a0\\2", texto)


def _cabe_em_linhas(texto):
    """Quebra `texto` em até MAX_LINHAS linhas equilibradas; None se não couber."""
    if len(texto) <= CHARS_POR_LINHA:
        return [texto]
    primeira_que_cabe = None
    for largura in range(max(8, -(-len(texto) // MAX_LINHAS)), CHARS_POR_LINHA + 1):
        tentativa = textwrap.wrap(texto, width=largura, break_long_words=False)
        if len(tentativa) <= MAX_LINHAS:
            primeira_que_cabe = primeira_que_cabe or tentativa
            # Evita linha terminando em conectivo/"a" ("Voyage 2016 a" / "2023"): prefere outra largura.
            if len(tentativa) == 1 or tentativa[0].split()[-1].lower() not in _PENDENTES:
                return tentativa
    return primeira_que_cabe


_CONECTIVOS = {"e", "ou", "com", "sem", "pra", "pro", "para", "de", "da", "do", "em", "no", "na", "que", "se"}
_PENDENTES = _CONECTIVOS | {"a", "o", "os", "as", "um", "uma", "uns", "umas", "mais", "menos", "muito", "bem", "tão", "por", "ao", "aos", "à", "às", "pelo", "pela", "sobre", "entre"}


def _quebrar_por_sentido(texto):
    """Se o texto não cabe em 2 linhas, parte no ponto mais natural perto do meio
    (depois de pontuação ou antes de conectivo) em vez de deixar uma palavra sozinha."""
    if _cabe_em_linhas(texto):
        return [texto]
    palavras = texto.split()
    if len(palavras) < 2:
        return [texto]
    melhor, melhor_nota = 1, None
    for k in range(1, len(palavras)):
        esq, dir_ = " ".join(palavras[:k]), " ".join(palavras[k:])
        nota = abs(len(esq) - len(dir_))
        if esq[-1] in ",;:.?!": nota -= 6
        if palavras[k].lower() in _CONECTIVOS: nota -= 4
        if palavras[k - 1].lower() in _PENDENTES: nota += 12
        if melhor_nota is None or nota < melhor_nota:
            melhor, melhor_nota = k, nota
    return _quebrar_por_sentido(" ".join(palavras[:melhor])) + _quebrar_por_sentido(" ".join(palavras[melhor:]))


def _clausulas(texto):
    # Frases e orações: quebra depois de . ! ? : ; e vírgula — nunca no meio de uma ideia.
    return [c for c in re.split(r"(?<=[.!?:;,])\s+", texto.strip()) if c]


def dividir_em_blocos(legenda):
    """Agrupa a fala em blocos de SENTIDO, cada um com no máximo MAX_LINHAS linhas.

    `legenda` pode ser texto único ou lista de blocos sugeridos. Regras:
      - junta orações curtas no mesmo bloco enquanto couberem em 2 linhas;
      - fragmentos (< MIN_FRAGMENTO caracteres, ex.: "e Gol 1.0") são colados
        ao bloco vizinho, nunca ficam sozinhos na tela;
      - nunca corta palavra nem descarta texto: o que não cabe vira mais um bloco."""
    capacidade = CHARS_POR_LINHA * MAX_LINHAS
    candidatos = []
    for parte in (legenda if isinstance(legenda, list) else [legenda]):
        texto = _proteger_unidades(parte).strip()
        if len(texto) <= capacidade and isinstance(legenda, list):
            candidatos.append(texto)
            continue
        atual = ""
        for clausula in _clausulas(texto):
            junto = f"{atual} {clausula}".strip()
            if atual and len(junto) > capacidade:
                candidatos.append(atual)
                atual = clausula
            else:
                atual = junto
        if atual:
            candidatos.append(atual)

    # Fragmento (ex.: "olha só.") nunca fica sozinho: junta com o vizinho; se juntos não cabem
    # em um bloco, refaz a divisão dos dois pelo ponto de corte mais natural, em partes equilibradas.
    mudou, voltas = True, 0
    while mudou and len(candidatos) > 1 and voltas < 12:
        mudou, voltas = False, voltas + 1
        for i, c in enumerate(candidatos):
            if len(c) >= MIN_FRAGMENTO:
                continue
            for j in (i - 1, i + 1):
                if 0 <= j < len(candidatos):
                    a, b = (candidatos[j], c) if j < i else (c, candidatos[j])
                    junto = f"{a} {b}"
                    if len(junto) <= capacidade:
                        novos = [junto]
                    else:
                        novos = _quebrar_por_sentido(junto)
                        if any(len(x) < MIN_FRAGMENTO for x in novos):
                            continue
                    candidatos[min(i, j):max(i, j) + 1] = novos
                    mudou = True
                    break
            if mudou:
                break

    blocos = []
    for c in candidatos:
        for pedaco in _quebrar_por_sentido(c):
            linhas = _cabe_em_linhas(pedaco) or textwrap.wrap(pedaco, width=CHARS_POR_LINHA, break_long_words=False)
            blocos.append("\n".join(linhas).replace(" ", " "))
    return [b for b in blocos if b.strip()]


def dimensoes(imagem):
    r = run([FFPROBE, "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height",
             "-of", "csv=p=0", imagem])
    w, h = r.stdout.strip().split(",")[:2]
    return int(w), int(h)


def ajustar_crop(crop, iw, ih):
    """Garante que um recorte de detalhe não seja ampliado além de MAX_AUMENTO (perderia nitidez).

    Se for pequeno demais, abre o recorte em volta do mesmo centro até o limite, respeitando a foto."""
    cw, ch, cx, cy = (int(v) for v in crop.split(":"))
    escala = min(W / cw, JANELA_H / ch)
    if escala <= MAX_AUMENTO:
        return crop, False
    f = escala / MAX_AUMENTO
    ncw, nch = min(iw, round(cw * f)), min(ih, round(ch * f))
    ncx = min(max(0, round(cx + cw / 2 - ncw / 2)), iw - ncw)
    ncy = min(max(0, round(cy + ch / 2 - nch / 2)), ih - nch)
    return f"{ncw}:{nch}:{ncx}:{ncy}", True


def escolher_modo(cw, ch, pedido=None):
    """'grande' preenche a janela (corta o excedente do lado maior); 'inteiro' mostra a foto toda.

    Sem pedido explícito: 'grande' só se cortar até PERDA_MAX_GRANDE da foto e sem ampliar além do limite —
    senão mostra inteira, preservando o produto."""
    if pedido in ("grande", "inteiro"):
        return pedido
    alvo = W / JANELA_H
    ar = cw / ch
    perda = 1 - min(ar, alvo) / max(ar, alvo)
    largura_exibida = min(cw, ch * alvo)
    if perda <= PERDA_MAX_GRANDE and W / largura_exibida <= MAX_AUMENTO:
        return "grande"
    return "inteiro"


MOVIMENTOS = ["entrar", "deslocar", "sair", "deslocar_inv"]


def montar_shot_silencioso(imagem, crop, duracao_s, saida, modo="grande", foco=0.5, movimento="entrar", zoom=0.05):
    """Um recorte, sem áudio, já no layout final (foto grande na janela, fundo escuro suave)."""
    crop_filter = f"crop={crop}," if crop else ""
    if modo == "inteiro":
        fg = f"scale={W}:{JANELA_H}:force_original_aspect_ratio=decrease"
    else:
        # Janela com a proporção da área da foto; corta só o excedente do lado maior, em torno do foco.
        fg = (f"crop='min(iw,ih*{W}/{JANELA_H})':'min(ih,iw*{JANELA_H}/{W})':"
              f"x='(iw-ow)*{foco}':y='(ih-oh)*{foco}',scale={W}:{JANELA_H}")

    n = max(2, int(duracao_s * 25))
    suave = "x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'"
    if movimento == "entrar":
        zp = f"z='min(zoom+{zoom / n:.6f},{1 + zoom})':{suave}"
    elif movimento == "sair":
        zp = f"z='if(eq(on,1),{1 + zoom},max(1.0,zoom-{zoom / n:.6f}))':{suave}"
    elif movimento == "deslocar":      # câmera desliza da esquerda pra direita, sem mudar o zoom
        zp = f"z={1 + zoom}:x='(iw-iw/zoom)*on/{n}':y='ih/2-(ih/zoom/2)'"
    else:                              # deslocar_inv: da direita pra esquerda
        zp = f"z={1 + zoom}:x='(iw-iw/zoom)*(1-on/{n})':y='ih/2-(ih/zoom/2)'"

    vf = (
        f"[0:v]{crop_filter}split=2[bgsrc][fgsrc];"
        f"[bgsrc]scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},gblur=sigma=40,eq=brightness=-0.22[bg];"
        f"[fgsrc]{fg}[fg];"
        f"[bg][fg]overlay=(W-w)/2:{JANELA_Y}+({JANELA_H}-h)/2[comp];"
        f"[comp]zoompan={zp}:d=1:s={W}x{H}:fps=25[vout]"
    )
    run([FFMPEG, "-y", "-loop", "1", "-i", imagem, "-t", f"{duracao_s:.3f}",
         "-filter_complex", vf, "-map", "[vout]", "-r", "25", "-pix_fmt", "yuv420p",
         "-c:v", "libx264", saida])


def montar_cena_com_legenda(shots_video, blocos, prefixo, saida_concat, saida_final):
    """Junta os shots da cena e queima os blocos de legenda, cada um no seu trecho de tempo."""
    lista = f"{prefixo}_lista_shots.txt"
    with open(lista, "w", encoding="utf-8") as f:
        for s in shots_video:
            f.write(f"file '{s}'\n")
    run([FFMPEG, "-y", "-f", "concat", "-safe", "0", "-i", lista,
         "-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", "25", saida_concat])

    total = duracao(saida_concat)
    pesos = [max(8, len(b.replace("\n", " "))) for b in blocos]
    soma = sum(pesos)
    filtros, entrada, t0 = [], "[0:v]", 0.0
    for i, (bloco, peso) in enumerate(zip(blocos, pesos)):
        arq = f"{prefixo}_bloco_{i}.txt"
        # newline="": no Windows o Python gravaria "\r\n" e o drawtext desenharia uma linha em branco entre as linhas.
        with open(arq, "w", encoding="utf-8", newline="") as f:
            f.write(bloco)
        t1 = total if i == len(blocos) - 1 else t0 + total * peso / soma
        saida = f"[l{i}]"
        filtros.append(
            f"{entrada}drawtext=fontfile={FONTE}:textfile={arq}:fontcolor=white:fontsize={FONTE_TAM}:"
            f"line_spacing=6:borderw=4:bordercolor=black:x=(w-text_w)/2-{MARGEM_DIREITA // 2}:y={LEGENDA_Y}:"
            f"box=1:boxcolor=black@0.62:boxborderw=24:enable='between(t\\,{t0:.3f}\\,{t1:.3f})'{saida}"
        )
        entrada, t0 = saida, t1
    run([FFMPEG, "-y", "-i", saida_concat, "-filter_complex", ";".join(filtros), "-map", entrada,
         "-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", "25", saida_final])


def concatenar_video(clipes, saida):
    lista = "lista_concat_final.txt"
    with open(lista, "w", encoding="utf-8") as f:
        for c in clipes:
            f.write(f"file '{c}'\n")
    run([FFMPEG, "-y", "-f", "concat", "-safe", "0", "-i", lista,
         "-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", "25", saida])


def concatenar_audio(audios, saida):
    lista = "lista_audio_final.txt"
    with open(lista, "w", encoding="utf-8") as f:
        for a in audios:
            f.write(f"file '{a}'\n")
    run([FFMPEG, "-y", "-f", "concat", "-safe", "0", "-i", lista, "-c:a", "libmp3lame", saida])


def mixar_com_musica(video_sem_audio, narracao, musica, saida, volume_musica=0.16):
    dur_v = duracao(video_sem_audio)
    fade_out_inicio = max(0, dur_v - 1.5)
    # Sidechain: a música baixa automaticamente enquanto a narração toca.
    filtro = (
        f"[2:a]volume={volume_musica},atrim=0:{dur_v},"
        f"afade=t=in:st=0:d=1,afade=t=out:st={fade_out_inicio}:d=1.5[musica_fade];"
        f"[musica_fade][1:a]sidechaincompress=threshold=0.04:ratio=10:attack=25:release=400[musica_duck];"
        f"[1:a][musica_duck]amix=inputs=2:duration=first:weights=1.6 1[audio_final]"
    )
    run([FFMPEG, "-y", "-i", video_sem_audio, "-i", narracao, "-i", musica,
         "-filter_complex", filtro, "-map", "0:v", "-map", "[audio_final]",
         "-c:v", "copy", "-c:a", "aac", "-t", str(dur_v), saida])


def main(roteiro_path, saida_nome):
    with open(roteiro_path, encoding="utf-8") as f:
        roteiro = json.load(f)

    clipes_cena, audios_cena = [], []
    indice_shot = 0
    for i, cena in enumerate(roteiro["cenas"]):
        audio_path = f"{saida_nome}_nar_{i}.mp3"
        dur = gerar_narracao(cena["fala"], cena["tom"], audio_path)
        audios_cena.append(audio_path)

        n_shots = len(cena["shots"])
        shots_video = []
        for j, shot in enumerate(cena["shots"]):
            fracao = shot.get("fracao", 1.0 / n_shots)
            shot_dur = max(0.8, dur * fracao) + (0.3 if j == n_shots - 1 else 0)
            shot_path = f"{saida_nome}_shot_{i}_{j}.mp4"

            # Enquadramento decidido pela foto real: detalhe nunca ampliado além do limite de nitidez;
            # foto inteira quando preencher a janela cortaria demais.
            iw, ih = dimensoes(shot["imagem"])
            crop, crop_aberto = (None, False) if not shot.get("crop") else ajustar_crop(shot["crop"], iw, ih)
            cw, ch = (int(v) for v in crop.split(":")[:2]) if crop else (iw, ih)
            modo = escolher_modo(cw, ch, shot.get("modo"))
            if crop_aberto:
                print(f"  aviso: recorte de detalhe da cena {i} aberto para não perder nitidez ({shot['crop']} -> {crop})")
            if min(W / cw, JANELA_H / ch) > MAX_AUMENTO:
                print(f"  aviso: foto {shot['imagem']} é pequena ({cw}x{ch}); será ampliada acima do ideal")

            montar_shot_silencioso(shot["imagem"], crop, shot_dur, shot_path, modo=modo,
                                   foco=shot.get("foco", 0.5), movimento=MOVIMENTOS[indice_shot % len(MOVIMENTOS)])
            indice_shot += 1
            shots_video.append(shot_path)

        blocos = dividir_em_blocos(cena.get("legenda") or cena["fala"])
        concat_path = f"{saida_nome}_cena_concat_{i}.mp4"
        final_cena_path = f"{saida_nome}_cena_{i}.mp4"
        montar_cena_com_legenda(shots_video, blocos, f"{saida_nome}_c{i}", concat_path, final_cena_path)
        clipes_cena.append(final_cena_path)
        print(f"Cena {i} [{cena['tom']}]: {dur:.2f}s, {n_shots} shot(s), {len(blocos)} bloco(s) de legenda — \"{cena['fala'][:55]}\"")

        if i < len(roteiro["cenas"]) - 1:
            pausa_path = f"{saida_nome}_pausa_{i}.mp3"
            silencio(pausa_path, 0.18)
            audios_cena.append(pausa_path)

    video_concat = f"{saida_nome}_video_concat.mp4"
    concatenar_video(clipes_cena, video_concat)

    narracao_final = f"{saida_nome}_narracao_final.mp3"
    concatenar_audio(audios_cena, narracao_final)

    saida_final = f"{saida_nome}.mp4"
    mixar_com_musica(video_concat, narracao_final, MUSICA, saida_final)

    dur_final = duracao(saida_final)
    tamanho = os.path.getsize(saida_final)
    print(f"\n{saida_nome}.mp4 — {dur_final:.2f}s, {tamanho/1024:.0f} KB")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
