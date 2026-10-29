// The crop cards cite public Philippine agricultural references. They provide
// general planning guidance only; soil tests, weather, farm records, and MAO
// advice are still required before a farm-specific recommendation is made.
const BPI_GUIDES = "https://buplant.da.gov.ph/production-guide/";
const DA_VEGETABLE_GUIDE = "https://hvcdp.da.gov.ph/wp-content/uploads/2022/05/DA-CAR-TECHNOGUIDE-IN-PRODUCTION-_-MANAGEMENT-OF-ORGANIC-HIGHLAND-VEGETABLES.pdf";
const IRRI_RICE_MANUAL = "https://www.knowledgebank.irri.org/images/docs/planting-establishment.pdf";
const IRRI_RICE_FERTILIZER = "https://www.knowledgebank.irri.org/pinoyrkb/QuickGuide/english/Region%205/Masbate/Quick%20guide%20for%20fertilizing%20direct-seeded%20rice%20in%20the%20wet%20and%20dry%20season%20in%20Masbate.pdf";

const cropProfiles = [
  {
    names: ["rice", "palay"],
    commonName: "Rice (Palay)", scientificName: "Oryza sativa",
    plantingAndHarvest: "Plan planting around the local irrigation and rainfall schedule. Crop duration and harvest timing depend on the selected variety and establishment method.",
    soil: "A levelled, well-prepared rice field supports even water coverage and crop establishment.",
    watering: "Keep water management matched to the crop stage and local irrigation availability. Do not use a generic water schedule when the field conditions are unknown.",
    sunlight: "Use an open field with adequate direct sunlight.",
    fertilizer: "Use a soil- and location-specific nutrient plan. The cited quick guide is only for the stated conditions; consult MAO, PhilRice, or Nutrient Manager for Rice for a field-specific plan.",
    practices: ["Use the registered land record to confirm the crop and location.", "Keep the field level where appropriate to improve water coverage.", "Inspect for visible symptoms and confirm any pest or disease finding with MAO before treatment."],
    sources: [{ label: "IRRI Rice Production Manual", url: IRRI_RICE_MANUAL }, { label: "IRRI/DA rice nutrient guide", url: IRRI_RICE_FERTILIZER }],
  },
  {
    names: ["corn", "maize", "mais"],
    commonName: "Corn (Mais)", scientificName: "Zea mays",
    plantingAndHarvest: "Choose planting and harvest dates from the seed label, local rainfall pattern, water availability, and MAO crop calendar. The image cannot verify a variety or maturity date.",
    soil: "Confirm soil suitability with a local soil assessment before making amendments.",
    watering: "Avoid moisture stress, especially during key reproductive stages. Set the schedule from field moisture and local weather, not image analysis alone.",
    sunlight: "Use an open site with adequate direct sunlight.",
    fertilizer: "Base nutrients and application timing on a soil test, expected yield, and the locally recommended production guide.",
    practices: ["Record the seed variety and planting date in the farm record.", "Inspect leaves, stems, and ears separately when diagnosing crop health.", "Ask MAO for site-specific guidance before applying inputs."],
    sources: [{ label: "DA National Color-Coded Agricultural Guide", url: "https://amia.da.gov.ph/national-color-coded-agricultural-guide-nccag-map/" }, { label: "DA crop production manuals", url: BPI_GUIDES }],
  },
  {
    names: ["eggplant", "talong"],
    commonName: "Eggplant (Talong)", scientificName: "Solanum melongena",
    plantingAndHarvest: "Use the variety label and local production schedule to set planting and harvest dates; a photo cannot establish either reliably.",
    soil: "Use a well-managed production area and confirm soil amendments with a soil assessment.",
    watering: "Keep water supply consistent; adjust for rainfall and field drainage.",
    sunlight: "Grow in adequate direct sunlight.",
    fertilizer: "Use compost or fertilizer according to a soil-based plan and the local production guide.",
    practices: ["Capture both healthy and affected leaves before diagnosing a problem.", "Remove only confirmed diseased material using MAO guidance.", "Do not choose pesticides from an image result alone."],
    sources: [{ label: "BPI eggplant production guide", url: BPI_GUIDES }, { label: "DA vegetable production guide", url: DA_VEGETABLE_GUIDE }],
  },
  {
    names: ["tomato", "kamatis"],
    commonName: "Tomato (Kamatis)", scientificName: "Solanum lycopersicum",
    plantingAndHarvest: "Use the seed label and local cropping calendar. A camera image does not confirm variety, planting date, or harvest date.",
    soil: "Use a site with suitable drainage and verify nutrient needs through soil information.",
    watering: "Provide clean water and adjust irrigation for rainfall, crop stage, and drainage.",
    sunlight: "Grow in adequate direct sunlight.",
    fertilizer: "Apply nutrients from a soil-based plan and local technical guide.",
    practices: ["Monitor flowers and fruit separately from leaf symptoms.", "Use clear close-up photos for any suspected pest or disease.", "Confirm disease management with MAO before treatment."],
    sources: [{ label: "BPI production guides", url: BPI_GUIDES }, { label: "DA vegetable production guide", url: DA_VEGETABLE_GUIDE }],
  },
  {
    names: ["banana", "saging", "cardaba"],
    commonName: "Banana (Saging)", scientificName: "Musa spp.",
    plantingAndHarvest: "Record cultivar and planting date separately. A single image cannot reliably identify the cultivar or harvest schedule.",
    soil: "Use the local banana production guide and a soil assessment for site preparation.",
    watering: "Base water management on rainfall, drainage, and field conditions.",
    sunlight: "Use a site with adequate sunlight and wind management suited to the farm.",
    fertilizer: "Use a soil- and crop-stage-based nutrient plan from the local technical guide.",
    practices: ["Photograph pseudostem, leaves, and fruit bunch separately for diagnosis.", "Record wind or flood damage in the farm notes.", "Confirm suspected disease or pest issues with MAO."],
    sources: [{ label: "BPI banana production guide", url: BPI_GUIDES }],
  },
  {
    names: ["mango", "mangga"],
    commonName: "Mango (Mangga)", scientificName: "Mangifera indica",
    plantingAndHarvest: "Tree age, cultivar, flowering history, and local weather are needed for a harvest plan; the image cannot establish them.",
    soil: "Use a local site and soil assessment before applying amendments.",
    watering: "Set water management from rainfall, soil condition, and tree stage.",
    sunlight: "Maintain adequate sunlight appropriate for the orchard layout.",
    fertilizer: "Use soil and leaf analysis with local technical guidance for a tree-specific plan.",
    practices: ["Photograph leaves, flowers, and fruit separately when seeking a diagnosis.", "Keep orchard observations and applications in the farm record.", "Confirm disease and pest management with MAO before treatment."],
    sources: [{ label: "BPI mango production guide", url: BPI_GUIDES }],
  },
];

