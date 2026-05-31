import { useEffect, useRef, useState } from 'react'

export default function MockInterviewSession({ questions, audioEnabled, onComplete }) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answer, setAnswer] = useState('')
  const [collectedAnswers, setCollectedAnswers] = useState([])

  const isLast = currentIndex === questions.length - 1
  const question = questions[currentIndex]

  // Speak question via Web Speech API when it changes
  useEffect(() => {
    if (!audioEnabled || !question) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(question)
    window.speechSynthesis.speak(utterance)
  }, [question, audioEnabled])

  // Cancel any speech on unmount or when navigating away
  useEffect(() => {
    return () => window.speechSynthesis.cancel()
  }, [])

  function handleNext() {
    const updated = [...collectedAnswers, { question, answer }]
    setCollectedAnswers(updated)
    setCurrentIndex((i) => i + 1)
    setAnswer('')
  }

  function handleSubmit() {
    const finalAnswers = [...collectedAnswers, { question, answer }]
    onComplete(finalAnswers)
  }

  function handleReplay() {
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(question))
  }

  return (
    <div className="mock-session">
      <div className="mock-progress">
        <div className="mock-progress-bar">
          <div
            className="mock-progress-fill"
            style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
          />
        </div>
        <span className="mock-progress-text">
          Question {currentIndex + 1} of {questions.length}
        </span>
      </div>

      <div className="mock-question-area">
        <p className="mock-question-text">{question}</p>
        {audioEnabled && (
          <button
            type="button"
            className="btn btn-outline btn-sm mock-replay-btn"
            onClick={handleReplay}
            title="Replay question audio"
          >
            &#x1F50A; Replay
          </button>
        )}
      </div>

      <div className="mock-answer-area">
        <label>
          Your answer
          <textarea
            className="mock-answer-textarea"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Type your answer here&hellip;"
            rows={6}
          />
        </label>

        <div className="mock-session-actions">
          {isLast ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={!answer.trim()}
            >
              Submit Interview
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleNext}
              disabled={!answer.trim()}
            >
              Next Question &rarr;
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
