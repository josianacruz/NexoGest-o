using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace NexoGestao.Api.Migrations
{
    /// <inheritdoc />
    public partial class AdicionaModoObservacaoCategoriaEmVideos : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CategoriaDetectada",
                table: "VideosAfiliados",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Modo",
                table: "VideosAfiliados",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "ObservacaoRevisao",
                table: "VideosAfiliados",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CategoriaDetectada",
                table: "VideosAfiliados");

            migrationBuilder.DropColumn(
                name: "Modo",
                table: "VideosAfiliados");

            migrationBuilder.DropColumn(
                name: "ObservacaoRevisao",
                table: "VideosAfiliados");
        }
    }
}
