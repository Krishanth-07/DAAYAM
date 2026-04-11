const claimLinks = {
  bank: "https://www.rbi.org.in/commonman/English/Scripts/FAQs.aspx?Id=2749",
  insurance: "https://irdai.gov.in/",
  loan: "https://sachet.rbi.org.in/",
  subscription: "https://www.npci.org.in/what-we-do/upi/product-overview",
};

const checklistMap = {
  insurance: {
    title: "Claim insurance within 30 days",
    priority: "Critical",
    note: "Gather policy documents, nominee identity proof, and death or disability certificate.",
  },
  loan: {
    title: "Stop EMI auto-debit",
    priority: "Critical",
    note: "Inform the lender immediately, freeze auto-debit risk, and request a hardship review.",
  },
  bank: {
    title: "Start nominee settlement for bank accounts",
    priority: "High",
    note: "Prevent misuse risk and begin survivor or nominee settlement with the bank.",
  },
  subscription: {
    title: "Cancel subscriptions",
    priority: "Medium",
    note: "Stop recurring UPI mandates and subscriptions before they keep draining the account.",
  },
};

function sanitizeType(type) {
  return checklistMap[type] ? type : "";
}

function maskId(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return "";
  }

  const suffix = trimmed.slice(-4);
  return `XXXX${suffix}`;
}

function countVerifiedNominees(nominees) {
  return nominees.filter((nominee) => nominee.verificationStatus === "verified").length;
}

function calculateReadiness(assets, nominees) {
  if (!assets.length) {
    return 15;
  }

  const mappedAssets = assets.filter((asset) => asset.discoveryStatus === "mapped").length;
  const linkedAssets = assets.filter((asset) => asset.nomineeId).length;
  const verifiedNominees = countVerifiedNominees(nominees);
  const releaseReadyAssets = assets.filter((asset) => asset.accessLevel === "protected").length;

  const mappingScore = Math.round((mappedAssets / assets.length) * 30);
  const nomineeScore = nominees.length
    ? Math.round((verifiedNominees / nominees.length) * 30)
    : 0;
  const coverageScore = Math.round((linkedAssets / assets.length) * 25);
  const releaseScore = Math.round((releaseReadyAssets / assets.length) * 15);

  return Math.min(100, mappingScore + nomineeScore + coverageScore + releaseScore);
}

function buildInsights(assets, nominees) {
  const unlinkedAssets = assets.filter((asset) => !asset.nomineeId).length;
  const pendingNominees = nominees.filter(
    (nominee) => nominee.verificationStatus !== "verified"
  ).length;
  const activeAutoDebits = assets.filter((asset) => asset.autoDebit).length;

  return [
    {
      label: "Shock Protection Score",
      value: `${calculateReadiness(assets, nominees)}%`,
      tone: "primary",
    },
    {
      label: "Assets Without Nominee",
      value: String(unlinkedAssets),
      tone: unlinkedAssets ? "warning" : "success",
    },
    {
      label: "Pending Verifications",
      value: String(pendingNominees),
      tone: pendingNominees ? "warning" : "success",
    },
    {
      label: "Live Auto-Debits",
      value: String(activeAutoDebits),
      tone: activeAutoDebits ? "warning" : "success",
    },
  ];
}

function buildChecklist({ triggerType, assets, nominees, createId, claimLinks, checklistMap }) {
  const seenTypes = new Set();
  const checklist = [];

  assets.forEach((asset) => {
    if (!seenTypes.has(asset.type) && checklistMap[asset.type]) {
      seenTypes.add(asset.type);
      checklist.push({
        id: createId(),
        category: asset.type,
        title: checklistMap[asset.type].title,
        priority: checklistMap[asset.type].priority,
        note: checklistMap[asset.type].note,
        institution: asset.provider,
        link: claimLinks[asset.type],
        actionLabel:
          asset.type === "subscription"
            ? "Open cancellation guidance"
            : "Open claim guidance",
      });
    }

    if (!asset.nomineeId) {
      checklist.push({
        id: createId(),
        category: asset.type,
        title: `Assign or confirm nominee for ${asset.name || asset.provider || asset.type}`,
        priority: "High",
        note: "This asset has no nominee mapping, which can delay access for the family during a shock event.",
        institution: asset.provider,
        link: claimLinks[asset.type],
        actionLabel: "View institution guidance",
      });
    }

    if (asset.autoDebit) {
      checklist.push({
        id: createId(),
        category: asset.type,
        title: `Review auto-debit on ${asset.provider}`,
        priority: asset.type === "loan" ? "Critical" : "High",
        note: "This payment can continue even after death or disability if the family does not act.",
        institution: asset.provider,
        link: claimLinks[asset.type],
        actionLabel: "Open payment guidance",
      });
    }
  });

  nominees
    .filter((nominee) => nominee.verificationStatus !== "verified")
    .forEach((nominee) => {
      checklist.push({
        id: createId(),
        category: "verification",
        title: `Verify nominee identity for ${nominee.name}`,
        priority: "High",
        note: "Protected access should not release until nominee verification is completed.",
        institution: "DAAYAM Vault",
        link: "",
        actionLabel: "Complete verification",
      });
    });

  if (!nominees.length) {
    checklist.push({
      id: createId(),
      category: "nominee",
      title: "Add at least one verified nominee",
      priority: "Critical",
      note: "No family member is currently verified to receive emergency access.",
      institution: "DAAYAM Vault",
      link: "",
      actionLabel: "Add family member",
    });
  }

  checklist.unshift({
    id: createId(),
    category: "nominee",
    title:
      triggerType === "disability"
        ? "Start disability support release"
        : "Start family access release",
    priority: "Critical",
    note:
      triggerType === "disability"
        ? "Protected vault access is being prepared for a verified disability event."
        : "Protected vault access is being prepared for a verified death event.",
    institution: "DAAYAM Vault",
    link: "",
    actionLabel: "Review release summary",
  });

  return checklist;
}

function buildFamilyAccessState({ triggerType, isReleased, verifiedNomineeCount }) {
  return {
    triggerType,
    vaultStatus: isReleased ? "released" : "protected",
    releaseSummary: isReleased
      ? `Access released to ${verifiedNomineeCount} verified family member${
          verifiedNomineeCount === 1 ? "" : "s"
        }.`
      : "Vault remains protected until death or disability is verified.",
    releaseRequirements: [
      "Verified nominee identity",
      "Death or disability confirmation",
      "Asset to nominee mapping",
    ],
  };
}

module.exports = {
  claimLinks,
  checklistMap,
  sanitizeType,
  maskId,
  countVerifiedNominees,
  calculateReadiness,
  buildInsights,
  buildChecklist,
  buildFamilyAccessState,
};
