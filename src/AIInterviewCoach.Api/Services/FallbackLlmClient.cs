using System.Text;
using System.Text.RegularExpressions;

namespace AIInterviewCoach.Api.Services;

public class FallbackLlmClient : ILlmClient
{
    public Task<string> CompleteAsync(string prompt, CancellationToken cancellationToken = default)
    {
        if (prompt.Contains("Return only a JSON array", StringComparison.OrdinalIgnoreCase))
        {
            var countMatch = Regex.Match(prompt, "Generate\\s+(\\d+)", RegexOptions.IgnoreCase);
            var count = countMatch.Success ? int.Parse(countMatch.Groups[1].Value) : 3;
            var questions = Enumerable.Range(1, Math.Max(count, 1))
                .Select(index => $"Tell me about a project where you demonstrated skill #{index} relevant to this role.")
                .ToArray();
            return Task.FromResult($"[\"{string.Join("\",\"", questions)}\"]");
        }

        if (prompt.Contains("overallFeedback", StringComparison.OrdinalIgnoreCase))
        {
            var qCount = Regex.Matches(prompt, @"^Q\d+:", RegexOptions.Multiline).Count;
            var feedbacks = Enumerable.Range(1, Math.Max(qCount, 1))
                .Select(i => $"{{\"question\":\"Question {i}\",\"feedback\":\"Good structure. Consider adding specific examples and measurable outcomes.\"}}")
                .ToArray();
            var json = $"{{\"rating\":7,\"overallFeedback\":\"Overall a solid performance. Focus on using the STAR method and quantifying your impact to make your answers more compelling.\",\"questionFeedbacks\":[{string.Join(",", feedbacks)}]}}";
            return Task.FromResult(json);
        }

        if (prompt.Contains("Provide concise, actionable interview feedback", StringComparison.OrdinalIgnoreCase))
        {
            return Task.FromResult("Good structure. Add clearer metrics, trade-offs, and business impact.");
        }

        var summary = new StringBuilder();
        summary.Append("Focus on depth, clarity, and measurable impact. ");
        summary.Append("Practice concise STAR-style responses with stronger outcomes.");
        return Task.FromResult(summary.ToString());
    }
}
