const assetForm = document.getElementById("assetForm");
const assetList = document.getElementById("assetList");
const assetNominee = document.getElementById("assetNominee");
const assetCount = document.getElementById("assetCount");
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
  if (!items.length) return `<div class="empty-state">${emptyMessage}</div>`;
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
  return dashboardState.nominees.find((nominee) => nominee.id === id)?.name || "Not linked";
}

function renderAssets(assets) {
  assetCount.textContent = assets.length;
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
        <div class="inline-detail">Nominee: ${escapeHtml(getNomineeName(asset.nomineeId))}</div>
        <div class="inline-detail">UPI source: ${escapeHtml(asset.upiApp || "Not mapped")}</div>
      </article>
    `;
    }
  );
}

async function loadAssets() {
  const data = await fetchJson("/assets");
  dashboardState = data;
  renderNomineeOptions(data.nominees || []);
  renderAssets(data.assets || []);
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
    await loadAssets();
  } catch (error) {
    showToast(error.message || "Unable to save asset.");
  }
});

loadAssets().catch((error) => {
  console.error(error);
  showToast("Unable to load assets.");
});
