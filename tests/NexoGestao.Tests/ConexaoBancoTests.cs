using System.Net.Sockets;
using Npgsql;
using NexoGestao.Api.Shared;
using Xunit;

namespace NexoGestao.Tests;

// Estabilidade da conexão com o Neon: ajustes automáticos que respeitam o que a string já tiver.
public class ConexaoBancoTests
{
    private static NpgsqlConnectionStringBuilder Ler(string? s) => new(s);

    [Fact]
    public void Acrescenta_os_ajustes_de_estabilidade_quando_a_string_nao_os_tem()
    {
        var b = Ler(ConexaoBanco.Ajustar("Host=ep-abc.us-east-2.aws.neon.tech;Database=neondb;Username=u;Password=p;SSL Mode=Require"));
        Assert.Equal(30, b.ConnectionIdleLifetime);
        Assert.Equal(20, b.KeepAlive);
        Assert.Equal(30, b.Timeout);
        Assert.Equal(20, b.MaxPoolSize);
        Assert.False(b.NoResetOnClose);                 // sem pooler: não precisa
        Assert.Equal(SslMode.Require, b.SslMode);       // o resto da string continua igual
        Assert.Equal("neondb", b.Database);
    }

    [Fact]
    public void Respeita_valores_ja_informados_e_nao_confunde_command_timeout_com_timeout_de_conexao()
    {
        var b = Ler(ConexaoBanco.Ajustar("Host=h;Database=d;Username=u;Password=p;Timeout=5;Keepalive=60;Maximum Pool Size=7;Connection Idle Lifetime=300"));
        Assert.Equal(5, b.Timeout);
        Assert.Equal(60, b.KeepAlive);
        Assert.Equal(7, b.MaxPoolSize);
        Assert.Equal(300, b.ConnectionIdleLifetime);

        var c = Ler(ConexaoBanco.Ajustar("Host=h;Database=d;Username=u;Password=p;Command Timeout=90"));
        Assert.Equal(90, c.CommandTimeout);   // mantido
        Assert.Equal(30, c.Timeout);          // o de conexão ainda recebe o padrão
    }

    [Fact]
    public void Com_o_pooler_do_neon_liga_no_reset_on_close()
    {
        var b = Ler(ConexaoBanco.Ajustar("Host=ep-abc-pooler.us-east-2.aws.neon.tech;Database=d;Username=u;Password=p"));
        Assert.True(b.NoResetOnClose);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("postgresql://u:p@host/db?sslmode=require")]
    public void Texto_vazio_ou_em_formato_de_url_nao_e_alterado(string? entrada) => Assert.Equal(entrada, ConexaoBanco.Ajustar(entrada));

    [Fact]
    public void Reconhece_falhas_de_conexao_mesmo_dentro_de_outras_excecoes()
    {
        Assert.True(ConexaoBanco.EhFalhaDeConexao(new TimeoutException()));
        Assert.True(ConexaoBanco.EhFalhaDeConexao(new InvalidOperationException("x", new SocketException())));
        Assert.True(ConexaoBanco.EhFalhaDeConexao(new Exception("a", new Exception("b", new System.IO.IOException()))));
        Assert.False(ConexaoBanco.EhFalhaDeConexao(new InvalidOperationException("erro de programação")));
        Assert.False(ConexaoBanco.EhFalhaDeConexao(null));
    }
}
