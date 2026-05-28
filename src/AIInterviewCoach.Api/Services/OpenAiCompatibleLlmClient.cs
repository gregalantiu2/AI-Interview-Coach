using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

namespace AIInterviewCoach.Api.Services;

public class OpenAiCompatibleLlmClient(HttpClient httpClient, IConfiguration configuration) : ILlmClient
{
    private readonly HttpClient _httpClient = httpClient;
    private readonly IConfiguration _configuration = configuration;

    public async Task<string> CompleteAsync(string prompt, CancellationToken cancellationToken = default)
    {
        var apiKey = _configuration["Llm:ApiKey"];
        var endpoint = _configuration["Llm:Endpoint"];
        var model = _configuration["Llm:Model"];

        if (string.IsNullOrWhiteSpace(apiKey) || string.IsNullOrWhiteSpace(endpoint) || string.IsNullOrWhiteSpace(model))
        {
            throw new InvalidOperationException("LLM configuration is missing. Set Llm:ApiKey, Llm:Endpoint, and Llm:Model.");
        }

        using var request = new HttpRequestMessage(HttpMethod.Post, endpoint);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);

        var payload = new
        {
            model,
            messages = new[]
            {
                new { role = "system", content = "You are an interview coach assistant." },
                new { role = "user", content = prompt }
            },
            temperature = 0.7
        };

        request.Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");

        using var response = await _httpClient.SendAsync(request, cancellationToken);
        response.EnsureSuccessStatusCode();

        var content = await response.Content.ReadAsStringAsync(cancellationToken);
        using var document = JsonDocument.Parse(content);
        var text = document.RootElement
            .GetProperty("choices")[0]
            .GetProperty("message")
            .GetProperty("content")
            .GetString();

        return text?.Trim() ?? string.Empty;
    }
}
