const assetForm = document.getElementById("assetForm");
const nomineeForm = document.getElementById("nomineeForm");
const assetList = document.getElementById("assetList");
const nomineeList = document.getElementById("nomineeList");
const assetCount = document.getElementById("assetCount");
const nomineeCount = document.getElementById("nomineeCount");
const verifiedCount = document.getElementById("verifiedCount");
const autoDebitCount = document.getElementById("autoDebitCount");
const assetNominee = document.getElementById("assetNominee");
const toast = document.getElementById("toast");

const typeMeta = {
  bank: { icon: "BK", label: "Bank" },
  loan: { icon: "LN", label: "Loan" },
  insurance: { icon: "IN", label: "Insurance" },
  subscription: { icon: "SB", label: "Subscription" },
};

function getTypeMeta(type) {
  return typeMeta[type] || { icon: "OT", label: "Other" };
}

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

let dashboardState = { nominees: [] };
let toastTimer;

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
  if (!items.length) {
    return `<div class="empty-state">${emptyMessage}</div>`;
  }
  return items.map(renderer).join("");
}

function renderNomineeOptions(nominees) {
  assetNominee.innerHTML = '<option value="">No nominee linked yet</option>';
  nominees.forEach((nominee) => {
    const option = document.createElement("option");
    option.value = nominee.id;
    option.textContent = `${nominee.name} (${nominee.verificationStatus})`;
    assetNominee.appendChild(option);
  });
}

function getNomineeName(id) {
  const nominee = dashboardState.nominees.find((item) => item.id === id);
  return nominee ? nominee.name : "Not linked";
}

function renderAssets(assets) {
  assetCount.textContent = assets.length;
  autoDebitCount.textContent = assets.filter((asset) => asset.autoDebit).length;
  assetList.innerHTML = createMarkup(
    assets,
    "No assets added yet.",
    (asset) => {
      const meta = getTypeMeta(asset.type);
      return `
      <article class="asset-card">
        <div class="asset-head">
          <div class="asset-meta">
            <strong>${escapeHtml(asset.name || asset.provider)}</strong>
            <span class="inline-detail">${escapeHtml(asset.provider)}</span>
          </div>
          <div class="tag-row">
            <span class="pill">${escapeHtml(meta.icon)} ${escapeHtml(meta.label)}</span>
            <span class="status-pill ${escapeHtml(asset.status)}">${escapeHtml(asset.status)}</span>
          </div>
        </div>
        <div class="inline-detail">Value: ${escapeHtml(asset.value || "Not specified")}</div>
        <div class="inline-detail">Linked nominee: ${escapeHtml(getNomineeName(asset.nomineeId))}</div>
        <div class="inline-detail">UPI source: ${escapeHtml(asset.upiApp || "Not mapped")}</div>
        <div class="inline-detail">Auto-debit risk: ${asset.autoDebit ? "Active" : "No"}</div>
      </article>
    `;
    }
  );
}

function renderNominees(nominees) {
  const verified = nominees.filter(
    (nominee) => nominee.verificationStatus === "verified"
  ).length;
  nomineeCount.textContent = nominees.length;
  verifiedCount.textContent = verified;
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
          <button
            class="verify-btn"
            data-nominee-id="${escapeHtml(nominee.id)}"
            ${nominee.verificationStatus === "verified" ? "disabled" : ""}
          >
            ${nominee.verificationStatus === "verified" ? "Verified" : "Verify Nominee"}
          </button>
        </div>
      </article>
    `
  );
}

async function loadDashboard() {
  const data = await fetchJson("/assets");
  dashboardState = data;
  renderNomineeOptions(data.nominees);
  renderAssets(data.assets);
  renderNominees(data.nominees);
}

assetForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const payload = {
    type: document.getElementById("assetType").value,
    name: document.getElementById("assetName").value.trim(),
    provider: document.getElementById("assetProvider").value.trim(),
    value: document.getElementById("assetValue").value.trim(),
    upiApp: document.getElementById("assetUpiApp").value.trim(),
    nomineeId: document.getElementById("assetNominee").value,
    status: document.getElementById("assetStatus").value,
    notes: document.getElementById("assetNotes").value.trim(),
    autoDebit: document.getElementById("assetAutoDebit").checked,
  };

  try {
    const data = await fetchJson("/add-asset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    assetForm.reset();
    showToast(data.message || "Asset saved.");
    await loadDashboard();
  } catch (error) {
    showToast(error.message || "Unable to save asset.");
  }
});

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
    await loadDashboard();
  } catch (error) {
    showToast(error.message || "Unable to save nominee.");
  }
});

nomineeList.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-nominee-id]");
  if (!button) {
    return;
  }

  try {
    const data = await fetchJson(`/verify-nominee/${button.getAttribute("data-nominee-id")}`, {
      method: "POST",
    });

    showToast(data.message || "Nominee verified.");
    await loadDashboard();
  } catch (error) {
    showToast(error.message || "Unable to verify nominee.");
  }
});

loadDashboard().catch(() => {
  showToast("Unable to load setup dashboard.");
});
