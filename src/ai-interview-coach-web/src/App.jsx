import { useCallback, useEffect, useMemo, useState } from 'react'
import './App.css'
import NewSessionModal from './components/NewSessionModal.jsx'
import AddQuestionsModal from './components/AddQuestionsModal.jsx'
import ConfirmModal from './components/ConfirmModal.jsx'
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

  if (response.status === 204) return null
  return response.json()
}

function App() {
  const [profiles, setProfiles] = useState([])
  const [activeProfile, setActiveProfile] = useState(null)
  const [showNewProfileModal, setShowNewProfileModal] = useState(false)
  const [showAddQuestionsModal, setShowAddQuestionsModal] = useState(false)
  const [profileToDelete, setProfileToDelete] = useState(null)
  const [summary, setSummary] = useState('')
  const [summaryCount, setSummaryCount] = useState(3)
  const [status, setStatus] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const answeredCount = useMemo(
    () => activeProfile?.questions.filter((q) => q.answer?.trim()).length ?? 0,
    [activeProfile],
  )

  const loadProfiles = useCallback(async () => {
    try {
      const data = await apiFetch('/api/interview/profiles')
      setProfiles(data)
    } catch {
      // keep UI interactive even when API is unavailable
    }
  }, [])

  useEffect(() => {
    loadProfiles()
  }, [loadProfiles])

  function handleProfileCreated(data) {
    const profile = {
      id: data.sessionId,
      roleDescription: data.roleDescription,
      questions: data.questions,
      isSaved: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    setProfiles((prev) => [profile, ...prev])
    setActiveProfile(profile)
    setSummary('')
    setSummaryCount(Math.min(3, data.questions.length || 1))
    setStatus('Profile created â€” questions generated.')
  }

  function handleQuestionsAdded(data) {
    setActiveProfile((prev) => ({ ...prev, questions: data.allQuestions }))
    setProfiles((prev) =>
      prev.map((p) =>
        p.id === activeProfile?.id ? { ...p, questions: data.allQuestions } : p,
      ),
    )
    setStatus(`${data.newQuestions.length} question(s) added.`)
  }

  function handleQuestionUpdated(updatedQuestion, statusMessage = 'Feedback received.') {
    setActiveProfile((prev) => ({
      ...prev,
      questions: prev.questions.map((q) => (q.id === updatedQuestion.id ? updatedQuestion : q)),
    }))
    setStatus(statusMessage)
  }

  function handleQuestionDeleted(questionId) {
    setActiveProfile((prev) => ({
      ...prev,
      questions: prev.questions.filter((q) => q.id !== questionId),
    }))
    setProfiles((prev) =>
      prev.map((p) =>
        p.id === activeProfile?.id
          ? { ...p, questions: p.questions.filter((q) => q.id !== questionId) }
          : p,
      ),
    )
  }

  async function generateSummary() {
    if (!activeProfile) return
    setIsLoading(true)
    try {
      const data = await apiFetch(`/api/interview/session/${activeProfile.id}/summary`, {
        method: 'POST',
        body: JSON.stringify({ questionsToInclude: Number(summaryCount) }),
      })
      setSummary(data)
      setStatus('Summary ready.')
    } catch (error) {
      setStatus(`Failed: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleProfileDeleted() {
    if (!profileToDelete) return
    try {
      await apiFetch(`/api/interview/session/${profileToDelete.id}`, { method: 'DELETE' })
      setProfiles((prev) => prev.filter((p) => p.id !== profileToDelete.id))
      if (activeProfile?.id === profileToDelete.id) {
        setActiveProfile(null)
        setSummary('')
        setStatus('')
      }
    } catch (error) {
      setStatus(`Failed to delete profile: ${error.message}`)
    } finally {
      setProfileToDelete(null)
    }
  }

  function selectProfile(profile) {
    setActiveProfile(profile)
    setSummary('')
    setSummaryCount(Math.min(3, profile.questions.length || 1))
    setStatus('')
  }

  return (
    <div className="app-layout">
      {/* â”€â”€ Sidebar â”€â”€ */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1 className="sidebar-title">AI Interview Coach</h1>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setShowNewProfileModal(true)}
          >
            + New Profile
          </button>
        </div>
        <div className="profile-list">
          {profiles.length === 0 ? (
            <p className="sidebar-empty">No profiles yet. Create one to get started.</p>
          ) : (
            profiles.map((p) => (
              <div
                key={p.id}
                className={`profile-item ${activeProfile?.id === p.id ? 'profile-item-active' : ''}`}
              >
                <button
                  type="button"
                  className="profile-item-btn"
                  onClick={() => selectProfile(p)}
                >
                  <span className="profile-name">{p.roleDescription}</span>
                  <span className="profile-meta">{p.questions.length} questions</span>
                </button>
                <button
                  type="button"
                  className="btn-delete-profile"
                  onClick={(e) => { e.stopPropagation(); setProfileToDelete(p) }}
                  aria-label="Delete profile"
                  title="Delete profile"
                >
                  🗑
                </button>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* â”€â”€ Main content â”€â”€ */}
      <main className="main-content">
        {!activeProfile ? (
          <div className="empty-state">
            <p>Select a profile from the sidebar or create a new one to get started.</p>
          </div>
        ) : (
          <>
            <div className="main-header">
              <div>
                <h2 className="main-title">{activeProfile.roleDescription}</h2>
                <p className="meta">
                  {answeredCount}/{activeProfile.questions.length} answered
                </p>
              </div>
              <div className="session-actions">
                <ExportButton
                  questions={activeProfile.questions}
                  roleDescription={activeProfile.roleDescription}
                />
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => setShowAddQuestionsModal(true)}
                >
                  + Add Questions
                </button>
              </div>
            </div>

            {status && <p className="status-text">{status}</p>}

            <div className="questions-list">
              {activeProfile.questions.map((q) => (
                <QuestionRow
                  key={q.id}
                  question={q}
                  sessionId={activeProfile.id}
                  apiFetch={apiFetch}
                  onQuestionUpdated={handleQuestionUpdated}
                  onDelete={handleQuestionDeleted}
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
                    max={activeProfile.questions.length || 1}
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
          </>
        )}
      </main>

      <NewSessionModal
        isOpen={showNewProfileModal}
        onClose={() => setShowNewProfileModal(false)}
        onSessionCreated={handleProfileCreated}
        apiFetch={apiFetch}
      />

      {activeProfile && (
        <AddQuestionsModal
          isOpen={showAddQuestionsModal}
          onClose={() => setShowAddQuestionsModal(false)}
          profileId={activeProfile.id}
          onQuestionsAdded={handleQuestionsAdded}
          apiFetch={apiFetch}
        />
      )}

      <ConfirmModal
        isOpen={!!profileToDelete}
        title="Delete Profile"
        message={`Are you sure you want to delete "${profileToDelete?.roleDescription}"? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={handleProfileDeleted}
        onCancel={() => setProfileToDelete(null)}
      />
    </div>
  )
}

export default App
