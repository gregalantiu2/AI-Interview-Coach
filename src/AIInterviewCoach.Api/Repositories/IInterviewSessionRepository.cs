using AIInterviewCoach.Api.Models;

namespace AIInterviewCoach.Api.Repositories;

public interface IInterviewSessionRepository
{
    Task UpsertAsync(InterviewSession session, CancellationToken cancellationToken = default);

    Task<InterviewSession?> GetAsync(string sessionId, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<InterviewSession>> ListSavedAsync(CancellationToken cancellationToken = default);

    Task<IReadOnlyList<InterviewSession>> ListAllAsync(CancellationToken cancellationToken = default);

    Task DeleteAsync(string sessionId, CancellationToken cancellationToken = default);
}
