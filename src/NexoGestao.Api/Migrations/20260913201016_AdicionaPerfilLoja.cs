using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace NexoGestao.Api.Migrations
{
    /// <inheritdoc />
    public partial class AdicionaPerfilLoja : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ConfiguracoesDiaSemana",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    EmpresaId = table.Column<int>(type: "integer", nullable: false),
                    DiaSemana = table.Column<int>(type: "integer", nullable: false),
                    Ativo = table.Column<bool>(type: "boolean", nullable: false),
                    HoraInicio = table.Column<string>(type: "text", nullable: false),
                    HoraFim = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ConfiguracoesDiaSemana", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ConfiguracoesDiaSemana_Empresas_EmpresaId",
                        column: x => x.EmpresaId,
                        principalTable: "Empresas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ConfiguracoesDiaSemana_EmpresaId",
                table: "ConfiguracoesDiaSemana",
                column: "EmpresaId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ConfiguracoesDiaSemana");
        }
    }
}
