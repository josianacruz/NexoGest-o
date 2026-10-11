namespace NexoGestao.Api.Videos;

// A geração de vídeo NÃO acontece dentro da API: roda no worker local (src/NexoGestao.Worker),
// que só faz conexões de saída até esta API.
// Esta opção serve apenas para a API entregar o MP4 (download/prévia) quando ela roda no
// MESMO computador do worker e enxerga a mesma pasta. Em produção fica sem configurar:
// o Nexo online só mostra o caminho do arquivo na máquina do worker.
public class VideosWorkerOptions
{
    public string? PastaSaida { get; set; }

    public string? PastaLocal => string.IsNullOrWhiteSpace(PastaSaida) ? null : Path.GetFullPath(PastaSaida);
}
