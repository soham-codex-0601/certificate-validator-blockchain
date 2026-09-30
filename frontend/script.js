/* =========================================================
   CERTICHAIN FRONTEND
========================================================= */

const API_BASE_URL = window.CERTICHAIN_API_URL || "http://127.0.0.1:8000/api";

/* =========================================================
   PDF.JS CONFIGURATION
========================================================= */

let pdfjsLib = null;

const PDF_JS_MODULE_URL =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs";

let pdfLibraryPromise = null;

/**
 * Load PDF.js only when it is actually needed.
 *
 * This keeps the normal page lightweight and means PDF.js
 * is only used when a PDF certificate is uploaded.
 */
async function loadPdfLibrary() {
  if (pdfjsLib) {
    return pdfjsLib;
  }

  if (!pdfLibraryPromise) {
    pdfLibraryPromise = import(PDF_JS_MODULE_URL)
      .then((module) => {
        pdfjsLib = module;

        /*
         * PDF.js worker is required for PDF processing.
         */
        if (pdfjsLib.GlobalWorkerOptions) {
          pdfjsLib.GlobalWorkerOptions.workerSrc =
            "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs";
        }

        return pdfjsLib;
      })
      .catch((error) => {
        pdfLibraryPromise = null;

        throw error;
      });
  }

  return pdfLibraryPromise;
}

/* =========================================================
   NAVIGATION
========================================================= */

const menuButton = document.getElementById("menuButton");

const nav = document.getElementById("nav");

if (menuButton && nav) {
  menuButton.addEventListener("click", () => {
    const open = nav.classList.toggle("open");

    menuButton.setAttribute("aria-expanded", String(open));
  });
}

document.querySelectorAll("#nav a").forEach((link) => {
  link.addEventListener("click", () => {
    nav.classList.remove("open");

    menuButton.setAttribute("aria-expanded", "false");
  });
});

/* =========================================================
   UPLOAD ELEMENTS
========================================================= */

const browseButton = document.getElementById("browseButton");

const certificateFile = document.getElementById("certificateFile");

const dropArea = document.getElementById("dropArea");

const fileName = document.getElementById("fileName");

const fileDetection = document.getElementById("fileDetection");

const certificateId = document.getElementById("certificateId");

/* =========================================================
   FILE RULES
========================================================= */

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
]);

/* =========================================================
   CERTIFICATE ID PATTERNS
========================================================= */

/*
 * CertiChain currently generates IDs such as:
 *
 * CERT-D50EC7C1AB
 * CERT-11F0A5AD80
 *
 * The regex is deliberately flexible enough to also find
 * IDs such as:
 *
 * CERT-2026-8F91A2
 * CERT-ABC123
 *
 * It is case-insensitive.
 */

const CERTIFICATE_ID_PATTERNS = [
  /\bCERT-[A-Z0-9]{6,32}\b/gi,

  /\bCERT-[A-Z0-9]+-[A-Z0-9-]{2,32}\b/gi,

  /\bCERTIFICATE[\s_-]*(?:ID|NO|NUMBER)?[\s:#-]*([A-Z0-9]+(?:-[A-Z0-9]+)+)\b/gi,
];

/* =========================================================
   BROWSE BUTTON
========================================================= */

if (browseButton && certificateFile) {
  browseButton.addEventListener("click", () => certificateFile.click());
}

/* =========================================================
   FILE SELECTION
========================================================= */

if (certificateFile) {
  certificateFile.addEventListener("change", async () => {
    const file = certificateFile.files?.[0];

    if (!file) {
      resetFileDisplay();

      return;
    }

    if (!validateFile(file)) {
      certificateFile.value = "";

      return;
    }

    await handleSelectedFile(file);
  });
}

/* =========================================================
   DRAG AND DROP
========================================================= */

if (dropArea) {
  ["dragenter", "dragover"].forEach((name) => {
    dropArea.addEventListener(name, (event) => {
      event.preventDefault();

      dropArea.classList.add("dragging");
    });
  });

  ["dragleave", "drop"].forEach((name) => {
    dropArea.addEventListener(name, (event) => {
      event.preventDefault();

      dropArea.classList.remove("dragging");
    });
  });

  dropArea.addEventListener("drop", async (event) => {
    const file = event.dataTransfer.files?.[0];

    if (!file || !validateFile(file)) {
      return;
    }

    try {
      const transfer = new DataTransfer();

      transfer.items.add(file);

      certificateFile.files = transfer.files;
    } catch {
      /*
       * Some browsers prevent programmatically
       * assigning files to an input.
       *
       * Verification still works because the
       * file remains available through this flow.
       */
    }

    await handleSelectedFile(file);
  });
}

/* =========================================================
   HANDLE SELECTED FILE
========================================================= */

async function handleSelectedFile(file) {
  fileName.textContent = `${file.name} · ${formatFileSize(file.size)}`;

  clearDetection();

  /*
   * Automatically try to find the ID.
   *
   * This currently works with PDF text.
   * For image certificates the user can still enter
   * the ID manually.
   */

  if (isPdfFile(file)) {
    await detectCertificateIdFromPdf(file);
  } else {
    setDetection(
      "For image certificates, enter the certificate ID manually.",
      "warning",
    );
  }
}

/* =========================================================
   PDF CHECK
========================================================= */

function isPdfFile(file) {
  return (
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
  );
}

/* =========================================================
   AUTOMATIC CERTIFICATE ID DETECTION
========================================================= */

async function detectCertificateIdFromPdf(file) {
  setDetection("Reading certificate ID from PDF…", "detecting");

  try {
    const pdfjs = await loadPdfLibrary();

    const arrayBuffer = await file.arrayBuffer();

    const pdf = await pdfjs.getDocument({
      data: arrayBuffer,
    }).promise;

    let fullText = "";

    /*
     * Read every page because the certificate ID
     * may appear on any page.
     */

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);

      const textContent = await page.getTextContent();

      const pageText = textContent.items
        .map((item) => item.str || "")
        .join(" ");

      fullText += ` ${pageText}`;
    }

    const detectedId = findCertificateId(fullText);

    if (detectedId) {
      certificateId.value = detectedId;

      certificateId.classList.add("auto-detected");

      setDetection(
        `Certificate ID detected automatically: ${detectedId}`,
        "success",
      );

      return;
    }

    /*
     * PDF may be scanned/image-only.
     * In that case PDF.js cannot extract text.
     */

    setDetection(
      "Certificate ID was not found in the PDF text. Please enter the ID manually.",
      "warning",
    );
  } catch (error) {
    console.error("Certificate ID detection failed:", error);

    setDetection(
      "Could not read the PDF automatically. Please enter the certificate ID manually.",
      "error",
    );
  }
}

