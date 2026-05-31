import { useState } from 'react'
import { marked } from 'marked'

export default function MockInterviewResults({ feedback, feedbackStatus, onReset, onGoToBank }) {
  const initialExpanded = () =>
    new Set((feedback?.questionFeedbacks ?? []).map((_, i) => i))
  const [expandedQ, setExpandedQ] = useState(initialExpanded)

  function toggleQ(i) {
    setExpandedQ((prev) => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })
  }

  if (feedbackStatus === 'pending' || feedbackStatus === 'idle') {
    return (
      <div className="mock-results">
        <div className="mock-results-pending">
          <span className="spinner mock-results-spinner" />
          <p>Generating interview feedback&hellip;</p>
          <p className="mock-results-hint">
            You can navigate to your Question Bank while you wait. A notification will appear when feedback is ready.
          </p>
        </div>
      </div>
    )
  }

  if (feedbackStatus === 'error') {
    return (
      <div className="mock-results">
        <div className="mock-results-error">
          <p className="error-text">Failed to generate feedback. Please try again.</p>
          <button type="button" className="btn btn-outline" onClick={onReset}>
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mock-results">
      <div className="mock-results-header">
        <h2>Interview Results</h2>
        <div className="mock-rating-badge">
          <span className="mock-rating-value">{feedback.rating}</span>
          <span className="mock-rating-denom">/10</span>
        </div>
      </div>

      <div
        className="mock-overall-feedback feedback-content"
        dangerouslySetInnerHTML={{ __html: marked.parse(feedback.overallFeedback ?? '') }}
      />

      {feedback.questionFeedbacks?.length > 0 && (
        <div className="mock-question-breakdown">
          <h3>Question Breakdown</h3>
          {feedback.questionFeedbacks.map((qf, i) => (
            <div key={i} className="mock-qf-card">
              <button
                type="button"
                className="mock-qf-toggle"
                onClick={() => toggleQ(i)}
                aria-expanded={expandedQ.has(i)}
              >
                <span className="mock-qf-num">Q{i + 1}</span>
                <span className="mock-qf-question">{qf.question}</span>
                <span className={`chevron ${expandedQ.has(i) ? 'open' : ''}`}>&#x25BC;</span>
              </button>
              {expandedQ.has(i) && qf.feedback && (
                <div
                  className="mock-qf-feedback feedback-content"
                  dangerouslySetInnerHTML={{ __html: marked.parse(qf.feedback) }}
                />
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mock-results-actions">
        <button type="button" className="btn btn-primary" onClick={onReset}>
          Start New Mock Interview
        </button>
        <button type="button" className="btn btn-outline" onClick={onGoToBank}>
          Go to Question Bank
        </button>
      </div>
    </div>
  )
}
