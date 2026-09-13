using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace NexoGestao.Api.Migrations
{
    /// <inheritdoc />
    public partial class AdicionaConfiguracaoECobrancaAgenda : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "FormaPagamento",
                table: "Agendamentos",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "ValorRecebido",
                table: "Agendamentos",
                type: "numeric",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "CobrancasAgendamento",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    EmpresaId = table.Column<int>(type: "integer", nullable: false),
                    AgendamentoId = table.Column<int>(type: "integer", nullable: false),
                    ClienteId = table.Column<int>(type: "integer", nullable: false),
                    Valor = table.Column<decimal>(type: "numeric", nullable: false),
                    Motivo = table.Column<string>(type: "text", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    DataCriacao = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    DataPagamento = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CobrancasAgendamento", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CobrancasAgendamento_Agendamentos_AgendamentoId",
                        column: x => x.AgendamentoId,
                        principalTable: "Agendamentos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_CobrancasAgendamento_Clientes_ClienteId",
                        column: x => x.ClienteId,
                        principalTable: "Clientes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_CobrancasAgendamento_Empresas_EmpresaId",
                        column: x => x.EmpresaId,
                        principalTable: "Empresas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ConfiguracoesAgenda",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    EmpresaId = table.Column<int>(type: "integer", nullable: false),
                    HorasAntesLembrete = table.Column<int>(type: "integer", nullable: false),
                    HorasMinimasCancelamento = table.Column<int>(type: "integer", nullable: false),
                    CobrarCancelamentoForaPrazo = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ConfiguracoesAgenda", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ConfiguracoesAgenda_Empresas_EmpresaId",
                        column: x => x.EmpresaId,
                        principalTable: "Empresas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CobrancasAgendamento_AgendamentoId",
                table: "CobrancasAgendamento",
                column: "AgendamentoId");

            migrationBuilder.CreateIndex(
                name: "IX_CobrancasAgendamento_ClienteId",
                table: "CobrancasAgendamento",
                column: "ClienteId");

            migrationBuilder.CreateIndex(
                name: "IX_CobrancasAgendamento_EmpresaId",
                table: "CobrancasAgendamento",
                column: "EmpresaId");

            migrationBuilder.CreateIndex(
                name: "IX_ConfiguracoesAgenda_EmpresaId",
                table: "ConfiguracoesAgenda",
                column: "EmpresaId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CobrancasAgendamento");

            migrationBuilder.DropTable(
                name: "ConfiguracoesAgenda");

            migrationBuilder.DropColumn(
                name: "FormaPagamento",
                table: "Agendamentos");

            migrationBuilder.DropColumn(
                name: "ValorRecebido",
                table: "Agendamentos");
        }
    }
}
