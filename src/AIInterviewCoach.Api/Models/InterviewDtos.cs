namespace AIInterviewCoach.Api.Models;

public record CreateProfileRequest(string RoleDescription);

public record SaveAnswerRequest(string? Answer = null, string? Feedback = null);

public record GenerateQuestionsRequest(string RoleDescription, int QuestionCount, List<string>? ManualQuestions);

public record GenerateQuestionsResponse(string SessionId, string RoleDescription, IReadOnlyList<InterviewQuestion> Questions);

public record AddQuestionsRequest(int QuestionCount, List<string>? ManualQuestions);

public record AddQuestionsResponse(IReadOnlyList<InterviewQuestion> NewQuestions, IReadOnlyList<InterviewQuestion> AllQuestions);

public record SubmitAnswerRequest(string SessionId, string QuestionId, string Answer);

public record SubmitAnswerResponse(string Feedback, InterviewQuestion Question);

public record GenerateSummaryRequest(int QuestionsToInclude);

public record SaveSessionResponse(string SessionId, bool IsSaved);

public record GetTipsResponse(string Tips, InterviewQuestion Question);

public record MockQuestionsRequest(string RoleDescription, int QuestionCount);

public record MockQuestionsResponse(List<string> Questions);

public record MockAnswerDto(string Question, string Answer);

public record MockFeedbackRequest(string RoleDescription, List<MockAnswerDto> Answers);

public record MockQuestionFeedback(string Question, string Feedback);

public record MockFeedbackResponse(int Rating, string OverallFeedback, List<MockQuestionFeedback> QuestionFeedbacks);
