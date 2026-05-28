using AIInterviewCoach.Api.Models;
using AIInterviewCoach.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace AIInterviewCoach.Api.Controllers;

[ApiController]
[Route("api/interview")]
public class InterviewController(InterviewCoachService service) : ControllerBase
{
    private readonly InterviewCoachService _service = service;

    [HttpPost("generate")]
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
    public async Task<ActionResult<InterviewSession>> GetSession(string sessionId, CancellationToken cancellationToken)
    {
        if (!IsValidSessionId(sessionId)) return BadRequest("Invalid session ID format.");

        var session = await _service.GetSessionAsync(sessionId, cancellationToken);
        return session is null ? NotFound() : Ok(session);
    }

    [HttpGet("saved")]
    public async Task<ActionResult<IReadOnlyList<InterviewSession>>> GetSavedSessions(CancellationToken cancellationToken)
    {
        var sessions = await _service.ListSavedSessionsAsync(cancellationToken);
        return Ok(sessions);
    }

    private static bool IsValidSessionId(string sessionId) => Guid.TryParse(sessionId, out _);
}
