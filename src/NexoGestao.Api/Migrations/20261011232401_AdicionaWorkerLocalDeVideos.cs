using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace NexoGestao.Api.Migrations
{
    /// <inheritdoc />
    public partial class AdicionaWorkerLocalDeVideos : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ArquivoLocal",
                table: "VideosAfiliados",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "LeaseAte",
                table: "VideosAfiliados",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "WorkerCredenciais",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    EmpresaId = table.Column<int>(type: "integer", nullable: false),
                    Nome = table.Column<string>(type: "text", nullable: false),
                    TokenHash = table.Column<string>(type: "text", nullable: false),
                    Prefixo = table.Column<string>(type: "text", nullable: false),
                    CriadaEm = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    RevogadaEm = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UltimoContato = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Maquina = table.Column<string>(type: "text", nullable: true),
                    Versao = table.Column<string>(type: "text", nullable: true),
                    Pasta = table.Column<string>(type: "text", nullable: true),
                    EspacoUsadoBytes = table.Column<long>(type: "bigint", nullable: true),
                    EspacoLivreBytes = table.Column<long>(type: "bigint", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WorkerCredenciais", x => x.Id);
                    table.ForeignKey(
                        name: "FK_WorkerCredenciais_Empresas_EmpresaId",
                        column: x => x.EmpresaId,
                        principalTable: "Empresas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_WorkerCredenciais_EmpresaId",
                table: "WorkerCredenciais",
                column: "EmpresaId");

            migrationBuilder.CreateIndex(
                name: "IX_WorkerCredenciais_TokenHash",
                table: "WorkerCredenciais",
                column: "TokenHash",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "WorkerCredenciais");

            migrationBuilder.DropColumn(
                name: "ArquivoLocal",
                table: "VideosAfiliados");

            migrationBuilder.DropColumn(
                name: "LeaseAte",
                table: "VideosAfiliados");
        }
    }
}
