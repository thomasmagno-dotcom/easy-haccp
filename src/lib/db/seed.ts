import { db } from "./index";
import * as schema from "./schema";
import { generateId } from "../utils";

interface HazardSeed {
  name: string;
  type: "biological" | "chemical" | "physical" | "allergen";
  description: string;
  severity: "low" | "medium" | "high";
  likelihood: "low" | "medium" | "high";
  sourceCategory: string;
  applicableStepCategories: string[];
}

const HAZARD_SEEDS: HazardSeed[] = [
  // ─── Biological ─────────────────────────────────────────────
  {
    name: "Salmonella spp.",
    type: "biological",
    description:
      "Gram-negative pathogenic bacteria commonly found in soil, water, and animal intestinal tracts. Can cause salmonellosis with symptoms of diarrhea, fever, and cramping.",
    severity: "high",
    likelihood: "medium",
    sourceCategory: "soil",
    applicableStepCategories: [
      "receiving",
      "processing",
      "packaging",
      "storage",
    ],
  },
  {
    name: "Listeria monocytogenes",
    type: "biological",
    description:
      "Gram-positive pathogenic bacteria ubiquitous in soil and water. Unique ability to grow at refrigeration temperatures (0-4°C). Can cause listeriosis, particularly dangerous for pregnant women, elderly, and immunocompromised.",
    severity: "high",
    likelihood: "medium",
    sourceCategory: "environment",
    applicableStepCategories: [
      "receiving",
      "storage",
      "processing",
      "packaging",
      "shipping",
    ],
  },
  {
    name: "E. coli O157:H7",
    type: "biological",
    description:
      "Shiga toxin-producing E. coli (STEC). Found in soil, manure, and irrigation water. Can cause hemorrhagic colitis and hemolytic uremic syndrome (HUS).",
    severity: "high",
    likelihood: "medium",
    sourceCategory: "soil",
    applicableStepCategories: ["receiving", "processing"],
  },
  {
    name: "Clostridium botulinum",
    type: "biological",
    description:
      "Spore-forming anaerobic bacteria found in soil. Produces botulinum toxin. Relevant for modified atmosphere packaging (MAP) where anaerobic conditions may develop.",
    severity: "high",
    likelihood: "low",
    sourceCategory: "soil",
    applicableStepCategories: ["receiving", "packaging"],
  },
  {
    name: "Cryptosporidium parvum",
    type: "biological",
    description:
      "Protozoan parasite found in water supplies and irrigation water. Resistant to chlorine disinfection at standard concentrations. Causes cryptosporidiosis.",
    severity: "medium",
    likelihood: "low",
    sourceCategory: "water",
    applicableStepCategories: ["receiving", "processing"],
  },
  {
    name: "Cyclospora cayetanensis",
    type: "biological",
    description:
      "Protozoan parasite associated with contaminated water and imported produce. Causes cyclosporiasis with prolonged diarrheal illness.",
    severity: "medium",
    likelihood: "low",
    sourceCategory: "water",
    applicableStepCategories: ["receiving"],
  },
  {
    name: "Hepatitis A virus",
    type: "biological",
    description:
      "Enteric virus transmitted through contaminated water or infected food handlers. Causes hepatitis with jaundice, fatigue, and liver inflammation.",
    severity: "high",
    likelihood: "low",
    sourceCategory: "personnel",
    applicableStepCategories: [
      "receiving",
      "processing",
      "packaging",
    ],
  },
  {
    name: "General spoilage organisms (yeasts, molds)",
    type: "biological",
    description:
      "Non-pathogenic but quality-affecting microorganisms including yeasts and molds. Cause visible spoilage, off-odors, and reduced shelf life.",
    severity: "low",
    likelihood: "high",
    sourceCategory: "environment",
    applicableStepCategories: [
      "receiving",
      "storage",
      "processing",
      "packaging",
    ],
  },

  // ─── Chemical ───────────────────────────────────────────────
  {
    name: "Pesticide residues",
    type: "chemical",
    description:
      "Residues from field-applied pesticides, herbicides, and fungicides. Risk of exceeding Maximum Residue Limits (MRLs) set by Health Canada if pre-harvest intervals not observed.",
    severity: "medium",
    likelihood: "low",
    sourceCategory: "supplier",
    applicableStepCategories: ["receiving"],
  },
  {
    name: "Chlorine / sanitizer residue (excess)",
    type: "chemical",
    description:
      "Excess chlorine or sanitizer residue on product from over-dosing of sodium hypochlorite in wash water. Can cause chemical burns, off-flavors, and consumer health risk.",
    severity: "medium",
    likelihood: "medium",
    sourceCategory: "equipment",
    applicableStepCategories: ["processing"],
  },
  {
    name: "Lubricant contamination",
    type: "chemical",
    description:
      "Contamination from equipment lubricants, greases, or hydraulic fluids. Risk from non-food-grade lubricants or excessive application near product contact surfaces.",
    severity: "medium",
    likelihood: "low",
    sourceCategory: "equipment",
    applicableStepCategories: ["processing"],
  },
  {
    name: "Cleaning chemical residues",
    type: "chemical",
    description:
      "Residues from cleaning and sanitation chemicals (detergents, acids, alkalis) remaining on equipment surfaces after inadequate rinsing.",
    severity: "medium",
    likelihood: "low",
    sourceCategory: "equipment",
    applicableStepCategories: [
      "processing",
      "packaging",
      "storage",
    ],
  },
  {
    name: "Allergen cross-contact",
    type: "chemical",
    description:
      "Cross-contact with allergenic substances from shared equipment or facility. Canada's priority allergens include peanuts, tree nuts, milk, eggs, wheat, soy, sesame, mustard, seafood, and sulphites.",
    severity: "high",
    likelihood: "low",
    sourceCategory: "equipment",
    applicableStepCategories: ["processing", "packaging"],
  },
  {
    name: "Heavy metals (lead, cadmium)",
    type: "chemical",
    description:
      "Heavy metal contamination from soil (industrial runoff, historical land use) or irrigation water. Lead and cadmium are of primary concern in root vegetables.",
    severity: "medium",
    likelihood: "low",
    sourceCategory: "soil",
    applicableStepCategories: ["receiving"],
  },

  // ─── Physical ───────────────────────────────────────────────
  {
    name: "Metal fragments",
    type: "physical",
    description:
      "Metal fragments from equipment wear, breakage, or deterioration. Includes ferrous (iron/steel), non-ferrous (copper, aluminum), and stainless steel particles. Can cause choking, tooth damage, or internal injury.",
    severity: "high",
    likelihood: "medium",
    sourceCategory: "equipment",
    applicableStepCategories: ["processing"],
  },
  {
    name: "Stones / gravel",
    type: "physical",
    description:
      "Stones, gravel, and soil clumps carried with root vegetables from field harvest. Can cause tooth damage or choking.",
    severity: "medium",
    likelihood: "medium",
    sourceCategory: "soil",
    applicableStepCategories: ["receiving", "processing"],
  },
  {
    name: "Wood splinters",
    type: "physical",
    description:
      "Wood fragments from wooden pallets, crates, or field containers used during harvest and transport.",
    severity: "medium",
    likelihood: "low",
    sourceCategory: "equipment",
    applicableStepCategories: ["receiving"],
  },
  {
    name: "Plastic fragments",
    type: "physical",
    description:
      "Plastic pieces from packaging materials, equipment guards, conveyor components, or container deterioration.",
    severity: "medium",
    likelihood: "low",
    sourceCategory: "equipment",
    applicableStepCategories: ["processing", "packaging"],
  },
  {
    name: "Glass fragments",
    type: "physical",
    description:
      "Glass from light fixtures, instrument covers, or facility infrastructure. High injury potential. Controlled by glass and brittle plastics policy.",
    severity: "high",
    likelihood: "low",
    sourceCategory: "environment",
    applicableStepCategories: [
      "receiving",
      "processing",
      "packaging",
      "storage",
    ],
  },
  {
    name: "Personal effects (jewelry, bandages)",
    type: "physical",
    description:
      "Foreign objects from workers including jewelry, bandages, hair, fingernails, buttons. Controlled by personnel hygiene GMP program.",
    severity: "medium",
    likelihood: "low",
    sourceCategory: "personnel",
    applicableStepCategories: [
      "processing",
      "packaging",
    ],
  },
  {
    name: "Insects / pests",
    type: "physical",
    description:
      "Insects, rodent droppings, or other pest-related contamination from field, storage, or processing areas.",
    severity: "low",
    likelihood: "medium",
    sourceCategory: "environment",
    applicableStepCategories: ["receiving", "storage"],
  },
];

