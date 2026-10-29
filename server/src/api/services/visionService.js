// AI results are advisory: a farmer and MAO Staff remain the authoritative source of report labels.
const damageTypes = ["Flood", "Drought", "Typhoon / strong wind", "Pest infestation", "Plant disease", "Nutrient deficiency", "Animal damage", "Fire", "Soil erosion", "Landslide", "Other", "No obvious damage detected", "Unknown"];
const categories = new Set(["fruit", "vegetable", "field crop", "tree crop", "ornamental plant", "livestock", "animal", "farm equipment", "tool", "person", "vehicle", "building", "general object", "non-agricultural", "unknown"]);
const cropMatchStatuses = new Set(["match", "possible match", "not listed", "not applicable", "unknown"]);
const urgencyLevels = new Set(["routine", "soon", "urgent", "unknown"]);
const healthStatuses = new Set(["healthy appearance", "possible damage", "mixed / uncertain", "not assessable"]);
const confidenceLabels = new Set(["HIGH", "MEDIUM", "LOW"]);
const damageSeverities = new Set(["Low", "Moderate", "High", "Critical", "Unknown"]);
const minimumCropConfidence = 0.7;
const thinkingLevels = new Set(["low", "medium", "high"]);
const visionRequestTimeoutMs = 25_000;
const retryableVisionStatuses = new Set([408, 429, 500, 502, 503, 504]);
const responseFieldNames = "plantIdentification identification commonName scientificName cropOrPlant plantType cropType confidenceScore confidence visibleFeatures identificationReason alternativeCandidates isPlantDetected needsClearerImage category identifiedCrops englishName filipinoName type growthStage health visualClues confidenceLevel detectedItems visibleObjects imageSummary imageQuality sceneType boundingBoxes damageConfidence possibleDamageType damageSeverity damageEvidence recommendedActions visibleSymptoms healthStatus reportRecommendation registeredCropMatch reportSuggestion urgency plantPartVisible evidenceToCapture affectedAreaEstimate affectedPlantCount possibleCauses preventionRecovery damageRegions weedsPestsProblems otherObjects unidentifiedItems".split(" ");

function geminiApiKey() {
  return String(process.env.GEMINI_API_KEY || "").trim();
}

function visionGenerationConfig(model) {
  const configuredTokens = Number(process.env.GEMINI_MAX_OUTPUT_TOKENS || 1200);
  const maxOutputTokens = Number.isFinite(configuredTokens) ? Math.min(1800, Math.max(800, Math.round(configuredTokens))) : 1200;
  const config = { responseMimeType: "application/json", maxOutputTokens };
  if (model.startsWith("gemini-3")) {
    const configuredLevel = String(process.env.GEMINI_THINKING_LEVEL || "low").toLowerCase();
    config.thinkingConfig = { thinkingLevel: thinkingLevels.has(configuredLevel) ? configuredLevel : "low" };
  } else {
    config.temperature = 0.05;
  }
  return config;
}

function visionModels(primaryModel) {
  const configuredFallbacks = String(process.env.GEMINI_FALLBACK_MODELS || "gemini-3.1-flash-lite")
    .split(",")
    .map(value => value.trim())
    .filter(Boolean);
  return [...new Set([primaryModel, ...configuredFallbacks])];
}

const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

function visionError(message, status, code) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function requestError(status) {
  if (status === 400) return visionError("Gemini could not process this image request. Try a clear JPG, PNG, or WebP photo, or ask the administrator to review the configured model.", 422, "GEMINI_INVALID_REQUEST");
  if ([401, 403].includes(status)) return visionError("Gemini did not authorize the request. Check that the server's GEMINI_API_KEY is active and has Gemini API access.", 502, "GEMINI_AUTH_ERROR");
  if (status === 404) return visionError("The configured Gemini model is unavailable. Update GEMINI_VISION_MODEL on the server, restart the server, then try again.", 502, "GEMINI_MODEL_ERROR");
  if (status === 429) return visionError("Gemini is receiving too many requests. Wait a moment and try the crop scan again.", 429, "GEMINI_RATE_LIMIT");
  if (status === 408 || status >= 500) return visionError("Gemini is temporarily unable to analyze this image. Please retry in a moment; your photo was not saved.", 503, "GEMINI_PROVIDER_UNAVAILABLE");
  return visionError("Gemini could not complete this image request. Please retry with a JPG, PNG, or WebP photo.", 502, "GEMINI_REQUEST_FAILED");
}

