using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace NexoGestao.Api.Migrations
{
    /// <inheritdoc />
    public partial class AdicionaMidiasNichoEAtributos : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "MidiaId",
                table: "StoriesLoja",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "AtributosJson",
                table: "Produtos",
                type: "character varying(4000)",
                maxLength: 4000,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Nicho",
                table: "Empresas",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "MidiasLoja",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    EmpresaId = table.Column<int>(type: "integer", nullable: false),
                    Nome = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    ContentType = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    Dados = table.Column<byte[]>(type: "bytea", nullable: false),
                    Miniatura = table.Column<string>(type: "text", nullable: false),
                    Hash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Usos = table.Column<int>(type: "integer", nullable: false),
                    DataCriacao = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UltimoUsoEm = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MidiasLoja", x => x.Id);
                    table.ForeignKey(
                        name: "FK_MidiasLoja_Empresas_EmpresaId",
                        column: x => x.EmpresaId,
                        principalTable: "Empresas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_StoriesLoja_MidiaId",
                table: "StoriesLoja",
                column: "MidiaId");

            migrationBuilder.CreateIndex(
                name: "IX_MidiasLoja_EmpresaId_Hash",
                table: "MidiasLoja",
                columns: new[] { "EmpresaId", "Hash" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_MidiasLoja_EmpresaId_UltimoUsoEm",
                table: "MidiasLoja",
                columns: new[] { "EmpresaId", "UltimoUsoEm" });

            migrationBuilder.AddForeignKey(
                name: "FK_StoriesLoja_MidiasLoja_MidiaId",
                table: "StoriesLoja",
                column: "MidiaId",
                principalTable: "MidiasLoja",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_StoriesLoja_MidiasLoja_MidiaId",
                table: "StoriesLoja");

            migrationBuilder.DropTable(
                name: "MidiasLoja");

            migrationBuilder.DropIndex(
                name: "IX_StoriesLoja_MidiaId",
                table: "StoriesLoja");

            migrationBuilder.DropColumn(
                name: "MidiaId",
                table: "StoriesLoja");

            migrationBuilder.DropColumn(
                name: "AtributosJson",
                table: "Produtos");

            migrationBuilder.DropColumn(
                name: "Nicho",
                table: "Empresas");
        }
    }
}
