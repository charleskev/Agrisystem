// Reference taxonomy for the vision prompt. It supplies vocabulary only; it is
// never evidence and the model is told to return Unknown when image evidence is weak.
export const agricultureCatalog = [
  ["Rice", "Palay", "Oryza sativa", "field crop"], ["Corn", "Mais", "Zea mays", "field crop"], ["Sugarcane", "Tubó", "Saccharum officinarum", "field crop"],
  ["Coconut", "Niyog", "Cocos nucifera", "tree crop"], ["Banana", "Saging", "Musa spp.", "fruit"], ["Mango", "Mangga", "Mangifera indica", "tree crop"],
  ["Pineapple", "Pinya", "Ananas comosus", "fruit"], ["Papaya", "Papaya", "Carica papaya", "fruit"], ["Calamansi", "Kalamansi", "Citrus × microcarpa", "fruit"],
  ["Pomelo", "Suha", "Citrus maxima", "fruit"], ["Lime", "Dayap", "Citrus aurantiifolia", "fruit"], ["Avocado", "Abokado", "Persea americana", "fruit"],
  ["Watermelon", "Pakwan", "Citrullus lanatus", "fruit"], ["Melon", "Melon", "Cucumis melo", "fruit"], ["Dragon fruit", "Pitaya", "Selenicereus undatus", "fruit"],
  ["Jackfruit", "Langka", "Artocarpus heterophyllus", "tree crop"], ["Guava", "Bayabas", "Psidium guajava", "fruit"], ["Rambutan", "Rambutan", "Nephelium lappaceum", "fruit"],
  ["Lanzones", "Lansones", "Lansium parasiticum", "fruit"], ["Durian", "Durian", "Durio zibethinus", "fruit"], ["Soursop", "Guyabano", "Annona muricata", "fruit"],
  ["Cacao", "Kakao", "Theobroma cacao", "tree crop"], ["Coffee", "Kape", "Coffea spp.", "tree crop"], ["Cassava", "Kamoteng kahoy", "Manihot esculenta", "field crop"],
  ["Sweet potato", "Kamote", "Ipomoea batatas", "field crop"], ["Taro", "Gabi", "Colocasia esculenta", "field crop"], ["Peanut", "Mani", "Arachis hypogaea", "field crop"], ["Mung bean", "Monggo", "Vigna radiata", "field crop"],
  ["Eggplant", "Talong", "Solanum melongena", "vegetable"], ["Tomato", "Kamatis", "Solanum lycopersicum", "vegetable"], ["Okra", "Okra", "Abelmoschus esculentus", "vegetable"],
  ["Squash", "Kalabasa", "Cucurbita moschata", "vegetable"], ["Bitter gourd", "Ampalaya", "Momordica charantia", "vegetable"], ["String bean", "Sitaw", "Vigna unguiculata subsp. sesquipedalis", "vegetable"],
  ["Cucumber", "Pipino", "Cucumis sativus", "vegetable"], ["Chili", "Sili", "Capsicum frutescens", "vegetable"], ["Bell pepper", "Siling-singaw", "Capsicum annuum", "vegetable"],
  ["Pechay", "Pechay", "Brassica rapa subsp. chinensis", "vegetable"], ["Cabbage", "Repolyo", "Brassica oleracea var. capitata", "vegetable"], ["Lettuce", "Letsugas", "Lactuca sativa", "vegetable"],
  ["Kangkong", "Kangkong", "Ipomoea aquatica", "vegetable"], ["Malunggay", "Malunggay", "Moringa oleifera", "tree crop"], ["Onion", "Sibuyas", "Allium cepa", "vegetable"],
  ["Garlic", "Bawang", "Allium sativum", "vegetable"], ["Ginger", "Luya", "Zingiber officinale", "herb"], ["Turmeric", "Luyang dilaw", "Curcuma longa", "herb"],
  ["Lemongrass", "Tanglad", "Cymbopogon citratus", "herb"], ["Pandan", "Pandan", "Pandanus amaryllifolius", "herb"], ["Tobacco", "Tabako", "Nicotiana tabacum", "field crop"]
  , ["Abaca", "Abaka", "Musa textilis", "field crop"], ["Rubber", "Goma", "Hevea brasiliensis", "tree crop"], ["Black pepper", "Paminta", "Piper nigrum", "spice crop"],
  ["Cashew", "Kasoy", "Anacardium occidentale", "tree crop"], ["Breadfruit", "Rimas", "Artocarpus altilis", "tree crop"], ["Star apple", "Kaimito", "Chrysophyllum cainito", "fruit"],
  ["Starfruit", "Balimbing", "Averrhoa carambola", "fruit"], ["Wax apple", "Makopa", "Syzygium samarangense", "fruit"], ["Tamarind", "Sampalok", "Tamarindus indica", "tree crop"],
  ["Indian jujube", "Mansanitas", "Ziziphus mauritiana", "fruit"], ["Bignay", "Bignay", "Antidesma bunius", "fruit"], ["Kamias", "Kamias", "Averrhoa bilimbi", "fruit"],
  ["Guyabano", "Guyabano", "Annona muricata", "fruit"], ["Atis", "Atis", "Annona squamosa", "fruit"], ["Duhat", "Duhat", "Syzygium cumini", "fruit"],
  ["Ube", "Ube", "Dioscorea alata", "root crop"], ["Arrowroot", "Uraro", "Maranta arundinacea", "root crop"], ["Jicama", "Singkamas", "Pachyrhizus erosus", "root crop"],
  ["Winged bean", "Sigarilyas", "Psophocarpus tetragonolobus", "vegetable"], ["Hyacinth bean", "Bataw", "Lablab purpureus", "vegetable"], ["Bottle gourd", "Upo", "Lagenaria siceraria", "vegetable"],
  ["Sponge gourd", "Patola", "Luffa aegyptiaca", "vegetable"], ["Chayote", "Sayote", "Sechium edule", "vegetable"], ["Yardlong bean", "Sitaw", "Vigna unguiculata", "vegetable"],
  ["Mustard greens", "Mustasa", "Brassica juncea", "vegetable"], ["Chinese celery", "Kintsay", "Apium graveolens", "herb"], ["Basil", "Balanoi", "Ocimum basilicum", "herb"],
  ["Coriander", "Wansoy", "Coriandrum sativum", "herb"], ["Sweet pepper", "Siling bell", "Capsicum annuum", "vegetable"], ["Radish", "Labanos", "Raphanus sativus", "vegetable"],
  ["Bitter leaf", "Sabila", "Vernonia amygdalina", "herb"], ["Aloe vera", "Sabila", "Aloe vera", "herb"], ["Mushroom", "Kabute", "Agaricus spp.", "fungal crop"]
].map(([english, filipino, scientificName, type]) => ({ english, filipino, scientificName, type }));

