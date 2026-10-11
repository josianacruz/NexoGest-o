using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace NexoGestao.Api.Migrations
{
    /// <inheritdoc />
    public partial class RestauraComissaoComRelatorioShopee : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "ComissaoPercentual",
                table: "ProdutosAfiliados",
                type: "numeric",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "ComissaoValor",
                table: "ProdutosAfiliados",
                type: "numeric",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "DataImportacao",
                table: "ProdutosAfiliados",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "ItemId",
                table: "ProdutosAfiliados",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "NomeLoja",
                table: "ProdutosAfiliados",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "OrigemDados",
                table: "ProdutosAfiliados",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "ShopId",
                table: "ProdutosAfiliados",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Vendas",
                table: "ProdutosAfiliados",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_ProdutosAfiliados_EmpresaId_ShopId_ItemId",
                table: "ProdutosAfiliados",
                columns: new[] { "EmpresaId", "ShopId", "ItemId" },
                unique: true,
                filter: "\"ItemId\" IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_ProdutosAfiliados_EmpresaId_ShopId_ItemId",
                table: "ProdutosAfiliados");

            migrationBuilder.DropColumn(
                name: "ComissaoPercentual",
                table: "ProdutosAfiliados");

            migrationBuilder.DropColumn(
                name: "ComissaoValor",
                table: "ProdutosAfiliados");

            migrationBuilder.DropColumn(
                name: "DataImportacao",
                table: "ProdutosAfiliados");

            migrationBuilder.DropColumn(
                name: "ItemId",
                table: "ProdutosAfiliados");

            migrationBuilder.DropColumn(
                name: "NomeLoja",
                table: "ProdutosAfiliados");

            migrationBuilder.DropColumn(
                name: "OrigemDados",
                table: "ProdutosAfiliados");

            migrationBuilder.DropColumn(
                name: "ShopId",
                table: "ProdutosAfiliados");

            migrationBuilder.DropColumn(
                name: "Vendas",
                table: "ProdutosAfiliados");
        }
    }
}
