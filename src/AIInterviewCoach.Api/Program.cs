using AIInterviewCoach.Api.Repositories;
using AIInterviewCoach.Api.Services;
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

var cosmosEndpoint = builder.Configuration["Cosmos:Endpoint"];
var cosmosKey = builder.Configuration["Cosmos:Key"];

if (!string.IsNullOrWhiteSpace(cosmosEndpoint) && !string.IsNullOrWhiteSpace(cosmosKey))
{
    CosmosClientOptions cosmosOptions = builder.Environment.IsDevelopment()
        ? new CosmosClientOptions
        {
            HttpClientFactory = () => new HttpClient(new HttpClientHandler
            {
                ServerCertificateCustomValidationCallback = HttpClientHandler.DangerousAcceptAnyServerCertificateValidator
            }),
            ConnectionMode = ConnectionMode.Gateway
        }
        : new CosmosClientOptions();

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
    var cosmosClient = app.Services.GetRequiredService<CosmosClient>();
    var dbName = app.Configuration["Cosmos:DatabaseName"] ?? "ai-interview-coach";
    var containerName = app.Configuration["Cosmos:ContainerName"] ?? "interview-sessions";
    var dbResponse = await cosmosClient.CreateDatabaseIfNotExistsAsync(dbName);
    await dbResponse.Database.CreateContainerIfNotExistsAsync(containerName, "/id");
}

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();
app.UseCors("frontend");
app.UseAuthorization();
app.MapControllers();

app.Run();
