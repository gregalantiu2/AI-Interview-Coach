using System.Text.Json;
using System.Threading.RateLimiting;
using AIInterviewCoach.Api.Infrastructure;
using Scalar.AspNetCore;
using AIInterviewCoach.Api.Repositories;
using AIInterviewCoach.Api.Services;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Azure.Cosmos;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddOpenApi();

builder.Services.AddCors(options =>
{
    options.AddPolicy("frontend", policy =>
    {
        policy
            .WithOrigins(builder.Configuration["Frontend:Url"] ?? "http://localhost:5173")
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

if (string.IsNullOrWhiteSpace(builder.Configuration["Llm:ApiKey"]) ||
    string.IsNullOrWhiteSpace(builder.Configuration["Llm:Endpoint"]) ||
    string.IsNullOrWhiteSpace(builder.Configuration["Llm:Model"]))
{
    builder.Services.AddSingleton<ILlmClient, FallbackLlmClient>();
}
else
{
    builder.Services.AddHttpClient<ILlmClient, OpenAiCompatibleLlmClient>()
        .ConfigureHttpClient(client => client.Timeout = TimeSpan.FromSeconds(30));
}

builder.Services.AddScoped<InterviewCoachService>();

builder.Services.AddRateLimiter(options =>
{
    // General API: 60 requests per minute per IP
    options.AddPolicy("general", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 60,
                Window = TimeSpan.FromMinutes(1),
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 0,
            }));

    // LLM endpoints: 10 requests per minute per IP
    options.AddPolicy("llm", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 10,
                Window = TimeSpan.FromMinutes(1),
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 0,
            }));

    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
});

var cosmosEndpoint = builder.Configuration["Cosmos:Endpoint"];
var cosmosKey = builder.Configuration["Cosmos:Key"];

if (!string.IsNullOrWhiteSpace(cosmosEndpoint) && !string.IsNullOrWhiteSpace(cosmosKey))
{
var cosmosSerializer = new CosmosSystemTextJsonSerializer(new JsonSerializerOptions
{
    PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    PropertyNameCaseInsensitive = true,
});

CosmosClientOptions cosmosOptions = builder.Environment.IsDevelopment()
    ? new CosmosClientOptions
    {
        HttpClientFactory = () => new HttpClient(new HttpClientHandler
        {
            ServerCertificateCustomValidationCallback = HttpClientHandler.DangerousAcceptAnyServerCertificateValidator
        }),
        ConnectionMode = ConnectionMode.Gateway,
        Serializer = cosmosSerializer,
    }
    : new CosmosClientOptions { Serializer = cosmosSerializer };

    builder.Services.AddSingleton(new CosmosClient(cosmosEndpoint, cosmosKey, cosmosOptions));
    builder.Services.AddScoped<IInterviewSessionRepository, CosmosInterviewSessionRepository>();
}
else
{
    builder.Services.AddSingleton<IInterviewSessionRepository, InMemoryInterviewSessionRepository>();
}

var app = builder.Build();

if (!string.IsNullOrWhiteSpace(cosmosEndpoint) && !string.IsNullOrWhiteSpace(cosmosKey))
{
    try
    {
        var cosmosClient = app.Services.GetRequiredService<CosmosClient>();
        var dbName = app.Configuration["Cosmos:DatabaseName"] ?? "ai-interview-coach";
        var containerName = app.Configuration["Cosmos:ContainerName"] ?? "interview-sessions";
        var dbResponse = await cosmosClient.CreateDatabaseIfNotExistsAsync(dbName);
        await dbResponse.Database.CreateContainerIfNotExistsAsync(containerName, "/id");
    }
    catch (Exception ex)
    {
        var logger = app.Services.GetRequiredService<ILogger<Program>>();
        logger.LogWarning(ex, "Cosmos DB provisioning failed at startup. Requests requiring persistence will fail until the emulator is reachable.");
    }
}

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.MapScalarApiReference();
}

app.UseHttpsRedirection();
app.UseCors("frontend");
app.UseRateLimiter();
app.UseAuthorization();
app.MapControllers();

app.Run();
