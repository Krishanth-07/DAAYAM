const nomineeForm = document.getElementById("nomineeForm");
const nomineeList = document.getElementById("nomineeList");
const nomineeCount = document.getElementById("nomineeCount");
const toast = document.getElementById("toast");
let toastTimer;

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  let data = {};

  try {
    data = await response.json();
  } catch (_error) {
    data = {};
  }

  if (!response.ok) {
    throw new Error(data.message || "Unable to complete request.");
  }

  return data;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function createMarkup(items, emptyMessage, renderer) {
  if (!items.length) return `<div class="empty-state">${emptyMessage}</div>`;
  return items.map(renderer).join("");
}

function renderNominees(nominees) {
  nomineeCount.textContent = nominees.length;
  nomineeList.innerHTML = createMarkup(
    nominees,
    "No nominees added yet.",
    (nominee) => `
      <article class="nominee-card">
        <div class="nominee-head">
          <div class="nominee-meta">
            <strong>${escapeHtml(nominee.name)}</strong>
            <span class="inline-detail">${escapeHtml(nominee.relation)} | ${escapeHtml(nominee.contact)}</span>
          </div>
          <span class="${nominee.verificationStatus === "verified" ? "verification-verified" : "verification-pending"} status-pill">
            ${escapeHtml(nominee.verificationStatus)}
          </span>
        </div>
        <div class="inline-detail">ID: ${escapeHtml(nominee.idType)} | ${escapeHtml(nominee.idNumber)}</div>
        <div class="verification-note">${escapeHtml(nominee.verificationNote)}</div>
        <div class="nominee-actions">
          <button class="verify-btn" data-nominee-id="${escapeHtml(nominee.id)}" ${nominee.verificationStatus === "verified" ? "disabled" : ""}>
            ${nominee.verificationStatus === "verified" ? "Verified" : "Verify Nominee"}
          </button>
        </div>
      </article>
    `
  );
}

async function loadNominees() {
  const data = await fetchJson("/assets");
  renderNominees(data.nominees || []);
}

nomineeForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = {
    name: document.getElementById("nomineeName").value.trim(),
    contact: document.getElementById("nomineeContact").value.trim(),
    relation: document.getElementById("nomineeRelation").value.trim(),
    idType: document.getElementById("nomineeIdType").value,
    idNumber: document.getElementById("nomineeIdNumber").value.trim(),
  };

  try {
    const data = await fetchJson("/add-nominee", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    nomineeForm.reset();
    showToast(data.message || "Nominee saved.");
    await loadNominees();
  } catch (error) {
    showToast(error.message || "Unable to save nominee.");
  }
});

nomineeList.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-nominee-id]");
  if (!button) return;

  try {
    const data = await fetchJson(`/verify-nominee/${button.getAttribute("data-nominee-id")}`, {
      method: "POST",
    });

    showToast(data.message || "Nominee verified.");
    await loadNominees();
  } catch (error) {
    showToast(error.message || "Unable to verify nominee.");
  }
});

loadNominees().catch((error) => {
  console.error(error);
  showToast("Unable to load nominees.");
});
