namespace AIInterviewCoach.Api.Models;

public record GenerateQuestionsRequest(string RoleDescription, int QuestionCount, List<string>? ManualQuestions);

public record GenerateQuestionsResponse(string SessionId, IReadOnlyList<InterviewQuestion> Questions);

public record SubmitAnswerRequest(string SessionId, string QuestionId, string Answer);

public record SubmitAnswerResponse(string Feedback, InterviewQuestion Question);

public record GenerateSummaryRequest(int QuestionsToInclude);

public record SaveSessionResponse(string SessionId, bool IsSaved);
