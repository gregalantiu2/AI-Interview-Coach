using System.Text.Json.Serialization;

namespace AIInterviewCoach.Api.Models;

public class InterviewSession
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = Guid.NewGuid().ToString("N");

    public string RoleDescription { get; set; } = string.Empty;

    public List<InterviewQuestion> Questions { get; set; } = [];

    public bool IsSaved { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
