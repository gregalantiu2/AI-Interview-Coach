import { useState } from 'react'

export default function NewSessionModal({ isOpen, onClose, onSessionCreated, apiFetch }) {
  const [roleName, setRoleName] = useState('')
  const [roleSummary, setRoleSummary] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setIsLoading(true)

    const roleDescription = roleName.trim() + (roleSummary.trim() ? '\n\n' + roleSummary.trim() : '')

    try {
      const data = await apiFetch('/api/interview/profiles', {
        method: 'POST',
        body: JSON.stringify({ roleName: roleName.trim(), roleSummary: roleSummary.trim() }),
      })
      onSessionCreated(data)
      setRoleName('')
      setRoleSummary('')
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
          <h2>New Interview Profile</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          <label>
            Role / Job Title
            <input
              value={roleName}
              onChange={(e) => setRoleName(e.target.value)}
              placeholder="e.g. Senior Backend Engineer"
              required
            />
          </label>

          <label>
            Role Summary
            <span className="label-hint">The more detail here, the better targeted your questions will be</span>
            <textarea
              value={roleSummary}
              onChange={(e) => setRoleSummary(e.target.value)}
              rows={5}
              placeholder="e.g. Focused on .NET and distributed systems, responsible for designing microservices, mentoring junior engineers..."
            />
          </label>

          {error && <p className="error-text">{error}</p>}

          <button type="submit" className="btn btn-primary" disabled={isLoading}>
            {isLoading ? 'Creating…' : 'Create Profile'}
          </button>
        </form>
      </div>
    </div>
  )
}
