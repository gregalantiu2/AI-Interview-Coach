import { useMemo, useState } from 'react'

export default function NewSessionModal({ isOpen, onClose, onSessionCreated, apiFetch }) {
  const [roleDescription, setRoleDescription] = useState('')
  const [questionCount, setQuestionCount] = useState(5)
  const [manualQuestionText, setManualQuestionText] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const manualQuestions = useMemo(
    () => manualQuestionText.split('\n').map((q) => q.trim()).filter(Boolean),
    [manualQuestionText],
  )

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
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
      onSessionCreated(data)
      setRoleDescription('')
      setQuestionCount(5)
      setManualQuestionText('')
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>New Interview Session</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          <label>
            Role description
            <input
              value={roleDescription}
              onChange={(e) => setRoleDescription(e.target.value)}
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
              onChange={(e) => setQuestionCount(e.target.value)}
              required
            />
          </label>

          <label>
            Optional manual questions (one per line)
            <textarea
              value={manualQuestionText}
              onChange={(e) => setManualQuestionText(e.target.value)}
              rows={4}
            />
          </label>

          {error && <p className="error-text">{error}</p>}

          <button type="submit" className="btn btn-primary" disabled={isLoading}>
            {isLoading ? 'Generating...' : 'Generate Questions'}
          </button>
        </form>
      </div>
    </div>
  )
}
