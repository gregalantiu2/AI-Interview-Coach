using AIInterviewCoach.Api.Models;
using AIInterviewCoach.Api.Repositories;
using AIInterviewCoach.Api.Services;

namespace AIInterviewCoach.Api.Tests;

public class InterviewCoachServiceTests
{
    [Fact]
    public async Task GenerateQuestionsAsync_CombinesManualAndGeneratedQuestions()
    {
        var llm = new FakeLlmClient("[\"What is dependency injection?\",\"Explain REST principles.\"]");
        var service = new InterviewCoachService(llm, new InMemoryInterviewSessionRepository());

        var response = await service.GenerateQuestionsAsync(
            new GenerateQuestionsRequest("Senior .NET engineer", 3, ["Tell me about your background"]));

        Assert.Equal(3, response.Questions.Count);
        Assert.Contains(response.Questions, q => q.Text == "Tell me about your background");
    }

    [Fact]
    public async Task SubmitAnswerAsync_SavesAnswerAndReturnsFeedback()
    {
        var llm = new FakeLlmClient(
            "[\"What is polymorphism?\"]",
            "Strong answer. Add a concrete production example.");
        var repository = new InMemoryInterviewSessionRepository();
        var service = new InterviewCoachService(llm, repository);

        var generated = await service.GenerateQuestionsAsync(new GenerateQuestionsRequest("Backend engineer", 1, null));
        var question = generated.Questions.Single();

        var answered = await service.SubmitAnswerAsync(new SubmitAnswerRequest(generated.SessionId, question.Id, "It lets one interface have many implementations."));

        Assert.Equal("Strong answer. Add a concrete production example.", answered.Feedback);

        var persisted = await repository.GetAsync(generated.SessionId);
        Assert.Equal("It lets one interface have many implementations.", persisted!.Questions.Single().Answer);
    }

    [Fact]
    public async Task GenerateSummaryAsync_ReturnsGuardMessageWhenNoAnswers()
    {
        var llm = new FakeLlmClient("[\"What is CAP theorem?\"]");
        var service = new InterviewCoachService(llm, new InMemoryInterviewSessionRepository());

        var generated = await service.GenerateQuestionsAsync(new GenerateQuestionsRequest("Distributed systems engineer", 1, null));
        var summary = await service.GenerateSummaryAsync(generated.SessionId, 1);

        Assert.Equal("Answer at least one question to receive summary feedback.", summary);
    }

    private sealed class FakeLlmClient(params string[] responses) : ILlmClient
    {
        private readonly Queue<string> _responses = new(responses);

        public Task<string> CompleteAsync(string prompt, CancellationToken cancellationToken = default)
        {
            if (_responses.Count == 0)
            {
                return Task.FromResult("Fallback response");
            }

            return Task.FromResult(_responses.Dequeue());
        }
    }
}
