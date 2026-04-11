const checklistContainer = document.getElementById("checklist");
const firstAidKitSection = document.getElementById("firstAidKitSection");
const checklistMessage = document.getElementById("checklistMessage");
const verifyEmergencyBtn = document.getElementById("verifyEmergencyBtn");
const emergencyBtn = document.getElementById("emergencyBtn");
const triggerType = document.getElementById("triggerType");
const certificateNumber = document.getElementById("certificateNumber");
const certificateIssuer = document.getElementById("certificateIssuer");
const vaultStatus = document.getElementById("vaultStatus");
const releaseSummary = document.getElementById("releaseSummary");
const familyAccessList = document.getElementById("familyAccessList");
const familyCount = document.getElementById("familyCount");
const riskCount = document.getElementById("riskCount");
const readinessScore = document.getElementById("readinessScore");
const assetCount = document.getElementById("assetCount");
const nomineeCount = document.getElementById("nomineeCount");
const verifiedCount = document.getElementById("verifiedCount");
const autoDebitCount = document.getElementById("autoDebitCount");
const insightGrid = document.getElementById("insightGrid");
const toast = document.getElementById("toast");

const typeMeta = {
  bank: { label: "Bank" },
  loan: { label: "Loan" },
  insurance: { label: "Insurance" },
  subscription: { label: "Subscription" },
  verification: { label: "Verification" },
  nominee: { label: "Nominee" },
};

let dashboardState = { guardians: [] };
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

function setChecklistAvailability(isEnabled) {
  emergencyBtn.disabled = !isEnabled;
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
  if (!items.length) {
    return `<div class="empty-state">${emptyMessage}</div>`;
  }
  return items.map(renderer).join("");
}

function renderFamilyAccess(familyAccess, guardians) {
  vaultStatus.textContent = familyAccess?.vaultStatus === "released" ? "Released" : "Protected";
  releaseSummary.textContent =
    familyAccess?.releaseSummary ||
    "Vault remains protected until death or disability is verified.";
  familyCount.textContent = guardians.length;
  familyAccessList.innerHTML = createMarkup(
    guardians,
    "No approved family member yet.",
    (guardian) => `
      <div class="access-chip">
        <strong>${escapeHtml(guardian.name)}</strong>
        <span>${escapeHtml(guardian.relation)} | ${escapeHtml(guardian.releaseStatus)}</span>
      </div>
    `
  );
}

function renderInsights(insights) {
  insightGrid.innerHTML = createMarkup(
    insights,
    "Insights will appear after data loads.",
    (insight) => `
      <div class="mini-card">
        <small>${escapeHtml(insight.label)}</small>
        <strong>${escapeHtml(insight.value)}</strong>
      </div>
    `
  );
}

function renderChecklist(checklist) {
  riskCount.textContent = checklist.length;
  checklistContainer.innerHTML = createMarkup(
    checklist,
    "Generate the checklist to see the ordered action plan.",
    (entry, index) => {
      const category = typeMeta[entry.category] || { label: "Other" };
      const priority = entry.priority || "High";
      return `
      <article class="check-item">
        <div class="check-icon">${index + 1}</div>
        <div>
          <div class="tag-row">
            <span class="pill">${escapeHtml(category.label)}</span>
            <span class="priority-pill ${escapeHtml(priority.toLowerCase())}">${escapeHtml(priority)}</span>
          </div>
          <strong>${escapeHtml(entry.title)}</strong>
          <p class="subtext">${escapeHtml(entry.note)}</p>
          <div class="inline-detail">Institution: ${escapeHtml(entry.institution || "DAAYAM Vault")}</div>
          ${
            entry.link
              ? `<a class="action-link" href="${escapeHtml(entry.link)}" target="_blank" rel="noreferrer">${escapeHtml(entry.actionLabel || "Open guidance")}</a>`
              : ""
          }
        </div>
      </article>
    `;
    }
  );
}

async function loadDashboard() {
  const data = await fetchJson("/assets");
  dashboardState = data;

  readinessScore.textContent = `${data.readinessScore || 15}%`;
  assetCount.textContent = data.assets.length;
  nomineeCount.textContent = data.nominees.length;
  verifiedCount.textContent = data.nominees.filter(
    (nominee) => nominee.verificationStatus === "verified"
  ).length;
  autoDebitCount.textContent = data.assets.filter((asset) => asset.autoDebit).length;

  renderFamilyAccess(data.familyAccess, data.guardians || []);
  renderInsights(data.insights || []);
  setChecklistAvailability(Boolean(data.emergencyVerification?.verified));
}

async function verifyEmergencyRelease() {
  try {
    const data = await fetchJson("/verify-emergency", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        triggerType: triggerType.value,
        certificateNumber: certificateNumber.value.trim(),
        issuer: certificateIssuer.value.trim(),
      }),
    });

    renderFamilyAccess(data.familyAccess, dashboardState.guardians || []);
    setChecklistAvailability(true);
    showToast(data.message || "Event verified.");
  } catch (error) {
    showToast(error.message || "Unable to verify event.");
    setChecklistAvailability(false);
  }
}

async function generateChecklist() {
  try {
    const data = await fetchJson("/generate-checklist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ triggerType: triggerType.value }),
    });

    checklistMessage.textContent = `${data.message} Verified nominees: ${data.verifiedNominees}/${data.nomineeCount}.`;
    renderFamilyAccess(data.familyAccess, dashboardState.guardians || []);
    renderChecklist(data.checklist || []);
    firstAidKitSection.scrollIntoView({ behavior: "smooth", block: "start" });
    showToast("Financial First Aid Kit ready.");
  } catch (error) {
    showToast(error.message || "Unable to generate checklist.");
  }
}

verifyEmergencyBtn.addEventListener("click", verifyEmergencyRelease);
emergencyBtn.addEventListener("click", generateChecklist);

loadDashboard().catch(() => {
  showToast("Unable to load grief mode.");
});
