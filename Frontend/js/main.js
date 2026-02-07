/* ================= GLOBAL STATE ================= */
window.enhanceEnabled = true;
window.lastRequestedPage = "home.html";

/* ================= LOAD NAVBAR ================= */
fetch("components/navbar.html")
  .then(res => res.text())
  .then(html => {
    document.getElementById("navbar-container").innerHTML = html;
    attachNavbarEvents();
  });

/* ================= LOAD FOOTER ================= */
fetch("components/footer.html")
  .then(res => res.text())
  .then(html => {
    document.getElementById("footer-container").innerHTML = html;
  });

/* ================= NAVBAR EVENTS ================= */
function attachNavbarEvents() {
  document.querySelectorAll("[data-page]").forEach(link => {
    link.onclick = e => {
      e.preventDefault();
      const page = link.dataset.page;
      if (page) loadPage(page);
    };
  });

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

      /* 🔑 PAGE-SPECIFIC BINDINGS */
      if (page === "conversion.html") bindConversionPage();
      if (page === "history.html") bindHistoryPage();
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

/* ================= CONVERSION LOGIC ================= */
function bindConversionPage() {
  const fileInput = document.getElementById("fileInput");
  const preview = document.getElementById("previewContainer");
  const status = document.getElementById("status");
  const download = document.getElementById("downloadBtn");
  const convertBtn = document.getElementById("convertBtn");

  if (!fileInput || !convertBtn) return;

  fileInput.onchange = () => {
    preview.innerHTML = "";
    [...fileInput.files].forEach(file => {
      if (!file.type.startsWith("image/")) return;

      const reader = new FileReader();
      reader.onload = e => {
        const img = document.createElement("img");
        img.src = e.target.result;
        img.style.width = "90px";
        img.style.height = "90px";
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

  convertBtn.onclick = async () => {
    if (!fileInput.files.length) {
      status.innerHTML =
        "<span class='text-danger'>Please select images</span>";
      return;
    }

    status.innerText = "Processing images...";

    const images = [];
    for (const file of fileInput.files) {
      images.push(await toBase64(file));
    }

    status.innerText = "Sending to server...";

    fetch("http://127.0.0.1:8000/convert-to-pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        images,
        enhance: window.enhanceEnabled
      })
    })
      .then(res => res.json())
      .then(data => {
        download.href =
          "data:application/pdf;base64," + data.pdf;
        download.download = "formatforge.pdf";
        download.classList.remove("d-none");
        status.innerHTML =
          "<span class='text-success'>PDF ready for download</span>";
      })
      .catch(() => {
        status.innerHTML =
          "<span class='text-danger'>Conversion failed</span>";
      });
  };
}

/* ================= HISTORY LOGIC ================= */
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

  fetch("http://127.0.0.1:8000/history")
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
                <i class="bi bi-download"></i>
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
