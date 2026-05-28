using System.Text.Json;
using System.Text.RegularExpressions;
using AIInterviewCoach.Api.Models;
using AIInterviewCoach.Api.Repositories;

namespace AIInterviewCoach.Api.Services;

public class InterviewCoachService(ILlmClient llmClient, IInterviewSessionRepository repository)
{
    private readonly ILlmClient _llmClient = llmClient;
    private readonly IInterviewSessionRepository _repository = repository;

    public async Task<GenerateQuestionsResponse> GenerateQuestionsAsync(GenerateQuestionsRequest request, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(request.RoleDescription))
        {
            throw new ArgumentException("Role description is required.");
        }

        if (request.QuestionCount <= 0)
        {
            throw new ArgumentException("Question count must be greater than zero.");
        }

        var manualQuestionSet = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var manualQuestions = request.ManualQuestions?
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Select(x => x.Trim())
            .Where(q => manualQuestionSet.Add(q))
            .Select(q => new InterviewQuestion { Text = q })
            .ToList() ?? [];

        var remainingCount = Math.Max(request.QuestionCount - manualQuestions.Count, 0);
        var generatedQuestions = new List<InterviewQuestion>();

        if (remainingCount > 0)
        {
            var prompt = $"Generate {remainingCount} interview questions for the following role. Return only a JSON array of question strings.\n<role>{request.RoleDescription}</role>";
            var response = await _llmClient.CompleteAsync(prompt, cancellationToken);
            generatedQuestions.AddRange(ParseQuestions(response).Take(remainingCount).Select(x => new InterviewQuestion { Text = x }));
        }

        var session = new InterviewSession
        {
            RoleDescription = request.RoleDescription.Trim(),
            Questions = [..manualQuestions, ..generatedQuestions],
            IsSaved = false,
            UpdatedAt = DateTimeOffset.UtcNow
        };

        await _repository.UpsertAsync(session, cancellationToken);

        return new GenerateQuestionsResponse(session.Id, session.Questions);
    }

    public async Task<SubmitAnswerResponse> SubmitAnswerAsync(SubmitAnswerRequest request, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(request.Answer))
        {
            throw new ArgumentException("Answer is required.");
        }

        var session = await _repository.GetAsync(request.SessionId, cancellationToken)
            ?? throw new KeyNotFoundException("Session not found.");

        var question = session.Questions.FirstOrDefault(x => x.Id == request.QuestionId)
            ?? throw new KeyNotFoundException("Question not found.");

        question.Answer = request.Answer.Trim();
        question.AnsweredAt = DateTimeOffset.UtcNow;
        question.Feedback = await _llmClient.CompleteAsync(
            $"<role>{session.RoleDescription}</role>\n<question>{question.Text}</question>\n<answer>{question.Answer}</answer>\nProvide concise, actionable interview feedback.",
            cancellationToken);

        session.UpdatedAt = DateTimeOffset.UtcNow;
        await _repository.UpsertAsync(session, cancellationToken);

        return new SubmitAnswerResponse(question.Feedback, question);
    }

    public async Task<string> GenerateSummaryAsync(string sessionId, int questionsToInclude, CancellationToken cancellationToken = default)
    {
        var session = await _repository.GetAsync(sessionId, cancellationToken)
            ?? throw new KeyNotFoundException("Session not found.");

        var answered = session.Questions
            .Where(x => !string.IsNullOrWhiteSpace(x.Answer))
            .Take(Math.Max(questionsToInclude, 0))
            .ToList();

        if (answered.Count == 0)
        {
            return "Answer at least one question to receive summary feedback.";
        }

        var qaBlock = string.Join("\n\n", answered.Select((q, index) =>
            $"Q{index + 1}: {q.Text}\nA{index + 1}: {q.Answer}\nFeedback: {q.Feedback}"));

        return await _llmClient.CompleteAsync(
            $"<role>{session.RoleDescription}</role>\nReview these interview responses and provide overall coaching focus areas:\n<interview-responses>\n{qaBlock}\n</interview-responses>",
            cancellationToken);
    }

    public async Task<InterviewSession> SaveSessionAsync(string sessionId, CancellationToken cancellationToken = default)
    {
        var session = await _repository.GetAsync(sessionId, cancellationToken)
            ?? throw new KeyNotFoundException("Session not found.");

        session.IsSaved = true;
        session.UpdatedAt = DateTimeOffset.UtcNow;
        await _repository.UpsertAsync(session, cancellationToken);
        return session;
    }

    public Task<InterviewSession?> GetSessionAsync(string sessionId, CancellationToken cancellationToken = default)
        => _repository.GetAsync(sessionId, cancellationToken);

    public Task<IReadOnlyList<InterviewSession>> ListSavedSessionsAsync(CancellationToken cancellationToken = default)
        => _repository.ListSavedAsync(cancellationToken);

    private static IReadOnlyList<string> ParseQuestions(string content)
    {
        if (string.IsNullOrWhiteSpace(content))
        {
            return [];
        }

        try
        {
            var parsed = JsonSerializer.Deserialize<List<string>>(content);
            if (parsed is { Count: > 0 })
            {
                return parsed.Where(x => !string.IsNullOrWhiteSpace(x)).Select(x => x.Trim()).ToList();
            }
        }
        catch (JsonException)
        {
            // fallback parsing below
        }

        return content
            .Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(x => x.TrimStart('-', '*', ' ', '\t'))
            .Select(x => Regex.Replace(x, @"^\d+[.)]\s*", string.Empty))
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .ToList();
    }
}
