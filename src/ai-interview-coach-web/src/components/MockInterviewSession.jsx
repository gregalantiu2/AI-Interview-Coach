import { useEffect, useRef, useState } from 'react'

// Voice name keywords used to guess gender from the Web Speech API voice list
const FEMALE_KEYWORDS = ['zira', 'samantha', 'victoria', 'aria', 'jenny', 'sonia', 'libby', 'natasha', 'hazel', 'susan', 'karen', 'moira', 'tessa', 'fiona', 'ava', 'allison', 'neerja', 'heera', 'female', 'woman', 'emma', 'joanna', 'ivy', 'kendra', 'kimberly', 'salli', 'nicole']
const MALE_KEYWORDS   = ['david', 'daniel', 'james', 'thomas', 'ryan', 'guy', 'davis', 'oliver', 'fred', 'mark', 'alex', 'rishi', 'reed', 'liam', 'male', 'man', 'eric', 'nathan', 'joey', 'matthew', 'justin', 'russell', 'brian', 'andrew']

function pickVoice(gender) {
  const voices = window.speechSynthesis.getVoices()
  if (!voices.length) return null
  const en = voices.filter((v) => v.lang.startsWith('en'))
  const pool = en.length ? en : voices
  const targetKw = gender === 'female' ? FEMALE_KEYWORDS : MALE_KEYWORDS
  const otherKw  = gender === 'female' ? MALE_KEYWORDS : FEMALE_KEYWORDS
  // Prefer network/online voices (usually higher quality) then local
  const sorted = [...pool].sort((a, b) => (a.localService === b.localService ? 0 : a.localService ? 1 : -1))
  // 1. Exact gender keyword match
  const exact = sorted.find((v) => targetKw.some((k) => v.name.toLowerCase().includes(k)))
  if (exact) return exact
  // 2. Any voice that doesn't match opposite-gender keywords
  const neutral = sorted.find((v) => !otherKw.some((k) => v.name.toLowerCase().includes(k)))
  if (neutral) return neutral
  // 3. Last resort
  return sorted[0] ?? null
}

export default function MockInterviewSession({ questions, audioEnabled, voiceGender = 'female', onComplete }) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answer, setAnswer] = useState('')
  const [collectedAnswers, setCollectedAnswers] = useState([])

  const isLast = currentIndex === questions.length - 1
  const question = questions[currentIndex]

  // Speak question via Web Speech API when it changes
  useEffect(() => {
    if (!audioEnabled || !question) return
    window.speechSynthesis.cancel()
    let active = true

    function speak() {
      if (!active) return
      const utterance = new SpeechSynthesisUtterance(question)
      const voice = pickVoice(voiceGender)
      if (voice) utterance.voice = voice
      utterance.rate = 0.92
      utterance.pitch = voiceGender === 'female' ? 1.05 : 0.9
      window.speechSynthesis.speak(utterance)
    }

    if (window.speechSynthesis.getVoices().length) {
      speak()
    } else {
      window.speechSynthesis.addEventListener('voiceschanged', speak, { once: true })
    }

    return () => {
      active = false
      // Remove listener in case voices hadn't loaded yet (StrictMode double-invoke)
      window.speechSynthesis.removeEventListener('voiceschanged', speak)
    }
  }, [question, audioEnabled, voiceGender])

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
    const utterance = new SpeechSynthesisUtterance(question)
    const voice = pickVoice(voiceGender)
    if (voice) utterance.voice = voice
    utterance.rate = 0.92
    utterance.pitch = voiceGender === 'female' ? 1.05 : 0.9
    window.speechSynthesis.speak(utterance)
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
