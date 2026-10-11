using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace NexoGestao.Api.Migrations
{
    /// <inheritdoc />
    public partial class CriaVideosAfiliados : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "VideosAfiliados",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    EmpresaId = table.Column<int>(type: "integer", nullable: false),
                    ProdutoAfiliadoId = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    Mensagem = table.Column<string>(type: "text", nullable: true),
                    Tentativas = table.Column<int>(type: "integer", nullable: false),
                    VersaoRoteiro = table.Column<string>(type: "text", nullable: true),
                    RoteiroJson = table.Column<string>(type: "text", nullable: true),
                    Legenda = table.Column<string>(type: "text", nullable: true),
                    Hashtags = table.Column<string>(type: "text", nullable: true),
                    MateriaisJson = table.Column<string>(type: "text", nullable: true),
                    MateriaisLidosEm = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    MusicaCredito = table.Column<string>(type: "text", nullable: true),
                    DuracaoSegundos = table.Column<double>(type: "double precision", nullable: true),
                    TamanhoBytes = table.Column<long>(type: "bigint", nullable: true),
                    TempoProcessamentoSegundos = table.Column<double>(type: "double precision", nullable: true),
                    ArquivoRelativo = table.Column<string>(type: "text", nullable: true),
                    CriadoEm = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    AtualizadoEm = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_VideosAfiliados", x => x.Id);
                    table.ForeignKey(
                        name: "FK_VideosAfiliados_Empresas_EmpresaId",
                        column: x => x.EmpresaId,
                        principalTable: "Empresas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_VideosAfiliados_ProdutosAfiliados_ProdutoAfiliadoId",
                        column: x => x.ProdutoAfiliadoId,
                        principalTable: "ProdutosAfiliados",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_VideosAfiliados_EmpresaId_Status",
                table: "VideosAfiliados",
                columns: new[] { "EmpresaId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_VideosAfiliados_ProdutoAfiliadoId",
                table: "VideosAfiliados",
                column: "ProdutoAfiliadoId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "VideosAfiliados");
        }
    }
}
