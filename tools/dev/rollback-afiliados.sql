START TRANSACTION;
-- Sessão com refresh token (migration 20261017164656_AdicionaRefreshToken): remove a tabela e o registro da migration.
-- Quem estiver logado terá de entrar de novo com e-mail e senha.
DROP TABLE IF EXISTS "RefreshTokens";

DELETE FROM "__EFMigrationsHistory"
WHERE "MigrationId" = '20261017164656_AdicionaRefreshToken';

-- Promoções de serviço (migration 20261017054302_CriaPromocoesServico): remove a tabela e o registro da migration.
DROP TABLE IF EXISTS "PromocoesServico";

DELETE FROM "__EFMigrationsHistory"
WHERE "MigrationId" = '20261017054302_CriaPromocoesServico';

DROP INDEX IF EXISTS "IX_Agendamentos_EmpresaId_DataHora_Status";

CREATE INDEX IF NOT EXISTS "IX_Agendamentos_EmpresaId" ON "Agendamentos" ("EmpresaId");

DELETE FROM "__EFMigrationsHistory"
WHERE "MigrationId" = '20261016032124_AdicionaIndiceAgendamentosPorDia';

ALTER TABLE "Empresas" DROP COLUMN IF EXISTS "WhatsApp";

DELETE FROM "__EFMigrationsHistory"
WHERE "MigrationId" = '20261016030833_AdicionaWhatsAppDaLoja';

COMMIT;

START TRANSACTION;
ALTER TABLE "StoriesLoja" DROP COLUMN "MidiaId";

DROP TABLE "MidiasLoja";

ALTER TABLE "Produtos" DROP COLUMN "AtributosJson";

ALTER TABLE "Empresas" DROP COLUMN "Nicho";

DELETE FROM "__EFMigrationsHistory"
WHERE "MigrationId" = '20261012231125_AdicionaMidiasNichoEAtributos';

COMMIT;

START TRANSACTION;
DROP TABLE "StoriesLoja";

DELETE FROM "__EFMigrationsHistory"
WHERE "MigrationId" = '20261012223831_CriaStoriesDaLoja';

COMMIT;

﻿START TRANSACTION;
DROP TABLE "ProdutoAfiliadoSnapshots";

DROP TABLE "RadarConsultas";

DROP TABLE "RadarExecucoes";

ALTER TABLE "ProdutosAfiliados" DROP COLUMN "Avaliacao";

ALTER TABLE "ProdutosAfiliados" DROP COLUMN "ComissaoShopeePercentual";

ALTER TABLE "ProdutosAfiliados" DROP COLUMN "ComissaoVendedorPercentual";

ALTER TABLE "ProdutosAfiliados" DROP COLUMN "FimOferta";

ALTER TABLE "ProdutosAfiliados" DROP COLUMN "InicioOferta";

ALTER TABLE "ProdutosAfiliados" DROP COLUMN "UltimaConsultaApi";

ALTER TABLE "ConfiguracoesAfiliados" DROP COLUMN "RadarAtivo";

DELETE FROM "__EFMigrationsHistory"
WHERE "MigrationId" = '20261011235503_AdicionaRadarShopee';

COMMIT;

START TRANSACTION;
DROP TABLE "WorkerCredenciais";

ALTER TABLE "VideosAfiliados" DROP COLUMN "ArquivoLocal";

ALTER TABLE "VideosAfiliados" DROP COLUMN "LeaseAte";

DELETE FROM "__EFMigrationsHistory"
WHERE "MigrationId" = '20261011232401_AdicionaWorkerLocalDeVideos';

COMMIT;

START TRANSACTION;
ALTER TABLE "VideosAfiliados" DROP COLUMN "CategoriaDetectada";

ALTER TABLE "VideosAfiliados" DROP COLUMN "Modo";

ALTER TABLE "VideosAfiliados" DROP COLUMN "ObservacaoRevisao";

DELETE FROM "__EFMigrationsHistory"
WHERE "MigrationId" = '20261011021038_AdicionaModoObservacaoCategoriaEmVideos';

COMMIT;

START TRANSACTION;
DROP TABLE "VideosAfiliados";

DELETE FROM "__EFMigrationsHistory"
WHERE "MigrationId" = '20261011014252_CriaVideosAfiliados';

COMMIT;

START TRANSACTION;
DROP INDEX "IX_ProdutosAfiliados_EmpresaId_ShopId_ItemId";

ALTER TABLE "ProdutosAfiliados" DROP COLUMN "ComissaoPercentual";

ALTER TABLE "ProdutosAfiliados" DROP COLUMN "ComissaoValor";

ALTER TABLE "ProdutosAfiliados" DROP COLUMN "DataImportacao";

ALTER TABLE "ProdutosAfiliados" DROP COLUMN "ItemId";

ALTER TABLE "ProdutosAfiliados" DROP COLUMN "NomeLoja";

ALTER TABLE "ProdutosAfiliados" DROP COLUMN "OrigemDados";

ALTER TABLE "ProdutosAfiliados" DROP COLUMN "ShopId";

ALTER TABLE "ProdutosAfiliados" DROP COLUMN "Vendas";

DELETE FROM "__EFMigrationsHistory"
WHERE "MigrationId" = '20261010224601_RestauraComissaoComRelatorioShopee';

COMMIT;

START TRANSACTION;
ALTER TABLE "ProdutosAfiliados" ADD "ComissaoPercentual" numeric;

ALTER TABLE "ProdutosAfiliados" ADD "ComissaoVerificada" boolean NOT NULL DEFAULT FALSE;

DELETE FROM "__EFMigrationsHistory"
WHERE "MigrationId" = '20261010033610_RemoveComissaoDeProdutoAfiliado';

COMMIT;

START TRANSACTION;
ALTER TABLE "ProdutosAfiliados" DROP COLUMN "ComissaoVerificada";

ALTER TABLE "ProdutosAfiliados" DROP COLUMN "DataConsultaFonte";

ALTER TABLE "ProdutosAfiliados" DROP COLUMN "FonteDescoberta";

ALTER TABLE "ProdutosAfiliados" DROP COLUMN "MotivoSelecao";

DELETE FROM "__EFMigrationsHistory"
WHERE "MigrationId" = '20261010030738_AdicionaBuscaAutomaticaProdutoAfiliado';

COMMIT;

START TRANSACTION;
DROP TABLE "ConteudosAfiliados";

DELETE FROM "__EFMigrationsHistory"
WHERE "MigrationId" = '20261010020012_CriaConteudoAfiliado';

COMMIT;

START TRANSACTION;
DROP TABLE "ConfiguracoesAfiliados";

DROP TABLE "ProdutosAfiliados";

DELETE FROM "__EFMigrationsHistory"
WHERE "MigrationId" = '20261010014402_CriaAfiliados';

COMMIT;

