using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace NexoGestao.Api.Migrations
{
    /// <inheritdoc />
    public partial class AdicionaAutoagendamento : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "PermiteAutoagendamento",
                table: "Servicos",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "HoraFimAtendimento",
                table: "ConfiguracoesAgenda",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "HoraInicioAtendimento",
                table: "ConfiguracoesAgenda",
                type: "text",
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PermiteAutoagendamento",
                table: "Servicos");

            migrationBuilder.DropColumn(
                name: "HoraFimAtendimento",
                table: "ConfiguracoesAgenda");

            migrationBuilder.DropColumn(
                name: "HoraInicioAtendimento",
                table: "ConfiguracoesAgenda");
        }
    }
}