function networkError(error) {
  if (error?.name === "TimeoutError" || error?.name === "AbortError") return visionError("Gemini took too long to analyze the photo. Your crop photo was not saved; try again with a clear, smaller image.", 504, "GEMINI_TIMEOUT");
  return visionError("The server could not reach Gemini. Check the internet connection, then try the crop scan again. Your crop photo was not saved.", 503, "GEMINI_NETWORK_ERROR");
}

function text(value, fallback = "Unknown", limit = 120) {
  const result = String(value || "").trim().slice(0, limit);
  return result || fallback;
}

function confidenceFraction(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(1, parsed > 1 ? parsed / 100 : parsed));
}

function cleanItem(item) {
  const label = text(typeof item === "string" ? item : item?.label, "Unknown", 80);
  const category = text(typeof item === "string" ? "general object" : item?.category, "general object", 40).toLowerCase();
  return { label, category: categories.has(category) ? category : "general object", confidence: confidenceFraction(item?.confidence) };
}

function cleanCropFinding(item) {
  const confidence = confidenceFraction(item?.confidence);
  const suppliedLabel = String(item?.confidenceLevel || "").trim().toUpperCase();
  const confidenceLevel = confidenceLabels.has(suppliedLabel) ? suppliedLabel : confidence >= .8 ? "HIGH" : confidence >= .55 ? "MEDIUM" : "LOW";
  return {
    englishName: text(item?.englishName, "Unknown", 80),
    filipinoName: text(item?.filipinoName, "Unknown", 80),
    scientificName: text(item?.scientificName, "Not confirmed", 120),
    type: text(item?.type, "unknown", 40).toLowerCase(),
    growthStage: text(item?.growthStage, "unknown", 60),
    health: text(item?.health, "not assessable", 120),
    ripeness: text(item?.ripeness, "not visible", 60),
    count: text(item?.count, "not countable", 40),
    frameLocation: text(item?.frameLocation, "not specified", 80),
    visualClues: text(item?.visualClues, "No reliable visual clues returned.", 280),
    confidence,
    confidenceLevel,
  };
}

function cleanBoundingBox(item) {
  const rawBox = Array.isArray(item?.box) ? item.box : Array.isArray(item?.boundingBox) ? item.boundingBox : [];
  if (rawBox.length !== 4) return null;
  const [yMin, xMin, yMax, xMax] = rawBox.map(Number);
  if (![yMin, xMin, yMax, xMax].every(Number.isFinite) || yMin < 0 || xMin < 0 || yMax > 1000 || xMax > 1000 || yMax <= yMin || xMax <= xMin) return null;
  const confidence = confidenceFraction(item?.confidence);
  if (confidence < minimumCropConfidence) return null;
  return { label: text(item?.label, "Unknown", 80), confidence, box: [yMin, xMin, yMax, xMax] };
}

function normalizedObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const entries = Object.entries(value);
  const normalized = Object.fromEntries(entries.flatMap(([key, item]) => [[key, item], [key.toLowerCase(), item]]));
  for (const field of responseFieldNames) {
    const match = entries.find(([key]) => key.toLowerCase() === field.toLowerCase());
    if (match) normalized[field] = match[1];
  }
  return normalized;
}

