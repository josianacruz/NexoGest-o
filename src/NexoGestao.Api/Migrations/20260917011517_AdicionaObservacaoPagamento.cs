using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace NexoGestao.Api.Migrations
{
    /// <inheritdoc />
    public partial class AdicionaObservacaoPagamento : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Observacao",
                table: "Pagamentos",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Observacao",
                table: "Pagamentos");
        }
    }
}
