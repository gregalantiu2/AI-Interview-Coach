import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import NewSessionModal from './components/NewSessionModal.jsx'
import AddQuestionsModal from './components/AddQuestionsModal.jsx'
import ConfirmModal from './components/ConfirmModal.jsx'
import QuestionRow from './components/QuestionRow.jsx'
import ExportButton from './components/ExportButton.jsx'
import MockInterviewConfig from './components/MockInterviewConfig.jsx'
import MockInterviewSession from './components/MockInterviewSession.jsx'
import MockInterviewResults from './components/MockInterviewResults.jsx'

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
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('questionViewMode') ?? 'modal')
  const [summary, setSummary] = useState('')
  const [summaryCount, setSummaryCount] = useState(3)
  const [toasts, setToasts] = useState([])
  const [isLoading, setIsLoading] = useState(false)

  // Sidebar
  const [activeMode, setActiveMode] = useState('question-bank')
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false)
  const profileDropdownRef = useRef(null)

  // Mock interview
  const [mockState, setMockState] = useState('config')
  const [mockConfig, setMockConfig] = useState({ questionCount: 5, source: 'new', audioEnabled: false })
  const [mockQuestions, setMockQuestions] = useState([])
  const [mockNewQuestionTexts, setMockNewQuestionTexts] = useState([])
  const [mockAnswers, setMockAnswers] = useState([])
  const [mockFeedback, setMockFeedback] = useState(null)
  const [mockFeedbackStatus, setMockFeedbackStatus] = useState('idle')

  // Close profile dropdown when clicking outside
  useEffect(() => {
    if (!isProfileDropdownOpen) return
    function handleClickOutside(e) {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(e.target)) {
        setIsProfileDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isProfileDropdownOpen])

  function addToast(message) {
    const id = Date.now() + Math.random()
    setToasts((prev) => [...prev, { id, message }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000)
  }

  function removeToast(id) {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

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
      id: data.id,
      roleDescription: data.roleDescription,
      questions: data.questions ?? [],
      isSaved: true,
      createdAt: data.createdAt ?? new Date().toISOString(),
      updatedAt: data.updatedAt ?? new Date().toISOString(),
    }
    setProfiles((prev) => [profile, ...prev])
    setActiveProfile(profile)
    setSummary('')
    setSummaryCount(1)
    addToast('Profile created.')
  }

  function handleQuestionsAdded(data) {
    setActiveProfile((prev) => ({ ...prev, questions: data.allQuestions }))
    setProfiles((prev) =>
      prev.map((p) =>
        p.id === activeProfile?.id ? { ...p, questions: data.allQuestions } : p,
      ),
    )
    addToast(`${data.newQuestions.length} question(s) added.`)
  }

  function applyQuestionsAdded(profileId, allQuestions) {
    setProfiles((prev) =>
      prev.map((p) => (p.id === profileId ? { ...p, questions: allQuestions } : p)),
    )
    setActiveProfile((prev) =>
      prev?.id === profileId ? { ...prev, questions: allQuestions } : prev,
    )
  }

  function handleQuestionUpdated(updatedQuestion, statusMessage = 'Feedback received.') {
    setActiveProfile((prev) => ({
      ...prev,
      questions: prev.questions.map((q) => (q.id === updatedQuestion.id ? updatedQuestion : q)),
    }))
    addToast(statusMessage)
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
      addToast('Summary ready.')
    } catch (error) {
      addToast(`Failed: ${error.message}`)
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
      }
    } catch (error) {
      addToast(`Failed to delete profile: ${error.message}`)
    } finally {
      setProfileToDelete(null)
    }
  }

  function handleViewModeChange(mode) {
    setViewMode(mode)
    localStorage.setItem('questionViewMode', mode)
  }

  function selectProfile(profile) {
    setActiveProfile(profile)
    setSummary('')
    setSummaryCount(Math.min(3, profile.questions.length || 1))
    setIsProfileDropdownOpen(false)
  }

  // ── Mock interview handlers ──
  async function handleMockStart(config) {
    setMockConfig(config)
    const existingQs = activeProfile?.questions ?? []
    let questions = []
    let newQuestionTexts = []

    if (config.source === 'existing') {
      const shuffled = [...existingQs].sort(() => Math.random() - 0.5)
      questions = shuffled.slice(0, config.questionCount).map((q) => q.text)
    } else if (config.source === 'new') {
      try {
        const data = await apiFetch('/api/interview/mock/questions', {
          method: 'POST',
          body: JSON.stringify({
            roleDescription: activeProfile?.roleDescription ?? '',
            questionCount: config.questionCount,
          }),
        })
        questions = data.questions
        newQuestionTexts = data.questions
      } catch (error) {
        addToast(`Failed to generate questions: ${error.message}`)
        return
      }
    } else {
      // mix: split count between existing and new
      const existingCount = Math.min(Math.floor(config.questionCount / 2), existingQs.length)
      const newCount = config.questionCount - existingCount
      const shuffled = [...existingQs].sort(() => Math.random() - 0.5)
      const existingPicked = shuffled.slice(0, existingCount).map((q) => q.text)
      if (newCount > 0) {
        try {
          const data = await apiFetch('/api/interview/mock/questions', {
            method: 'POST',
            body: JSON.stringify({
              roleDescription: activeProfile?.roleDescription ?? '',
              questionCount: newCount,
            }),
          })
          newQuestionTexts = data.questions
          questions = [...existingPicked, ...data.questions]
        } catch (error) {
          addToast(`Failed to generate questions: ${error.message}`)
          return
        }
      } else {
        questions = existingPicked
      }
    }

    setMockQuestions(questions)
    setMockNewQuestionTexts(newQuestionTexts)
    setMockAnswers([])
    setMockFeedback(null)
    setMockFeedbackStatus('idle')
    setMockState('running')
  }

  function handleMockComplete(answers) {
    setMockAnswers(answers)
    setMockState('awaiting-feedback')
    setMockFeedbackStatus('pending')

    const profileId = activeProfile?.id
    const roleDescription = activeProfile?.roleDescription ?? ''
    const newQTexts = mockNewQuestionTexts

    // Auto-add new questions to the active profile (silent — no toast)
    if (newQTexts.length > 0 && profileId) {
      apiFetch(`/api/interview/session/${profileId}/questions`, {
        method: 'POST',
        body: JSON.stringify({ questionCount: 0, manualQuestions: newQTexts }),
      })
        .then((data) => applyQuestionsAdded(profileId, data.allQuestions))
        .catch(() => {})
    }

    // Generate feedback — non-blocking so the user can freely navigate away
    apiFetch('/api/interview/mock/feedback', {
      method: 'POST',
      body: JSON.stringify({
        roleDescription,
        answers: answers.map((a) => ({ question: a.question, answer: a.answer })),
      }),
    })
      .then((data) => {
        setMockFeedback(data)
        setMockFeedbackStatus('ready')
        setMockState('results')
        addToast('Interview feedback is ready!')
      })
      .catch((error) => {
        setMockFeedbackStatus('error')
        addToast(`Feedback failed: ${error.message}`)
      })
  }

  function handleMockReset() {
    setMockState('config')
    setMockQuestions([])
    setMockNewQuestionTexts([])
    setMockAnswers([])
    setMockFeedback(null)
    setMockFeedbackStatus('idle')
  }

  return (
    <div className="app-layout">
      {toasts.length > 0 && (
        <div className="toast-container" aria-live="polite">
          {toasts.map((t) => (
            <div key={t.id} className="toast">
              <span>{t.message}</span>
              <button type="button" className="toast-close" onClick={() => removeToast(t.id)} aria-label="Dismiss">&#x2715;</button>
            </div>
          ))}
        </div>
      )}
      {/* â”€â”€ Sidebar â”€â”€ */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1 className="sidebar-title">AI Interview Coach</h1>
        </div>

        {/* Profile picker */}
        <div className="sidebar-profile-section">
          <span className="sidebar-section-label">Profile</span>
          <div className="profile-dropdown-row">
            <div className="profile-dropdown" ref={profileDropdownRef}>
              <button
                type="button"
                className="profile-dropdown-trigger"
                onClick={() => setIsProfileDropdownOpen((v) => !v)}
                aria-haspopup="listbox"
                aria-expanded={isProfileDropdownOpen}
              >
                <span className="profile-dropdown-value">
                  {activeProfile?.roleDescription ?? (profiles.length === 0 ? 'No profiles yet' : 'Select a profile\u2026')}
                </span>
                <span className={`chevron ${isProfileDropdownOpen ? 'open' : ''}`}>&#x25BC;</span>
              </button>
              {isProfileDropdownOpen && profiles.length > 0 && (
                <div className="profile-dropdown-menu" role="listbox">
                  {profiles.map((p) => (
                    <div
                      key={p.id}
                      className={`profile-dropdown-item ${activeProfile?.id === p.id ? 'active' : ''}`}
                    >
                      <button
                        type="button"
                        className="profile-dropdown-item-btn"
                        role="option"
                        aria-selected={activeProfile?.id === p.id}
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
                        &#x1F5D1;
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button
              type="button"
              className="btn btn-primary btn-sm profile-add-btn"
              onClick={() => setShowNewProfileModal(true)}
              title="New profile"
            >
              +
            </button>
          </div>
        </div>

        {/* Mode navigation */}
        <nav className="mode-nav" aria-label="App modes">
          <button
            type="button"
            className={`mode-nav-btn ${activeMode === 'question-bank' ? 'active' : ''}`}
            onClick={() => setActiveMode('question-bank')}
          >
            <span className="mode-nav-icon">&#x1F4CB;</span>
            Question Bank
          </button>
          <button
            type="button"
            className={`mode-nav-btn ${activeMode === 'mock-interview' ? 'active' : ''}`}
            onClick={() => setActiveMode('mock-interview')}
          >
            <span className="mode-nav-icon">&#x1F3A4;</span>
            Mock Interview
            {mockFeedbackStatus === 'pending' && (
              <span className="mode-nav-spinner">
                <span className="spinner" />
              </span>
            )}
          </button>
        </nav>
      </aside>

      {/* â”€â”€ Main content â”€â”€ */}
      <main className="main-content">
        {activeMode === 'question-bank' ? (
          !activeProfile ? (
            <div className="empty-state">
              <p>Select a profile from the dropdown or create a new one to get started.</p>
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
                  <div className="view-mode-toggle" role="group" aria-label="Question view mode">
                    <span className="view-mode-label">View:</span>
                    <button
                      type="button"
                      className={`view-mode-btn ${viewMode === 'modal' ? 'active' : ''}`}
                      onClick={() => handleViewModeChange('modal')}
                    >
                      Pop-up
                    </button>
                    <button
                      type="button"
                      className={`view-mode-btn ${viewMode === 'expand' ? 'active' : ''}`}
                      onClick={() => handleViewModeChange('expand')}
                    >
                      Expand
                    </button>
                  </div>
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

              {activeProfile.questions.length === 0 ? (
                <div className="empty-bank-overlays">
                  <div className="empty-bank-callout">
                    <span className="ebc-icon">&#x1F4CB;</span>
                    <div className="ebc-body">
                      <strong>Your question bank is empty</strong>
                      <p>Click <strong>+ Add Questions</strong> above to generate AI-tailored questions based on your role, or paste your own.</p>
                    </div>
                  </div>
                  <div className="empty-bank-callout">
                    <span className="ebc-icon">&#x1F3A4;</span>
                    <div className="ebc-body">
                      <strong>Ready to jump straight into practice?</strong>
                      <p>Switch to <strong>Mock Interview</strong> in the sidebar — it can generate fresh questions on the spot, no question bank needed.</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="questions-list">
                  {activeProfile.questions.map((q) => (
                    <QuestionRow
                      key={q.id}
                      question={q}
                      sessionId={activeProfile.id}
                      apiFetch={apiFetch}
                      onQuestionUpdated={handleQuestionUpdated}
                      onDelete={handleQuestionDeleted}
                      onToast={addToast}
                      viewMode={viewMode}
                    />
                  ))}
                </div>
              )}
            </>
          )
        ) : (
          mockState === 'running' ? (
            <MockInterviewSession
              questions={mockQuestions}
              audioEnabled={mockConfig.audioEnabled}
              onComplete={handleMockComplete}
            />
          ) : mockState === 'awaiting-feedback' || mockState === 'results' ? (
            <MockInterviewResults
              feedback={mockFeedback}
              feedbackStatus={mockFeedbackStatus}
              onReset={handleMockReset}
              onGoToBank={() => setActiveMode('question-bank')}
            />
          ) : (
            <MockInterviewConfig
              activeProfile={activeProfile}
              onStart={handleMockStart}
            />
          )
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
          onGenerating={() => addToast('Generating questions… they\'ll appear shortly.')}
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
