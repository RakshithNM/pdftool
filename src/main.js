import './style.css';

const form = document.querySelector('#unlock-form');
const fileInput = document.querySelector('#pdf-file');
const passwordInput = document.querySelector('#password');
const confirmField = document.querySelector('#confirm-field');
const confirmPasswordInput = document.querySelector('#confirm-password');
const passwordTitle = document.querySelector('#password-title');
const fileMeta = document.querySelector('#file-meta');
const status = document.querySelector('#status');
const submitButton = document.querySelector('#submit-button');
const dropzone = document.querySelector('#dropzone');
const downloadLink = document.querySelector('#download-link');
const howItWorksCopy = document.querySelector('#how-it-works-copy');
const limitsCopy = document.querySelector('#limits-copy');
const modeButtons = Array.from(document.querySelectorAll('.mode-button'));

let downloadUrl = null;
let pdfLibPromise = null;

const modeContent = {
  unlock: {
    buttonLabel: 'Remove Password',
    busyLabel: 'Removing password…',
    idleStatus: 'Choose a protected PDF, enter the current password, and remove protection.',
    workingStatus: 'Opening the PDF in your browser and removing protection…',
    passwordTitle: 'Current PDF password',
    passwordPlaceholder: 'Enter the user or owner password',
    downloadLabel: 'Download unlocked PDF again',
    howItWorks:
      'This tool opens the document in your browser, authenticates with the password you provide, removes the PDF protection flags, and saves a new copy.',
    limits:
      'You still need the current password. If the password can only open the PDF but cannot change security settings, you will need the owner password.',
  },
  protect: {
    buttonLabel: 'Add Password',
    busyLabel: 'Protecting PDF…',
    idleStatus: 'Choose an unprotected PDF, enter a new password twice, and download the protected copy.',
    workingStatus: 'Adding password protection to the PDF in your browser…',
    passwordTitle: 'New PDF password',
    passwordPlaceholder: 'Enter the new password',
    downloadLabel: 'Download protected PDF again',
    howItWorks:
      'This tool opens the document locally in your browser, applies password protection, and saves a new PDF that asks for the password when opened.',
    limits:
      'Protect mode is for plain PDFs. If the file is already encrypted, remove the current protection first and then add the new password you want.',
  },
};

const state = {
  busy: false,
  file: null,
  mode: 'unlock',
};

function setStatus(message, tone = 'idle') {
  status.dataset.state = tone;
  status.textContent = message;
}

function formatBytes(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

function buildDownloadName(filename, suffix) {
  const trimmed = filename.trim();

  if (!trimmed) {
    return `document-${suffix}.pdf`;
  }

  if (trimmed.toLowerCase().endsWith('.pdf')) {
    return `${trimmed.slice(0, -4)}-${suffix}.pdf`;
  }

  return `${trimmed}-${suffix}.pdf`;
}

function revokeDownloadUrl() {
  if (downloadUrl) {
    URL.revokeObjectURL(downloadUrl);
    downloadUrl = null;
  }
}

function clearDownload() {
  revokeDownloadUrl();
  downloadLink.classList.add('hidden');
  downloadLink.removeAttribute('href');
  downloadLink.removeAttribute('download');
}

function updateFile(file) {
  state.file = file;

  if (!file) {
    fileMeta.textContent = 'No file selected yet.';
    return;
  }

  fileMeta.textContent = `${file.name} • ${formatBytes(file.size)}`;
}

function setBusy(nextBusy) {
  state.busy = nextBusy;
  const content = modeContent[state.mode];

  form.setAttribute('aria-busy', String(nextBusy));
  fileInput.disabled = nextBusy;
  passwordInput.disabled = nextBusy;
  confirmPasswordInput.disabled = nextBusy;
  submitButton.disabled = nextBusy;
  modeButtons.forEach((button) => {
    button.disabled = nextBusy;
  });
  submitButton.textContent = nextBusy ? content.busyLabel : content.buttonLabel;
}

function updateDownload(bytes, filename) {
  revokeDownloadUrl();
  downloadUrl = URL.createObjectURL(
    new Blob([bytes], { type: 'application/pdf' }),
  );

  downloadLink.href = downloadUrl;
  downloadLink.download = filename;
  downloadLink.textContent = modeContent[state.mode].downloadLabel;
  downloadLink.classList.remove('hidden');
  downloadLink.click();
}

function isPdfFile(file) {
  if (!file) {
    return false;
  }

  return (
    file.type === 'application/pdf' ||
    file.name.toLowerCase().endsWith('.pdf')
  );
}

function loadPdfLib() {
  if (!pdfLibPromise) {
    pdfLibPromise = import('@libpdf/core');
  }

  return pdfLibPromise;
}

function applyModeUi() {
  const content = modeContent[state.mode];
  const isProtectMode = state.mode === 'protect';

  modeButtons.forEach((button) => {
    const isActive = button.dataset.mode === state.mode;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-selected', String(isActive));
  });

  confirmField.classList.toggle('hidden', !isProtectMode);
  passwordTitle.textContent = content.passwordTitle;
  passwordInput.placeholder = content.passwordPlaceholder;
  howItWorksCopy.textContent = content.howItWorks;
  limitsCopy.textContent = content.limits;
  submitButton.textContent = content.buttonLabel;
  downloadLink.textContent = content.downloadLabel;

  passwordInput.autocomplete = isProtectMode ? 'new-password' : 'current-password';
  confirmPasswordInput.value = '';
  clearDownload();

  if (state.file) {
    setStatus(content.idleStatus, 'idle');
  } else {
    setStatus('Choose a PDF to begin.', 'idle');
  }
}

async function unlockPdf(file, password) {
  const { PDF } = await loadPdfLib();
  const bytes = new Uint8Array(await file.arrayBuffer());
  const pdf = await PDF.load(bytes);

  if (pdf.isEncrypted) {
    const result = pdf.authenticate(password);

    if (!result.authenticated) {
      throw new Error('The password is incorrect.');
    }
  }

  pdf.removeProtection();
  return pdf.save();
}

async function protectPdf(file, password) {
  const { PDF } = await loadPdfLib();
  const bytes = new Uint8Array(await file.arrayBuffer());
  const pdf = await PDF.load(bytes);

  if (pdf.isEncrypted) {
    throw new Error('This PDF is already password protected. Remove protection first.');
  }

  pdf.setProtection({
    userPassword: password,
    ownerPassword: password,
  });

  return pdf.save();
}

modeButtons.forEach((button) => {
  button.addEventListener('click', () => {
    if (state.busy || button.dataset.mode === state.mode) {
      return;
    }

    state.mode = button.dataset.mode;
    passwordInput.value = '';
    applyModeUi();
  });
});

fileInput.addEventListener('change', (event) => {
  const [file] = event.target.files ?? [];
  clearDownload();

  if (file && !isPdfFile(file)) {
    fileInput.value = '';
    updateFile(null);
    setStatus('Choose a valid PDF file.', 'error');
    return;
  }

  updateFile(file ?? null);

  if (file) {
    setStatus(modeContent[state.mode].idleStatus, 'idle');
  } else {
    setStatus('Choose a PDF to begin.', 'idle');
  }
});

['dragenter', 'dragover'].forEach((eventName) => {
  dropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    if (!state.busy) {
      dropzone.classList.add('is-dragging');
    }
  });
});

