using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using NexoGestao.Api.Data;
using NexoGestao.Api.Domain;
using NexoGestao.Api.Shared;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;

namespace NexoGestao.Api.Auth;

public record RegisterRequest(string Email, string Senha);
public record LoginRequest(string Email, string Senha);
public record RefreshRequest(string RefreshToken);
public record LogoutRequest(string RefreshToken);

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly UserManager<IdentityUser> _userManager;
    private readonly IConfiguration _configuration;
    private readonly AppDbContext _context;

    public AuthController(UserManager<IdentityUser> userManager, IConfiguration configuration, AppDbContext context)
    {
        _userManager = userManager;
        _configuration = configuration;
        _context = context;
    }

    [HttpPost("registrar")]
    [EnableRateLimiting("autenticacao")]
    public async Task<IActionResult> Registrar(RegisterRequest request)
    {
        // Proteção do servidor gratuito: depois de N contas (Limites__MaxUsuarios, padrão 100) fecha novos cadastros.
        if (LimitesDoServidor.CadastrosFechados(await _userManager.Users.CountAsync(), _configuration))
        {
            var alerta = HttpContext.RequestServices.GetService<AlertaAdmin>();
            if (alerta is not null)
                _ = alerta.EnviarAsync("Cadastros fechados", "Alguém tentou criar conta, mas o limite de contas foi atingido. Aumente Limites__MaxUsuarios no Render se quiser abrir mais vagas.");
            return StatusCode(StatusCodes.Status403Forbidden, new { mensagem = "Os cadastros estão temporariamente fechados. Tente novamente em alguns dias." });
        }

        var usuario = new IdentityUser { UserName = request.Email, Email = request.Email };
        var resultado = await _userManager.CreateAsync(usuario, request.Senha);

        if (!resultado.Succeeded)
            return BadRequest(resultado.Errors);

        return Ok(new { mensagem = "Usuário criado com sucesso." });
    }

    [HttpPost("login")]
    [EnableRateLimiting("autenticacao")]
    public async Task<IActionResult> Login(LoginRequest request)
    {
        var usuario = await _userManager.FindByEmailAsync(request.Email);
        if (usuario is null)
            return Unauthorized(new { mensagem = "Email ou senha inválidos." });

        var senhaValida = await _userManager.CheckPasswordAsync(usuario, request.Senha);
        if (!senhaValida)
            return Unauthorized(new { mensagem = "Email ou senha inválidos." });

        var token = GerarToken(usuario);
        var refreshToken = await CriarRefreshTokenAsync(usuario.Id);
        return Ok(new { token, refreshToken });
    }

    // Troca um refresh token (de longa duração, guardado no aparelho) por um access token novo — é isso que
    // mantém a pessoa logada depois de fechar e abrir o app/navegador, sem pedir email/senha de novo.
    // Rotação: o refresh token usado aqui é invalidado e um novo é devolvido; reusar o antigo nunca mais funciona.
    [HttpPost("refresh")]
    [EnableRateLimiting("autenticacao-renovar")]
    public async Task<IActionResult> Refresh(RefreshRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.RefreshToken))
            return Unauthorized();

        var hash = HashDoToken(request.RefreshToken);
        var registro = await _context.RefreshTokens.FirstOrDefaultAsync(r => r.TokenHash == hash);
        if (registro is null || registro.RevogadoEm != null || registro.ExpiraEm < DateTime.UtcNow)
            return Unauthorized();

        var usuario = await _userManager.FindByIdAsync(registro.UsuarioId);
        if (usuario is null)
            return Unauthorized();

        var novoRefreshToken = await CriarRefreshTokenAsync(usuario.Id);
        registro.RevogadoEm = DateTime.UtcNow;
        registro.SubstituidoPorHash = HashDoToken(novoRefreshToken);
        await _context.SaveChangesAsync();

        var token = GerarToken(usuario);
        return Ok(new { token, refreshToken = novoRefreshToken });
    }

    // Encerramento explícito ("Sair"): revoga o refresh token no servidor para que ele não possa mais
    // ser usado, mesmo que ainda esteja salvo em algum aparelho.
    [HttpPost("logout")]
    public async Task<IActionResult> Logout(LogoutRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.RefreshToken))
            return Ok();

        var hash = HashDoToken(request.RefreshToken);
        var registro = await _context.RefreshTokens.FirstOrDefaultAsync(r => r.TokenHash == hash);
        if (registro is not null && registro.RevogadoEm is null)
        {
            registro.RevogadoEm = DateTime.UtcNow;
            await _context.SaveChangesAsync();
        }

        return Ok();
    }

    private static string HashDoToken(string token) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));

    private async Task<string> CriarRefreshTokenAsync(string usuarioId)
    {
        var token = Convert.ToBase64String(RandomNumberGenerator.GetBytes(64))
            .Replace('+', '-').Replace('/', '_').TrimEnd('=');

        var dias = int.TryParse(_configuration["Jwt:RefreshTokenDias"], out var d) ? d : 30;
        _context.RefreshTokens.Add(new RefreshToken
        {
            UsuarioId = usuarioId,
            TokenHash = HashDoToken(token),
            ExpiraEm = DateTime.UtcNow.AddDays(dias),
        });
        await _context.SaveChangesAsync();

        return token;
    }

    private string GerarToken(IdentityUser usuario)
    {
        var jwtKey = _configuration["Jwt:Key"]!;
        var jwtIssuer = _configuration["Jwt:Issuer"]!;
        var jwtAudience = _configuration["Jwt:Audience"]!;
        var expiresInMinutes = int.Parse(_configuration["Jwt:ExpiresInMinutes"]!);

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, usuario.Id),
            new(JwtRegisteredClaimNames.Email, usuario.Email!),
        };

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey));
        var credenciais = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: jwtIssuer,
            audience: jwtAudience,
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(expiresInMinutes),
            signingCredentials: credenciais
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
