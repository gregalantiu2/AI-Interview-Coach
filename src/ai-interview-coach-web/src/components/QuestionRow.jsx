import { useState } from 'react'

export default function QuestionRow({ question, sessionId, apiFetch, onQuestionUpdated }) {
  const [expanded, setExpanded] = useState(false)
  const [answer, setAnswer] = useState(question.answer ?? '')
  const [isLoading, setIsLoading] = useState(false)

  async function submitAnswer(event) {
    event.preventDefault()
    if (!sessionId || !answer.trim()) return

    setIsLoading(true)
    try {
      const data = await apiFetch('/api/interview/answer', {
        method: 'POST',
        body: JSON.stringify({ sessionId, questionId: question.id, answer }),
      })
      onQuestionUpdated(data.question)
    } catch {
      // keep UI interactive
    } finally {
      setIsLoading(false)
    }
  }

  const hasAnswer = question.answer?.trim()
  const hasFeedback = question.feedback?.trim()

  return (
    <div className={`question-row ${expanded ? 'expanded' : ''}`}>
      <button
        type="button"
        className="question-row-header"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
      >
        <span className="question-text">{question.text}</span>
        <span className="question-badges">
          {hasAnswer && <span className="badge badge-answered">Answered</span>}
          {hasFeedback && <span className="badge badge-feedback">Feedback</span>}
          <span className={`chevron ${expanded ? 'open' : ''}`}>▾</span>
        </span>
      </button>

      {expanded && (
        <div className="question-row-body">
          <form onSubmit={submitAnswer} className="answer-panel">
            <h4>Your Answer</h4>
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              rows={6}
              placeholder="Type your answer here..."
              required
            />
            <button type="submit" className="btn btn-primary btn-sm" disabled={isLoading}>
              {isLoading ? 'Evaluating...' : 'Get Feedback'}
            </button>
          </form>

          <div className="feedback-panel">
            <h4>AI Feedback</h4>
            {hasFeedback ? (
              <div className="feedback-content">{question.feedback}</div>
            ) : (
              <p className="placeholder-text">
                Submit your answer to receive AI-powered feedback.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
