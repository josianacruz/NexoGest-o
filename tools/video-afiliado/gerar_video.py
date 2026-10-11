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
FONTE_TAM = 66
CHARS_POR_LINHA = 22                   # ~860 px de largura útil com fonte 66 negrito
MAX_LINHAS = 2

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


def dividir_em_blocos(legenda):
    """Quebra a legenda em blocos de no máximo MAX_LINHAS linhas curtas.

    `legenda` pode ser texto único (quebrado automaticamente em blocos) ou uma
    lista de blocos já definidos (cada um ainda é verificado). Nunca corta
    palavra nem descarta texto: se não cabe, vira mais um bloco."""
    partes = legenda if isinstance(legenda, list) else [legenda]
    blocos = []
    for parte in partes:
        texto = _proteger_unidades(parte)
        # Linhas equilibradas: procura a menor largura que ainda cabe em MAX_LINHAS.
        linhas = None
        if len(texto) <= CHARS_POR_LINHA:
            linhas = [texto]
        for largura in ([] if linhas else range(max(8, -(-len(texto) // MAX_LINHAS)), CHARS_POR_LINHA + 1)):
            tentativa = textwrap.wrap(texto, width=largura, break_long_words=False)
            if len(tentativa) <= MAX_LINHAS:
                linhas = tentativa
                break
        if linhas is None:
            linhas = textwrap.wrap(texto, width=CHARS_POR_LINHA, break_long_words=False)
        for i in range(0, len(linhas), MAX_LINHAS):
            blocos.append("\n".join(linhas[i:i + MAX_LINHAS]).replace("\u00a0", " "))
    return [b for b in blocos if b.strip()]


def montar_shot_silencioso(imagem, crop, duracao_s, saida, modo="grande", foco=0.5, entrar=True, zoom=0.06):
    """Um recorte, sem áudio, já no layout final (foto grande na janela, fundo escuro suave)."""
    crop_filter = f"crop={crop}," if crop else ""
    if modo == "inteiro":
        fg = f"scale={W}:{JANELA_H}:force_original_aspect_ratio=decrease"
    else:
        # Janela com a proporção da área da foto; corta só o excedente do lado maior, em torno do foco.
        fg = (f"crop='min(iw,ih*{W}/{JANELA_H})':'min(ih,iw*{JANELA_H}/{W})':"
              f"x='(iw-ow)*{foco}':y='(ih-oh)*{foco}',scale={W}:{JANELA_H}")

    passo = zoom / max(1, int(duracao_s * 25))
    if entrar:
        z = f"min(zoom+{passo:.6f},{1 + zoom})"
    else:
        z = f"if(eq(on,1),{1 + zoom},max(1.0,zoom-{passo:.6f}))"

    vf = (
        f"[0:v]{crop_filter}split=2[bgsrc][fgsrc];"
        f"[bgsrc]scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},gblur=sigma=40,eq=brightness=-0.22[bg];"
        f"[fgsrc]{fg}[fg];"
        f"[bg][fg]overlay=(W-w)/2:{JANELA_Y}+({JANELA_H}-h)/2[comp];"
        f"[comp]zoompan=z='{z}':d=1:s={W}x{H}:fps=25[vout]"
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
        with open(arq, "w", encoding="utf-8") as f:
            f.write(bloco)
        t1 = total if i == len(blocos) - 1 else t0 + total * peso / soma
        saida = f"[l{i}]"
        filtros.append(
            f"{entrada}drawtext=fontfile={FONTE}:textfile={arq}:fontcolor=white:fontsize={FONTE_TAM}:"
            f"line_spacing=14:borderw=5:bordercolor=black:x=(w-text_w)/2-50:y={LEGENDA_Y}:"
            f"box=1:boxcolor=black@0.6:boxborderw=26:enable='between(t\\,{t0:.3f}\\,{t1:.3f})'{saida}"
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
            montar_shot_silencioso(shot["imagem"], shot.get("crop"), shot_dur, shot_path,
                                   modo=shot.get("modo", "grande"), foco=shot.get("foco", 0.5),
                                   entrar=(indice_shot % 2 == 0))
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
