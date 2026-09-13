using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace NexoGestao.Api.Migrations
{
    /// <inheritdoc />
    public partial class AdicionaInteresses : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "FotoUrl",
                table: "Produtos",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "LinkStoryAtivo",
                table: "Produtos",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "LinkStoryToken",
                table: "Produtos",
                type: "text",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "Interesses",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    EmpresaId = table.Column<int>(type: "integer", nullable: false),
                    ProdutoId = table.Column<int>(type: "integer", nullable: false),
                    ProdutoNome = table.Column<string>(type: "text", nullable: false),
                    ProdutoPreco = table.Column<decimal>(type: "numeric", nullable: false),
                    ClienteId = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    VendaId = table.Column<int>(type: "integer", nullable: true),
                    DataCriacao = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Interesses", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Interesses_Clientes_ClienteId",
                        column: x => x.ClienteId,
                        principalTable: "Clientes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Interesses_Empresas_EmpresaId",
                        column: x => x.EmpresaId,
                        principalTable: "Empresas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Interesses_Produtos_ProdutoId",
                        column: x => x.ProdutoId,
                        principalTable: "Produtos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Interesses_Vendas_VendaId",
                        column: x => x.VendaId,
                        principalTable: "Vendas",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateIndex(
                name: "IX_Produtos_LinkStoryToken",
                table: "Produtos",
                column: "LinkStoryToken",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Interesses_ClienteId",
                table: "Interesses",
                column: "ClienteId");

            migrationBuilder.CreateIndex(
                name: "IX_Interesses_EmpresaId",
                table: "Interesses",
                column: "EmpresaId");

            migrationBuilder.CreateIndex(
                name: "IX_Interesses_ProdutoId",
                table: "Interesses",
                column: "ProdutoId");

            migrationBuilder.CreateIndex(
                name: "IX_Interesses_VendaId",
                table: "Interesses",
                column: "VendaId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Interesses");

            migrationBuilder.DropIndex(
                name: "IX_Produtos_LinkStoryToken",
                table: "Produtos");

            migrationBuilder.DropColumn(
                name: "FotoUrl",
                table: "Produtos");

            migrationBuilder.DropColumn(
                name: "LinkStoryAtivo",
                table: "Produtos");

            migrationBuilder.DropColumn(
                name: "LinkStoryToken",
                table: "Produtos");
        }
    }
}
