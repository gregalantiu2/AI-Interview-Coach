import { useCallback, useMemo, useState } from 'react'
import './App.css'
import NewSessionModal from './components/NewSessionModal.jsx'
import QuestionRow from './components/QuestionRow.jsx'
import ExportButton from './components/ExportButton.jsx'

const apiBase = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000').replace(/\/$/, '')

async function apiFetch(path, options = {}) {
  const response = await fetch(`${apiBase}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })

  if (!response.ok) {
    throw new Error(await response.text())
  }

  return response.json()
}

function App() {
  const [showModal, setShowModal] = useState(false)
  const [sessionId, setSessionId] = useState('')
  const [roleDescription, setRoleDescription] = useState('')
  const [questions, setQuestions] = useState([])
  const [summaryCount, setSummaryCount] = useState(3)
  const [summary, setSummary] = useState('')
  const [savedSessions, setSavedSessions] = useState([])
  const [expandedSessionId, setExpandedSessionId] = useState('')
  const [status, setStatus] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const answeredCount = useMemo(
    () => questions.filter((q) => q.answer?.trim()).length,
    [questions],
  )

  const loadSavedSessions = useCallback(async () => {
    try {
      const data = await apiFetch('/api/interview/saved')
      setSavedSessions(data)
    } catch {
      // keep UI interactive even when API is unavailable
    }
  }, [])

  function handleSessionCreated(data) {
    setSessionId(data.sessionId)
    setQuestions(data.questions)
    setSummary('')
    setSummaryCount(Math.min(3, data.questions.length || 1))
    setStatus('Questions generated — expand a row to start answering.')
  }

  function handleQuestionUpdated(updatedQuestion) {
    setQuestions((prev) =>
      prev.map((q) => (q.id === updatedQuestion.id ? updatedQuestion : q)),
    )
    setStatus('Feedback received.')
  }

  async function saveSession() {
    if (!sessionId) return
    setIsLoading(true)
    try {
      await apiFetch(`/api/interview/session/${sessionId}/save`, { method: 'POST' })
      setStatus('Session saved.')
      await loadSavedSessions()
    } catch (error) {
      setStatus(`Failed: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  async function generateSummary() {
    if (!sessionId) return
    setIsLoading(true)
    try {
      const data = await apiFetch(`/api/interview/session/${sessionId}/summary`, {
        method: 'POST',
        body: JSON.stringify({ questionsToInclude: Number(summaryCount) }),
      })
      setSummary(data)
      setStatus('Summary feedback ready.')
    } catch (error) {
      setStatus(`Failed: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  function loadSession(session) {
    if (expandedSessionId === session.id) {
      setExpandedSessionId('')
      return
    }
    setExpandedSessionId(session.id)
    setSessionId(session.id)
    setRoleDescription(session.roleDescription)
    setQuestions(session.questions)
    setSummary('')
    setSummaryCount(Math.min(3, session.questions.length || 1))
    setStatus('')
  }

  return (
    <div className="dashboard">
      {/* ── Header ── */}
      <header className="topbar">
        <h1>AI Interview Coach</h1>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setShowModal(true)}
        >
          + New Session
        </button>
      </header>

      <NewSessionModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSessionCreated={handleSessionCreated}
        apiFetch={apiFetch}
      />

      {/* ── Active Session ── */}
      {questions.length > 0 && !expandedSessionId && (
        <section className="card session-card">
          <div className="session-header">
            <div>
              <h2>Current Session</h2>
              <p className="meta">
                {answeredCount}/{questions.length} answered
              </p>
            </div>
            <div className="session-actions">
              <ExportButton questions={questions} roleDescription={roleDescription} />
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={saveSession}
                disabled={isLoading}
              >
                💾 Save
              </button>
            </div>
          </div>

          <div className="questions-list">
            {questions.map((q) => (
              <QuestionRow
                key={q.id}
                question={q}
                sessionId={sessionId}
                apiFetch={apiFetch}
                onQuestionUpdated={handleQuestionUpdated}
              />
            ))}
          </div>

          <div className="summary-section">
            <div className="summary-controls">
              <label>
                Summarize first
                <input
                  type="number"
                  min="1"
                  max={questions.length || 1}
                  value={summaryCount}
                  onChange={(e) => setSummaryCount(e.target.value)}
                  className="summary-input"
                />
                answered questions
              </label>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={generateSummary}
                disabled={isLoading}
              >
                Generate Summary
              </button>
            </div>
            {summary && <div className="feedback-content summary-box">{summary}</div>}
          </div>
        </section>
      )}

      {/* ── Saved Sessions ── */}
      <section className="card">
        <div className="session-header">
          <h2>Saved Sessions</h2>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={loadSavedSessions}
          >
            ↻ Refresh
          </button>
        </div>

        {savedSessions.length === 0 && (
          <p className="placeholder-text">
            No saved sessions yet. Start a new session and save it!
          </p>
        )}

        {savedSessions.map((session) => (
          <div key={session.id} className="saved-session">
            <button
              type="button"
              className="saved-session-header"
              onClick={() => loadSession(session)}
              aria-expanded={expandedSessionId === session.id}
            >
              <div>
                <strong>{session.roleDescription}</strong>
                <span className="meta"> — {session.questions.length} questions</span>
              </div>
              <span className={`chevron ${expandedSessionId === session.id ? 'open' : ''}`}>
                ▾
              </span>
            </button>

            {expandedSessionId === session.id && (
              <div className="saved-session-body">
                <div className="session-actions" style={{ marginBottom: '0.75rem' }}>
                  <ExportButton
                    questions={session.questions}
                    roleDescription={session.roleDescription}
                  />
                </div>
                {session.questions.map((q) => (
                  <QuestionRow
                    key={q.id}
                    question={q}
                    sessionId={session.id}
                    apiFetch={apiFetch}
                    onQuestionUpdated={handleQuestionUpdated}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </section>

      {/* ── Status Toast ── */}
      {status && (
        <div className="toast">
          <span>{status}</span>
          <button type="button" className="toast-close" onClick={() => setStatus('')}>
            ✕
          </button>
        </div>
      )}
    </div>
  )
}

export default App
