import { Document, Packer, Paragraph, TextRun } from 'docx'
import { saveAs } from 'file-saver'

export default function ExportButton({ questions, roleDescription }) {
  async function exportToWord() {
    const children = []

    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: roleDescription || 'Interview Questions', bold: true, size: 32 }),
        ],
        spacing: { after: 300 },
      }),
    )

    for (const q of questions) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: `Q: ${q.text}`, bold: true })],
          spacing: { before: 200 },
        }),
      )

      children.push(
        new Paragraph({
          children: [new TextRun({ text: `A: ${q.answer || '(No answer provided)'}` })],
          spacing: { after: 200 },
        }),
      )
    }

    const doc = new Document({
      sections: [{ children }],
    })

    const blob = await Packer.toBlob(doc)
    saveAs(blob, `interview-${Date.now()}.docx`)
  }

  return (
    <button type="button" className="btn btn-outline btn-sm" onClick={exportToWord}>
      📄 Export to Word
    </button>
  )
}
