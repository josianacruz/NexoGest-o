using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace NexoGestao.Api.Migrations
{
    /// <inheritdoc />
    public partial class AdicionaRadarShopee : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<double>(
                name: "Avaliacao",
                table: "ProdutosAfiliados",
                type: "double precision",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "ComissaoShopeePercentual",
                table: "ProdutosAfiliados",
                type: "numeric",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "ComissaoVendedorPercentual",
                table: "ProdutosAfiliados",
                type: "numeric",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "FimOferta",
                table: "ProdutosAfiliados",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "InicioOferta",
                table: "ProdutosAfiliados",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "UltimaConsultaApi",
                table: "ProdutosAfiliados",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "RadarAtivo",
                table: "ConfiguracoesAfiliados",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateTable(
                name: "ProdutoAfiliadoSnapshots",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    EmpresaId = table.Column<int>(type: "integer", nullable: false),
                    ProdutoAfiliadoId = table.Column<int>(type: "integer", nullable: false),
                    DataConsulta = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Fonte = table.Column<string>(type: "text", nullable: false),
                    Preco = table.Column<decimal>(type: "numeric", nullable: true),
                    Vendas = table.Column<int>(type: "integer", nullable: true),
                    ComissaoPercentual = table.Column<decimal>(type: "numeric", nullable: true),
                    ComissaoValor = table.Column<decimal>(type: "numeric", nullable: true),
                    ComissaoVendedorPercentual = table.Column<decimal>(type: "numeric", nullable: true),
                    ComissaoShopeePercentual = table.Column<decimal>(type: "numeric", nullable: true),
                    InicioOferta = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    FimOferta = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProdutoAfiliadoSnapshots", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ProdutoAfiliadoSnapshots_ProdutosAfiliados_ProdutoAfiliadoId",
                        column: x => x.ProdutoAfiliadoId,
                        principalTable: "ProdutosAfiliados",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "RadarConsultas",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    EmpresaId = table.Column<int>(type: "integer", nullable: false),
                    Nome = table.Column<string>(type: "text", nullable: false),
                    PalavraChave = table.Column<string>(type: "text", nullable: false),
                    Ordenacao = table.Column<int>(type: "integer", nullable: false),
                    ComissaoMinimaPercentual = table.Column<decimal>(type: "numeric", nullable: true),
                    MaximoProdutos = table.Column<int>(type: "integer", nullable: false),
                    Ativa = table.Column<bool>(type: "boolean", nullable: false),
                    CriadaEm = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RadarConsultas", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RadarConsultas_Empresas_EmpresaId",
                        column: x => x.EmpresaId,
                        principalTable: "Empresas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "RadarExecucoes",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    EmpresaId = table.Column<int>(type: "integer", nullable: false),
                    Origem = table.Column<string>(type: "text", nullable: false),
                    Inicio = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Fim = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    Consultas = table.Column<int>(type: "integer", nullable: false),
                    Chamadas = table.Column<int>(type: "integer", nullable: false),
                    Consultados = table.Column<int>(type: "integer", nullable: false),
                    Novos = table.Column<int>(type: "integer", nullable: false),
                    Atualizados = table.Column<int>(type: "integer", nullable: false),
                    Mensagem = table.Column<string>(type: "text", nullable: true),
                    AmostraBruta = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RadarExecucoes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RadarExecucoes_Empresas_EmpresaId",
                        column: x => x.EmpresaId,
                        principalTable: "Empresas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ProdutoAfiliadoSnapshots_ProdutoAfiliadoId_DataConsulta",
                table: "ProdutoAfiliadoSnapshots",
                columns: new[] { "ProdutoAfiliadoId", "DataConsulta" });

            migrationBuilder.CreateIndex(
                name: "IX_RadarConsultas_EmpresaId",
                table: "RadarConsultas",
                column: "EmpresaId");

            migrationBuilder.CreateIndex(
                name: "IX_RadarExecucoes_EmpresaId_Inicio",
                table: "RadarExecucoes",
                columns: new[] { "EmpresaId", "Inicio" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ProdutoAfiliadoSnapshots");

            migrationBuilder.DropTable(
                name: "RadarConsultas");

            migrationBuilder.DropTable(
                name: "RadarExecucoes");

            migrationBuilder.DropColumn(
                name: "Avaliacao",
                table: "ProdutosAfiliados");

            migrationBuilder.DropColumn(
                name: "ComissaoShopeePercentual",
                table: "ProdutosAfiliados");

            migrationBuilder.DropColumn(
                name: "ComissaoVendedorPercentual",
                table: "ProdutosAfiliados");

            migrationBuilder.DropColumn(
                name: "FimOferta",
                table: "ProdutosAfiliados");

            migrationBuilder.DropColumn(
                name: "InicioOferta",
                table: "ProdutosAfiliados");

            migrationBuilder.DropColumn(
                name: "UltimaConsultaApi",
                table: "ProdutosAfiliados");

            migrationBuilder.DropColumn(
                name: "RadarAtivo",
                table: "ConfiguracoesAfiliados");
        }
    }
}