/* =========================================================
   FIND CERTIFICATE ID
========================================================= */

function findCertificateId(text) {
  if (!text) {
    return null;
  }

  /*
   * Normalize whitespace while preserving
   * the actual certificate ID characters.
   */

  const normalized = text.replace(/\s+/g, " ").trim();

  for (const pattern of CERTIFICATE_ID_PATTERNS) {
    /*
     * Reset regex state because these regexes
     * use the global flag.
     */

    pattern.lastIndex = 0;

    const match = pattern.exec(normalized);

    if (!match) {
      continue;
    }

    /*
     * Some patterns place the actual ID in
     * capture group 1.
     */

    const candidate = match[1] || match[0];

    const cleaned = candidate
      .replace(/^(CERTIFICATE[\s_-]*(?:ID|NO|NUMBER)?[\s:#-]*)/i, "")
      .trim();

    /*
     * Make sure the final value is a proper
     * CertiChain ID.
     */

    if (/^CERT-/i.test(cleaned)) {
      return cleaned.toUpperCase();
    }

    /*
     * If the regex matched a CERTIFICATE ID label,
     * reconstruct it.
     */

    if (/^[A-Z0-9]+(?:-[A-Z0-9]+)+$/i.test(cleaned)) {
      return `CERT-${cleaned}`.toUpperCase();
    }
  }

  return null;
}

/* =========================================================
   FILE VALIDATION
========================================================= */

function validateFile(file) {
  const fileType = file.type || getMimeTypeFromExtension(file.name);

  if (!ALLOWED_TYPES.has(fileType)) {
    showResult(
      false,
      "Unsupported file type",
      "Please upload a PDF, PNG, JPG, JPEG or WEBP file.",
      "INVALID FILE",
    );

    return false;
  }

  if (file.size > MAX_FILE_SIZE) {
    showResult(
      false,
      "File is too large",
      "The maximum certificate size is 10 MB.",
      "INVALID FILE",
    );

    return false;
  }

  return true;
}

/* =========================================================
   MIME TYPE FALLBACK
========================================================= */

function getMimeTypeFromExtension(filename) {
  const extension = filename.split(".").pop()?.toLowerCase();

  const types = {
    pdf: "application/pdf",

    png: "image/png",

    jpg: "image/jpeg",

    jpeg: "image/jpeg",

    webp: "image/webp",
  };

  return types[extension] || "";
}

/* =========================================================
   DETECTION UI
========================================================= */

function setDetection(message, type = "") {
  if (!fileDetection) {
    return;
  }

  fileDetection.textContent = message;

  fileDetection.className = "file-detection";

  if (type) {
    fileDetection.classList.add(type);
  }
}

function clearDetection() {
  if (!fileDetection) {
    return;
  }

  fileDetection.textContent = "";

  fileDetection.className = "file-detection";
}

function resetFileDisplay() {
  fileName.textContent = "No file selected";

  clearDetection();

  certificateId.classList.remove("auto-detected");
}

/* =========================================================
   CERTIFICATE ID MANUAL EDIT
========================================================= */

certificateId.addEventListener("input", () => {
  /*
   * Once the user changes the automatically
   * detected ID, it is no longer marked as
   * automatically detected.
   */

  certificateId.classList.remove("auto-detected");
});

/* =========================================================
   VERIFY BUTTON
========================================================= */

const verifyButton = document.getElementById("verifyButton");

verifyButton.addEventListener("click", verifyCertificate);

certificateId.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();

    verifyCertificate();
  }
});

