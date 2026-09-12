using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace NexoGestao.Api.Migrations
{
    /// <inheritdoc />
    public partial class AdicionaTrocoParcelasEFiado : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "Parcelas",
                table: "Vendas",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "SaldoDevedor",
                table: "Vendas",
                type: "numeric",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "Troco",
                table: "Vendas",
                type: "numeric",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "ValorRecebido",
                table: "Vendas",
                type: "numeric",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Parcelas",
                table: "Vendas");

            migrationBuilder.DropColumn(
                name: "SaldoDevedor",
                table: "Vendas");

            migrationBuilder.DropColumn(
                name: "Troco",
                table: "Vendas");

            migrationBuilder.DropColumn(
                name: "ValorRecebido",
                table: "Vendas");
        }
    }
}
