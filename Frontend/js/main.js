/* ================= GLOBAL STATE ================= */
window.enhanceEnabled = true;
window.lastRequestedPage = "home.html";

/* ================= BACKEND BASE URL ================= */
/* 🔥 CHANGE THIS ONLY if backend port changes */
const API_BASE = "http://localhost:8000";

/* ================= GLOBAL SPA CLICK HANDLER ================= */
document.addEventListener("click", function (e) {
  const target = e.target.closest("[data-page]");
  if (!target) return;

  e.preventDefault();
  const page = target.getAttribute("data-page");
  if (page) loadPage(page);
});

/* ================= LOAD NAVBAR ================= */
fetch("components/navbar.html")
  .then(res => res.text())
  .then(html => {
    document.getElementById("navbar-container").innerHTML = html;
    initNavbarControls();
  });

/* ================= LOAD FOOTER ================= */
fetch("components/footer.html")
  .then(res => res.text())
  .then(html => {
    document.getElementById("footer-container").innerHTML = html;
  });

/* ================= NAVBAR CONTROLS ================= */
function initNavbarControls() {
  const enhanceBtn = document.getElementById("enhanceBtn");
  const themeBtn = document.getElementById("themeToggleBtn");

  if (enhanceBtn) {
    enhanceBtn.onclick = () => {
      window.enhanceEnabled = !window.enhanceEnabled;
      enhanceBtn.textContent =
        window.enhanceEnabled ? "Enhance: ON" : "Enhance: OFF";
    };
  }

  if (themeBtn) {
    themeBtn.onclick = () => {
      document.body.classList.toggle("theme-dark");
      document.body.classList.toggle("theme-light");
    };
  }
}

/* ================= PAGE LOADER ================= */
function loadPage(page) {
  window.lastRequestedPage = page;

  fetch(`pages/${page}`)
    .then(res => {
      if (!res.ok) throw new Error("Page not found");
      return res.text();
    })
    .then(html => {
      const container = document.getElementById("page-content");
      container.innerHTML = html;

      highlightActiveNav(page);

      requestAnimationFrame(() => {
        if (page === "conversion.html") bindConversionPage();
        if (page === "history.html") bindHistoryPage();
      });
    })
    .catch(() => {
      fetch("pages/404.html")
        .then(res => res.text())
        .then(html => {
          document.getElementById("page-content").innerHTML = html;
          highlightActiveNav(null);
        });
    });
}

/* ================= CONVERSION PAGE ================= */
function bindConversionPage() {
  const fileInput = document.getElementById("fileInput");
  const preview = document.getElementById("previewContainer");
  const status = document.getElementById("status");
  const download = document.getElementById("downloadBtn");
  const convertBtn = document.getElementById("convertBtn");
  const compressBtn = document.getElementById("compressBtn");

  if (!fileInput || !convertBtn || !compressBtn) {
    console.log("Conversion page elements not found");
    return;
  }

  preview.innerHTML = "";
  status.innerHTML = "";
  download.classList.add("d-none");

  /* ===== IMAGE PREVIEW ===== */
  fileInput.onchange = () => {
    preview.innerHTML = "";

    [...fileInput.files].forEach(file => {
      if (!file.type.startsWith("image/")) return;

      const reader = new FileReader();
      reader.onload = e => {
        const img = document.createElement("img");
        img.src = e.target.result;
        img.style.width = "80px";
        img.style.height = "80px";
        img.style.objectFit = "cover";
        img.style.borderRadius = "8px";
        img.style.border = "2px solid #fff";
        preview.appendChild(img);
      };
      reader.readAsDataURL(file);
    });
  };

  const toBase64 = file =>
    new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(file);
    });

  /* ===== CONVERT BUTTON ===== */
  convertBtn.onclick = async () => {
    const files = [...fileInput.files];

    if (!files.length) {
      status.innerHTML =
        "<span class='text-danger'>Select images only</span>";
      return;
    }

    const images = [];

    for (const file of files) {
      if (!file.type.startsWith("image/")) {
        status.innerHTML =
          "<span class='text-danger'>Convert supports images only</span>";
        return;
      }
      images.push(await toBase64(file));
    }

    status.innerText = "Converting...";

    try {
      const res = await fetch(`${API_BASE}/convert-to-pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          images,
          enhance: window.enhanceEnabled
        })
      });

      const data = await res.json();

      if (data.status !== "success") {
        status.innerHTML =
          "<span class='text-danger'>Conversion failed</span>";
        return;
      }

      download.href =
        "data:application/pdf;base64," + data.pdf;
      download.download = "converted.pdf";
      download.classList.remove("d-none");

      status.innerHTML =
        "<span class='text-success'>Conversion complete</span>";

    } catch (err) {
      console.error(err);
      status.innerHTML =
        "<span class='text-danger'>Server error</span>";
    }
  };

  /* ===== COMPRESS BUTTON ===== */
  compressBtn.onclick = async () => {
    const files = [...fileInput.files];

    if (!files.length) {
      status.innerHTML =
        "<span class='text-danger'>Select a file</span>";
      return;
    }

    status.innerText = "Compressing...";

    try {
      const base64File = await toBase64(files[0]);

      const res = await fetch(`${API_BASE}/compress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          file: base64File,
          filename: files[0].name
        })
      });

      const data = await res.json();

      if (data.status !== "success") {
        status.innerHTML =
          "<span class='text-danger'>Compression failed</span>";
        return;
      }

      download.href =
        `data:${data.mime};base64,${data.file}`;
      download.download = "compressed_" + files[0].name;
      download.classList.remove("d-none");

      status.innerHTML =
        "<span class='text-success'>Compression complete</span>";

    } catch (err) {
      console.error(err);
      status.innerHTML =
        "<span class='text-danger'>Server error</span>";
    }
  };
}

/* ================= HISTORY PAGE ================= */
function bindHistoryPage() {
  const tableBody = document.getElementById("historyTable");
  if (!tableBody) return;

  tableBody.innerHTML = `
    <tr>
      <td colspan="5" class="text-muted text-center">
        Loading history...
      </td>
    </tr>
  `;

  fetch(`${API_BASE}/history`)
    .then(res => res.json())
    .then(data => {
      tableBody.innerHTML = "";

      if (!data.length) {
        tableBody.innerHTML = `
          <tr>
            <td colspan="5" class="text-muted text-center">
              No conversion history available
            </td>
          </tr>
        `;
        return;
      }

      data.forEach((item, index) => {
        const statusBadge =
          item.status === "success"
            ? `<span class="badge bg-success">Success</span>`
            : `<span class="badge bg-danger">Failed</span>`;

        tableBody.innerHTML += `
          <tr>
            <td>${index + 1}</td>
            <td>${item.original_filename}</td>
            <td>${item.created_at}</td>
            <td>${statusBadge}</td>
            <td>
              <button class="btn btn-sm btn-outline-secondary" disabled>
                Download
              </button>
            </td>
          </tr>
        `;
      });
    })
    .catch(() => {
      tableBody.innerHTML = `
        <tr>
          <td colspan="5" class="text-danger text-center">
            Failed to load history
          </td>
        </tr>
      `;
    });
}

/* ================= ACTIVE NAV ================= */
function highlightActiveNav(page) {
  document.querySelectorAll(".nav-link").forEach(link => {
    link.classList.toggle(
      "active",
      page && link.dataset.page === page
    );
  });
}

/* ================= INITIAL LOAD ================= */
loadPage("home.html");
