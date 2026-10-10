using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace NexoGestao.Api.Migrations
{
    /// <inheritdoc />
    public partial class RemoveComissaoDeProdutoAfiliado : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ComissaoPercentual",
                table: "ProdutosAfiliados");

            migrationBuilder.DropColumn(
                name: "ComissaoVerificada",
                table: "ProdutosAfiliados");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "ComissaoPercentual",
                table: "ProdutosAfiliados",
                type: "numeric",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "ComissaoVerificada",
                table: "ProdutosAfiliados",
                type: "boolean",
                nullable: false,
                defaultValue: false);
        }
    }
}
