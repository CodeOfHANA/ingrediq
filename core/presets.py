PRESET_PROFILES = {

    "halal": {
        "label": "Halal",
        "emoji": "🟢",
        "color": "#15803d",
        "excluded_ingredients": [
            "pork", "lard", "bacon", "ham", "gelatin", "carmine",
            "alcohol", "wine", "beer", "ethanol", "rum", "whiskey"
        ],
        "flagged_enumbers": [
            "E120",   # Carmine — insect derived
            "E441",   # Gelatin — pork derived
            "E542",   # Bone phosphate — animal derived
            "E631",   # Disodium inosinate — may be pork derived
            "E635",   # Disodium ribonucleotides — may be pork derived
            "E471",   # Mono/diglycerides — may be animal derived
        ],
        "rules": [
            "Flag any pork or pork-derived ingredients including lard, gelatin unless Halal certified",
            "Flag alcohol and alcohol-derived flavourings including ethanol",
            "Flag gelatin unless explicitly labelled as Halal certified",
            "Flag E120 (carmine) as insect-derived",
            "Flag E471 as potentially animal-derived — not always Halal",
            "Flag E631 and E635 as potentially pork-derived",
            "Flag any meat derivatives unless Halal slaughter certified"
        ]
    },

    "kosher": {
        "label": "Kosher",
        "emoji": "✡️",
        "color": "#1d4ed8",
        "excluded_ingredients": [
            "pork", "lard", "shellfish", "shrimp", "lobster", "crab",
            "gelatin", "non-kosher meat"
        ],
        "flagged_enumbers": [
            "E120",   # Carmine
            "E441",   # Gelatin
            "E542",   # Bone phosphate
        ],
        "rules": [
            "Flag pork and all pork derivatives",
            "Flag shellfish and shellfish derivatives",
            "Flag mixing of meat and dairy ingredients in same product",
            "Flag gelatin unless explicitly Kosher certified",
            "Flag non-Kosher certified meat derivatives",
            "Flag E120, E441, E542 as potentially non-Kosher"
        ]
    },

    "jain": {
        "label": "Jain",
        "emoji": "🟤",
        "color": "#92400e",
        "excluded_ingredients": [
            "meat", "fish", "egg", "onion", "garlic", "potato",
            "carrot", "beetroot", "leek", "celery root", "turnip",
            "radish", "fennel root"
        ],
        "flagged_enumbers": [
            "E120",   # Carmine — insect derived
            "E441",   # Gelatin — animal derived
            "E542",   # Bone phosphate
            "E904",   # Shellac — insect derived
        ],
        "rules": [
            "Flag all meat, fish, and egg ingredients",
            "Flag all root vegetables: onion, garlic, potato, carrot, beetroot, leek",
            "Flag any underground vegetable derivatives",
            "Flag insect-derived E-numbers: E120, E904",
            "Flag all animal-derived E-numbers"
        ]
    },

    "hindu_vegetarian": {
        "label": "Hindu Veg",
        "emoji": "🕉️",
        "color": "#f97316",
        "excluded_ingredients": [
            "beef", "veal", "cow", "gelatin"
        ],
        "flagged_enumbers": [],
        "rules": [
            "Flag beef and all beef derivatives strictly",
            "Flag gelatin unless certified non-beef",
            "Flag rennet unless plant-based",
            "Note: egg and dairy are generally acceptable unless user specifies otherwise"
        ]
    },

    "buddhist_strict": {
        "label": "Buddhist",
        "emoji": "☸️",
        "color": "#7c3aed",
        "excluded_ingredients": [
            "meat", "fish", "egg", "onion", "garlic", "leek",
            "spring onion", "chives", "shallot"
        ],
        "flagged_enumbers": [],
        "rules": [
            "Flag all meat and fish",
            "Flag eggs",
            "Flag the five pungent roots: onion, garlic, leek, spring onion, chives"
        ]
    },

    "vegan": {
        "label": "Vegan",
        "emoji": "🌱",
        "color": "#16a34a",
        "excluded_ingredients": [
            "milk", "dairy", "egg", "honey", "carmine", "lanolin",
            "casein", "whey", "lactose", "gelatin", "shellac",
            "beeswax", "isinglass", "albumen", "lard", "suet",
            "tallow", "anchovies", "meat", "fish"
        ],
        "flagged_enumbers": [
            "E120",   # Carmine — insect
            "E441",   # Gelatin — animal
            "E542",   # Bone phosphate
            "E901",   # Beeswax
            "E904",   # Shellac — insect
            "E471",   # Mono/diglycerides — may be animal
            "E472",   # Esters of mono/diglycerides — may be animal
        ],
        "rules": [
            "Flag ALL animal-derived ingredients including hidden ones",
            "Flag dairy derivatives: casein, whey, lactose, butter, cream",
            "Flag egg and egg derivatives: albumen, lysozyme",
            "Flag honey and bee products: beeswax, royal jelly",
            "Flag E120 as insect-derived red dye",
            "Flag E471/E472 as potentially animal-derived",
            "Flag gelatin in any form",
            "Flag isinglass (used in wine/beer clarification)",
            "Flag ambiguous ingredients that may be animal-derived"
        ]
    },

    "vegetarian": {
        "label": "Vegetarian",
        "emoji": "🥗",
        "color": "#65a30d",
        "excluded_ingredients": [
            "meat", "fish", "gelatin", "lard", "suet", "tallow",
            "anchovies", "rennet"
        ],
        "flagged_enumbers": [
            "E120",   # Carmine
            "E441",   # Gelatin
            "E542",   # Bone phosphate
            "E904",   # Shellac
        ],
        "rules": [
            "Flag all meat and fish ingredients",
            "Flag gelatin unless vegetarian certified",
            "Flag animal-derived E-numbers",
            "Flag rennet unless plant or microbial based",
            "Note: dairy and eggs are acceptable for vegetarian"
        ]
    },

    "pescatarian": {
        "label": "Pescatarian",
        "emoji": "🐟",
        "color": "#0284c7",
        "excluded_ingredients": [
            "beef", "pork", "chicken", "lamb", "veal", "meat",
            "lard", "suet", "tallow", "gelatin"
        ],
        "flagged_enumbers": [],
        "rules": [
            "Flag all land animal meat",
            "Flag meat derivatives: lard, suet, tallow",
            "Flag gelatin unless fish-derived",
            "Note: fish and seafood are acceptable"
        ]
    },

    "keto": {
        "label": "Keto",
        "emoji": "🥩",
        "color": "#b45309",
        "excluded_ingredients": [
            "sugar", "glucose", "fructose", "maltose", "sucrose",
            "corn syrup", "wheat", "flour", "starch", "bread",
            "rice", "potato", "oat", "barley", "honey", "maple syrup"
        ],
        "flagged_enumbers": [],
        "rules": [
            "Flag all sugars including hidden sugar names",
            "Flag high carbohydrate ingredients",
            "Flag starchy ingredients",
            "Flag grains and grain derivatives",
            "Note if total carbs per serving exceed 5g"
        ]
    },

    "gluten_free": {
        "label": "Gluten-Free",
        "emoji": "🌾",
        "color": "#d97706",
        "excluded_ingredients": [
            "wheat", "barley", "rye", "malt", "spelt", "kamut",
            "triticale", "gluten", "semolina", "durum", "farro",
            "bulgur", "farina", "graham flour", "wheat starch"
        ],
        "flagged_enumbers": [
            "E150c",  # Ammonia caramel — may contain gluten
            "E150d",  # Sulphite ammonia caramel — may contain gluten
        ],
        "rules": [
            "Flag wheat and all wheat derivatives",
            "Flag barley, rye, malt and their derivatives",
            "Flag any ingredient that may contain hidden gluten",
            "Flag malt vinegar and malt extract",
            "Flag modified wheat starch"
        ]
    },

    "dairy_free": {
        "label": "Dairy-Free",
        "emoji": "🥛",
        "color": "#0891b2",
        "excluded_ingredients": [
            "milk", "dairy", "lactose", "casein", "whey", "butter",
            "cream", "cheese", "yogurt", "ghee", "lactalbumin",
            "lactoglobulin", "lactulose"
        ],
        "flagged_enumbers": [],
        "rules": [
            "Flag all milk and dairy ingredients",
            "Flag hidden dairy: casein, whey, lactalbumin",
            "Flag lactose in any form",
            "Flag butter, ghee, cream and derivatives",
            "Flag E numbers derived from dairy"
        ]
    },

    "low_fodmap": {
        "label": "Low-FODMAP",
        "emoji": "🔬",
        "color": "#9333ea",
        "excluded_ingredients": [
            "onion", "garlic", "lactose", "fructose", "honey",
            "apple", "pear", "wheat", "rye", "cashew", "pistachio",
            "inulin", "chicory root", "fructooligosaccharides"
        ],
        "flagged_enumbers": [],
        "rules": [
            "Flag high-FODMAP vegetables: onion, garlic, leek",
            "Flag lactose-containing dairy",
            "Flag high-fructose ingredients",
            "Flag inulin and chicory root (prebiotic fibres)",
            "Flag fructooligosaccharides (FOS)",
            "Flag high-FODMAP fruits: apple, pear, mango"
        ]
    }
}

