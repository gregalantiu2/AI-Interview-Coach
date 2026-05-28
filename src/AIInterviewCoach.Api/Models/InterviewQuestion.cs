using System.Text.Json.Serialization;

namespace AIInterviewCoach.Api.Models;

public class InterviewQuestion
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");

    public string Text { get; set; } = string.Empty;

    public string? Answer { get; set; }

    public string? Feedback { get; set; }

    public DateTimeOffset? AnsweredAt { get; set; }
}
