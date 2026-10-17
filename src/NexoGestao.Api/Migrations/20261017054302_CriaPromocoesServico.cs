using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace NexoGestao.Api.Migrations
{
    /// <inheritdoc />
    public partial class CriaPromocoesServico : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "PromocoesServico",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    EmpresaId = table.Column<int>(type: "integer", nullable: false),
                    ServicoId = table.Column<int>(type: "integer", nullable: false),
                    Titulo = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Descricao = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
                    PrecoPromocional = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    InicioEm = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    FimEm = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Ativa = table.Column<bool>(type: "boolean", nullable: false),
                    DataCriacao = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PromocoesServico", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PromocoesServico_Empresas_EmpresaId",
                        column: x => x.EmpresaId,
                        principalTable: "Empresas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_PromocoesServico_Servicos_ServicoId",
                        column: x => x.ServicoId,
                        principalTable: "Servicos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PromocoesServico_EmpresaId_Ativa_FimEm",
                table: "PromocoesServico",
                columns: new[] { "EmpresaId", "Ativa", "FimEm" });

            migrationBuilder.CreateIndex(
                name: "IX_PromocoesServico_ServicoId",
                table: "PromocoesServico",
                column: "ServicoId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PromocoesServico");
        }
    }
}
