namespace AIInterviewCoach.Api.Services;

public interface ILlmClient
{
    Task<string> CompleteAsync(string prompt, CancellationToken cancellationToken = default);
}
