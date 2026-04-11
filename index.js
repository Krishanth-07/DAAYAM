const express = require("express");
const fs = require("fs");
const http = require("http");
const path = require("path");
const {
  claimLinks,
  checklistMap,
  sanitizeType,
  maskId,
  countVerifiedNominees,
  calculateReadiness,
  buildInsights,
  buildChecklist,
  buildFamilyAccessState,
} = require("./lib/domain");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "store.json");
const AUTH_REQUIRED = process.env.AUTH_REQUIRED === "true";
const ROLE_KEYS = {
  admin: process.env.ADMIN_KEY || "daayam-admin-demo",
  family: process.env.FAMILY_KEY || "daayam-family-demo",
};

const assets = [];
const nominees = [];
const guardians = [];
const auditLog = [];

const defaultEmergencyVerification = {
  verified: false,
  triggerType: "death",
  certificateType: "",
  certificateNumber: "",
  issuer: "",
  verifiedAt: "",
};
let emergencyVerification = { ...defaultEmergencyVerification };

const nomineeIdTypes = new Set(["Aadhaar", "PAN", "Passport", "Driver License"]);
const assetStatuses = new Set(["active", "review", "archived"]);

function createId() {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function replaceList(target, source) {
  target.splice(0, target.length, ...source);
}

function normalizeString(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

function ensureDataDir() {
  return fs.promises.mkdir(DATA_DIR, { recursive: true });
}

async function persistState() {
  await ensureDataDir();
  const payload = {
    schemaVersion: 2,
    assets,
    nominees,
    guardians,
    emergencyVerification,
    auditLog,
  };

  const tempFile = `${DATA_FILE}.tmp`;
  await fs.promises.writeFile(tempFile, JSON.stringify(payload, null, 2), "utf8");
  await fs.promises.rename(tempFile, DATA_FILE);
}

async function loadState() {
  try {
    await fs.promises.access(DATA_FILE, fs.constants.F_OK);
  } catch (_error) {
    return false;
  }

  const raw = await fs.promises.readFile(DATA_FILE, "utf8");
  const parsed = JSON.parse(raw);

  replaceList(assets, Array.isArray(parsed.assets) ? parsed.assets : []);
  replaceList(nominees, Array.isArray(parsed.nominees) ? parsed.nominees : []);
  replaceList(guardians, Array.isArray(parsed.guardians) ? parsed.guardians : []);
  replaceList(auditLog, Array.isArray(parsed.auditLog) ? parsed.auditLog : []);

  emergencyVerification = {
    ...defaultEmergencyVerification,
    ...(parsed.emergencyVerification || {}),
  };

  return true;
}

function recordAudit(action, metadata, req) {
  auditLog.unshift({
    id: createId(),
    action,
    at: new Date().toISOString(),
    actorRole: req?.header("x-daayam-role") || "anonymous",
    actorIp: req?.ip || "system",
    metadata,
  });

  if (auditLog.length > 400) {
    auditLog.length = 400;
  }
}

function toPublicNominee(nominee) {
  return {
    ...nominee,
    idNumber: maskId(nominee.idNumber),
  };
}

function requireRole(allowedRoles) {
  return (req, res, next) => {
    if (!AUTH_REQUIRED) {
      return next();
    }

    const role = req.header("x-daayam-role");
    const key = req.header("x-daayam-key");

    if (!role || !ROLE_KEYS[role]) {
      return res.status(401).json({ message: "Authentication required." });
    }

    if (key !== ROLE_KEYS[role]) {
      return res.status(401).json({ message: "Invalid access key." });
    }

    if (!allowedRoles.includes(role)) {
      return res.status(403).json({ message: "Insufficient role permissions." });
    }

    return next();
  };
}

function validateAssetPayload(body) {
  const type = sanitizeType(body.type);
  const name = normalizeString(body.name, 100);
  const provider = normalizeString(body.provider, 100);
  const value = normalizeString(body.value, 100);
  const nomineeId = normalizeString(body.nomineeId, 60);
  const status = normalizeString(body.status, 20) || "active";
  const notes = normalizeString(body.notes, 500);
  const upiApp = normalizeString(body.upiApp, 80);
  const autoDebit = Boolean(body.autoDebit);

  if (!type) {
    return { error: "Valid asset type is required." };
  }

  if (provider.length < 2) {
    return { error: "Provider or institution is required." };
  }

  if (status && !assetStatuses.has(status)) {
    return { error: "Invalid asset status." };
  }

  return {
    payload: {
      type,
      name,
      provider,
      value,
      nomineeId,
      status,
      notes,
      upiApp,
      autoDebit,
    },
  };
}

function validateNomineePayload(body) {
  const name = normalizeString(body.name, 80);
  const contact = normalizeString(body.contact, 120);
  const relation = normalizeString(body.relation, 50);
  const idType = normalizeString(body.idType, 30);
  const idNumber = normalizeString(body.idNumber, 40);

  if (name.length < 2) {
    return { error: "Name is required." };
  }

  if (contact.length < 3) {
    return { error: "Contact is required." };
  }

  if (relation.length < 2) {
    return { error: "Relation is required." };
  }

  if (!nomineeIdTypes.has(idType)) {
    return { error: "Valid ID type is required." };
  }

  if (idNumber.length < 4) {
    return { error: "ID number must be at least 4 characters." };
  }

  return {
    payload: {
      name,
      contact,
      relation,
      idType,
      idNumber,
    },
  };
}

function validateEmergencyPayload(body) {
  const triggerType = body.triggerType === "disability" ? "disability" : "death";
  const certificateNumber = normalizeString(body.certificateNumber, 60);
  const issuer = normalizeString(body.issuer, 120);

  if (certificateNumber.length < 4) {
    return { error: "Certificate number is required and must be at least 4 characters." };
  }

  if (!/^[A-Za-z0-9/-]+$/.test(certificateNumber)) {
    return { error: "Certificate number format is invalid." };
  }

  if (issuer.length < 2) {
    return { error: "Issuing authority is required." };
  }

  return {
    payload: {
      triggerType,
      certificateNumber,
      issuer,
      certificateType:
        triggerType === "disability" ? "Disability Certificate" : "Death Certificate",
    },
  };
}

function seedDemoData() {
  if (assets.length || nominees.length || guardians.length) {
    return;
  }

  const nomineeOne = {
    id: createId(),
    name: "Meera Joshi",
    contact: "+91 9876543210",
    relation: "Spouse",
    idType: "Aadhaar",
    idNumber: "XXXX-XXXX-2244",
    verificationStatus: "verified",
    verificationNote: "Family identity verified and emergency access approved.",
    createdAt: new Date().toISOString(),
  };

  const nomineeTwo = {
    id: createId(),
    name: "Arjun Joshi",
    contact: "arjun@example.com",
    relation: "Brother",
    idType: "PAN",
    idNumber: "ABCDE4321K",
    verificationStatus: "pending",
    verificationNote: "Awaiting identity proof upload.",
    createdAt: new Date().toISOString(),
  };

  nominees.push(nomineeOne, nomineeTwo);

  guardians.push({
    id: createId(),
    name: "Meera Joshi",
    relation: "Primary nominee",
    contact: nomineeOne.contact,
    releaseStatus: "approved",
  });

  assets.push(
    {
      id: createId(),
      type: "bank",
      name: "Salary Account",
      provider: "HDFC Bank",
      value: "Rs 4,80,000",
      nomineeId: nomineeOne.id,
      status: "active",
      notes: "Main salary credit account",
      discoveryStatus: "mapped",
      accessLevel: "protected",
      autoDebit: false,
      upiApp: "PhonePe",
      createdAt: new Date().toISOString(),
    },
    {
      id: createId(),
      type: "loan",
      name: "Home Loan",
      provider: "SBI Home Loans",
      value: "Rs 28,00,000 outstanding",
      nomineeId: nomineeOne.id,
      status: "active",
      notes: "EMI every 5th of month",
      discoveryStatus: "mapped",
      accessLevel: "protected",
      autoDebit: true,
      upiApp: "",
      createdAt: new Date().toISOString(),
    },
    {
      id: createId(),
      type: "insurance",
      name: "Term Life Cover",
      provider: "LIC",
      value: "Rs 1,00,00,000",
      nomineeId: nomineeOne.id,
      status: "active",
      notes: "Nominee already listed as spouse",
      discoveryStatus: "mapped",
      accessLevel: "protected",
      autoDebit: false,
      upiApp: "",
      createdAt: new Date().toISOString(),
    },
    {
      id: createId(),
      type: "subscription",
      name: "Streaming and utility subscriptions",
      provider: "Google Pay mandates",
      value: "Rs 2,899/month",
      nomineeId: "",
      status: "active",
      notes: "Three active UPI mandates detected",
      discoveryStatus: "mapped",
      accessLevel: "protected",
      autoDebit: true,
      upiApp: "Google Pay",
      createdAt: new Date().toISOString(),
    }
  );

  recordAudit("demo.seeded", { assets: assets.length, nominees: nominees.length });
}

const asyncHandler = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

app.use(express.json({ limit: "200kb" }));
app.use(express.static(path.join(__dirname, "public")));

app.get(
  "/assets",
  requireRole(["admin", "family"]),
  asyncHandler(async (req, res) => {
    const verifiedNomineeCount = countVerifiedNominees(nominees);

    res.json({
      assets,
      nominees: nominees.map(toPublicNominee),
      guardians,
      insights: buildInsights(assets, nominees),
      readinessScore: calculateReadiness(assets, nominees),
      familyAccess: buildFamilyAccessState({
        triggerType: emergencyVerification.triggerType,
        isReleased: emergencyVerification.verified,
        verifiedNomineeCount,
      }),
      emergencyVerification,
      auditTrail: auditLog.slice(0, 20),
    });
  })
);

app.post(
  "/add-asset",
  requireRole(["admin"]),
  asyncHandler(async (req, res) => {
    const result = validateAssetPayload(req.body || {});
    if (result.error) {
      return res.status(400).json({ message: result.error });
    }

    const { type, name, provider, value, nomineeId, status, notes, autoDebit, upiApp } =
      result.payload;

    if (nomineeId && !nominees.find((nominee) => nominee.id === nomineeId)) {
      return res.status(400).json({ message: "Selected nominee was not found." });
    }

    const asset = {
      id: createId(),
      type,
      name,
      provider,
      value,
      nomineeId,
      status,
      notes,
      discoveryStatus: "mapped",
      accessLevel: "protected",
      autoDebit,
      upiApp,
      createdAt: new Date().toISOString(),
    };

    assets.unshift(asset);
    recordAudit("asset.added", { id: asset.id, type: asset.type, provider: asset.provider }, req);
    await persistState();

    return res.status(201).json({
      message: "Asset added to DAAYAM protected vault.",
      asset,
    });
  })
);

app.post(
  "/add-nominee",
  requireRole(["admin"]),
  asyncHandler(async (req, res) => {
    const result = validateNomineePayload(req.body || {});
    if (result.error) {
      return res.status(400).json({ message: result.error });
    }

    const { name, contact, relation, idType, idNumber } = result.payload;

    if (nominees.some((nominee) => nominee.contact.toLowerCase() === contact.toLowerCase())) {
      return res.status(400).json({ message: "A nominee with this contact already exists." });
    }

    const nominee = {
      id: createId(),
      name,
      contact,
      relation,
      idType,
      idNumber,
      verificationStatus: "pending",
      verificationNote: "Awaiting nominee identity verification before protected access can release.",
      createdAt: new Date().toISOString(),
    };

    nominees.unshift(nominee);
    recordAudit("nominee.added", { id: nominee.id, name: nominee.name }, req);
    await persistState();

    return res.status(201).json({
      message: "Family member added. Verification is pending.",
      nominee: toPublicNominee(nominee),
    });
  })
);

app.post(
  "/verify-nominee/:id",
  requireRole(["admin"]),
  asyncHandler(async (req, res) => {
    const nominee = nominees.find((item) => item.id === req.params.id);

    if (!nominee) {
      return res.status(404).json({ message: "Nominee not found." });
    }

    nominee.verificationStatus = "verified";
    nominee.verificationNote = "Identity cross-check completed. Emergency release eligible.";
    nominee.verifiedAt = new Date().toISOString();

    if (!guardians.find((guardian) => guardian.contact === nominee.contact)) {
      guardians.push({
        id: createId(),
        name: nominee.name,
        relation: nominee.relation,
        contact: nominee.contact,
        releaseStatus: "approved",
      });
    }

    recordAudit("nominee.verified", { id: nominee.id, name: nominee.name }, req);
    await persistState();

    return res.json({
      message: `${nominee.name} verified successfully for protected access.`,
      nominee: toPublicNominee(nominee),
    });
  })
);

app.post(
  "/generate-checklist",
  requireRole(["admin", "family"]),
  asyncHandler(async (req, res) => {
    const triggerType = req.body.triggerType === "disability" ? "disability" : "death";

    if (!emergencyVerification.verified || emergencyVerification.triggerType !== triggerType) {
      return res.status(400).json({
        message:
          "Verify the death or disability event with certificate details before generating the Financial First Aid Kit.",
      });
    }

    const checklist = buildChecklist({
      triggerType,
      assets,
      nominees,
      createId,
      claimLinks,
      checklistMap,
    });

    const verifiedNomineeCount = countVerifiedNominees(nominees);
    recordAudit(
      "checklist.generated",
      { triggerType, items: checklist.length, verifiedNominees: verifiedNomineeCount },
      req
    );
    await persistState();

    return res.json({
      emergencyMode: true,
      readinessScore: calculateReadiness(assets, nominees),
      checklist,
      nomineeCount: nominees.length,
      verifiedNominees: verifiedNomineeCount,
      familyAccess: buildFamilyAccessState({
        triggerType,
        isReleased: true,
        verifiedNomineeCount,
      }),
      message:
        checklist.length > 0
          ? "Financial First Aid Kit generated for the family with actions, claims, and cancellations in the right order."
          : "No assets found yet. Add assets to generate a checklist.",
    });
  })
);

app.post(
  "/verify-emergency",
  requireRole(["admin", "family"]),
  asyncHandler(async (req, res) => {
    const result = validateEmergencyPayload(req.body || {});
    if (result.error) {
      return res.status(400).json({ message: result.error });
    }

    const { triggerType, certificateNumber, issuer, certificateType } = result.payload;

    emergencyVerification = {
      verified: true,
      triggerType,
      certificateType,
      certificateNumber,
      issuer,
      verifiedAt: new Date().toISOString(),
    };

    const verifiedNomineeCount = countVerifiedNominees(nominees);
    recordAudit(
      "emergency.verified",
      {
        triggerType,
        certificateType,
        certificateNumber: maskId(certificateNumber),
      },
      req
    );
    await persistState();

    return res.json({
      verified: true,
      triggerType,
      emergencyVerification,
      familyAccess: buildFamilyAccessState({
        triggerType,
        isReleased: true,
        verifiedNomineeCount,
      }),
      message:
        triggerType === "disability"
          ? "Verified disability event with certificate details. Protected access is now available to approved family members."
          : "Verified death event with certificate details. Protected access is now available to approved family members.",
    });
  })
);

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    service: "daayam-financial-emergency-assistant",
    time: new Date().toISOString(),
  });
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.use((error, req, res, _next) => {
  console.error("Unhandled request error:", error.message);
  res.status(500).json({
    message: "Unexpected server error. Please try again.",
  });
});

const server = http.createServer(app);
server.on("error", (error) => {
  if (error && error.code === "EADDRINUSE") {
    console.error(
      `Port ${PORT} is already in use. Stop the existing process or run with a different PORT.`
    );
    process.exit(1);
  }

  console.error("Server failed to start.");
  console.error(error.message);
  process.exit(1);
});

async function initializeState() {
  let loadedFromDisk = false;

  try {
    loadedFromDisk = await loadState();
  } catch (error) {
    console.error("Unable to load persisted state. Falling back to demo seed.");
    console.error(error.message);
  }

  if (!loadedFromDisk) {
    seedDemoData();
    await persistState();
  }
}

initializeState()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`DAAYAM server running on http://localhost:${PORT}`);
      if (AUTH_REQUIRED) {
        console.log("Authentication mode: ON (x-daayam-role + x-daayam-key required)");
      }
    });
  })
  .catch((error) => {
    console.error("Failed to initialize application state.");
    console.error(error.message);
    process.exit(1);
  });
