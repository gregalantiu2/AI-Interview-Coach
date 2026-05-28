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
    builder.Services.AddHttpClient<ILlmClient, OpenAiCompatibleLlmClient>();
}

builder.Services.AddScoped<InterviewCoachService>();

var cosmosEndpoint = builder.Configuration["Cosmos:Endpoint"];
var cosmosKey = builder.Configuration["Cosmos:Key"];

if (!string.IsNullOrWhiteSpace(cosmosEndpoint) && !string.IsNullOrWhiteSpace(cosmosKey))
{
    builder.Services.AddSingleton(serviceProvider => new CosmosClient(cosmosEndpoint, cosmosKey));
    builder.Services.AddScoped<IInterviewSessionRepository, CosmosInterviewSessionRepository>();
}
else
{
    builder.Services.AddSingleton<IInterviewSessionRepository, InMemoryInterviewSessionRepository>();
}

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseCors("frontend");
app.UseHttpsRedirection();
app.UseAuthorization();
app.MapControllers();

app.Run();