export const catalogForVisionPrompt = agricultureCatalog.map(item => `${item.english}/${item.filipino} (${item.scientificName}; ${item.type})`).join("; ");

export const farmObservationCatalog = {
  livestock: ["carabao", "cattle", "goat", "sheep", "pig", "chicken", "duck", "turkey", "horse", "dog", "cat", "bee colony"],
  aquaculture: ["tilapia pond", "milkfish pond", "catfish pond", "freshwater fish cage", "shrimp pond", "mussel culture", "oyster culture", "seaweed farm"],
  farmStructures: ["irrigation canal", "drip irrigation", "sprinkler", "water pump", "water tank", "greenhouse", "shade net", "insect net", "trellis", "rice paddy bund", "fence", "silo", "grain dryer", "nursery bed", "compost pit", "chicken coop", "pigpen", "fish pond"],
  equipment: ["hand tractor", "rice harvester", "thresher", "rotavator", "plow", "hoe", "machete", "shovel", "knapsack sprayer", "wheelbarrow", "fertilizer sack", "seedling tray", "mulch film", "stakes", "crates"],
  commonWeeds: ["cogon grass", "goosegrass", "crabgrass", "purple nutsedge", "spiny amaranth", "sensitive plant", "morning glory vine", "water hyacinth"],
  pests: ["aphids", "whiteflies", "thrips", "leafhoppers", "planthoppers", "caterpillars", "armyworms", "rice stem borers", "fruit flies", "snails", "mites", "mealybugs", "scale insects", "rats", "birds"],
  plantSymptoms: ["yellowing leaves", "leaf spots", "mosaic pattern", "wilting", "leaf holes", "chewed edges", "curling leaves", "mold growth", "stem breakage", "lodging", "fruit rot", "stunted growth", "dry leaf margins"],
  soilConditions: ["dry soil", "wet soil", "standing water", "cracked soil", "muddy soil", "mulched soil", "erosion", "weed-covered soil", "bare soil"],
  weatherDamage: ["flooding", "drought stress", "wind damage", "typhoon debris", "landslide", "fire damage"]
};

export const farmObservationsForVisionPrompt = Object.entries(farmObservationCatalog)
  .map(([group, values]) => `${group}: ${values.join(", ")}`)
  .join(". ");
