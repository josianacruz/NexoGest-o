FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY src/NexoGestao.Api/*.csproj ./src/NexoGestao.Api/
RUN dotnet restore ./src/NexoGestao.Api/NexoGestao.Api.csproj
COPY src/NexoGestao.Api/. ./src/NexoGestao.Api/
RUN dotnet publish ./src/NexoGestao.Api/NexoGestao.Api.csproj -c Release -o /app --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=build /app .
EXPOSE 8080
# Render injeta a variável PORT; escutamos nela (com 8080 como fallback local).
ENTRYPOINT ["sh", "-c", "ASPNETCORE_URLS=http://+:${PORT:-8080} dotnet NexoGestao.Api.dll"]
