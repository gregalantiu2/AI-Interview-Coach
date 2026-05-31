import { useState } from 'react'

export default function AddQuestionsModal({ isOpen, onClose, profileId, onQuestionsAdded, onGenerating, apiFetch }) {
  const [questionCount, setQuestionCount] = useState(3)
  const [manualQuestionText, setManualQuestionText] = useState('')

  function handleSubmit(event) {
    event.preventDefault()
    if (!profileId) return
    const manualQuestions = manualQuestionText.split('\n').map((q) => q.trim()).filter(Boolean)
    onGenerating?.()
    onClose()
    apiFetch(`/api/interview/session/${profileId}/questions`, {
      method: 'POST',
      body: JSON.stringify({
        questionCount: Number(questionCount),
        manualQuestions,
      }),
    })
      .then(onQuestionsAdded)
      .catch(() => {})
    setQuestionCount(3)
    setManualQuestionText('')
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

          <button type="submit" className="btn btn-primary">
            Add Questions
          </button>
        </form>
      </div>
    </div>
  )
}
