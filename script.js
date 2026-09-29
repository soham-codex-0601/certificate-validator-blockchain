/* ============================================
   CERTICHAIN FRONTEND
   ============================================ */


/* ================= NAVIGATION ================= */

const menuButton =
    document.getElementById("menuButton");

const nav =
    document.getElementById("nav");


menuButton.addEventListener("click", () => {

    nav.classList.toggle("open");

});


document
    .querySelectorAll("#nav a")
    .forEach(link => {

        link.addEventListener("click", () => {

            nav.classList.remove("open");

        });

    });



/* ================= FILE UPLOAD ================= */

const browseButton =
    document.getElementById("browseButton");

const certificateFile =
    document.getElementById("certificateFile");

const dropArea =
    document.getElementById("dropArea");

const fileName =
    document.getElementById("fileName");


browseButton.addEventListener(
    "click",
    () => {

        certificateFile.click();

    }
);


certificateFile.addEventListener(
    "change",
    () => {

        if (
            certificateFile.files.length === 0
        ) {

            fileName.textContent =
                "No file selected";

            return;

        }


        const file =
            certificateFile.files[0];


        fileName.textContent =
            `${file.name} · ${formatFileSize(file.size)}`;

    }
);



/* ================= DRAG & DROP ================= */

[
    "dragenter",
    "dragover"
].forEach(eventName => {

    dropArea.addEventListener(
        eventName,
        event => {

            event.preventDefault();

            dropArea.classList.add(
                "dragging"
            );

        }
    );

});


[
    "dragleave",
    "drop"
].forEach(eventName => {

    dropArea.addEventListener(
        eventName,
        event => {

            event.preventDefault();

            dropArea.classList.remove(
                "dragging"
            );

        }
    );

});


dropArea.addEventListener(
    "drop",
    event => {

        const file =
            event.dataTransfer.files[0];


        if (!file) {
            return;
        }


        certificateFile.files =
            event.dataTransfer.files;


        fileName.textContent =
            `${file.name} · ${formatFileSize(file.size)}`;

    }
);



/* ================= VERIFICATION ================= */

const verifyButton =
    document.getElementById("verifyButton");

const certificateId =
    document.getElementById("certificateId");


const result =
    document.getElementById("result");

const resultIcon =
    document.getElementById("resultIcon");

const resultTitle =
    document.getElementById("resultTitle");

const resultMessage =
    document.getElementById("resultMessage");

const resultStatus =
    document.getElementById("resultStatus");



verifyButton.addEventListener(
    "click",
    async () => {

        const id =
            certificateId.value.trim();


        const file =
            certificateFile.files[0];


        /*
         ============================================
         TEMPORARY FRONTEND VALIDATION
         ============================================

         This is only for testing the UI.

         Later replace this with:

             fetch("/api/verify")

         and connect it with your FastAPI
         + blockchain backend.
         */


        if (!id && !file) {

            showResult(

                false,

                "Certificate information required",

                "Please upload a certificate or enter a verification ID.",

                "MISSING"

            );

            return;

        }


        /*
         DEMO BEHAVIOR

         If the ID contains:

             fake
             invalid

         the UI shows NOT VERIFIED.

         Everything else shows AUTHENTIC.

         This is NOT the actual blockchain
         verification.
        */


        const lowerId =
            id.toLowerCase();


        const fakeCertificate =
            lowerId.includes("fake") ||
            lowerId.includes("invalid");


        if (fakeCertificate) {

            showResult(

                false,

                "Certificate could not be verified",

                "No matching blockchain record was found for the supplied information.",

                "NOT VERIFIED"

            );

        }

        else {

            showResult(

                true,

                "Certificate verified",

                "The certificate record matches the blockchain entry.",

                "AUTHENTIC"

            );

        }

    }
);



/* ================= SHOW RESULT ================= */

function showResult(
    valid,
    title,
    message,
    status
) {

    result.classList.add("show");


    result.classList.toggle(
        "invalid",
        !valid
    );


    resultIcon.textContent =
        valid ? "✓" : "!";


    resultTitle.textContent =
        title;


    resultMessage.textContent =
        message;


    resultStatus.textContent =
        status;

}



/* ================= FILE SIZE ================= */

function formatFileSize(bytes) {

    if (bytes === 0) {
        return "0 B";
    }


    const units = [
        "B",
        "KB",
        "MB",
        "GB"
    ];


    const index =
        Math.floor(
            Math.log(bytes) /
            Math.log(1024)
        );


    return (
        (
            bytes /
            Math.pow(1024, index)
        ).toFixed(index ? 1 : 0)
        +
        " "
        +
        units[index]
    );

}