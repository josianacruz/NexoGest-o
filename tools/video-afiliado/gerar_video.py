#!/usr/bin/env python3
"""Gerador de vídeo de afiliado v3 — roteiro humano, cenas coerentes com a
fala, narração com variação de ritmo/tom, música com redução automática.

Cada cena tem UM trecho de narração e um ou mais "shots" (recortes de fotos
reais) que se alternam durante aquele trecho, sempre case com o que está
sendo dito. Nunca mostra ângulo/detalhe que a imagem não tem de verdade.
"""
import json
import os
import subprocess
import sys
import textwrap

FFMPEG = os.environ.get("FFMPEG_BIN", "ffmpeg")
FFPROBE = os.environ.get("FFPROBE_BIN", "ffprobe")
FONTE = os.environ.get("FONTE_TTF", "fonte.ttf")
MUSICA = os.environ.get("MUSICA_FUNDO", "musica_fundo.wav")

W, H = 1080, 1920

# Ajuste de ritmo/tom por tipo de fala — mesma técnica usada em locução real:
# pergunta um pouco mais viva, explicação neutra, fechamento mais pausado.
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
    run([FFMPEG, "-y", "-f", "lavfi", "-i", f"anullsrc=r=24000:cl=mono",
         "-t", str(segundos), "-c:a", "libmp3lame", saida])


def legenda_file(texto, caminho, largura_min=20, largura_max=50):
    largura = largura_min
    linhas = textwrap.wrap(texto, width=largura)
    while len(linhas) > 2 and largura < largura_max:
        largura += 2
        linhas = textwrap.wrap(texto, width=largura)
    if len(linhas) > 2:
        raise ValueError(f"Legenda não coube em 2 linhas: {texto!r}")
    with open(caminho, "w", encoding="utf-8") as f:
        f.write("\n".join(linhas))


def montar_shot_silencioso(imagem, crop, duracao_s, saida, zoom_final=1.07, pan=None):
    """Um recorte, sem áudio — vira um pedaço de uma cena maior."""
    crop_filter = f"crop={crop}," if crop else ""
    zoom_expr = f"min(zoom+0.0007,{zoom_final})"
    vf = (
        f"[0:v]{crop_filter}split=2[bgsrc][fgsrc];"
        f"[bgsrc]scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},gblur=sigma=25,eq=brightness=-0.08[bg];"
        f"[fgsrc]scale={W}:{H}:force_original_aspect_ratio=decrease[fg];"
        f"[bg][fg]overlay=(W-w)/2:(H-h)/2[comp];"
        f"[comp]zoompan=z='{zoom_expr}':d=1:s={W}x{H}:fps=25[vout]"
    )
    run([FFMPEG, "-y", "-loop", "1", "-i", imagem, "-t", str(duracao_s),
         "-filter_complex", vf, "-map", "[vout]", "-r", "25", "-pix_fmt", "yuv420p",
         "-c:v", "libx264", saida])


def montar_cena_com_legenda(shots_video, legenda_txt, saida_sem_legenda_concat, saida_final):
    """Concatena os shots silenciosos da cena e queima a legenda por cima do resultado."""
    lista = "lista_shots.txt"
    with open(lista, "w", encoding="utf-8") as f:
        for s in shots_video:
            f.write(f"file '{s}'\n")
    run([FFMPEG, "-y", "-f", "concat", "-safe", "0", "-i", lista,
         "-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", "25", saida_sem_legenda_concat])

    vf = (
        f"drawtext=fontfile={FONTE}:textfile={legenda_txt}:fontcolor=white:fontsize=50:"
        f"line_spacing=10:borderw=4:bordercolor=black:x=(w-text_w)/2:y=h-380:"
        f"box=1:boxcolor=black@0.45:boxborderw=22"
    )
    run([FFMPEG, "-y", "-i", saida_sem_legenda_concat, "-vf", vf,
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
    # Sidechain: a música baixa automaticamente sempre que a narração está
    # tocando (compressão disparada pelo canal da voz) — é a "redução
    # automática do volume da música enquanto a pessoa fala" pedida.
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

    clipes_cena = []
    audios_cena = []
    for i, cena in enumerate(roteiro["cenas"]):
        audio_path = f"{saida_nome}_nar_{i}.mp3"
        dur = gerar_narracao(cena["fala"], cena["tom"], audio_path)
        audios_cena.append(audio_path)

        n_shots = len(cena["shots"])
        shots_video = []
        for j, shot in enumerate(cena["shots"]):
            fracao = shot.get("fracao", 1.0 / n_shots)
            shot_dur = max(0.6, dur * fracao) + (0.3 if j == n_shots - 1 else 0)
            shot_path = f"{saida_nome}_shot_{i}_{j}.mp4"
            montar_shot_silencioso(shot["imagem"], shot.get("crop"), shot_dur, shot_path,
                                    pan=shot.get("pan"))
            shots_video.append(shot_path)

        leg_path = f"{saida_nome}_leg_{i}.txt"
        legenda_file(cena["legenda"], leg_path)
        concat_path = f"{saida_nome}_cena_concat_{i}.mp4"
        final_cena_path = f"{saida_nome}_cena_{i}.mp4"
        montar_cena_com_legenda(shots_video, leg_path, concat_path, final_cena_path)
        clipes_cena.append(final_cena_path)
        print(f"Cena {i} [{cena['tom']}]: {dur:.2f}s, {n_shots} shot(s) — \"{cena['fala'][:55]}\"")

        # Pequena pausa de silêncio entre cenas — "pausas nas divisões de sentido".
        if i < len(roteiro["cenas"]) - 1:
            pausa_path = f"{saida_nome}_pausa_{i}.mp3"
            silencio(pausa_path, 0.22)
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
