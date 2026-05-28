using System.Collections.Concurrent;
using AIInterviewCoach.Api.Models;

namespace AIInterviewCoach.Api.Repositories;

public class InMemoryInterviewSessionRepository : IInterviewSessionRepository
{
    private readonly ConcurrentDictionary<string, InterviewSession> _sessions = new();

    public Task UpsertAsync(InterviewSession session, CancellationToken cancellationToken = default)
    {
        _sessions[session.Id] = session;
        return Task.CompletedTask;
    }

    public Task<InterviewSession?> GetAsync(string sessionId, CancellationToken cancellationToken = default)
    {
        _sessions.TryGetValue(sessionId, out var session);
        return Task.FromResult(session);
    }

    public Task<IReadOnlyList<InterviewSession>> ListSavedAsync(CancellationToken cancellationToken = default)
    {
        var items = _sessions.Values
            .Where(x => x.IsSaved)
            .OrderByDescending(x => x.UpdatedAt)
            .ToList();
        return Task.FromResult<IReadOnlyList<InterviewSession>>(items);
    }
}
