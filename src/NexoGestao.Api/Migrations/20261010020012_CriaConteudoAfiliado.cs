using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace NexoGestao.Api.Migrations
{
    /// <inheritdoc />
    public partial class CriaConteudoAfiliado : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ConteudosAfiliados",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    EmpresaId = table.Column<int>(type: "integer", nullable: false),
                    ProdutoAfiliadoId = table.Column<int>(type: "integer", nullable: false),
                    Abordagem = table.Column<int>(type: "integer", nullable: false),
                    Roteiro = table.Column<string>(type: "text", nullable: false),
                    Legenda = table.Column<string>(type: "text", nullable: false),
                    ChamadaParaCompra = table.Column<string>(type: "text", nullable: false),
                    Hashtags = table.Column<string>(type: "text", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    MensagemErro = table.Column<string>(type: "text", nullable: true),
                    DataGeracao = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ConteudosAfiliados", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ConteudosAfiliados_Empresas_EmpresaId",
                        column: x => x.EmpresaId,
                        principalTable: "Empresas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ConteudosAfiliados_ProdutosAfiliados_ProdutoAfiliadoId",
                        column: x => x.ProdutoAfiliadoId,
                        principalTable: "ProdutosAfiliados",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ConteudosAfiliados_EmpresaId",
                table: "ConteudosAfiliados",
                column: "EmpresaId");

            migrationBuilder.CreateIndex(
                name: "IX_ConteudosAfiliados_ProdutoAfiliadoId",
                table: "ConteudosAfiliados",
                column: "ProdutoAfiliadoId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ConteudosAfiliados");
        }
    }
}
