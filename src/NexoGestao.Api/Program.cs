using NexoGestao.Api.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.ResponseCompression;
using NexoGestao.Api.Shared;
using System.IO.Compression;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using System.Text.Json.Serialization;
using System.Threading.RateLimiting;

// Evita um NullReferenceException do próprio .NET ao processar o cabeçalho
// Alt-Svc que a CDN da Shopee devolve (ShopeeMetadataFetcher) — bug conhecido
// no parsing de Alt-Svc malformado, independente da versão HTTP pedida.
AppContext.SetSwitch("System.Net.SocketsHttpHandler.Http3Support", false);

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.

// Enums trafegam como nome (ex.: "Pix"), nunca como número — necessário pro
// FormaPagamentoRecebido do módulo financeiro (e deixa qualquer enum futuro
// legível no corpo da requisição/resposta em vez de um índice arbitrário).
builder.Services.AddControllers()
    .AddJsonOptions(options => options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()));
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();

var origensPermitidas = (builder.Configuration["Cors:AllowedOrigins"] ?? "http://localhost:3000")
    .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

builder.Services.AddCors(options =>
{
    options.AddPolicy("PermitirFrontend", policy =>
    {
        policy.WithOrigins(origensPermitidas)
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

// Compressão das respostas (Brotli quando o navegador aceita, senão gzip): o JSON de listas fica de 3 a 10 vezes menor,
// o que pesa bastante em celular com internet fraca. As respostas usam o token no cabeçalho (não cookie), então é seguro com HTTPS.
builder.Services.AddResponseCompression(options =>
{
    options.EnableForHttps = true;
    options.Providers.Add<BrotliCompressionProvider>();
    options.Providers.Add<GzipCompressionProvider>();
});
builder.Services.Configure<BrotliCompressionProviderOptions>(o => o.Level = CompressionLevel.Fastest);
builder.Services.Configure<GzipCompressionProviderOptions>(o => o.Level = CompressionLevel.Fastest);

// Conexão com o banco: acrescenta (sem sobrescrever o que já estiver na string) ajustes de estabilidade para o Neon,
// que suspende o banco ocioso e derruba as conexões abertas. Ver ConexaoBanco.
var conexaoPadrao = ConexaoBanco.Ajustar(builder.Configuration.GetConnectionString("DefaultConnection"));
builder.Services.AddDbContext<AppDbContext>(options => options.UseNpgsql(conexaoPadrao));

builder.Services.AddIdentity<IdentityUser, IdentityRole>()
    .AddEntityFrameworkStores<AppDbContext>();

// Usada pra criptografar credenciais de API de afiliados (App Id/App Secret)
// em repouso — nativa do ASP.NET Core, sem serviço externo.
builder.Services.AddDataProtection();

// Busca só metadados públicos (og:title/og:image) de links de produto da
// Shopee — nunca login, nunca a API paga/autenticada.
builder.Services.AddHttpClient<NexoGestao.Api.Shared.ShopeeMetadataFetcher>();

// Descobre links de produtos a partir de palavra-chave via busca pública
// (DuckDuckGo) — nunca a busca autenticada da própria Shopee.
builder.Services.AddHttpClient<NexoGestao.Api.Shared.DescobertaShopeeFetcher>();

// A geração de vídeo roda no worker local (src/NexoGestao.Worker), fora desta API.
// Esta opção só diz onde a API (rodando no mesmo PC do worker) pode ler o MP4 para entregar.
builder.Services.Configure<NexoGestao.Api.Videos.VideosWorkerOptions>(builder.Configuration.GetSection("Videos:Worker"));

// Radar Shopee: API oficial de afiliados (GraphQL). App ID/Secret só por variável de ambiente
// (Shopee__Affiliate__AppId / __AppSecret) ou pelo cadastro criptografado da empresa; nunca no código.
// Sem credenciais nada é consultado. Rotina diária às 8h de Brasília: ver RadarAgendadorService.
builder.Services.Configure<NexoGestao.Api.Shared.ShopeeAffiliateOptions>(builder.Configuration.GetSection("Shopee:Affiliate"));
builder.Services.AddHttpClient<NexoGestao.Api.Shared.ShopeeAffiliateApiService>();
builder.Services.AddScoped<NexoGestao.Api.Radar.RadarService>();
builder.Services.AddHostedService<NexoGestao.Api.Radar.RadarAgendadorService>();

// Lê só o 1º redirecionamento de links curtos de afiliada (s.shopee.com.br);
// AllowAutoRedirect desligado de propósito pra nunca seguir além disso.
builder.Services.AddHttpClient<NexoGestao.Api.Shared.ResolvedorLinkAfiliado>()
    .ConfigurePrimaryHttpMessageHandler(() => new SocketsHttpHandler { AllowAutoRedirect = false });

var jwtKey = builder.Configuration["Jwt:Key"]!;
var jwtIssuer = builder.Configuration["Jwt:Issuer"]!;
var jwtAudience = builder.Configuration["Jwt:Audience"]!;

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = jwtIssuer,
        ValidAudience = jwtAudience,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey))
    };
});

