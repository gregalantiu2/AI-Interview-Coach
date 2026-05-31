using AIInterviewCoach.Api.Models;
using AIInterviewCoach.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace AIInterviewCoach.Api.Controllers;

[ApiController]
[Route("api/interview")]
public class InterviewController(InterviewCoachService service) : ControllerBase
{
    private readonly InterviewCoachService _service = service;

    [HttpPost("generate")]
    [EnableRateLimiting("llm")]
    public async Task<ActionResult<GenerateQuestionsResponse>> GenerateQuestions([FromBody] GenerateQuestionsRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var response = await _service.GenerateQuestionsAsync(request, cancellationToken);
            return Ok(response);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpPost("answer")]
    [EnableRateLimiting("llm")]
    public async Task<ActionResult<SubmitAnswerResponse>> SubmitAnswer([FromBody] SubmitAnswerRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var response = await _service.SubmitAnswerAsync(request, cancellationToken);
            return Ok(response);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ex.Message);
        }
    }

    [HttpPost("session/{sessionId}/summary")]
    [EnableRateLimiting("llm")]
    public async Task<ActionResult<string>> GenerateSummary(string sessionId, [FromBody] GenerateSummaryRequest request, CancellationToken cancellationToken)
    {
        if (!IsValidSessionId(sessionId)) return BadRequest("Invalid session ID format.");

        try
        {
            var response = await _service.GenerateSummaryAsync(sessionId, request.QuestionsToInclude, cancellationToken);
            return Ok(response);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ex.Message);
        }
    }

    [HttpPost("session/{sessionId}/save")]
    [EnableRateLimiting("general")]
    public async Task<ActionResult<SaveSessionResponse>> SaveSession(string sessionId, CancellationToken cancellationToken)
    {
        if (!IsValidSessionId(sessionId)) return BadRequest("Invalid session ID format.");

        try
        {
            var session = await _service.SaveSessionAsync(sessionId, cancellationToken);
            return Ok(new SaveSessionResponse(session.Id, session.IsSaved));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ex.Message);
        }
    }

    [HttpGet("session/{sessionId}")]
    [EnableRateLimiting("general")]
    public async Task<ActionResult<InterviewSession>> GetSession(string sessionId, CancellationToken cancellationToken)
    {
        if (!IsValidSessionId(sessionId)) return BadRequest("Invalid session ID format.");

        var session = await _service.GetSessionAsync(sessionId, cancellationToken);
        return session is null ? NotFound() : Ok(session);
    }

    [HttpGet("saved")]
    [EnableRateLimiting("general")]
    public async Task<ActionResult<IReadOnlyList<InterviewSession>>> GetSavedSessions(CancellationToken cancellationToken)
    {
        var sessions = await _service.ListSavedSessionsAsync(cancellationToken);
        return Ok(sessions);
    }

    [HttpPost("profiles")]
    [EnableRateLimiting("general")]
    public async Task<ActionResult<InterviewSession>> CreateProfile([FromBody] CreateProfileRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var session = await _service.CreateProfileAsync(request, cancellationToken);
            return Ok(session);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpGet("profiles")]
    [EnableRateLimiting("general")]
    public async Task<ActionResult<IReadOnlyList<InterviewSession>>> GetProfiles(CancellationToken cancellationToken)
    {
        var profiles = await _service.ListAllSessionsAsync(cancellationToken);
        return Ok(profiles);
    }

    [HttpPatch("profiles/{profileId}/summary")]
    [EnableRateLimiting("general")]
    public async Task<ActionResult<InterviewSession>> UpdateProfileSummary(string profileId, [FromBody] UpdateProfileSummaryRequest request, CancellationToken cancellationToken)
    {
        if (!IsValidSessionId(profileId)) return BadRequest("Invalid profile ID format.");

        try
        {
            var session = await _service.UpdateProfileSummaryAsync(profileId, request, cancellationToken);
            return Ok(session);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ex.Message);
        }
    }

    [HttpPost("session/{sessionId}/questions")]
    [EnableRateLimiting("llm")]
    public async Task<ActionResult<AddQuestionsResponse>> AddQuestions(string sessionId, [FromBody] AddQuestionsRequest request, CancellationToken cancellationToken)
    {
        if (!IsValidSessionId(sessionId)) return BadRequest("Invalid session ID format.");

        try
        {
            var response = await _service.AddQuestionsAsync(sessionId, request, cancellationToken);
            return Ok(response);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ex.Message);
        }
    }

    [HttpPost("session/{sessionId}/question/{questionId}/tips")]
    [EnableRateLimiting("llm")]
    public async Task<ActionResult<GetTipsResponse>> GetTips(string sessionId, string questionId, CancellationToken cancellationToken)
    {
        if (!IsValidSessionId(sessionId) || !IsValidSessionId(questionId)) return BadRequest("Invalid ID format.");

        try
        {
            var response = await _service.GetTipsAsync(sessionId, questionId, cancellationToken);
            return Ok(response);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ex.Message);
        }
    }

    [HttpDelete("session/{sessionId}")]
    [EnableRateLimiting("general")]
    public async Task<IActionResult> DeleteProfile(string sessionId, CancellationToken cancellationToken)
    {
        if (!IsValidSessionId(sessionId)) return BadRequest("Invalid session ID format.");

        try
        {
            await _service.DeleteSessionAsync(sessionId, cancellationToken);
            return NoContent();
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ex.Message);
        }
    }

    [HttpDelete("session/{sessionId}/question/{questionId}")]
    [EnableRateLimiting("general")]
    public async Task<IActionResult> DeleteQuestion(string sessionId, string questionId, CancellationToken cancellationToken)
    {
        if (!IsValidSessionId(sessionId) || !IsValidSessionId(questionId)) return BadRequest("Invalid ID format.");

        try
        {
            await _service.DeleteQuestionAsync(sessionId, questionId, cancellationToken);
            return NoContent();
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ex.Message);
        }
    }

    [HttpPatch("session/{sessionId}/question/{questionId}/answer")]
    [EnableRateLimiting("general")]
    public async Task<IActionResult> SaveAnswer(string sessionId, string questionId, [FromBody] SaveAnswerRequest request, CancellationToken cancellationToken)
    {
        if (!IsValidSessionId(sessionId)) return BadRequest("Invalid session ID format.");

        try
        {
            var question = await _service.SaveAnswerAsync(sessionId, questionId, request, cancellationToken);
            return Ok(question);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ex.Message);
        }
    }

    [HttpPost("mock/questions")]
    [EnableRateLimiting("llm")]
    public async Task<ActionResult<MockQuestionsResponse>> GenerateMockQuestions([FromBody] MockQuestionsRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var response = await _service.GenerateMockQuestionsAsync(request, cancellationToken);
            return Ok(response);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpPost("mock/feedback")]
    [EnableRateLimiting("llm")]
    public async Task<ActionResult<MockFeedbackResponse>> GenerateMockFeedback([FromBody] MockFeedbackRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var response = await _service.GenerateMockFeedbackAsync(request, cancellationToken);
            return Ok(response);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    private static bool IsValidSessionId(string sessionId) => Guid.TryParse(sessionId, out _);
}