/* =========================================================
   MAIN VERIFICATION
========================================================= */

async function verifyCertificate() {
  const id = certificateId.value.trim();

  const file = certificateFile.files?.[0];

  /*
   * Nothing supplied.
   */

  if (!id && !file) {
    showResult(
      false,
      "Certificate information required",
      "Enter a certificate ID or upload a certificate file.",
      "MISSING",
    );

    return;
  }

  /*
   * If a file is supplied but ID could not be
   * automatically detected, we still require
   * the ID because the backend endpoint needs it.
   */

  if (file && !id) {
    showResult(
      false,
      "Certificate ID required",
      "The certificate file was uploaded, but no certificate ID was detected. Enter the ID printed on the certificate or encoded in its QR code.",
      "MISSING",
    );

    return;
  }

  setLoading(true);

  try {
    let response;

    /* =================================================
           FILE + ID VERIFICATION
        ================================================= */

    if (file) {
      const form = new FormData();

      form.append("file", file);

      form.append("certificate_id", id);

      response = await fetch(`${API_BASE_URL}/certificates/verify/file`, {
        method: "POST",
        body: form,
      });
    } else {

    /* =================================================
           ID-ONLY VERIFICATION
        ================================================= */
      response = await fetch(
        `${API_BASE_URL}/certificates/${encodeURIComponent(id)}/verify`,
        {
          method: "GET",
        },
      );
    }

    const data = await safeJson(response);

    /*
     * Backend errors.
     */

    if (!response.ok) {
      throw new Error(data.detail || data.message || "Verification failed.");
    }

    showResult(
      Boolean(data.valid),

      data.valid ? "Certificate verified" : "Certificate could not be verified",

      data.message || "Verification completed.",

      data.status || (data.valid ? "AUTHENTIC" : "NOT VERIFIED"),

      data,
    );
  } catch (error) {
    console.error("Verification error:", error);

    showResult(
      false,
      "Verification unavailable",
      error.message || "The verification service could not be reached.",
      "ERROR",
    );
  } finally {
    setLoading(false);
  }
}

/* =========================================================
   SAFE JSON
========================================================= */

async function safeJson(response) {
  const text = await response.text();

  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return {
      detail: text || "Unexpected server response.",
    };
  }
}

/* =========================================================
   RESULT DISPLAY
========================================================= */

function showResult(valid, title, message, status, data = {}) {
  const result = document.getElementById("result");

  const resultIcon = document.getElementById("resultIcon");

  const resultTitle = document.getElementById("resultTitle");

  const resultMessage = document.getElementById("resultMessage");

  const resultStatus = document.getElementById("resultStatus");

  const resultDetails = document.getElementById("resultDetails");

  result.classList.add("show");

  result.classList.toggle("invalid", !valid);

  resultIcon.textContent = valid ? "✓" : "!";

  resultTitle.textContent = title;

  resultMessage.textContent = message;

  resultStatus.textContent = status;

  const details = [];

  if (data.certificate_id) {
    details.push(`ID: ${data.certificate_id}`);
  }

  if (data.issuer_address) {
    details.push(`Issuer: ${data.issuer_address}`);
  }

  if (data.transaction_hash) {
    details.push(`Transaction: ${data.transaction_hash}`);
  }

  if (data.certificate_hash) {
    details.push(`File hash: ${data.certificate_hash}`);
  }

  if (data.blockchain_hash) {
    details.push(`Blockchain hash: ${data.blockchain_hash}`);
  }

  if (data.timestamp) {
    details.push(`Timestamp: ${formatTimestamp(data.timestamp)}`);
  }

  resultDetails.textContent = details.join(" · ");

  /*
   * Scroll the result into view on smaller screens.
   */

  setTimeout(() => {
    result.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }, 50);
}

/* =========================================================
   TIMESTAMP FORMATTER
========================================================= */

function formatTimestamp(timestamp) {
  if (timestamp === null || timestamp === undefined || timestamp === "") {
    return "";
  }

  /*
   * Keep numeric blockchain timestamps readable.
   */

  if (typeof timestamp === "number" || /^\d+$/.test(String(timestamp))) {
    const numeric = Number(timestamp);

    /*
     * Handle Unix seconds.
     */

    if (numeric < 100000000000) {
      return new Date(numeric * 1000).toLocaleString();
    }

    return new Date(numeric).toLocaleString();
  }

  return String(timestamp);
}

/* =========================================================
   LOADING STATE
========================================================= */

function setLoading(loading) {
  verifyButton.disabled = loading;

  verifyButton.innerHTML = loading ? "VERIFYING…" : "VERIFY <span>→</span>";
}

/* =========================================================
   FILE SIZE
========================================================= */

function formatFileSize(bytes) {
  if (bytes === 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB"];

  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );

  return `${(bytes / Math.pow(1024, index)).toFixed(
    index ? 1 : 0,
  )} ${units[index]}`;
}
