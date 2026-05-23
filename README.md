# Exam Practice Trainer

A React + Vite app for practicing multiple-choice exams. The app lets a user upload an exam file, parse questions and answers, edit the parsed exam, practice interactively, and review results.

## Supported Uploads

- PDF
- DOCX / Word documents

## MVP Flow

upload -> parse -> edit -> practice -> results

## Run Locally

```bash
npm install
npm run dev
```

The Vite dev server will print the local URL, usually `http://localhost:5173/`.

## Build

```bash
npm run build
```

To test the production build locally:

```bash
npm run preview
```

## Deployment Settings

- Build command: `npm run build`
- Publish directory: `dist`

## Known Limitations

- Scanned PDFs may not parse without OCR.
- Visual/code/table answers may require visual crops or manual review.
- The first detected answer is marked correct by default unless changed by the user.
