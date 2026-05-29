import { useEffect, useRef, useState } from 'react'
import { marked } from 'marked'
import ConfirmModal from './ConfirmModal.jsx'

const DRAFT_KEY = (id) => `answer-draft-${id}`

export default function QuestionRow({ question, sessionId, apiFetch, onQuestionUpdated, onDelete, viewMode = 'modal' }) {
  const [isOpen, setIsOpen] = useState(false)
  const [answer, setAnswer] = useState(() => {
    if (question.answer) return question.answer
    return localStorage.getItem(DRAFT_KEY(question.id)) ?? ''
  })
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingTips, setIsLoadingTips] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const debounceRef = useRef(null)

  // Persist draft on every keystroke (debounced 300ms)
  useEffect(() => {
    if (question.answer) return
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      if (answer.trim()) {
        localStorage.setItem(DRAFT_KEY(question.id), answer)
      } else {
        localStorage.removeItem(DRAFT_KEY(question.id))
      }
    }, 300)
    return () => clearTimeout(debounceRef.current)
  }, [answer, question.id, question.answer])

  // Close modal on Escape (modal mode only)
  useEffect(() => {
    if (!isOpen || viewMode !== 'modal') return
    function onKey(e) { if (e.key === 'Escape') setIsOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, viewMode])

  async function submitAnswer(event) {
    event.preventDefault()
    if (!sessionId || !answer.trim()) return
    setIsLoading(true)
    try {
      const data = await apiFetch('/api/interview/answer', {
        method: 'POST',
        body: JSON.stringify({ sessionId, questionId: question.id, answer }),
      })
      localStorage.removeItem(DRAFT_KEY(question.id))
      onQuestionUpdated(data.question, 'Feedback received.')
    } catch {
      // keep UI interactive
    } finally {
      setIsLoading(false)
    }
  }

  async function handleDelete(event) {
    event.stopPropagation()
    const hasData = question.answer?.trim() || question.feedback?.trim() || question.tips?.trim()
    if (hasData) {
      setShowDeleteConfirm(true)
      return
    }
    await doDelete()
  }

  async function doDelete() {
    setIsDeleting(true)
    try {
      await apiFetch(`/api/interview/session/${sessionId}/question/${question.id}`, {
        method: 'DELETE',
      })
      localStorage.removeItem(DRAFT_KEY(question.id))
      onDelete(question.id)
    } catch {
      setIsDeleting(false)
    }
  }

  async function handleGetTips() {
    setIsLoadingTips(true)
    try {
      const data = await apiFetch(
        `/api/interview/session/${sessionId}/question/${question.id}/tips`,
        { method: 'POST' },
      )
      onQuestionUpdated(data.question, 'Tips ready.')
    } catch {
      // keep UI interactive
    } finally {
      setIsLoadingTips(false)
    }
  }

  const hasAnswer = question.answer?.trim()
  const hasFeedback = question.feedback?.trim()
  const hasTips = question.tips?.trim()

  const answerForm = (
    <form onSubmit={submitAnswer} className="answer-panel">
      <h4>Your Answer</h4>
      <textarea
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        rows={7}
        placeholder="Type your answer here..."
        required
      />
      <div className="answer-actions">
        <button type="submit" className="btn btn-primary btn-sm" disabled={isLoading}>
          {isLoading ? 'Evaluating…' : 'Get Feedback'}
        </button>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={handleGetTips}
          disabled={isLoadingTips}
        >
          {isLoadingTips ? 'Loading tips…' : 'Get Tips'}
        </button>
      </div>
    </form>
  )

  const feedbackPanels = (
    <>
      <div className="feedback-panel">
        <h4>AI Feedback</h4>
        {isLoading ? (
          <div className="feedback-spinner" aria-label="Waiting for feedback">
            <span className="spinner" />
            <span className="spinner-text">Evaluating your answer…</span>
          </div>
        ) : hasFeedback ? (
          <div className="feedback-content" dangerouslySetInnerHTML={{ __html: marked.parse(question.feedback) }} />
        ) : (
          <p className="placeholder-text">Submit your answer to receive AI-powered feedback.</p>
        )}
      </div>
      <div className="feedback-panel">
        <h4>Tips &amp; Example Answer</h4>
        {isLoadingTips ? (
          <div className="feedback-spinner" aria-label="Loading tips">
            <span className="spinner" />
            <span className="spinner-text">Generating tips…</span>
          </div>
        ) : hasTips ? (
          <div className="feedback-content" dangerouslySetInnerHTML={{ __html: marked.parse(question.tips) }} />
        ) : (
          <p className="placeholder-text">Click "Get Tips" to see guidance and an example answer.</p>
        )}
      </div>
    </>
  )

  return (
    <>
      <div className={`question-row${viewMode === 'expand' && isOpen ? ' expanded' : ''}`}>
        <div className="question-row-header-wrapper">
          <button
            type="button"
            className="question-row-header"
            onClick={() => setIsOpen((v) => !v)}
            aria-expanded={viewMode === 'expand' ? isOpen : undefined}
          >
            <span className="question-text">{question.text}</span>
            <span className="question-badges">
              {hasAnswer && <span className="badge badge-answered">Answered</span>}
              {hasFeedback && <span className="badge badge-feedback">Feedback</span>}
              {hasTips && <span className="badge badge-tips">Tips</span>}
              {viewMode === 'expand' && (
                <span className={`chevron ${isOpen ? 'open' : ''}`}>▾</span>
              )}
            </span>
          </button>
          <button
            type="button"
            className="btn-delete-question"
            onClick={handleDelete}
            disabled={isDeleting}
            aria-label="Delete question"
            title="Delete question"
          >
            ✕
          </button>
        </div>

        {viewMode === 'expand' && isOpen && (
          <div className="question-row-body">
            {answerForm}
            <div className="question-expand-panels">
              {feedbackPanels}
            </div>
          </div>
        )}
      </div>

      {viewMode === 'modal' && isOpen && (
        <div className="modal-backdrop" onClick={() => setIsOpen(false)}>
          <div
            className="modal question-modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header question-modal-header">
              <h2>{question.text}</h2>
              <button
                type="button"
                className="modal-close"
                onClick={() => setIsOpen(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="modal-body question-modal-body">
              {answerForm}
              <div className="question-modal-panels">
                {feedbackPanels}
              </div>
            </div>

            <div className="modal-footer question-modal-footer">
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting…' : 'Delete Question'}
              </button>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setIsOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={showDeleteConfirm}
        title="Delete Question"
        message="This question has saved data. Are you sure you want to delete it?"
        confirmLabel="Delete"
        onConfirm={() => { setShowDeleteConfirm(false); doDelete() }}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </>
  )
}


const DRAFT_KEY = (id) => `answer-draft-${id}`

export default function QuestionRow({ question, sessionId, apiFetch, onQuestionUpdated, onDelete }) {
  const [isOpen, setIsOpen] = useState(false)
  const [answer, setAnswer] = useState(() => {
    if (question.answer) return question.answer
    return localStorage.getItem(DRAFT_KEY(question.id)) ?? ''
  })
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingTips, setIsLoadingTips] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const debounceRef = useRef(null)

  // Persist draft on every keystroke (debounced 300ms)
  useEffect(() => {
    if (question.answer) return
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      if (answer.trim()) {
        localStorage.setItem(DRAFT_KEY(question.id), answer)
      } else {
        localStorage.removeItem(DRAFT_KEY(question.id))
      }
    }, 300)
    return () => clearTimeout(debounceRef.current)
  }, [answer, question.id, question.answer])

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return
    function onKey(e) { if (e.key === 'Escape') setIsOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen])

  async function submitAnswer(event) {
    event.preventDefault()
    if (!sessionId || !answer.trim()) return
    setIsLoading(true)
    try {
      const data = await apiFetch('/api/interview/answer', {
        method: 'POST',
        body: JSON.stringify({ sessionId, questionId: question.id, answer }),
      })
      localStorage.removeItem(DRAFT_KEY(question.id))
      onQuestionUpdated(data.question, 'Feedback received.')
    } catch {
      // keep UI interactive
    } finally {
      setIsLoading(false)
    }
  }

  async function handleDelete(event) {
    event.stopPropagation()
    const hasData = question.answer?.trim() || question.feedback?.trim() || question.tips?.trim()
    if (hasData) {
      setShowDeleteConfirm(true)
      return
    }
    await doDelete()
  }

  async function doDelete() {
    setIsDeleting(true)
    try {
      await apiFetch(`/api/interview/session/${sessionId}/question/${question.id}`, {
        method: 'DELETE',
      })
      localStorage.removeItem(DRAFT_KEY(question.id))
      onDelete(question.id)
    } catch {
      setIsDeleting(false)
    }
  }

  async function handleGetTips() {
    setIsLoadingTips(true)
    try {
      const data = await apiFetch(
        `/api/interview/session/${sessionId}/question/${question.id}/tips`,
        { method: 'POST' },
      )
      onQuestionUpdated(data.question, 'Tips ready.')
    } catch {
      // keep UI interactive
    } finally {
      setIsLoadingTips(false)
    }
  }

  const hasAnswer = question.answer?.trim()
  const hasFeedback = question.feedback?.trim()
  const hasTips = question.tips?.trim()

  return (
    <>
      <div className="question-row">
        <div className="question-row-header-wrapper">
          <button
            type="button"
            className="question-row-header"
            onClick={() => setIsOpen(true)}
          >
            <span className="question-text">{question.text}</span>
            <span className="question-badges">
              {hasAnswer && <span className="badge badge-answered">Answered</span>}
              {hasFeedback && <span className="badge badge-feedback">Feedback</span>}
              {hasTips && <span className="badge badge-tips">Tips</span>}
            </span>
          </button>
          <button
            type="button"
            className="btn-delete-question"
            onClick={handleDelete}
            disabled={isDeleting}
            aria-label="Delete question"
            title="Delete question"
          >
            ✕
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="modal-backdrop" onClick={() => setIsOpen(false)}>
          <div
            className="modal question-modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header question-modal-header">
              <h2>{question.text}</h2>
              <button
                type="button"
                className="modal-close"
                onClick={() => setIsOpen(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="modal-body question-modal-body">
              <form onSubmit={submitAnswer} className="answer-panel">
                <h4>Your Answer</h4>
                <textarea
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  rows={7}
                  placeholder="Type your answer here..."
                  required
                />
                <div className="answer-actions">
                  <button type="submit" className="btn btn-primary btn-sm" disabled={isLoading}>
                    {isLoading ? 'Evaluating…' : 'Get Feedback'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={handleGetTips}
                    disabled={isLoadingTips}
                  >
                    {isLoadingTips ? 'Loading tips…' : 'Get Tips'}
                  </button>
                </div>
              </form>

              <div className="question-modal-panels">
                <div className="feedback-panel">
                  <h4>AI Feedback</h4>
                  {isLoading ? (
                    <div className="feedback-spinner" aria-label="Waiting for feedback">
                      <span className="spinner" />
                      <span className="spinner-text">Evaluating your answer…</span>
                    </div>
                  ) : hasFeedback ? (
                    <div
                      className="feedback-content"
                      dangerouslySetInnerHTML={{ __html: marked.parse(question.feedback) }}
                    />
                  ) : (
                    <p className="placeholder-text">Submit your answer to receive AI-powered feedback.</p>
                  )}
                </div>

                <div className="feedback-panel">
                  <h4>Tips &amp; Example Answer</h4>
                  {isLoadingTips ? (
                    <div className="feedback-spinner" aria-label="Loading tips">
                      <span className="spinner" />
                      <span className="spinner-text">Generating tips…</span>
                    </div>
                  ) : hasTips ? (
                    <div
                      className="feedback-content"
                      dangerouslySetInnerHTML={{ __html: marked.parse(question.tips) }}
                    />
                  ) : (
                    <p className="placeholder-text">Click "Get Tips" to see guidance and an example answer.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="modal-footer question-modal-footer">
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting…' : 'Delete Question'}
              </button>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setIsOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={showDeleteConfirm}
        title="Delete Question"
        message="This question has saved data. Are you sure you want to delete it?"
        confirmLabel="Delete"
        onConfirm={() => { setShowDeleteConfirm(false); doDelete() }}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </>
  )
}