function normalized(value) { return String(value || "").trim().toLowerCase(); }

function genericProfile(cropName, analysis) {
  const type = normalized(analysis.type || analysis.category);
  if (type.includes("vegetable") || type.includes("herb")) return {
    commonName: cropName,
    scientificName: analysis.scientificName || "Not confirmed from the image",
    plantingAndHarvest: "Use the seed label, local cropping calendar, and crop-specific DA production guide for planting and harvest timing.",
    soil: "Confirm drainage, soil condition, and required amendments with a soil assessment before planting.",
    watering: "Use clean water and adjust irrigation to rainfall, drainage, and crop stage. Fruit vegetables need adequate water during flower initiation and fruit development.",
    sunlight: "Confirm sunlight needs using the exact crop production guide.",
    fertilizer: "Use fully decomposed compost or other inputs according to a soil-based plan and the exact crop guide.",
    practices: ["Confirm the exact crop species before choosing a production schedule.", "Do not diagnose disease or choose a pesticide from one image result.", "Consult MAO for a crop- and site-specific recommendation."],
    sources: [{ label: "DA vegetable production guide", url: DA_VEGETABLE_GUIDE }, { label: "BPI production guides", url: BPI_GUIDES }],
  };
  if (type.includes("fruit") || type.includes("tree crop") || type.includes("field crop") || type === "crop") return {
    commonName: cropName,
    scientificName: analysis.scientificName || "Not confirmed from the image",
    plantingAndHarvest: "Use the crop variety, farm records, local weather, and the applicable DA production guide to determine planting and harvest periods.",
    soil: "Use a local soil assessment before choosing amendments or making a site-specific recommendation.",
    watering: "Set water management from local rainfall, drainage, crop stage, and the exact production guide.",
    sunlight: "Confirm the exact crop's sunlight requirement in a verified crop guide.",
    fertilizer: "Use a soil-based nutrient plan and confirm input rates with MAO or the crop's official guide.",
    practices: ["Record crop variety and planting date in the farm profile.", "Use close-up photos of the affected plant part for health checks.", "Confirm any disease or pest finding with MAO before treatment."],
    sources: [{ label: "BPI production guides", url: BPI_GUIDES }, { label: "DA National Color-Coded Agricultural Guide", url: "https://amia.da.gov.ph/national-color-coded-agricultural-guide-nccag-map/" }],
  };
  return null;
}

