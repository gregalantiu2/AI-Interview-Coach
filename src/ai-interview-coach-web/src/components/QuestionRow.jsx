import { useEffect, useRef, useState } from 'react'
import { marked } from 'marked'
import ConfirmModal from './ConfirmModal.jsx'

const DRAFT_KEY = (id) => `answer-draft-${id}`

export default function QuestionRow({ question, sessionId, apiFetch, onQuestionUpdated, onDelete, onToast, viewMode = 'modal' }) {
  const [isOpen, setIsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('feedback')
  const [answer, setAnswer] = useState(() => {
    if (question.answer) return question.answer
    return localStorage.getItem(DRAFT_KEY(question.id)) ?? ''
  })
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingTips, setIsLoadingTips] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const debounceRef = useRef(null)

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

  useEffect(() => {
    if (!isOpen || viewMode !== 'modal') return
    function onKey(e) { if (e.key === 'Escape') setIsOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, viewMode])

  async function handleSubmitAnswer() {
    if (!answer.trim()) {
      onToast?.('Please enter an answer before generating feedback.')
      return
    }
    if (!sessionId) return
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

  const answerSection = (
    <div className="answer-panel">
      <h4>Your Answer</h4>
      <textarea
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        placeholder="Type your answer here..."
      />
    </div>
  )

  const tabbedPanel = (
    <div className="question-tab-panel">
      <div className="tab-bar" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'feedback'}
          className={`tab-btn${activeTab === 'feedback' ? ' active' : ''}`}
          onClick={() => setActiveTab('feedback')}
        >
          Feedback
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'tips'}
          className={`tab-btn${activeTab === 'tips' ? ' active' : ''}`}
          onClick={() => setActiveTab('tips')}
        >
          Tips &amp; Example
        </button>
      </div>
      <div className="tab-content" role="tabpanel">
        {activeTab === 'feedback' && (
          isLoading ? (
            <div className="feedback-spinner" aria-label="Waiting for feedback">
              <span className="spinner" />
              <span className="spinner-text">Evaluating your answer…</span>
            </div>
          ) : hasFeedback ? (
            <div className="feedback-content" dangerouslySetInnerHTML={{ __html: marked.parse(question.feedback) }} />
          ) : (
            <div className="tab-empty-state">
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleSubmitAnswer}
                disabled={isLoading}
              >
                Generate Feedback
              </button>
            </div>
          )
        )}
        {activeTab === 'tips' && (
          isLoadingTips ? (
            <div className="feedback-spinner" aria-label="Loading tips">
              <span className="spinner" />
              <span className="spinner-text">Generating tips…</span>
            </div>
          ) : hasTips ? (
            <div className="feedback-content" dangerouslySetInnerHTML={{ __html: marked.parse(question.tips) }} />
          ) : (
            <div className="tab-empty-state">
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={handleGetTips}
                disabled={isLoadingTips}
              >
                Get Tips
              </button>
            </div>
          )
        )}
      </div>
    </div>
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
                <span className={`chevron ${isOpen ? 'open' : ''}`}>&#9662;</span>
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
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="15" height="15" aria-hidden="true">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6" />
              <path d="M14 11v6" />
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
            </svg>
          </button>
        </div>

        {viewMode === 'expand' && isOpen && (
          <div className="question-row-body">
            {answerSection}
            <div className="question-expand-panels">
              {tabbedPanel}
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
                &#x2715;
              </button>
            </div>

            <div className="modal-body question-modal-body">
              {answerSection}
              <div className="question-modal-panels">
                {tabbedPanel}
              </div>
            </div>

            <div className="modal-footer question-modal-footer">
              <button
                type="button"
                className="btn-icon-delete"
                onClick={handleDelete}
                disabled={isDeleting}
                aria-label="Delete question"
                title="Delete question"
              >
                {isDeleting ? (
                  <span className="spinner" style={{ borderColor: 'rgba(255,255,255,0.35)', borderTopColor: '#fff' }} />
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" aria-hidden="true">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                    <path d="M10 11v6" />
                    <path d="M14 11v6" />
                    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                  </svg>
                )}
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
