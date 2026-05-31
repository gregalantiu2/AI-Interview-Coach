import { useMemo, useState } from 'react'

export default function AddQuestionsModal({ isOpen, onClose, profileId, onQuestionsAdded, apiFetch }) {
  const [questionCount, setQuestionCount] = useState(3)
  const [manualQuestionText, setManualQuestionText] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const manualQuestions = useMemo(
    () => manualQuestionText.split('\n').map((q) => q.trim()).filter(Boolean),
    [manualQuestionText],
  )

  async function handleSubmit(event) {
    event.preventDefault()
    if (!profileId) return
    setError('')
    setIsLoading(true)

    try {
      const data = await apiFetch(`/api/interview/session/${profileId}/questions`, {
        method: 'POST',
        body: JSON.stringify({
          questionCount: Number(questionCount),
          manualQuestions,
        }),
      })
      onQuestionsAdded(data)
      setQuestionCount(3)
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
          <h2>Add Questions</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          <label>
            Number of AI-generated questions to add
            <input
              type="number"
              min="0"
              max="20"
              value={questionCount}
              onChange={(e) => setQuestionCount(e.target.value)}
            />
          </label>

          <label>
            Manual questions (one per line, optional)
            <textarea
              value={manualQuestionText}
              onChange={(e) => setManualQuestionText(e.target.value)}
              rows={4}
              placeholder="Type questions here, one per line..."
            />
          </label>

          {error && <p className="error-text">{error}</p>}

          <button type="submit" className="btn btn-primary" disabled={isLoading}>
            {isLoading ? 'Adding...' : 'Add Questions'}
          </button>
        </form>
      </div>
    </div>
  )
}