MEDICAL_PRESETS = {

    "diabetes": {
        "label": "Diabetic",
        "emoji": "💉",
        "rules": [
            "Flag all sugars including 40+ hidden names: dextrose, maltose, corn syrup, agave, etc.",
            "Flag high glycemic index ingredients",
            "Flag artificial sweeteners: aspartame conflicts with PKU, not diabetes — clarify",
            "Note total sugar content per serving if extractable",
            "Flag refined carbohydrates"
        ]
    },

    "hypertension": {
        "label": "Hypertension",
        "emoji": "❤️",
        "rules": [
            "Flag high sodium content — warn if >600mg per serving",
            "Flag MSG (monosodium glutamate) and sodium glutamate",
            "Flag sodium-based preservatives: sodium nitrate, sodium benzoate",
            "Flag high sodium E-numbers"
        ]
    },

    "kidney_disease": {
        "label": "Kidney Disease",
        "emoji": "🫘",
        "rules": [
            "Flag high potassium ingredients: banana, potato, tomato paste, nuts",
            "Flag high phosphorus ingredients: dairy, nuts, seeds, cola",
            "Flag high protein if protein restriction indicated",
            "Flag phosphate additives: E338-E341, E450-E452",
            "Flag high sodium as kidneys cannot filter efficiently"
        ]
    }
}
