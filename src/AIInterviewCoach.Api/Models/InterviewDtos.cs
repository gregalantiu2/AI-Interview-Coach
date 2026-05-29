namespace AIInterviewCoach.Api.Models;

public record GenerateQuestionsRequest(string RoleDescription, int QuestionCount, List<string>? ManualQuestions);

public record GenerateQuestionsResponse(string SessionId, string RoleDescription, IReadOnlyList<InterviewQuestion> Questions);

public record AddQuestionsRequest(int QuestionCount, List<string>? ManualQuestions);

public record AddQuestionsResponse(IReadOnlyList<InterviewQuestion> NewQuestions, IReadOnlyList<InterviewQuestion> AllQuestions);

public record SubmitAnswerRequest(string SessionId, string QuestionId, string Answer);

public record SubmitAnswerResponse(string Feedback, InterviewQuestion Question);

public record GenerateSummaryRequest(int QuestionsToInclude);

public record SaveSessionResponse(string SessionId, bool IsSaved);

public record GetTipsResponse(string Tips, InterviewQuestion Question);
