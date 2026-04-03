# NoPassword

Client-side website for removing the current PDF password or adding a new password to an unprotected PDF.

## Run

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Notes

- Files are processed entirely in the browser.
- The app does not guess or crack passwords.
- Some PDFs require the owner password to remove protection.
- Protect mode is intended for PDFs that are not already encrypted.
