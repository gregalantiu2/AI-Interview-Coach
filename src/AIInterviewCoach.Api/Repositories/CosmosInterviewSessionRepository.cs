using AIInterviewCoach.Api.Models;
using Microsoft.Azure.Cosmos;

namespace AIInterviewCoach.Api.Repositories;

public class CosmosInterviewSessionRepository : IInterviewSessionRepository
{
    private readonly Container _container;

    public CosmosInterviewSessionRepository(CosmosClient cosmosClient, IConfiguration configuration)
    {
        var databaseName = configuration["Cosmos:DatabaseName"] ?? "ai-interview-coach";
        var containerName = configuration["Cosmos:ContainerName"] ?? "interview-sessions";
        _container = cosmosClient.GetContainer(databaseName, containerName);
    }

    public async Task UpsertAsync(InterviewSession session, CancellationToken cancellationToken = default)
    {
        await _container.UpsertItemAsync(session, new PartitionKey(session.Id), cancellationToken: cancellationToken);
    }

    public async Task<InterviewSession?> GetAsync(string sessionId, CancellationToken cancellationToken = default)
    {
        try
        {
            var response = await _container.ReadItemAsync<InterviewSession>(sessionId, new PartitionKey(sessionId), cancellationToken: cancellationToken);
            return response.Resource;
        }
        catch (CosmosException ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            return null;
        }
    }

    public async Task<IReadOnlyList<InterviewSession>> ListSavedAsync(CancellationToken cancellationToken = default)
    {
        var query = _container.GetItemQueryIterator<InterviewSession>(new QueryDefinition("SELECT * FROM c WHERE c.isSaved = true ORDER BY c.updatedAt DESC"));
        var sessions = new List<InterviewSession>();

        while (query.HasMoreResults)
        {
            var response = await query.ReadNextAsync(cancellationToken);
            sessions.AddRange(response);
        }

        return sessions;
    }
}
