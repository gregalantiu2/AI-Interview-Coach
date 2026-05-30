import { useState } from 'react'
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx'
import { saveAs } from 'file-saver'
import { jsPDF } from 'jspdf'

const FORMATS = [
  { id: 'docx', label: 'Word',       description: '.docx — Microsoft Word document', icon: '📝' },
  { id: 'pdf',  label: 'PDF',        description: '.pdf — Portable Document Format',  icon: '📄' },
  { id: 'md',   label: 'Markdown',   description: '.md — Markdown text file',         icon: '🗒️' },
  { id: 'txt',  label: 'Plain Text', description: '.txt — Plain text file',           icon: '📃' },
]

// Strip markdown syntax to plain readable text
function stripMd(text) {
  if (!text) return ''
  return text
    .replace(/#{1,6}\s+/g, '')           // headings
    .replace(/\*\*(.+?)\*\*/g, '$1')     // bold
    .replace(/\*(.+?)\*/g, '$1')         // italic
    .replace(/`{1,3}([^`]+)`{1,3}/g, '$1') // code
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links
    .replace(/^[-*+]\s+/gm, '• ')        // unordered lists
    .replace(/^\d+\.\s+/gm, (m) => m)    // keep numbered lists as-is
    .replace(/\n{3,}/g, '\n\n')          // collapse excess blank lines
    .trim()
}

export default function ExportButton({ questions, roleDescription }) {
  const [isOpen, setIsOpen] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [includeFeedback, setIncludeFeedback] = useState(true)
  const [includeTips, setIncludeTips] = useState(true)
  const title = roleDescription || 'Interview Questions'
  const filename = `interview-${Date.now()}`

  async function handleExport(formatId) {
    setIsExporting(true)
    try {
      if (formatId === 'docx') await exportDocx()
      else if (formatId === 'pdf') exportPdf()
      else if (formatId === 'md') exportMarkdown()
      else if (formatId === 'txt') exportText()
      setIsOpen(false)
    } finally {
      setIsExporting(false)
    }
  }

  async function exportDocx() {
    const children = [
      new Paragraph({ text: title, heading: HeadingLevel.HEADING_1, spacing: { after: 300 } }),
    ]
    for (const q of questions) {
      children.push(
        new Paragraph({ children: [new TextRun({ text: q.text, bold: true })], spacing: { before: 300, after: 100 } }),
      )
      if (q.answer) {
        children.push(new Paragraph({ children: [new TextRun({ text: 'Answer: ', bold: true }), new TextRun(q.answer)], spacing: { after: 100 } }))
      }
      if (includeFeedback && q.feedback) {
        children.push(new Paragraph({ children: [new TextRun({ text: 'Feedback: ', bold: true }), new TextRun(stripMd(q.feedback))], spacing: { after: 100 } }))
      }
      if (includeTips && q.tips) {
        children.push(new Paragraph({ children: [new TextRun({ text: 'Tips: ', bold: true }), new TextRun(stripMd(q.tips))], spacing: { after: 100 } }))
      }
    }
    const doc = new Document({ sections: [{ children }] })
    const blob = await Packer.toBlob(doc)
    saveAs(blob, `${filename}.docx`)
  }

  function exportPdf() {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' })
    const marginX = 50
    const pageW = doc.internal.pageSize.getWidth()
    const maxW = pageW - marginX * 2
    let y = 60

    function addText(text, opts = {}) {
      const { bold = false, size = 11, indent = 0 } = opts
      doc.setFont('helvetica', bold ? 'bold' : 'normal')
      doc.setFontSize(size)
      const lines = doc.splitTextToSize(text, maxW - indent)
      lines.forEach((line) => {
        if (y > doc.internal.pageSize.getHeight() - 50) { doc.addPage(); y = 60 }
        doc.text(line, marginX + indent, y)
        y += size * 1.5
      })
    }

    addText(title, { bold: true, size: 18 })
    y += 14

    questions.forEach((q, i) => {
      addText(`${i + 1}. ${q.text}`, { bold: true, size: 12 })
      y += 4
      if (q.answer) {
        addText('Answer:', { bold: true, size: 10 })
        addText(q.answer, { indent: 10, size: 10 })
        y += 4
      }
      if (includeFeedback && q.feedback) {
        addText('Feedback:', { bold: true, size: 10 })
        addText(stripMd(q.feedback), { indent: 10, size: 10 })
        y += 4
      }
      if (includeTips && q.tips) {
        addText('Tips:', { bold: true, size: 10 })
        addText(stripMd(q.tips), { indent: 10, size: 10 })
        y += 4
      }
      y += 10
    })

    doc.save(`${filename}.pdf`)
  }

  function exportMarkdown() {
    let md = `# ${title}\n\n`
    questions.forEach((q, i) => {
      md += `## ${i + 1}. ${q.text}\n\n`
      if (q.answer)                    md += `**Answer:**\n\n${q.answer}\n\n`
      if (includeFeedback && q.feedback) md += `**Feedback:**\n\n${q.feedback}\n\n`
      if (includeTips && q.tips)         md += `**Tips:**\n\n${q.tips}\n\n`
    })
    saveAs(new Blob([md], { type: 'text/markdown;charset=utf-8' }), `${filename}.md`)
  }

  function exportText() {
    let txt = `${title}\n${'='.repeat(title.length)}\n\n`
    questions.forEach((q, i) => {
      txt += `${i + 1}. ${q.text}\n`
      if (q.answer)                      txt += `   Answer:\n${q.answer.split('\n').map(l => `     ${l}`).join('\n')}\n`
      if (includeFeedback && q.feedback) txt += `   Feedback:\n${stripMd(q.feedback).split('\n').map(l => `     ${l}`).join('\n')}\n`
      if (includeTips && q.tips)         txt += `   Tips:\n${stripMd(q.tips).split('\n').map(l => `     ${l}`).join('\n')}\n`
      txt += '\n'
    })
    saveAs(new Blob([txt], { type: 'text/plain;charset=utf-8' }), `${filename}.txt`)
  }

  return (
    <>
      <button type="button" className="btn btn-outline btn-sm" onClick={() => setIsOpen(true)}>
        Export
      </button>

      {isOpen && (
        <div className="modal-backdrop" onClick={() => setIsOpen(false)}>
          <div className="modal export-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Export Interview</h2>
              <button type="button" className="modal-close" onClick={() => setIsOpen(false)} aria-label="Close">&#x2715;</button>
            </div>
            <div className="modal-body">
              <p className="export-subtitle">Choose a format to export <strong>{title}</strong></p>

              <div className="export-options">
                <label className="export-checkbox-label">
                  <input type="checkbox" checked={includeFeedback} onChange={(e) => setIncludeFeedback(e.target.checked)} />
                  Include Feedback
                </label>
                <label className="export-checkbox-label">
                  <input type="checkbox" checked={includeTips} onChange={(e) => setIncludeTips(e.target.checked)} />
                  Include Tips
                </label>
              </div>

              <div className="export-format-list">
                {FORMATS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className="export-format-btn"
                    onClick={() => handleExport(f.id)}
                    disabled={isExporting}
                  >
                    <span className="export-format-icon">{f.icon}</span>
                    <span className="export-format-info">
                      <span className="export-format-label">{f.label}</span>
                      <span className="export-format-desc">{f.description}</span>
                    </span>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}