interface ProcessStepTemplate {
  stepNumber: number;
  name: string;
  description: string;
  category: string;
  isCcp: boolean;
  ccpNumber: string | null;
}

export const BABY_CARROT_STEPS: ProcessStepTemplate[] = [
  {
    stepNumber: 1,
    name: "Receiving Raw Carrots",
    description:
      "Incoming raw whole carrots inspected for temperature, quality, and foreign material. COA and lot traceability verified.",
    category: "receiving",
    isCcp: false,
    ccpNumber: null,
  },
  {
    stepNumber: 2,
    name: "Cold Storage (Raw)",
    description:
      "Raw carrots stored at 0-4°C. FIFO rotation enforced. Storage area sanitized per SSOP.",
    category: "storage",
    isCcp: false,
    ccpNumber: null,
  },
  {
    stepNumber: 3,
    name: "Pre-Wash / Soaking",
    description:
      "Carrots washed in potable water to remove soil, debris, and loose foreign material. Agitation and drain screens used.",
    category: "processing",
    isCcp: false,
    ccpNumber: null,
  },
  {
    stepNumber: 4,
    name: "Peeling",
    description:
      "Outer skin removed using abrasion peelers. Equipment inspected daily for wear.",
    category: "processing",
    isCcp: false,
    ccpNumber: null,
  },
  {
    stepNumber: 5,
    name: "Cutting / Shaping",
    description:
      "Carrots cut to baby carrot shape using rotary cutters. Blades inspected daily for wear and damage.",
    category: "processing",
    isCcp: false,
    ccpNumber: null,
  },
  {
    stepNumber: 6,
    name: "Chlorinated Water Rinse",
    description:
      "Primary antimicrobial wash step. Carrots immersed in chlorinated water (100-150 ppm free chlorine, 1-4°C, pH 6.0-7.5) for minimum 1 minute contact time.",
    category: "processing",
    isCcp: true,
    ccpNumber: "CCP-1",
  },
  {
    stepNumber: 7,
    name: "Metal Detection",
    description:
      "Inline metal detector scans all product. Automatic reject mechanism diverts contaminated product. Sensitivity: Fe ≥1.5mm, Non-Fe ≥2.0mm, SS ≥2.5mm.",
    category: "processing",
    isCcp: true,
    ccpNumber: "CCP-2",
  },
  {
    stepNumber: 8,
    name: "Weighing / Packaging",
    description:
      "Product weighed by auto-weigher and packed into polyethylene bags under modified atmosphere (MAP). Controlled environment with positive pressure.",
    category: "packaging",
    isCcp: false,
    ccpNumber: null,
  },
  {
    stepNumber: 9,
    name: "Cold Storage (Finished Product)",
    description:
      "Finished product stored at 0-4°C with continuous temperature monitoring via data logger. Product core temperature verified by spot checks.",
    category: "storage",
    isCcp: true,
    ccpNumber: "CCP-3",
  },
  {
    stepNumber: 10,
    name: "Shipping / Distribution",
    description:
      "Product loaded onto refrigerated transport (≤4°C). Temperature recorder placed in each shipment. Carrier qualification verified.",
    category: "shipping",
    isCcp: false,
    ccpNumber: null,
  },
];

export async function seedHazards(): Promise<void> {
  // Check if hazards already exist
  const existing = db.select().from(schema.hazards).all();
  if (existing.length > 0) {
    console.log(`Hazards already seeded (${existing.length} found). Skipping.`);
    return;
  }

  console.log("Seeding hazard reference database...");

  for (const hazard of HAZARD_SEEDS) {
    db.insert(schema.hazards)
      .values({
        id: generateId(),
        name: hazard.name,
        type: hazard.type,
        description: hazard.description,
        severity: hazard.severity,
        likelihood: hazard.likelihood,
        sourceCategory: hazard.sourceCategory,
        isSystemDefault: true,
        applicableStepCategories: JSON.stringify(
          hazard.applicableStepCategories,
        ),
      })
      .run();
  }

  console.log(`Seeded ${HAZARD_SEEDS.length} hazards.`);
}

// Run seed if called directly
if (require.main === module) {
  seedHazards();
  console.log("Done.");
}
