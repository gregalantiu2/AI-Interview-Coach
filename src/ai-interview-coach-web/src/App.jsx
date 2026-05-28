import { useMemo, useState } from 'react'
import './App.css'

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
  const [roleDescription, setRoleDescription] = useState('')
  const [questionCount, setQuestionCount] = useState(5)
  const [manualQuestionText, setManualQuestionText] = useState('')
  const [sessionId, setSessionId] = useState('')
  const [questions, setQuestions] = useState([])
  const [selectedQuestionId, setSelectedQuestionId] = useState('')
  const [answer, setAnswer] = useState('')
  const [summaryCount, setSummaryCount] = useState(3)
  const [summary, setSummary] = useState('')
  const [savedSessions, setSavedSessions] = useState([])
  const [status, setStatus] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const selectedQuestion = useMemo(
    () => questions.find((question) => question.id === selectedQuestionId),
    [questions, selectedQuestionId],
  )

  const answeredCount = useMemo(
    () => questions.filter((question) => question.answer?.trim()).length,
    [questions],
  )

  const manualQuestions = useMemo(
    () => manualQuestionText.split('\n').map((q) => q.trim()).filter(Boolean),
    [manualQuestionText],
  )

  async function generateQuestions(event) {
    event.preventDefault()
    setStatus('Generating questions...')
    setSummary('')
    setIsLoading(true)

    try {
      const data = await apiFetch('/api/interview/generate', {
        method: 'POST',
        body: JSON.stringify({
          roleDescription,
          questionCount: Number(questionCount),
          manualQuestions,
        }),
      })

      setSessionId(data.sessionId)
      setQuestions(data.questions)
      setSelectedQuestionId(data.questions[0]?.id ?? '')
      setSummaryCount((prev) => Math.min(prev, data.questions.length || 1))
      setAnswer('')
      setStatus('Questions generated.')
    } catch (error) {
      setStatus(`Failed: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  async function submitAnswer(event) {
    event.preventDefault()
    if (!sessionId || !selectedQuestionId || !answer.trim()) return

    setStatus('Evaluating answer...')
    setIsLoading(true)

    try {
      const data = await apiFetch('/api/interview/answer', {
        method: 'POST',
        body: JSON.stringify({ sessionId, questionId: selectedQuestionId, answer }),
      })

      setQuestions((previous) =>
        previous.map((question) =>
          question.id === selectedQuestionId ? data.question : question,
        ),
      )
      setAnswer('')
      setStatus('Feedback generated.')
    } catch (error) {
      setStatus(`Failed: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  async function saveSession() {
    if (!sessionId) return

    setIsLoading(true)
    try {
      await apiFetch(`/api/interview/session/${sessionId}/save`, { method: 'POST' })
      setStatus('Session saved for future reference.')
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

  async function loadSavedSessions() {
    try {
      const data = await apiFetch('/api/interview/saved')
      setSavedSessions(data)
    } catch {
      // keep UI interactive even when API is unavailable
    }
  }

  return (
    <main>
      <h1>AI Interview Coach</h1>
      <form onSubmit={generateQuestions} className="card">
        <label>
          Role description
          <input
            value={roleDescription}
            onChange={(event) => setRoleDescription(event.target.value)}
            placeholder="e.g. Senior Backend Engineer focused on .NET and distributed systems"
            required
          />
        </label>

        <label>
          Number of questions
          <input
            type="number"
            min="1"
            max="20"
            value={questionCount}
            onChange={(event) => setQuestionCount(event.target.value)}
            required
          />
        </label>

        <label>
          Optional manual questions (one per line)
          <textarea
            value={manualQuestionText}
            onChange={(event) => setManualQuestionText(event.target.value)}
            rows={4}
          />
        </label>

        <button type="submit" disabled={isLoading}>Generate interview questions</button>
      </form>

      {questions.length > 0 && (
        <section className="card">
          <h2>Session Questions</h2>
          <p>Session ID: {sessionId}</p>
          <p>
            Answered: {answeredCount}/{questions.length}
          </p>
          <ul>
            {questions.map((question) => (
              <li key={question.id}>
                <button
                  type="button"
                  className={question.id === selectedQuestionId ? 'selected' : ''}
                  onClick={() => {
                    setSelectedQuestionId(question.id)
                    setAnswer(question.answer ?? '')
                  }}
                >
                  {question.text}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {selectedQuestion && (
        <form onSubmit={submitAnswer} className="card">
          <h2>Answer question</h2>
          <p>{selectedQuestion.text}</p>
          <textarea
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
            rows={6}
            placeholder="Type your answer here"
            required
          />
          <button type="submit" disabled={isLoading}>Get feedback</button>
          {selectedQuestion.feedback && (
            <p className="feedback">Feedback: {selectedQuestion.feedback}</p>
          )}
        </form>
      )}

      {sessionId && (
        <section className="card">
          <h2>Session actions</h2>
          <button type="button" onClick={saveSession} disabled={isLoading}>
            Save questions & answers
          </button>

          <div className="summaryRow">
            <label>
              Summarize first X answered questions
              <input
                type="number"
                min="1"
                max={questions.length || 1}
                value={summaryCount}
                onChange={(event) => setSummaryCount(event.target.value)}
              />
            </label>
            <button type="button" onClick={generateSummary} disabled={isLoading}>
              Generate overall feedback
            </button>
          </div>

          {summary && <p className="feedback">Overall feedback: {summary}</p>}
        </section>
      )}

      <section className="card">
        <h2>Saved sessions</h2>
        <button type="button" onClick={loadSavedSessions}>
          Refresh saved history
        </button>
        <ul>
          {savedSessions.map((session) => (
            <li key={session.id}>
              <strong>{session.roleDescription}</strong> ({session.questions.length} questions)
            </li>
          ))}
        </ul>
      </section>

      {status && <p className="status">{status}</p>}
    </main>
  )
}

export default App