export function cropInformation(cropName, analysis = {}) {
  const name = normalized(cropName);
  if (!name || name === "unknown" || name === "unknown crop") return null;
  const profile = cropProfiles.find(item => item.names.some(alias => name === alias || name.includes(alias))) || genericProfile(cropName, analysis);
  if (!profile) return {
    commonName: cropName,
    scientificName: analysis.scientificName || "Not confirmed from the image",
    variety: "Not identifiable from an image. Check the seed, nursery, or farm record.",
    growthStage: analysis.growthStage || "Unknown",
    availability: "No verified crop profile is installed for this exact crop yet. The system will not create crop care instructions without a source.",
    sources: [{ label: "DA production guides", url: BPI_GUIDES }],
  };
  return {
    ...profile,
    variety: "Not identifiable from an image. Check the seed, nursery, or farm record.",
    growthStage: analysis.growthStage || "Unknown",
  };
}

export function farmInformation({ farmer, land, cropName }) {
  const registeredCrops = Array.isArray(land?.crop_types) ? land.crop_types : [];
  const normalizedCrop = normalized(cropName);
  const matchesRegisteredCrop = normalizedCrop && normalizedCrop !== "unknown crop" && registeredCrops.some(item => normalized(item).includes(normalizedCrop) || normalizedCrop.includes(normalized(item)));
  const recommendations = [];
  if (!land) recommendations.push("Select a registered land before detection to associate this result with its farm profile.");
  if (land && matchesRegisteredCrop) recommendations.push("The crop finding is consistent with a crop recorded for this land. Confirm the exact crop and variety in the farm record.");
  if (land && !matchesRegisteredCrop && normalizedCrop && normalizedCrop !== "unknown crop") recommendations.push("The image finding differs from the crop types recorded for this land. Confirm the crop with the farmer or update the land record only after verification.");
  if (land && (!land.latitude || !land.longitude)) recommendations.push("Add the farm GPS coordinates before requesting location-specific agricultural guidance.");
  recommendations.push("No soil, rainfall, pest, or disease map was queried for this result. Ask MAO before making site-specific input or treatment decisions.");
  return {
    farmerName: farmer?.full_name || null,
    landName: land?.name || null,
    barangay: land?.barangay || farmer?.barangay || null,
    sizeHectares: land?.size_hectares || null,
    coordinates: land?.latitude && land?.longitude ? { latitude: land.latitude, longitude: land.longitude } : null,
    registeredCrops,
    matchesRegisteredCrop,
    recommendations,
  };
}
