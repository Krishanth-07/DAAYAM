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

function renderInsights(insights) {
  document.getElementById("insightGrid").innerHTML = createMarkup(
    insights,
    "No insights available.",
    (insight) => `
      <div class="mini-card">
        <small>${escapeHtml(insight.label)}</small>
        <strong>${escapeHtml(insight.value)}</strong>
      </div>
    `
  );
}

function renderFamilyAccess(guardians) {
  document.getElementById("familyAccessList").innerHTML = createMarkup(
    guardians,
    "No approved family member yet.",
    (guardian) => `
      <div class="access-chip">
        <strong>${escapeHtml(guardian.name)}</strong>
        <div class="inline-detail">${escapeHtml(guardian.relation)} | ${escapeHtml(guardian.releaseStatus)}</div>
      </div>
    `
  );
}

function renderAssets(assets, nominees) {
  const getNominee = (id) => nominees.find((nominee) => nominee.id === id)?.name || "Not linked";
  document.getElementById("assetList").innerHTML = createMarkup(
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
          <span class="pill">${escapeHtml(meta.icon)} ${escapeHtml(meta.label)}</span>
        </div>
        <div class="inline-detail">Value: ${escapeHtml(asset.value || "Not specified")}</div>
        <div class="inline-detail">Nominee: ${escapeHtml(getNominee(asset.nomineeId))}</div>
      </article>
    `;
    }
  );
}

function renderNominees(nominees) {
  document.getElementById("nomineeList").innerHTML = createMarkup(
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
      </article>
    `
  );
}

async function loadDashboard() {
  const data = await fetchJson("/assets");

  document.getElementById("readinessScore").textContent = `${data.readinessScore}%`;
  document.getElementById("assetCount").textContent = data.assets.length;
  document.getElementById("nomineeCount").textContent = data.nominees.length;
  document.getElementById("verifiedCount").textContent = data.nominees.filter(
    (nominee) => nominee.verificationStatus === "verified"
  ).length;
  document.getElementById("autoDebitCount").textContent = data.assets.filter(
    (asset) => asset.autoDebit
  ).length;

  renderInsights(data.insights || []);
  renderFamilyAccess(data.guardians || []);
  renderAssets(data.assets || [], data.nominees || []);
  renderNominees(data.nominees || []);
}

loadDashboard().catch((error) => {
  console.error(error);
  renderInsights([]);
  renderFamilyAccess([]);
  renderAssets([], []);
  renderNominees([]);
});
