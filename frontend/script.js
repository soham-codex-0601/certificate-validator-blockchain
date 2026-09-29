const API_BASE_URL =
    window.CERTICHAIN_API_URL ||
    "http://127.0.0.1:8000/api";

const menuButton = document.getElementById("menuButton");
const nav = document.getElementById("nav");

menuButton.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    menuButton.setAttribute("aria-expanded", String(open));
});

document.querySelectorAll("#nav a").forEach(link => {
    link.addEventListener("click", () => nav.classList.remove("open"));
});

const browseButton = document.getElementById("browseButton");
const certificateFile = document.getElementById("certificateFile");
const dropArea = document.getElementById("dropArea");
const fileName = document.getElementById("fileName");

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/webp"
]);

browseButton.addEventListener("click", () => certificateFile.click());

certificateFile.addEventListener("change", () => {
    const file = certificateFile.files?.[0];
    if (!file) {
        fileName.textContent = "No file selected";
        return;
    }
    if (!validateFile(file)) {
        certificateFile.value = "";
        return;
    }
    fileName.textContent = `${file.name} · ${formatFileSize(file.size)}`;
});

["dragenter", "dragover"].forEach(name => {
    dropArea.addEventListener(name, event => {
        event.preventDefault();
        dropArea.classList.add("dragging");
    });
});

["dragleave", "drop"].forEach(name => {
    dropArea.addEventListener(name, event => {
        event.preventDefault();
        dropArea.classList.remove("dragging");
    });
});

dropArea.addEventListener("drop", event => {
    const file = event.dataTransfer.files?.[0];
    if (!file || !validateFile(file)) return;

    try {
        const transfer = new DataTransfer();
        transfer.items.add(file);
        certificateFile.files = transfer.files;
        fileName.textContent = `${file.name} · ${formatFileSize(file.size)}`;
    } catch {
        fileName.textContent = `${file.name} · ${formatFileSize(file.size)}`;
    }
});

const verifyButton = document.getElementById("verifyButton");
const certificateId = document.getElementById("certificateId");

verifyButton.addEventListener("click", verifyCertificate);

certificateId.addEventListener("keydown", event => {
    if (event.key === "Enter") verifyCertificate();
});

async function verifyCertificate() {
    const id = certificateId.value.trim();
    const file = certificateFile.files?.[0];

    if (!id && !file) {
        showResult(false, "Certificate information required",
            "Enter a certificate ID or upload a certificate file.", "MISSING");
        return;
    }

    if (file && !id) {
        showResult(false, "Certificate ID required",
            "File verification requires the certificate ID so the uploaded hash can be compared with the registered blockchain record.", "MISSING");
        return;
    }

    setLoading(true);

    try {
        let response;

        if (file) {
            const form = new FormData();
            form.append("file", file);
            form.append("certificate_id", id);

            response = await fetch(`${API_BASE_URL}/certificates/verify/file`, {
                method: "POST",
                body: form
            });
        } else {
            response = await fetch(
                `${API_BASE_URL}/certificates/${encodeURIComponent(id)}/verify`,
                { method: "GET" }
            );
        }

        const data = await safeJson(response);

        if (!response.ok) {
            throw new Error(data.detail || data.message || "Verification failed.");
        }

        showResult(
            Boolean(data.valid),
            data.valid ? "Certificate verified" : "Certificate could not be verified",
            data.message || "Verification completed.",
            data.status || (data.valid ? "AUTHENTIC" : "NOT VERIFIED"),
            data
        );
    } catch (error) {
        showResult(false, "Verification unavailable",
            error.message || "The verification service could not be reached.",
            "ERROR");
    } finally {
        setLoading(false);
    }
}

function validateFile(file) {
    if (!ALLOWED_TYPES.has(file.type)) {
        showResult(false, "Unsupported file type",
            "Please upload a PDF, PNG, JPG, JPEG or WEBP file.", "INVALID FILE");
        return false;
    }

    if (file.size > MAX_FILE_SIZE) {
        showResult(false, "File is too large",
            "The maximum certificate size is 10 MB.", "INVALID FILE");
        return false;
    }

    return true;
}

async function safeJson(response) {
    const text = await response.text();
    try {
        return text ? JSON.parse(text) : {};
    } catch {
        return { detail: text || "Unexpected server response." };
    }
}

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
    if (data.certificate_id) details.push(`ID: ${data.certificate_id}`);
    if (data.issuer_address) details.push(`Issuer: ${data.issuer_address}`);
    if (data.transaction_hash) details.push(`Transaction: ${data.transaction_hash}`);
    if (data.certificate_hash) details.push(`File hash: ${data.certificate_hash}`);
    if (data.blockchain_hash) details.push(`Blockchain hash: ${data.blockchain_hash}`);

    resultDetails.textContent = details.join(" · ");
}

function setLoading(loading) {
    verifyButton.disabled = loading;
    verifyButton.innerHTML = loading ? "VERIFYING…" : "VERIFY <span>→</span>";
}

function formatFileSize(bytes) {
    if (bytes === 0) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    const index = Math.min(
        Math.floor(Math.log(bytes) / Math.log(1024)),
        units.length - 1
    );
    return `${(bytes / Math.pow(1024, index)).toFixed(index ? 1 : 0)} ${units[index]}`;
}