['dragleave', 'dragend', 'drop'].forEach((eventName) => {
  dropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropzone.classList.remove('is-dragging');
  });
});

dropzone.addEventListener('drop', (event) => {
  if (state.busy) {
    return;
  }

  const [file] = event.dataTransfer?.files ?? [];

  if (!file) {
    return;
  }

  if (!isPdfFile(file)) {
    updateFile(null);
    setStatus('Drop a PDF file only.', 'error');
    return;
  }

  const transfer = new DataTransfer();
  transfer.items.add(file);
  fileInput.files = transfer.files;
  updateFile(file);
  clearDownload();
  setStatus(modeContent[state.mode].idleStatus, 'idle');
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  if (state.busy) {
    return;
  }

  if (!state.file) {
    setStatus('Choose a PDF before trying to process it.', 'error');
    return;
  }

  const password = passwordInput.value;
  const confirmPassword = confirmPasswordInput.value;

  if (state.mode === 'unlock' && !password) {
    setStatus('Enter the current PDF password.', 'error');
    return;
  }

  if (state.mode === 'protect') {
    if (!password) {
      setStatus('Enter a new password for the PDF.', 'error');
      return;
    }

    if (password !== confirmPassword) {
      setStatus('The password confirmation does not match.', 'error');
      return;
    }
  }

  setBusy(true);
  setStatus(modeContent[state.mode].workingStatus, 'working');

  try {
    const bytes = state.mode === 'unlock'
      ? await unlockPdf(state.file, password)
      : await protectPdf(state.file, password);
    const outputName = buildDownloadName(
      state.file.name,
      state.mode === 'unlock' ? 'unlocked' : 'protected',
    );

    updateDownload(bytes, outputName);
    setStatus(
      state.mode === 'unlock'
        ? `Done. ${outputName} was downloaded without password protection.`
        : `Done. ${outputName} was downloaded with password protection.`,
      'success',
    );
  } catch (error) {
    const PermissionDeniedError = await loadPdfLib()
      .then((module) => module.PermissionDeniedError)
      .catch(() => null);

    if (PermissionDeniedError && error instanceof PermissionDeniedError) {
      setStatus(
        'This password can open the PDF, but it cannot change protection settings. Try the owner password.',
        'error',
      );
    } else if (error instanceof Error) {
      const lowerMessage = error.message.toLowerCase();

      if (lowerMessage.includes('incorrect password')) {
        setStatus('The password is incorrect. Check it and try again.', 'error');
      } else if (lowerMessage.includes('already password protected')) {
        setStatus(
          'This PDF already has password protection. Remove it first before adding a new password here.',
          'error',
        );
      } else {
        setStatus(`Could not process this PDF: ${error.message}`, 'error');
      }
    } else {
      setStatus('Could not process this PDF.', 'error');
    }
  } finally {
    setBusy(false);
  }
});

window.addEventListener('beforeunload', revokeDownloadUrl);

applyModeUi();