function parseJsonResponse(responseText) {
  const trimmed = String(responseText || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try { return JSON.parse(trimmed); } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    try { return JSON.parse(trimmed.slice(start, end + 1)); } catch { return null; }
  }
}

function booleanValue(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (/^(true|yes|1)$/i.test(value.trim())) return true;
    if (/^(false|no|0)$/i.test(value.trim())) return false;
  }
  return fallback;
}

export function parseVisionResponse(responseText) {
  try {
    const raw = normalizedObject(parseJsonResponse(responseText));
    if (!Object.keys(raw).length) return null;
    const value = { ...raw };
    for (const key of ["identifiedcrops", "visibleobjects", "detecteditems", "boundingboxes", "damageevidence", "visiblesymptoms", "weedspestsproblems", "recommendedactions", "possiblecauses", "preventionrecovery", "damageregions", "evidencetocapture"]) {
      if (Array.isArray(value[key])) value[key] = value[key].map(normalizedObject);
    }
    const identification = normalizedObject(value.plantIdentification || value.identification || {});
    const commonName = text(identification.commonname || value.commonName || value.cropOrPlant, "", 100);
    const scientificName = text(identification.scientificname || value.scientificName, "", 140);
    const plantType = text(identification.planttype || identification.croptype || value.plantType || value.cropType, "", 60);
    const rawConfidence = Number(identification.confidencescore ?? value.confidenceScore ?? value.confidence ?? 0);
    const confidence = confidenceFraction(rawConfidence);
    const isPlantDetected = booleanValue(identification.isplantdetected ?? value.isPlantDetected, Boolean(commonName && !/^unknown( crop)?$/i.test(commonName)));
    const needsClearerImage = booleanValue(identification.needsclearerimage ?? value.needsClearerImage);
    const visibleFeatures = identification.visiblefeatures || value.visibleFeatures || [];
    const identificationReason = text(identification.identificationreason || value.identificationReason, "", 500);
    const alternatives = identification.alternativecandidates || value.alternativeCandidates || [];
    const alternativesList = Array.isArray(alternatives) ? alternatives.slice(0, 4).map(item => typeof item === "string" ? text(item, "", 100) : text(normalizedObject(item).commonname || normalizedObject(item).name, "", 100)).filter(Boolean) : [];
    const detectedItems = Array.isArray(value.detectedItems) ? value.detectedItems.slice(0, 12).map(cleanItem).filter(item => item.label !== "Unknown") : [];
    const visibleObjects = detectedItems.length ? detectedItems.map(item => item.label) : (Array.isArray(value.visibleObjects) ? value.visibleObjects.slice(0, 12).map(item => text(item, "Unknown", 80)).filter(item => item !== "Unknown") : []);
    const analysisConfidence = confidenceFraction(value.confidence ?? confidence);
    const category = categories.has(String(value.category || "").toLowerCase()) ? String(value.category).toLowerCase() : "unknown";
    const cropCategory = ["fruit", "vegetable", "field crop", "tree crop"].includes(category);
    const cropIsClear = !cropCategory || analysisConfidence >= minimumCropConfidence;
    const damageConfidence = Math.max(0, Math.min(1, Number(value.damageConfidence ?? value.confidence) || 0));
    const suppliedDamage = String(value.possibleDamageType || "").trim();
    const possibleDamageType = damageTypes.includes(suppliedDamage) && damageConfidence >= 0.55 ? suppliedDamage : "Unknown";
    const identifiedCrops = Array.isArray(value.identifiedCrops) ? value.identifiedCrops.slice(0, 12).map(cleanCropFinding).filter(item => item.englishName !== "Unknown" || item.confidenceLevel === "LOW") : [];
    const boundingBoxes = Array.isArray(value.boundingBoxes) ? value.boundingBoxes.slice(0, 12).map(cleanBoundingBox).filter(Boolean) : [];
    return {
      cropOrPlant: needsClearerImage || !isPlantDetected ? "Unknown" : commonName && !/^unknown( crop)?$/i.test(commonName) ? commonName : (cropIsClear ? text(value.cropOrPlant) : "Unknown"),
      category: category === "unknown" && isPlantDetected ? (plantType.toLowerCase().includes("tree") ? "tree crop" : ["fruit", "vegetable", "field crop"].includes(plantType.toLowerCase()) ? plantType.toLowerCase() : "field crop") : (cropIsClear ? category : "unknown"),
      scientificName: scientificName || identifiedCrops[0]?.scientificName || "",
      plantType: plantType || identifiedCrops[0]?.type || "",
      confidenceScore: Math.round(confidence * 100),
      visibleFeatures: Array.isArray(visibleFeatures) ? visibleFeatures.slice(0, 8).map(item => text(item, "", 180)).filter(Boolean) : typeof visibleFeatures === "string" ? [visibleFeatures.slice(0, 500)] : [],
      identificationReason,
      alternativeCandidates: alternativesList,
      isPlantDetected: Boolean(isPlantDetected),
      needsClearerImage: Boolean(needsClearerImage),
      identificationUncertain: Boolean(isPlantDetected && (confidence < .75 || alternativesList.length > 0 || !scientificName)),
      imageSummary: text(value.imageSummary, "No clear subject identified.", 240),
      sceneType: text(value.sceneType, "unknown", 80),
      detectedItems: detectedItems.length ? detectedItems : visibleObjects.map(label => ({ label, category: "general object", confidence: 0 })),
      identifiedCrops,
      boundingBoxes,
      weedsPestsProblems: Array.isArray(value.weedsPestsProblems) ? value.weedsPestsProblems.slice(0, 10).map(item => text(item, "", 180)).filter(Boolean) : [],
      otherObjects: Array.isArray(value.otherObjects) ? value.otherObjects.slice(0, 12).map(item => text(item, "", 160)).filter(Boolean) : [],
      unidentifiedItems: Array.isArray(value.unidentifiedItems) ? value.unidentifiedItems.slice(0, 10).map(item => text(item, "", 180)).filter(Boolean) : [],
      imageQuality: text(value.imageQuality, "Fair", 180),
      visibleObjects,
      possibleDamageType,
      damageConfidence,
      damageSeverity: possibleDamageType !== "Unknown" && possibleDamageType !== "No obvious damage detected" && damageSeverities.has(value.damageSeverity) ? value.damageSeverity : "Unknown",
      affectedAreaEstimate: text(value.affectedAreaEstimate, "Not measurable from this image", 180),
      affectedPlantCount: text(value.affectedPlantCount, "Not measurable from this image", 120),
      damageEvidence: Array.isArray(value.damageEvidence) ? value.damageEvidence.slice(0, 6).map(item => text(item, "", 180)).filter(Boolean) : [],
      possibleCauses: Array.isArray(value.possibleCauses) ? value.possibleCauses.slice(0, 4).map(item => text(item, "", 160)).filter(Boolean) : [],
      recommendedActions: Array.isArray(value.recommendedActions) ? value.recommendedActions.slice(0, 5).map(item => text(item, "", 180)).filter(Boolean) : [],
      preventionRecovery: Array.isArray(value.preventionRecovery) ? value.preventionRecovery.slice(0, 5).map(item => text(item, "", 180)).filter(Boolean) : [],
      damageRegions: Array.isArray(value.damageRegions) ? value.damageRegions.slice(0, 8).map(cleanBoundingBox).filter(Boolean) : [],
      visibleSymptoms: Array.isArray(value.visibleSymptoms) ? value.visibleSymptoms.slice(0, 8).map(item => text(item, "Unknown", 120)).filter(item => item !== "Unknown") : [],
      reportRecommendation: text(value.reportRecommendation, "Confirm the crop and damage type before submitting.", 180),
      registeredCropMatch: cropMatchStatuses.has(String(value.registeredCropMatch || "").toLowerCase()) ? String(value.registeredCropMatch).toLowerCase() : "unknown",
      reportSuggestion: text(value.reportSuggestion, "Use a clear close-up photo and confirm the crop and damage labels before submitting.", 220),
      urgency: urgencyLevels.has(String(value.urgency || "").toLowerCase()) ? String(value.urgency).toLowerCase() : "unknown",
      healthStatus: healthStatuses.has(String(value.healthStatus || "").toLowerCase()) ? String(value.healthStatus).toLowerCase() : "not assessable",
      plantPartVisible: text(value.plantPartVisible, "unknown", 60),
      growthStage: text(value.growthStage, "unknown", 80),
      evidenceToCapture: Array.isArray(value.evidenceToCapture) ? value.evidenceToCapture.slice(0, 4).map(item => text(item, "", 100)).filter(Boolean) : [],
      confidence: analysisConfidence,
      qualityCheck: needsClearerImage || (cropCategory && !cropIsClear) ? "needs_clearer_photo" : "sufficient_for_advisory",
      needsVerification: true,
      formattedReport: text(value.formattedReport, "No structured visual report was returned. Confirm the crop and damage manually before submitting.", 7000),
    };
  } catch { return null; }
}