// Limite por IP nos endpoints públicos (sem login) — impede spam de
// interesse/agendamento/vaga sem afetar o resto da API.
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.OnRejected = async (context, cancellationToken) =>
    {
        context.HttpContext.Response.ContentType = "application/json";
        await context.HttpContext.Response.WriteAsync(
            "{\"mensagem\":\"Muitas tentativas. Aguarde um instante e tente de novo.\"}",
            cancellationToken);
    };

    // Worker local: consulta a fila de tempos em tempos; o limite é por token (ou IP, se faltar).
    options.AddPolicy("worker", httpContext => RateLimitPartition.GetFixedWindowLimiter(
        partitionKey: httpContext.Request.Headers["X-Worker-Token"].ToString() is { Length: > 0 } t
            ? "t:" + t : "ip:" + (httpContext.Connection.RemoteIpAddress?.ToString() ?? "desconhecido"),
        factory: _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = 240,
            Window = TimeSpan.FromMinutes(1),
            QueueLimit = 0,
        }));

    // Leitura pública (página da loja, horários livres, novidades): mais folgada, porque a tela adianta pedidos para
    // ficar instantânea e muita gente divide o mesmo IP (rede de operadora, Wi-Fi de salão). Criar coisas continua no
    // limite rígido "publico" abaixo.
    options.AddPolicy("publico-leitura", httpContext => RateLimitPartition.GetFixedWindowLimiter(
        partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "desconhecido",
        factory: _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = 120,
            Window = TimeSpan.FromMinutes(1),
            QueueLimit = 0,
        }));

    options.AddPolicy("publico", httpContext => RateLimitPartition.GetFixedWindowLimiter(
        partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "desconhecido",
        factory: _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = 15,
            Window = TimeSpan.FromMinutes(1),
            QueueLimit = 0,
        }));
});

var app = builder.Build();

// Migrations: se existir ConnectionStrings:Migracoes (conexão DIRETA do Neon, sem "-pooler"), é ela que aplica as migrations.
// O pooler do Neon (PgBouncer) é ótimo para as consultas do dia a dia, mas não combina com o bloqueio que o EF usa
// para migrar. Sem essa configuração, tudo segue como antes (usa a DefaultConnection).
var conexaoMigracoes = builder.Configuration.GetConnectionString("Migracoes");
if (!string.IsNullOrWhiteSpace(conexaoMigracoes))
{
    using var dbMigracao = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(ConexaoBanco.Ajustar(conexaoMigracoes)).Options);
    dbMigracao.Database.Migrate();
}
else
{
    using var scope = app.Services.CreateScope();
    scope.ServiceProvider.GetRequiredService<AppDbContext>().Database.Migrate();
}

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.MapSwaggerUI("swagger", options =>
    {
        options.SwaggerEndpoint("/openapi/v1.json", "NexoGestao API v1");
    });
}

// Render (e outros PaaS) terminam o HTTPS no proxy deles e falam HTTP com o
// container — sem isso, UseHttpsRedirection entra em loop de redirecionamento.
app.UseForwardedHeaders(new ForwardedHeadersOptions
{
    ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto
});

app.UseResponseCompression();

// Falha de conexão com o banco (Neon acordando, rede oscilando): em vez de "erro 500" genérico, responde 503 com uma
// mensagem clara e "Retry-After". As telas tentam de novo sozinhas nas leituras e mantêm o que a pessoa digitou.
app.Use(async (contexto, proximo) =>
{
    try
    {
        await proximo();
    }
    catch (Exception ex) when (ConexaoBanco.EhFalhaDeConexao(ex) && !contexto.Response.HasStarted)
    {
        app.Logger.LogWarning(ex, "Falha de conexão com o banco em {Metodo} {Caminho}", contexto.Request.Method, contexto.Request.Path);
        contexto.Response.Clear();
        contexto.Response.StatusCode = StatusCodes.Status503ServiceUnavailable;
        contexto.Response.Headers.RetryAfter = "3";
        contexto.Response.ContentType = "application/json";
        await contexto.Response.WriteAsync("{\"mensagem\":\"O servidor está se reconectando ao banco de dados. Tente de novo em alguns segundos. O que você digitou não foi perdido.\"}");
    }
});

app.UseHttpsRedirection();

app.UseCors("PermitirFrontend");

app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();

app.MapControllers();
app.MapGet("/health", () => Results.Ok("ok"));

// Saúde "de verdade": faz uma consulta mínima ao banco e mede o tempo. Serve para monitorar (ex.: um verificador de
// disponibilidade gratuito) e para conferir a conexão servidor-banco depois de qualquer troca de configuração.
app.MapGet("/health/db", async (AppDbContext db, CancellationToken ct) =>
{
    var relogio = System.Diagnostics.Stopwatch.StartNew();
    try
    {
        await db.Database.ExecuteSqlRawAsync("SELECT 1", ct);
        return Results.Ok(new { banco = "ok", ms = relogio.ElapsedMilliseconds });
    }
    catch (Exception ex) when (ConexaoBanco.EhFalhaDeConexao(ex) || ex is OperationCanceledException)
    {
        return Results.Json(new { banco = "indisponivel", ms = relogio.ElapsedMilliseconds }, statusCode: StatusCodes.Status503ServiceUnavailable);
    }
});

app.Run();