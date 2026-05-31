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
            IsSaved = true,
            UpdatedAt = DateTimeOffset.UtcNow
        };

        await _repository.UpsertAsync(session, cancellationToken);

        return new GenerateQuestionsResponse(session.Id, session.RoleDescription, session.Questions);
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
            $"<role>{session.RoleDescription}</role>\n<question>{question.Text}</question>\n<answer>{question.Answer}</answer>\n" +
            "You are an expert interview coach. Provide detailed, actionable feedback on the answer above.\n" +
            "Do not include any introduction, preamble, or closing sentence. Start directly with the feedback structure below.\n" +
            "Use this exact markdown structure:\n" +
            "**Strengths:**\n- (bullet points)\n\n" +
            "**Areas for Improvement:**\n- (bullet points)\n\n" +
            "**Suggestions for Next Steps:**\n- (bullet points)\n\n" +
            "Example revised answer:\n\n\"(a rewritten version of the answer demonstrating best practices)\"",
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

    public Task<IReadOnlyList<InterviewSession>> ListAllSessionsAsync(CancellationToken cancellationToken = default)
        => _repository.ListAllAsync(cancellationToken);

    public async Task DeleteSessionAsync(string sessionId, CancellationToken cancellationToken = default)
    {
        var session = await _repository.GetAsync(sessionId, cancellationToken)
            ?? throw new KeyNotFoundException("Profile not found.");

        await _repository.DeleteAsync(session.Id, cancellationToken);
    }

    public async Task<AddQuestionsResponse> AddQuestionsAsync(string sessionId, AddQuestionsRequest request, CancellationToken cancellationToken = default)
    {
        var session = await _repository.GetAsync(sessionId, cancellationToken)
            ?? throw new KeyNotFoundException("Profile not found.");

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
            var prompt = $"Generate {remainingCount} interview questions for the following role. Return only a JSON array of question strings.\n<role>{session.RoleDescription}</role>";
            var response = await _llmClient.CompleteAsync(prompt, cancellationToken);
            generatedQuestions.AddRange(ParseQuestions(response).Take(remainingCount).Select(x => new InterviewQuestion { Text = x }));
        }

        var newQuestions = new List<InterviewQuestion>([..manualQuestions, ..generatedQuestions]);
        session.Questions.AddRange(newQuestions);
        session.UpdatedAt = DateTimeOffset.UtcNow;
        await _repository.UpsertAsync(session, cancellationToken);

        return new AddQuestionsResponse(newQuestions, session.Questions);
    }

    public async Task<GetTipsResponse> GetTipsAsync(string sessionId, string questionId, CancellationToken cancellationToken = default)
    {
        var session = await _repository.GetAsync(sessionId, cancellationToken)
            ?? throw new KeyNotFoundException("Profile not found.");

        var question = session.Questions.FirstOrDefault(x => x.Id == questionId)
            ?? throw new KeyNotFoundException("Question not found.");

        question.Tips = await _llmClient.CompleteAsync(
            $"<role>{session.RoleDescription}</role>\n<question>{question.Text}</question>\nProvide concise tips for answering this interview question well, then give one strong example answer.",
            cancellationToken);

        session.UpdatedAt = DateTimeOffset.UtcNow;
        await _repository.UpsertAsync(session, cancellationToken);

        return new GetTipsResponse(question.Tips, question);
    }

    public async Task DeleteQuestionAsync(string sessionId, string questionId, CancellationToken cancellationToken = default)
    {
        var session = await _repository.GetAsync(sessionId, cancellationToken)
            ?? throw new KeyNotFoundException("Profile not found.");

        var removed = session.Questions.RemoveAll(q => q.Id == questionId);
        if (removed == 0) throw new KeyNotFoundException("Question not found.");

        session.UpdatedAt = DateTimeOffset.UtcNow;
        await _repository.UpsertAsync(session, cancellationToken);
    }

    private static IReadOnlyList<string> ParseQuestions(string content)
    {
        if (string.IsNullOrWhiteSpace(content))
        {
            return [];
        }

        // Try to locate a JSON array anywhere in the response (LLMs sometimes add preamble text)
        var arrayStart = content.IndexOf('[');
        var arrayEnd = content.LastIndexOf(']');
        if (arrayStart >= 0 && arrayEnd > arrayStart)
        {
            var jsonSlice = content[arrayStart..(arrayEnd + 1)];
            try
            {
                var parsed = JsonSerializer.Deserialize<List<string>>(jsonSlice);
                if (parsed is { Count: > 0 })
                {
                    return parsed.Where(x => !string.IsNullOrWhiteSpace(x)).Select(x => x.Trim()).ToList();
                }
            }
            catch (JsonException) { }
        }

        // Fallback: split on newlines and clean up each line
        return content
            .Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(x => x.TrimStart('-', '*', ' ', '\t'))
            .Select(x => Regex.Replace(x, @"^\d+[.)]\s*", string.Empty))
            // Strip surrounding quotes and trailing commas that some models include
            .Select(x => x.Trim('"', ',', ' '))
            // Exclude lines that look like JSON structure rather than questions
            .Where(x => !string.IsNullOrWhiteSpace(x) && x.Length > 5 && !x.StartsWith('[') && !x.StartsWith(']'))
            .ToList();
    }

    public async Task<InterviewSession> CreateProfileAsync(CreateProfileRequest request, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(request.RoleName))
            throw new ArgumentException("Role name is required.");

        var roleName = request.RoleName.Trim();
        var roleSummary = request.RoleSummary?.Trim() ?? string.Empty;
        var roleDescription = string.IsNullOrWhiteSpace(roleSummary)
            ? roleName
            : roleName + "\n\n" + roleSummary;

        var session = new InterviewSession
        {
            RoleName = roleName,
            RoleSummary = roleSummary,
            RoleDescription = roleDescription,
            Questions = [],
            IsSaved = true,
            UpdatedAt = DateTimeOffset.UtcNow
        };

        await _repository.UpsertAsync(session, cancellationToken);
        return session;
    }

    public async Task<InterviewSession> UpdateProfileSummaryAsync(string sessionId, UpdateProfileSummaryRequest request, CancellationToken cancellationToken = default)
    {
        var session = await _repository.GetAsync(sessionId, cancellationToken)
            ?? throw new KeyNotFoundException("Profile not found.");

        var roleSummary = request.RoleSummary?.Trim() ?? string.Empty;
        session.RoleSummary = roleSummary;
        session.RoleDescription = string.IsNullOrWhiteSpace(roleSummary)
            ? session.RoleName
            : session.RoleName + "\n\n" + roleSummary;
        session.UpdatedAt = DateTimeOffset.UtcNow;

        await _repository.UpsertAsync(session, cancellationToken);
        return session;
    }

    public async Task<InterviewQuestion> SaveAnswerAsync(string sessionId, string questionId, SaveAnswerRequest request, CancellationToken cancellationToken = default)
    {
        var session = await _repository.GetAsync(sessionId, cancellationToken)
            ?? throw new KeyNotFoundException("Profile not found.");

        var question = session.Questions.FirstOrDefault(q => q.Id == questionId)
            ?? throw new KeyNotFoundException("Question not found.");

        if (request.Answer is not null)
            question.Answer = request.Answer;

        if (request.Feedback is not null)
            question.Feedback = request.Feedback;

        session.UpdatedAt = DateTimeOffset.UtcNow;
        await _repository.UpsertAsync(session, cancellationToken);
        return question;
    }

    public async Task<MockQuestionsResponse> GenerateMockQuestionsAsync(MockQuestionsRequest request, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(request.RoleDescription))
            throw new ArgumentException("Role description is required.");

        if (request.QuestionCount <= 0)
            throw new ArgumentException("Question count must be greater than zero.");

        var prompt = $"Generate {request.QuestionCount} interview questions for the following role. Return only a JSON array of question strings.\n<role>{request.RoleDescription}</role>";
        var response = await _llmClient.CompleteAsync(prompt, cancellationToken);
        var questions = ParseQuestions(response).Take(request.QuestionCount).ToList();
        return new MockQuestionsResponse(questions);
    }

    public async Task<MockFeedbackResponse> GenerateMockFeedbackAsync(MockFeedbackRequest request, CancellationToken cancellationToken = default)
    {
        if (request.Answers is null || request.Answers.Count == 0)
            throw new ArgumentException("At least one answer is required.");

        var qaBlock = string.Join("\n\n", request.Answers.Select((a, i) =>
            $"Q{i + 1}: {a.Question}\nA{i + 1}: {a.Answer}"));

        var prompt = $"<role>{request.RoleDescription}</role>\n" +
            "You are an expert interview coach. Evaluate each candidate response with the same depth and detail as a professional one-on-one coaching session.\n" +
            "Return a JSON object with EXACTLY these three fields and nothing else:\n" +
            "\"rating\": integer 1-10 overall score.\n" +
            "\"overallFeedback\": a high-level markdown coaching summary (3-5 sentences ONLY). Do NOT repeat or recap individual questions here. Cover overall themes, patterns, and 2-3 concrete preparation steps.\n" +
            "\"questionFeedbacks\": array with one entry per question, in the same order as above. Each entry has \"question\" (copy verbatim) and \"feedback\" (rich markdown).\n" +
            "The feedback markdown for EACH question MUST follow this exact structure — do NOT include any preamble or introduction, start directly with **Strengths:**:\n" +
            "**Strengths:**\n- (detailed bullet points with specific observations)\n\n**Areas for Improvement:**\n- (detailed bullet points)\n\n**Suggestions for Next Steps:**\n- (detailed bullet points)\n\nExample revised answer:\n\n\"(a fully rewritten version of the answer demonstrating best practices, using specific language and metrics where possible)\"\n" +
            "Return only valid JSON with all markdown properly escaped as JSON strings. Do not include any text outside the JSON object.\n" +
            $"<interview>\n{qaBlock}\n</interview>";

        var response = await _llmClient.CompleteAsync(prompt, cancellationToken);
        return ParseMockFeedback(response, request.Answers);
    }

    private static MockFeedbackResponse ParseMockFeedback(string content, List<MockAnswerDto> answers)
    {
        if (string.IsNullOrWhiteSpace(content))
            return new MockFeedbackResponse(5, "No feedback available.", []);

        var objStart = content.IndexOf('{');
        var objEnd = content.LastIndexOf('}');

        if (objStart >= 0 && objEnd > objStart)
        {
            var jsonSlice = content[objStart..(objEnd + 1)];
            try
            {
                var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
                var parsed = JsonSerializer.Deserialize<MockFeedbackJsonRaw>(jsonSlice, options);
                if (parsed is not null)
                {
                    var qFeedbacks = parsed.QuestionFeedbacks?
                        .Select(x => new MockQuestionFeedback(x.Question ?? string.Empty, x.Feedback ?? string.Empty))
                        .ToList() ?? [];
                    return new MockFeedbackResponse(Math.Clamp(parsed.Rating, 1, 10), parsed.OverallFeedback ?? string.Empty, qFeedbacks);
                }
            }
            catch (JsonException) { }
        }

        return new MockFeedbackResponse(5, content.Trim(), answers.Select(a => new MockQuestionFeedback(a.Question, string.Empty)).ToList());
    }

    private record MockFeedbackJsonRaw(int Rating, string? OverallFeedback, List<MockQuestionFeedbackRaw>? QuestionFeedbacks);

    private record MockQuestionFeedbackRaw(string? Question, string? Feedback);
}
