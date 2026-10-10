using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace NexoGestao.Api.Migrations
{
    /// <inheritdoc />
    public partial class AdicionaBuscaAutomaticaProdutoAfiliado : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "ComissaoVerificada",
                table: "ProdutosAfiliados",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "DataConsultaFonte",
                table: "ProdutosAfiliados",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "FonteDescoberta",
                table: "ProdutosAfiliados",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "MotivoSelecao",
                table: "ProdutosAfiliados",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ComissaoVerificada",
                table: "ProdutosAfiliados");

            migrationBuilder.DropColumn(
                name: "DataConsultaFonte",
                table: "ProdutosAfiliados");

            migrationBuilder.DropColumn(
                name: "FonteDescoberta",
                table: "ProdutosAfiliados");

            migrationBuilder.DropColumn(
                name: "MotivoSelecao",
                table: "ProdutosAfiliados");
        }
    }
}
