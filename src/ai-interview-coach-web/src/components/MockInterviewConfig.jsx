import { useState } from 'react'

export default function MockInterviewConfig({ activeProfile, onStart }) {
  const hasExistingQuestions = (activeProfile?.questions?.length ?? 0) > 0

  const [questionCount, setQuestionCount] = useState(5)
  const [source, setSource] = useState('new')
  const [audioEnabled, setAudioEnabled] = useState(false)
  const [voiceGender, setVoiceGender] = useState('female')
  const [isLoading, setIsLoading] = useState(false)

  const sourceOptions = [
    { value: 'new', label: 'New Questions', desc: 'AI generates fresh questions', disabled: false },
    { value: 'existing', label: 'Existing Questions', desc: 'From your Question Bank', disabled: !hasExistingQuestions },
    { value: 'mix', label: 'Mix', desc: 'Blend of new + existing', disabled: !hasExistingQuestions },
  ]

  async function handleSubmit(e) {
    e.preventDefault()
    if (!activeProfile) return
    setIsLoading(true)
    await onStart({ questionCount: Number(questionCount), source, audioEnabled, voiceGender })
    setIsLoading(false)
  }

  return (
    <form className="mock-config" onSubmit={handleSubmit}>
      <div className="mock-config-header">
        <h2>Mock Interview</h2>
        {activeProfile && (
          <p className="mock-config-role">{activeProfile.roleDescription}</p>
        )}
        {!activeProfile && (
          <p className="mock-config-role placeholder-text">Select a profile from the sidebar to begin.</p>
        )}
      </div>

      <div className="mock-config-body">
        {/* Question count */}
        <label>
          Number of questions
          <div className="mock-count-row">
            <input
              type="range"
              min={1}
              max={20}
              value={questionCount}
              onChange={(e) => setQuestionCount(e.target.value)}
              disabled={!activeProfile}
            />
            <span className="mock-count-badge">{questionCount}</span>
          </div>
        </label>

        {/* Question source */}
        <div className="mock-source-group">
          <span className="mock-source-label">Question source</span>
          <div className="mock-source-options">
            {sourceOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`mock-source-btn${source === opt.value ? ' active' : ''}${opt.disabled ? ' disabled' : ''}`}
                onClick={() => !opt.disabled && setSource(opt.value)}
                disabled={opt.disabled || !activeProfile}
                title={opt.disabled ? 'No questions in Question Bank yet' : undefined}
              >
                <span className="mock-source-btn-label">{opt.label}</span>
                <span className="mock-source-btn-desc">{opt.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Audio toggle */}
        <div className="mock-audio-label">
          <span>Audio &mdash; read questions aloud</span>
          <div className="mock-toggle-row">
            <button
              type="button"
              role="switch"
              aria-checked={audioEnabled}
              className={`mock-toggle ${audioEnabled ? 'on' : 'off'}`}
              onClick={() => setAudioEnabled((v) => !v)}
              disabled={!activeProfile}
            >
              <span className="mock-toggle-knob" />
            </button>
            <span className="mock-toggle-status">{audioEnabled ? 'On' : 'Off'}</span>
          </div>
        </div>

        {/* Voice gender — only shown when audio is enabled */}
        {audioEnabled && (
          <div className="mock-source-group">
            <span className="mock-source-label">Voice</span>
            <div className="mock-voice-options">
              {[
                { value: 'female', label: '\u2640 Female' },
                { value: 'male', label: '\u2642 Male' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`mock-voice-btn${voiceGender === opt.value ? ' active' : ''}`}
                  onClick={() => setVoiceGender(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mock-config-footer">
        <button
          type="submit"
          className="btn btn-primary"
          disabled={isLoading || !activeProfile}
        >
          {isLoading ? (
            <><span className="spinner" />Generating questions&hellip;</>
          ) : (
            'Start Mock Interview'
          )}
        </button>
      </div>
    </form>
  )
}
