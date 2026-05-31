using System.Text.Json.Serialization;

namespace AIInterviewCoach.Api.Models;

public class InterviewSession
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = Guid.NewGuid().ToString("N");

    /// <summary>Short display name, e.g. "Senior Backend Engineer"</summary>
    public string RoleName { get; set; } = string.Empty;

    /// <summary>Optional expanded description used as context for LLM prompts</summary>
    public string RoleSummary { get; set; } = string.Empty;

    /// <summary>Combined name + summary used in LLM prompts. Kept up-to-date by the service.</summary>
    public string RoleDescription { get; set; } = string.Empty;

    public List<InterviewQuestion> Questions { get; set; } = [];

    public bool IsSaved { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
