using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace NexoGestao.Api.Migrations
{
    /// <inheritdoc />
    public partial class CriaPagamentosEFinanceiro : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Pagamentos",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    EmpresaId = table.Column<int>(type: "integer", nullable: false),
                    ClienteId = table.Column<int>(type: "integer", nullable: true),
                    VendaId = table.Column<int>(type: "integer", nullable: false),
                    ContaReceberId = table.Column<int>(type: "integer", nullable: true),
                    Valor = table.Column<decimal>(type: "numeric", nullable: false),
                    FormaPagamento = table.Column<int>(type: "integer", nullable: false),
                    Data = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Pagamentos", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Pagamentos_Clientes_ClienteId",
                        column: x => x.ClienteId,
                        principalTable: "Clientes",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_Pagamentos_ContasReceber_ContaReceberId",
                        column: x => x.ContaReceberId,
                        principalTable: "ContasReceber",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_Pagamentos_Empresas_EmpresaId",
                        column: x => x.EmpresaId,
                        principalTable: "Empresas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Pagamentos_Vendas_VendaId",
                        column: x => x.VendaId,
                        principalTable: "Vendas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Pagamentos_ClienteId",
                table: "Pagamentos",
                column: "ClienteId");

            migrationBuilder.CreateIndex(
                name: "IX_Pagamentos_ContaReceberId",
                table: "Pagamentos",
                column: "ContaReceberId");

            migrationBuilder.CreateIndex(
                name: "IX_Pagamentos_EmpresaId",
                table: "Pagamentos",
                column: "EmpresaId");

            migrationBuilder.CreateIndex(
                name: "IX_Pagamentos_VendaId",
                table: "Pagamentos",
                column: "VendaId");

            // --- Backfill de dados existentes ---
            // Habilita o módulo Financeiro pras empresas que já têm configuração
            // explícita de módulos (as sem configuração já enxergam tudo liberado,
            // ver TenantControllerBase) — senão o novo módulo de Relatórios
            // ficaria bloqueado do dia pra noite pra quem já tinha módulos configurados.
            migrationBuilder.Sql(
                """
                INSERT INTO "ModulosEmpresa" ("EmpresaId", "Modulo", "Habilitado")
                SELECT DISTINCT me."EmpresaId", 8, true
                FROM "ModulosEmpresa" me
                WHERE NOT EXISTS (
                    SELECT 1 FROM "ModulosEmpresa" me2
                    WHERE me2."EmpresaId" = me."EmpresaId" AND me2."Modulo" = 8
                );
                """);

            // Reconstrói o histórico de recebimentos a partir dos registros que já
            // existiam antes da tabela Pagamentos existir. A forma de pagamento de
            // cada recebimento passado só é conhecida com certeza quando ele nunca
            // passou por uma cobrança fiado (Vendas.FormaPagamento); todo o resto
            // (valor pago na hora de uma venda fiado, e a quitação de uma conta a
            // receber) entra como "Outros" (5) — nunca inventamos qual foi a forma
            // real. Datas usam sempre um valor real já registrado (Data da venda ou
            // DataPagamento da conta), nunca uma data fictícia.
            migrationBuilder.Sql(
                """
                INSERT INTO "Pagamentos" ("EmpresaId", "ClienteId", "VendaId", "ContaReceberId", "Valor", "FormaPagamento", "Data")
                SELECT v."EmpresaId", v."ClienteId", v."Id", NULL,
                       COALESCE(v."ValorRecebido", v."Total"),
                       CASE v."FormaPagamento"
                           WHEN 'PIX' THEN 0
                           WHEN 'Dinheiro' THEN 1
                           WHEN 'Crédito' THEN 2
                           WHEN 'Débito' THEN 3
                           ELSE 5
                       END,
                       v."Data"
                FROM "Vendas" v
                WHERE NOT EXISTS (SELECT 1 FROM "ContasReceber" cr WHERE cr."VendaId" = v."Id")
                  AND COALESCE(v."ValorRecebido", v."Total") > 0;
                """);

            migrationBuilder.Sql(
                """
                INSERT INTO "Pagamentos" ("EmpresaId", "ClienteId", "VendaId", "ContaReceberId", "Valor", "FormaPagamento", "Data")
                SELECT v."EmpresaId", v."ClienteId", v."Id", NULL,
                       v."Total" - cr."ValorOriginal",
                       5,
                       v."Data"
                FROM "Vendas" v
                JOIN "ContasReceber" cr ON cr."VendaId" = v."Id"
                WHERE (v."Total" - cr."ValorOriginal") > 0;
                """);

            migrationBuilder.Sql(
                """
                INSERT INTO "Pagamentos" ("EmpresaId", "ClienteId", "VendaId", "ContaReceberId", "Valor", "FormaPagamento", "Data")
                SELECT cr."EmpresaId", cr."ClienteId", cr."VendaId", cr."Id",
                       cr."ValorOriginal",
                       5,
                       COALESCE(cr."DataPagamento", v."Data")
                FROM "ContasReceber" cr
                JOIN "Vendas" v ON v."Id" = cr."VendaId"
                WHERE cr."Status" = 1;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Pagamentos");
        }
    }
}