export async function identifyCropDamage(imageBuffer, mimeType, landContext = {}) {
  const apiKey = geminiApiKey();
  if (!apiKey) return null;
  const primaryModel = String(process.env.GEMINI_VISION_MODEL || "").trim() || "gemini-3.6-flash";
  const cropTypes = Array.isArray(landContext.cropTypes) ? landContext.cropTypes.map(item => text(item, "", 60)).filter(Boolean).slice(0, 12) : [];
  const prompt = [
    "Analyze one crop or farm photo from the Philippines. Use only visible evidence; do not guess from farm records.",
    `Registered crop names are context only: ${cropTypes.join(", ") || "none provided"}.`,
    "Identify the plant before evaluating damage. Examine leaf shape and arrangement, veins, color, stems, flowers, fruits, and whole plant structure. First choose the most likely common crop or plant name when visible evidence supports one; uncertainty about exact species or scientific name is not a reason to answer Unknown. State uncertainty and give up to three plausible alternatives. Never infer from registered farm crops.",
    "Set isPlantDetected false and needsClearerImage true when there is no recognizable plant, the photo is too blurry, too dark, or shows too little of the plant. Do not invent names, confidence, features, or symptoms. Confidence is an integer from 0 to 100 based on visible evidence. Keep plant identification separate from symptoms and possible disease analysis.",
    "For damage, name only direct visible evidence. If uncertain, return Unknown. This result is advisory and needs MAO verification.",
    "Return JSON only. Keep text concise and return at most three identified crops and six concerns.",
    '{"plantIdentification":{"commonName":"most likely common crop name or Unknown","scientificName":"only if visually identifiable, else empty","plantType":"crop type","confidenceScore":0,"visibleFeatures":["only directly visible features"],"identificationReason":"brief visual reasoning","alternativeCandidates":["plausible alternatives if uncertain"],"isPlantDetected":true,"needsClearerImage":false},"cropOrPlant":"same common name","category":"fruit|vegetable|field crop|tree crop|ornamental plant|livestock|animal|farm equipment|tool|person|vehicle|building|general object|non-agricultural|unknown","imageSummary":"brief visible description","imageQuality":"Good|Fair|Poor plus reason","identifiedCrops":[{"englishName":"same common name","filipinoName":"name or Unknown","scientificName":"name only when confident","type":"crop|fruit tree|vegetable|herb|weed|ornamental|other","growthStage":"seedling|vegetative|flowering|fruiting|ripe|harvest-ready|unknown","health":"visible condition, not diagnosis","confidence":0.0,"confidenceLevel":"HIGH|MEDIUM|LOW","visualClues":"visible traits"}],"boundingBoxes":[],"weedsPestsProblems":[],"possibleDamageType":"Flood|Drought|Typhoon / strong wind|Pest infestation|Plant disease|Nutrient deficiency|Animal damage|Fire|Soil erosion|Landslide|Other|No obvious damage detected|Unknown","damageConfidence":0,"damageSeverity":"Low|Moderate|High|Critical|Unknown","damageEvidence":[],"recommendedActions":[],"visibleSymptoms":[],"healthStatus":"healthy appearance|possible damage|mixed / uncertain|not assessable","growthStage":"stage or unknown","reportRecommendation":"brief next step","confidence":0.0}'
  ].join("\n");
  const imageData = imageBuffer.toString("base64");
  const models = visionModels(primaryModel).slice(0, 2);
  let lastError;

  for (const [index, activeModel] of models.entries()) {
    try {
      const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(activeModel) + ":generateContent", {
        method: "POST",
        signal: AbortSignal.timeout(visionRequestTimeoutMs),
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: imageData } }] }],
          generationConfig: visionGenerationConfig(activeModel),
        }),
      });
      if (!response.ok) {
        const providerData = await response.json().catch(() => null);
        const providerStatus = String(providerData?.error?.status || "").slice(0, 60) || null;
        console.warn("Gemini image analysis request failed", { model: activeModel, httpStatus: response.status, providerStatus });
        const providerError = requestError(response.status);
        if (!retryableVisionStatuses.has(response.status)) throw providerError;
        lastError = providerError;
      } else {
        let data;
        try { data = await response.json(); }
        catch { throw visionError("Gemini returned an unreadable analysis. Your crop photo was not saved; try again.", 502, "GEMINI_INVALID_RESPONSE"); }
        const responseText = data.candidates?.[0]?.content?.parts?.map(part => part.text || "").join("") || "";
        const analysis = parseVisionResponse(responseText);
        if (!analysis) throw visionError("Gemini returned an incomplete crop analysis. Your crop photo was not saved; try again.", 502, "GEMINI_INVALID_RESPONSE");
        return { ...analysis, modelName: activeModel };
      }
    } catch (error) {
      const mapped = String(error?.code || "").startsWith("GEMINI_") ? error : networkError(error);
      if (["GEMINI_AUTH_ERROR", "GEMINI_INVALID_REQUEST"].includes(mapped.code)) throw mapped;
      if (mapped.code === "GEMINI_TIMEOUT" || mapped.code === "GEMINI_NETWORK_ERROR") console.warn("Gemini image analysis transport failed", { model: activeModel, error: mapped.code });
      lastError = mapped;
    }
    if (index < models.length - 1) await wait(650);
  }
  throw lastError || visionError("Agricultural image analysis is temporarily unavailable. Your crop photo was not saved; try again in a moment.", 503, "GEMINI_UNAVAILABLE");
}

export function visionProviderStatus() {
  const configured = Boolean(geminiApiKey());
  const model = String(process.env.GEMINI_VISION_MODEL || "").trim() || "gemini-3.6-flash";
  return {
    configured,
    provider: "Google Gemini Vision",
    model,
    fallbackModels: visionModels(model).slice(1),
    performance: {
      thinkingLevel: model.startsWith("gemini-3") ? visionGenerationConfig(model).thinkingConfig.thinkingLevel : "model default",
      maxOutputTokens: visionGenerationConfig(model).maxOutputTokens,
      message: "Crop scans send an optimized image and request a concise, structured response. Low reasoning is used by default for faster visual identification; results remain advisory.",
    },
    cropSpecificValidation: {
      available: false,
      message: "No labeled local crop validation dataset or measured crop-specific accuracy is registered in this system. Results are advisory and may be saved for MAO review, not treated as a validated field diagnosis.",
    },
    boundingBoxes: "Approximate model-provided crop boxes are shown only when the image boundaries are clear. They are not survey-grade measurements.",
  };
}
