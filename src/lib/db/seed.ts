import { db } from "./index";
import * as schema from "./schema";
import { generateId } from "../utils";

interface HazardSeed {
  name: string;
  type: "biological" | "chemical" | "physical" | "allergen" | "radiological" | "fraud";
  description: string;
  severity: string; // "1"=Negligible, "2"=Minor, "3"=Major, "4"=Critical
  likelihood: string; // "1"=Rare, "2"=Unlikely, "3"=Likely, "4"=Almost Certain
  sourceCategory: string;
  applicableStepCategories: string[];
}

export const HAZARD_SEEDS: HazardSeed[] = [

  // ══════════════════════════════════════════════════════════════
  // BIOLOGICAL HAZARDS
  // ══════════════════════════════════════════════════════════════

  // ─── Bacteria ────────────────────────────────────────────────
  {
    name: "Salmonella spp.",
    type: "biological",
    description:
      "Gram-negative pathogenic bacteria found in soil, water, animal intestinal tracts, poultry, eggs, and meat. Causes salmonellosis: diarrhea, fever, abdominal cramps. High-risk for vulnerable populations.",
    severity: "4",
    likelihood: "3",
    sourceCategory: "soil",
    applicableStepCategories: ["receiving", "processing", "packaging", "storage"],
  },
  {
    name: "Listeria monocytogenes",
    type: "biological",
    description:
      "Gram-positive pathogen ubiquitous in soil, water, and processing environments. Uniquely grows at refrigeration temperatures (0–4°C). Causes listeriosis — life-threatening for pregnant women, elderly, and immunocompromised.",
    severity: "4",
    likelihood: "3",
    sourceCategory: "environment",
    applicableStepCategories: ["receiving", "storage", "processing", "packaging", "shipping"],
  },
  {
    name: "E. coli O157:H7 (STEC)",
    type: "biological",
    description:
      "Shiga toxin-producing E. coli found in soil, manure, and irrigation water. Causes hemorrhagic colitis and hemolytic uremic syndrome (HUS), especially in children.",
    severity: "4",
    likelihood: "2",
    sourceCategory: "soil",
    applicableStepCategories: ["receiving", "processing"],
  },
  {
    name: "Campylobacter jejuni",
    type: "biological",
    description:
      "Leading bacterial cause of foodborne illness globally. Primary source is poultry, raw milk, and untreated water. Causes campylobacteriosis: diarrhea (often bloody), fever, cramping. Associated with Guillain-Barré syndrome.",
    severity: "4",
    likelihood: "3",
    sourceCategory: "supplier",
    applicableStepCategories: ["receiving", "processing"],
  },
  {
    name: "Staphylococcus aureus / Enterotoxins",
    type: "biological",
    description:
      "Gram-positive bacteria that produces heat-stable enterotoxins. Common source is infected food handlers (skin, nose, throat). Toxins survive cooking. Causes rapid-onset vomiting within 1–6 hours.",
    severity: "3",
    likelihood: "3",
    sourceCategory: "personnel",
    applicableStepCategories: ["processing", "packaging"],
  },
  {
    name: "Bacillus cereus",
    type: "biological",
    description:
      "Spore-forming bacteria found in soil and cereal crops. Two toxin syndromes: emetic (starchy foods, rapid onset) and diarrheal (proteinaceous foods). Spores survive normal cooking; rapid cooling required.",
    severity: "3",
    likelihood: "3",
    sourceCategory: "soil",
    applicableStepCategories: ["receiving", "processing", "storage"],
  },
  {
    name: "Clostridium botulinum",
    type: "biological",
    description:
      "Spore-forming anaerobic bacteria found in soil. Produces potent botulinum neurotoxin under anaerobic conditions (MAP, canned, vacuum-packed foods). Botulism is potentially fatal.",
    severity: "4",
    likelihood: "1",
    sourceCategory: "soil",
    applicableStepCategories: ["receiving", "processing", "packaging"],
  },
  {
    name: "Clostridium perfringens",
    type: "biological",
    description:
      "Spore-forming anaerobic bacteria. Common cause of foodborne illness in cooked meat and poultry dishes held at incorrect temperatures. Spores germinate during slow cooling or inadequate reheating.",
    severity: "3",
    likelihood: "2",
    sourceCategory: "environment",
    applicableStepCategories: ["processing", "storage"],
  },
  {
    name: "Yersinia enterocolitica",
    type: "biological",
    description:
      "Cold-tolerant pathogen associated with raw pork and unpasteurized milk. Can grow at refrigeration temperatures (1–4°C). Causes yersiniosis: diarrhea, abdominal pain that can mimic appendicitis.",
    severity: "3",
    likelihood: "2",
    sourceCategory: "supplier",
    applicableStepCategories: ["receiving", "processing", "storage"],
  },
  {
    name: "Vibrio parahaemolyticus",
    type: "biological",
    description:
      "Marine bacterium associated with raw or undercooked seafood, particularly shellfish (oysters, shrimp). Leading cause of seafood-related gastroenteritis. Grows rapidly at warm temperatures.",
    severity: "3",
    likelihood: "3",
    sourceCategory: "supplier",
    applicableStepCategories: ["receiving", "processing", "storage"],
  },
  {
    name: "Vibrio vulnificus",
    type: "biological",
    description:
      "Highly virulent marine pathogen found in raw oysters and warm coastal waters. Causes severe septicemia in immunocompromised individuals; high mortality rate (~50%). Requires strict temperature control.",
    severity: "4",
    likelihood: "1",
    sourceCategory: "supplier",
    applicableStepCategories: ["receiving", "processing"],
  },
  {
    name: "Brucella spp.",
    type: "biological",
    description:
      "Zoonotic bacteria found in unpasteurized milk, raw dairy products, and undercooked meat from infected animals. Causes brucellosis: undulant fever, joint pain, fatigue. Effectively controlled by pasteurization.",
    severity: "3",
    likelihood: "1",
    sourceCategory: "supplier",
    applicableStepCategories: ["receiving", "processing"],
  },
  {
    name: "Mycobacterium bovis",
    type: "biological",
    description:
      "Causative agent of bovine tuberculosis. Transmitted through unpasteurized milk and dairy products from infected cattle. Pasteurization is highly effective; rare in regulated supply chains.",
    severity: "3",
    likelihood: "1",
    sourceCategory: "supplier",
    applicableStepCategories: ["receiving"],
  },
  {
    name: "Cronobacter sakazakii",
    type: "biological",
    description:
      "Opportunistic pathogen associated with dry powdered infant formula. Causes severe neonatal meningitis, septicemia, and enterocolitis with high mortality. Critical for infant food manufacture.",
    severity: "4",
    likelihood: "1",
    sourceCategory: "environment",
    applicableStepCategories: ["processing", "packaging"],
  },

  // ─── Parasites ───────────────────────────────────────────────
  {
    name: "Cryptosporidium parvum",
    type: "biological",
    description:
      "Protozoan parasite found in water supplies and on fresh produce irrigated with contaminated water. Resistant to standard chlorination. Causes cryptosporidiosis with prolonged watery diarrhea.",
    severity: "3",
    likelihood: "1",
    sourceCategory: "water",
    applicableStepCategories: ["receiving", "processing"],
  },
  {
    name: "Cyclospora cayetanensis",
    type: "biological",
    description:
      "Protozoan parasite associated with contaminated irrigation water and imported fresh produce (berries, leafy greens, herbs). Causes prolonged cyclosporiasis. Not destroyed by chlorination.",
    severity: "3",
    likelihood: "1",
    sourceCategory: "water",
    applicableStepCategories: ["receiving"],
  },
  {
    name: "Toxoplasma gondii",
    type: "biological",
    description:
      "Intracellular parasite found in raw or undercooked meat (especially pork, lamb) and contaminated soil/water. Dangerous in pregnancy (congenital toxoplasmosis). Destroyed by adequate cooking or freezing.",
    severity: "3",
    likelihood: "1",
    sourceCategory: "supplier",
    applicableStepCategories: ["receiving", "processing"],
  },
  {
    name: "Trichinella spiralis",
    type: "biological",
    description:
      "Parasitic nematode found in raw or undercooked pork, wild game, and horse meat. Larvae encyst in muscle tissue. Causes trichinellosis: muscle pain, fever, edema. Controlled by cooking to safe internal temperature or freezing.",
    severity: "3",
    likelihood: "1",
    sourceCategory: "supplier",
    applicableStepCategories: ["receiving", "processing"],
  },
  {
    name: "Anisakis spp.",
    type: "biological",
    description:
      "Parasitic nematode found in raw or undercooked fish (herring, cod, salmon, mackerel) and squid. Larvae can penetrate gastric/intestinal wall causing anisakiasis. Destroyed by freezing (−20°C for 7 days) or cooking.",
    severity: "3",
    likelihood: "2",
    sourceCategory: "supplier",
    applicableStepCategories: ["receiving", "processing"],
  },

  // ─── Viruses ─────────────────────────────────────────────────
  {
    name: "Hepatitis A virus (HAV)",
    type: "biological",
    description:
      "Enteric virus transmitted through contaminated water or infected food handlers. Causes acute liver inflammation with jaundice, fatigue, and nausea. Effective personal hygiene and vaccination programs are key controls.",
    severity: "4",
    likelihood: "1",
    sourceCategory: "personnel",
    applicableStepCategories: ["receiving", "processing", "packaging"],
  },
  {
    name: "Norovirus",
    type: "biological",
    description:
      "Highly contagious calicivirus; leading cause of non-bacterial gastroenteritis worldwide. Transmitted primarily via infected food handlers, contaminated water, or shellfish (oysters). Survives on surfaces for days. Very low infectious dose.",
    severity: "2",
    likelihood: "3",
    sourceCategory: "personnel",
    applicableStepCategories: ["processing", "packaging"],
  },

  // ─── Moulds / Toxin-producing organisms ──────────────────────
  {
    name: "General spoilage organisms (yeasts and moulds)",
    type: "biological",
    description:
      "Non-pathogenic but quality-deteriorating microorganisms including yeasts and moulds. Cause visible spoilage, off-odours, off-flavours, discolouration, and reduced shelf life. Indicate inadequate temperature or sanitation control.",
    severity: "1",
    likelihood: "4",
    sourceCategory: "environment",
    applicableStepCategories: ["receiving", "storage", "processing", "packaging"],
  },
  {
    name: "Aspergillus flavus / A. parasiticus (mould)",
    type: "biological",
    description:
      "Toxigenic moulds that colonise nuts (peanuts, tree nuts), maize, cereals, dried fruit, and spices under warm, humid conditions. Primary producers of aflatoxins (B1, B2, G1, G2). Mould growth precedes toxin production.",
    severity: "4",
    likelihood: "2",
    sourceCategory: "supplier",
    applicableStepCategories: ["receiving", "storage"],
  },

  // ══════════════════════════════════════════════════════════════
  // CHEMICAL HAZARDS
  // ══════════════════════════════════════════════════════════════

  // ─── Agricultural residues ───────────────────────────────────
  {
    name: "Pesticide residues",
    type: "chemical",
    description:
      "Residues from field-applied pesticides, herbicides, and fungicides. Risk of exceeding Maximum Residue Limits (MRLs) set by Health Canada / CFIA if pre-harvest intervals not observed.",
    severity: "3",
    likelihood: "2",
    sourceCategory: "supplier",
    applicableStepCategories: ["receiving"],
  },
  {
    name: "Veterinary drug residues (antibiotics)",
    type: "chemical",
    description:
      "Residues of antibiotics (penicillins, tetracyclines, sulfonamides) in meat, poultry, fish, and dairy from inadequate withdrawal periods. Cause antimicrobial resistance (AMR) and allergic reactions. Controlled through supplier assurance and COA verification.",
    severity: "3",
    likelihood: "2",
    sourceCategory: "supplier",
    applicableStepCategories: ["receiving"],
  },
  {
    name: "Veterinary drug residues (growth hormones)",
    type: "chemical",
    description:
      "Residues of growth-promoting hormones (estradiol, testosterone, zeranol) in beef, pork, and dairy. Endocrine disruption potential with long-term exposure. Supplier COA and country of origin controls apply.",
    severity: "2",
    likelihood: "2",
    sourceCategory: "supplier",
    applicableStepCategories: ["receiving"],
  },
  {
    name: "Heavy metals — lead (Pb) and cadmium (Cd)",
    type: "chemical",
    description:
      "Heavy metal contamination from soil (industrial runoff, historic land use) or irrigation water. Concentrate in root vegetables, leafy greens, and shellfish. Chronic neurotoxic (Pb) and nephrotoxic (Cd) effects. Controlled via soil testing and agricultural land verification.",
    severity: "3",
    likelihood: "1",
    sourceCategory: "soil",
    applicableStepCategories: ["receiving"],
  },
  {
    name: "Heavy metals — mercury (Hg)",
    type: "chemical",
    description:
      "Methylmercury bioaccumulates in predatory fish (tuna, swordfish, shark, king mackerel). Neurotoxic, especially in developing foetuses and young children. Controlled through species sourcing limits and supplier verification.",
    severity: "3",
    likelihood: "2",
    sourceCategory: "supplier",
    applicableStepCategories: ["receiving"],
  },

  // ─── Mycotoxins ───────────────────────────────────────────────
  {
    name: "Aflatoxins (B1, B2, G1, G2)",
    type: "chemical",
    description:
      "Highly potent carcinogenic mycotoxins produced by Aspergillus flavus and A. parasiticus in peanuts, tree nuts, maize, cottonseed, and spices. Aflatoxin B1 is the most potent known natural carcinogen (IARC Group 1). Require raw material testing and dry storage conditions.",
    severity: "4",
    likelihood: "2",
    sourceCategory: "supplier",
    applicableStepCategories: ["receiving", "storage"],
  },
  {
    name: "Deoxynivalenol (DON) / Vomitoxin",
    type: "chemical",
    description:
      "Type B trichothecene mycotoxin produced by Fusarium species in wheat, barley, oats, and maize. Causes nausea, vomiting, diarrhea, and feed refusal. Common contaminant in cereal supply chains; controlled by raw material testing and good agricultural practices.",
    severity: "3",
    likelihood: "2",
    sourceCategory: "supplier",
    applicableStepCategories: ["receiving", "storage"],
  },
  {
    name: "Ochratoxin A (OTA)",
    type: "chemical",
    description:
      "Nephrotoxic mycotoxin produced by Aspergillus ochraceus and Penicillium verrucosum. Found in cereals, coffee, cocoa, dried fruits, spices, and wine. Probable human carcinogen (IARC Group 2B). Controlled by dry storage (< 70% RH) and supplier testing.",
    severity: "3",
    likelihood: "1",
    sourceCategory: "supplier",
    applicableStepCategories: ["receiving", "storage"],
  },
  {
    name: "Zearalenone (ZEA)",
    type: "chemical",
    description:
      "Oestrogenic mycotoxin produced by Fusarium species in maize, wheat, barley, and oats. Causes reproductive disorders and endocrine disruption. Controlled via raw material testing and appropriate grain storage conditions.",
    severity: "3",
    likelihood: "2",
    sourceCategory: "supplier",
    applicableStepCategories: ["receiving", "storage"],
  },
  {
    name: "Patulin",
    type: "chemical",
    description:
      "Mycotoxin produced by Penicillium expansum and other moulds in mouldy apples, apple juice, and other fruit products. Genotoxic and potentially carcinogenic. Controlled by rejecting mouldy fruit at receiving and monitoring Brix/pH in apple products.",
    severity: "3",
    likelihood: "2",
    sourceCategory: "supplier",
    applicableStepCategories: ["receiving", "processing"],
  },

  // ─── Process-generated / In-process chemicals ────────────────
  {
    name: "Histamine (scombrotoxin)",
    type: "chemical",
    description:
      "Biogenic amine formed by bacterial decarboxylation of histidine in histidine-rich fish (tuna, mackerel, sardines, mahi-mahi). Causes rapid-onset allergy-like symptoms. Once formed, heat-stable and cannot be destroyed. Strict temperature-chain control is essential.",
    severity: "3",
    likelihood: "2",
    sourceCategory: "supplier",
    applicableStepCategories: ["receiving", "storage", "processing"],
  },
  {
    name: "Acrylamide",
    type: "chemical",
    description:
      "Probable carcinogen (IARC Group 2A) formed from asparagine and reducing sugars in starchy foods heated above ~120°C (Maillard reaction). Relevant for fried, baked, and roasted products (potato chips, French fries, biscuits, breakfast cereals, coffee). Controlled by recipe modification, reducing sugars, and temperature/time monitoring.",
    severity: "3",
    likelihood: "3",
    sourceCategory: "environment",
    applicableStepCategories: ["processing"],
  },
  {
    name: "Nitrite / nitrate residues (excess)",
    type: "chemical",
    description:
      "Excess sodium/potassium nitrite used in cured meats (bacon, ham, hot dogs). Nitrite converts to nitrosamines (carcinogenic) under acidic conditions or high heat. Overdose causes methaemoglobinaemia. Controlled by precise weighing and batch verification against maximum permitted levels.",
    severity: "3",
    likelihood: "2",
    sourceCategory: "equipment",
    applicableStepCategories: ["processing"],
  },
  {
    name: "Sulphite residues (excess)",
    type: "chemical",
    description:
      "Excess sulphur dioxide (SO₂) / sulphites used as preservatives in dried fruits, wine, shrimp, and juices. Can trigger severe asthmatic reactions and is a declared Health Canada priority allergen (>10 ppm). Controlled by concentration monitoring and accurate labelling.",
    severity: "3",
    likelihood: "2",
    sourceCategory: "equipment",
    applicableStepCategories: ["receiving", "processing"],
  },
  {
    name: "Chlorine / sanitizer residue (excess)",
    type: "chemical",
    description:
      "Excess chlorine or sanitizer (sodium hypochlorite, PAA) residue on product from over-dosing of wash water. Can cause mucosal irritation, off-flavours, and consumer health effects. Controlled by titrimetric monitoring and CCP concentration limits.",
    severity: "2",
    likelihood: "3",
    sourceCategory: "equipment",
    applicableStepCategories: ["processing"],
  },
  {
    name: "Cleaning chemical residues",
    type: "chemical",
    description:
      "Residues from CIP cleaning and sanitation chemicals (caustic soda, phosphoric acid, quaternary ammonium compounds) remaining on product-contact surfaces after inadequate rinsing. Controlled through SSOPs with rinse verification (ATP or pH).",
    severity: "2",
    likelihood: "2",
    sourceCategory: "equipment",
    applicableStepCategories: ["processing", "packaging", "storage"],
  },
  {
    name: "Lubricant contamination (non-food-grade)",
    type: "chemical",
    description:
      "Contamination from non-food-grade equipment lubricants, greases, or hydraulic fluids near product-contact surfaces. Risk from maintenance activities or equipment failure. Controlled by using NSF H1-certified lubricants and equipment maintenance SSOPs.",
    severity: "2",
    likelihood: "1",
    sourceCategory: "equipment",
    applicableStepCategories: ["processing"],
  },

  // ─── Packaging migration ──────────────────────────────────────
  {
    name: "Packaging material migration (phthalates, BPA)",
    type: "chemical",
    description:
      "Migration of plasticisers (phthalates) or bisphenol A (BPA) from plastic packaging into fatty or acidic foods. Endocrine-disrupting potential. Controlled through food-contact material compliance (EC 10/2011 / FDA regulations), COA for packaging, and storage temperature limits.",
    severity: "2",
    likelihood: "2",
    sourceCategory: "equipment",
    applicableStepCategories: ["packaging"],
  },

  // ─── Natural toxins ───────────────────────────────────────────
  {
    name: "Solanine / chaconine (glycoalkaloids)",
    type: "chemical",
    description:
      "Natural steroidal glycoalkaloids in green or sprouted potatoes (skin and eyes). Bitter taste; cause nausea, vomiting, neurological symptoms at high doses. Controlled by rejecting greened/sprouted potatoes at receiving and dark/cool storage.",
    severity: "3",
    likelihood: "2",
    sourceCategory: "supplier",
    applicableStepCategories: ["receiving", "storage"],
  },
  {
    name: "Cyanogenic glycosides (HCN)",
    type: "chemical",
    description:
      "Naturally occurring toxins in cassava (tapioca), stone fruit seeds, bitter almonds, and lima beans that release hydrogen cyanide (HCN) on hydrolysis. Controlled by using low-cyanide varieties, adequate processing (cooking, soaking, drying), and raw material specification.",
    severity: "3",
    likelihood: "1",
    sourceCategory: "supplier",
    applicableStepCategories: ["receiving", "processing"],
  },
  {
    name: "Dioxins and PCBs",
    type: "chemical",
    description:
      "Persistent organic pollutants (POPs) that bioaccumulate in the food chain, particularly in fatty fish (salmon, eel), meat, and dairy. Long-term carcinogenic and immunotoxic effects. Controlled through supplier origin verification and environmental monitoring programmes.",
    severity: "3",
    likelihood: "1",
    sourceCategory: "supplier",
    applicableStepCategories: ["receiving"],
  },

  // ══════════════════════════════════════════════════════════════
  // PHYSICAL HAZARDS
  // ══════════════════════════════════════════════════════════════

  {
    name: "Metal fragments",
    type: "physical",
    description:
      "Metal fragments from equipment wear, breakage, or deterioration (ferrous, non-ferrous, stainless steel). High injury potential — internal laceration, choking, tooth damage. Primary control: inline metal detection (Fe ≥1.5 mm, non-Fe ≥2.0 mm, SS ≥2.5 mm).",
    severity: "4",
    likelihood: "3",
    sourceCategory: "equipment",
    applicableStepCategories: ["processing"],
  },
  {
    name: "Bone fragments",
    type: "physical",
    description:
      "Bone and cartilage fragments in meat, poultry, and fish products from incomplete deboning or saw cuts. Choking and laceration hazard. Controlled by X-ray inspection, bone detection systems, and post-deboning visual inspection.",
    severity: "3",
    likelihood: "3",
    sourceCategory: "equipment",
    applicableStepCategories: ["receiving", "processing"],
  },
  {
    name: "Shell and exoskeleton fragments",
    type: "physical",
    description:
      "Shell fragments from crustaceans (shrimp, crab, lobster), molluscs, eggs, and nut shells. Choking and laceration hazard. Controlled by visual inspection, mechanical sorting, and X-ray detection in shellfish processing.",
    severity: "3",
    likelihood: "2",
    sourceCategory: "supplier",
    applicableStepCategories: ["receiving", "processing"],
  },
  {
    name: "Stones and gravel",
    type: "physical",
    description:
      "Stones, gravel, and soil clumps from field harvest (root vegetables, pulses, cereals). Can cause tooth fracture, choking, or equipment damage. Controlled by destoning, washing, and inspection.",
    severity: "3",
    likelihood: "3",
    sourceCategory: "soil",
    applicableStepCategories: ["receiving", "processing"],
  },
  {
    name: "Pit and stone fragments",
    type: "physical",
    description:
      "Hard pit fragments from stone fruits (olives, cherries, peaches, plums, dates) that survive de-pitting. Tooth fracture and choking hazard. Controlled by metal/X-ray detection and de-pitting validation studies.",
    severity: "3",
    likelihood: "2",
    sourceCategory: "supplier",
    applicableStepCategories: ["receiving", "processing"],
  },
  {
    name: "Glass fragments",
    type: "physical",
    description:
      "Glass from light fixtures, instrument covers, glazed tiles, or glass containers. High laceration potential. Controlled by glass and brittle plastic policy, use of shatterproof covers, and glass audits.",
    severity: "4",
    likelihood: "1",
    sourceCategory: "environment",
    applicableStepCategories: ["receiving", "processing", "packaging", "storage"],
  },
  {
    name: "Plastic fragments (hard)",
    type: "physical",
    description:
      "Hard plastic pieces from equipment guards, conveyor belting, crates, and container deterioration. Choking and laceration hazard. Controlled by maintenance SSOPs, colour-coded brittle plastics policy, and X-ray/optical sorting.",
    severity: "3",
    likelihood: "2",
    sourceCategory: "equipment",
    applicableStepCategories: ["processing", "packaging"],
  },
  {
    name: "Wood splinters",
    type: "physical",
    description:
      "Wood fragments from wooden pallets, field bins, or crates used during harvest and transport. Splinter and choking hazard. Controlled by use of plastic/metal alternatives and visual inspection at receiving.",
    severity: "2",
    likelihood: "1",
    sourceCategory: "equipment",
    applicableStepCategories: ["receiving"],
  },
  {
    name: "Wire and cable fragments",
    type: "physical",
    description:
      "Wire, staples, metal clips, twist-ties, or cable fragments from equipment, pallets, baling wire, or bundling materials. Serious laceration hazard. Controlled by restricting use of wire near product and pre-operational inspection checks.",
    severity: "4",
    likelihood: "1",
    sourceCategory: "equipment",
    applicableStepCategories: ["receiving", "processing"],
  },
  {
    name: "Rubber and gasket fragments",
    type: "physical",
    description:
      "Rubber pieces from worn seals, gaskets, conveyor belts, or O-rings in food-contact equipment. Choking hazard. Controlled by scheduled preventive maintenance, use of detectable (metal-detectable or X-ray-opaque) rubber, and pre-operational checks.",
    severity: "2",
    likelihood: "2",
    sourceCategory: "equipment",
    applicableStepCategories: ["processing", "packaging"],
  },
  {
    name: "Personal effects (jewellery, bandages, buttons)",
    type: "physical",
    description:
      "Foreign objects from workers including jewellery, bandages (blue detectable preferred), hair, fingernails, and clothing fasteners. Controlled by personnel hygiene GMP: jewellery policy, hair nets, coloured detectable bandages, and pre-shift inspections.",
    severity: "2",
    likelihood: "2",
    sourceCategory: "personnel",
    applicableStepCategories: ["processing", "packaging"],
  },
  {
    name: "Insects and pest material",
    type: "physical",
    description:
      "Insects, rodent droppings, hair, or other pest-related contamination from field, storage, or processing environments. Quality and consumer safety concern. Controlled by integrated pest management (IPM) programme and physical exclusion.",
    severity: "1",
    likelihood: "3",
    sourceCategory: "environment",
    applicableStepCategories: ["receiving", "storage"],
  },

  // ══════════════════════════════════════════════════════════════
  // ALLERGENS
  // ══════════════════════════════════════════════════════════════

  {
    name: "Allergen cross-contact — Peanuts",
    type: "allergen",
    description:
      "Cross-contact with peanut protein from shared equipment, common production lines, or airborne dust. Peanuts are a Health Canada priority allergen. Even trace amounts can trigger anaphylaxis in sensitised individuals. Controlled by allergen management programme, dedicated lines or validated cleaning, and mandatory labelling.",
    severity: "4",
    likelihood: "2",
    sourceCategory: "equipment",
    applicableStepCategories: ["receiving", "processing", "packaging"],
  },
  {
    name: "Allergen cross-contact — Tree Nuts",
    type: "allergen",
    description:
      "Cross-contact with tree nut proteins (almonds, cashews, walnuts, pecans, hazelnuts, Brazil nuts, pistachios, macadamias, pine nuts). Priority allergen under Health Canada CFIA. Anaphylaxis risk in sensitised individuals. Requires allergen management, validated cleaning, and clear labelling.",
    severity: "4",
    likelihood: "2",
    sourceCategory: "equipment",
    applicableStepCategories: ["receiving", "processing", "packaging"],
  },
  {
    name: "Allergen cross-contact — Milk / Dairy",
    type: "allergen",
    description:
      "Cross-contact with milk proteins (casein, whey) from shared equipment or ingredients. Priority allergen affecting ~2–3% of infants and ~0.5% of adults. Distinct from lactose intolerance. Controlled by allergen segregation, validated wet cleaning, and mandatory labelling.",
    severity: "4",
    likelihood: "2",
    sourceCategory: "equipment",
    applicableStepCategories: ["receiving", "processing", "packaging"],
  },
  {
    name: "Allergen cross-contact — Eggs",
    type: "allergen",
    description:
      "Cross-contact with egg proteins (ovalbumin, ovomucoid) from shared equipment. Priority allergen; common in children. Ovomucoid is heat-stable and persists after cooking. Controlled by allergen management, validated cleaning, and labelling.",
    severity: "4",
    likelihood: "2",
    sourceCategory: "equipment",
    applicableStepCategories: ["receiving", "processing", "packaging"],
  },
  {
    name: "Allergen cross-contact — Wheat / Gluten",
    type: "allergen",
    description:
      "Cross-contact with wheat proteins (gluten — gliadin and glutenin) affecting coeliac disease patients and wheat-allergic individuals. Priority allergen. Gluten threshold <20 ppm for 'gluten-free' claims. Controlled by ingredient segregation, validated cleaning, and labelling.",
    severity: "4",
    likelihood: "2",
    sourceCategory: "equipment",
    applicableStepCategories: ["receiving", "processing", "packaging"],
  },
  {
    name: "Allergen cross-contact — Soy",
    type: "allergen",
    description:
      "Cross-contact with soy proteins (lectin, Gly m 4) from shared equipment or processing aids. Priority allergen; particularly prevalent in infants. Widely used as an ingredient, processing aid, and oil in food manufacturing.",
    severity: "4",
    likelihood: "2",
    sourceCategory: "equipment",
    applicableStepCategories: ["receiving", "processing", "packaging"],
  },
  {
    name: "Allergen cross-contact — Fish",
    type: "allergen",
    description:
      "Cross-contact with fish proteins (parvalbumins) across different species from shared equipment or processing environments. Priority allergen. May occur even where fish is not a primary ingredient. Requires clear allergen segregation and labelling.",
    severity: "4",
    likelihood: "2",
    sourceCategory: "equipment",
    applicableStepCategories: ["receiving", "processing", "packaging"],
  },
  {
    name: "Allergen cross-contact — Shellfish / Crustaceans",
    type: "allergen",
    description:
      "Cross-contact with shellfish proteins (tropomyosin — shrimp, crab, lobster, crayfish) from shared equipment. Priority allergen; particularly prevalent in adults. Tropomyosin is heat-stable. Requires strict segregation, validated cleaning, and labelling.",
    severity: "4",
    likelihood: "2",
    sourceCategory: "equipment",
    applicableStepCategories: ["receiving", "processing", "packaging"],
  },
  {
    name: "Allergen cross-contact — Sesame",
    type: "allergen",
    description:
      "Cross-contact with sesame proteins (2S albumin — Ses i 1). Priority allergen in Canada (added 2021). Prevalence increasing. Found in oils, pastes (tahini), bread, and Asian foods. Requires updated allergen management programmes and mandatory labelling.",
    severity: "4",
    likelihood: "2",
    sourceCategory: "equipment",
    applicableStepCategories: ["receiving", "processing", "packaging"],
  },
  {
    name: "Allergen cross-contact — Mustard",
    type: "allergen",
    description:
      "Cross-contact with mustard proteins (2S albumin — Sin a 1). Priority allergen in Canada. Present in seeds, powder, paste, oil, and many condiments. Can cause severe anaphylaxis. Requires ingredient vigilance and allergen management controls.",
    severity: "4",
    likelihood: "2",
    sourceCategory: "equipment",
    applicableStepCategories: ["receiving", "processing", "packaging"],
  },
  {
    name: "Allergen — Sulphites (>10 ppm SO₂ equivalent)",
    type: "allergen",
    description:
      "Sulphur dioxide and sulphite salts are priority allergens in Canada at concentrations >10 ppm. Used as preservatives in dried fruits, wine, shrimp, juices, and vinegar. Trigger severe asthmatic reactions in sulphite-sensitive individuals. Requires accurate labelling.",
    severity: "3",
    likelihood: "2",
    sourceCategory: "equipment",
    applicableStepCategories: ["receiving", "processing"],
  },
  {
    name: "Allergen cross-contact — Lupin",
    type: "allergen",
    description:
      "Cross-contact with lupin flour or lupin seed proteins (increasingly used in gluten-free products, pasta, and baked goods). Cross-reactive with peanut allergy (~20% cross-reactivity). Declared allergen in EU and Canada. Requires ingredient review and labelling updates.",
    severity: "3",
    likelihood: "1",
    sourceCategory: "equipment",
    applicableStepCategories: ["receiving", "processing", "packaging"],
  },

  // ══════════════════════════════════════════════════════════════
  // RADIOLOGICAL HAZARDS
  // ══════════════════════════════════════════════════════════════

  {
    name: "Radionuclides — Cesium-137 (Cs-137)",
    type: "radiological",
    description:
      "Anthropogenic radioactive isotope released from nuclear accidents (Chernobyl, Fukushima) or nuclear weapons testing. Accumulates in soil and is taken up by crops and forage, entering meat/dairy via the food chain. Long half-life (~30 years). Controlled by origin verification, environmental monitoring programmes, and radiological testing of raw materials from affected regions.",
    severity: "3",
    likelihood: "1",
    sourceCategory: "environment",
    applicableStepCategories: ["receiving"],
  },
  {
    name: "Radionuclides — Strontium-90 (Sr-90)",
    type: "radiological",
    description:
      "Fission product from nuclear explosions and reactor accidents. Behaves similarly to calcium and is incorporated into bones and dairy products. Half-life ~29 years. Monitored via national environmental surveillance programmes; risk highest in affected agricultural zones post-nuclear events.",
    severity: "3",
    likelihood: "1",
    sourceCategory: "environment",
    applicableStepCategories: ["receiving"],
  },
  {
    name: "Radionuclides — Iodine-131 (I-131)",
    type: "radiological",
    description:
      "Short-lived fission product (half-life ~8 days) released from nuclear reactor accidents. Accumulates in the thyroid gland and is relevant in fresh milk and leafy vegetables shortly after a nuclear event. Critical in the immediate post-accident phase; risk diminishes within weeks.",
    severity: "4",
    likelihood: "1",
    sourceCategory: "environment",
    applicableStepCategories: ["receiving"],
  },
  {
    name: "Naturally occurring radioactive material (NORM) — Radium / Radon",
    type: "radiological",
    description:
      "Naturally occurring radionuclides (Ra-226, Ra-228, Rn-222) present in groundwater used for irrigation or processing, particularly in areas with granite or phosphate-rich geology. Can accumulate in root vegetables and drinking water. Controlled through water source testing and treatment.",
    severity: "2",
    likelihood: "1",
    sourceCategory: "water",
    applicableStepCategories: ["receiving", "processing"],
  },
  {
    name: "Radionuclides — Polonium-210 (Po-210)",
    type: "radiological",
    description:
      "Naturally occurring alpha-emitter that bioaccumulates in seafood (especially bivalves, cephalopods) and tobacco. Ingestion of high levels poses a carcinogenic risk. Monitored in seafood species from certain fisheries; levels generally below regulatory action thresholds for most commercial fish.",
    severity: "3",
    likelihood: "1",
    sourceCategory: "supplier",
    applicableStepCategories: ["receiving"],
  },

  // ══════════════════════════════════════════════════════════════
  // FOOD FRAUD / ECONOMICALLY MOTIVATED ADULTERATION (EMA)
  // ══════════════════════════════════════════════════════════════

  {
    name: "Food fraud — Adulteration with undeclared substances",
    type: "fraud",
    description:
      "Intentional addition of undeclared or cheaper substances to increase bulk or apparent quality (e.g., melamine in milk powder, horse meat in beef products, water injection in fish, chalk in flour). Can introduce undeclared allergens, toxic substances, or microbiological hazards. Controlled through supplier qualification, COA review, authenticity testing (DNA, isotope ratio, NIR), and vulnerability assessments (VACCP).",
    severity: "4",
    likelihood: "2",
    sourceCategory: "supplier",
    applicableStepCategories: ["receiving"],
  },
  {
    name: "Food fraud — Species substitution",
    type: "fraud",
    description:
      "Replacement of a declared species with a cheaper alternative (e.g., farmed salmon labelled as wild-caught, cheaper fish species sold as premium species, pork in halal/kosher products). Creates allergen, religious dietary, and consumer deception risks. Controlled through DNA species identification testing, chain of custody documentation, and supplier audits.",
    severity: "3",
    likelihood: "2",
    sourceCategory: "supplier",
    applicableStepCategories: ["receiving"],
  },
  {
    name: "Food fraud — Dilution / short-weighting",
    type: "fraud",
    description:
      "Deliberate dilution of a food product with lower-value material or water to increase volume/profit (e.g., diluted honey, adulterated olive oil with cheaper vegetable oils, watered-down juice concentrates). Primarily a commercial fraud; can create allergen or safety risks if adulterant is hazardous. Controlled by supplier qualification, compositional testing, and audit programmes.",
    severity: "2",
    likelihood: "2",
    sourceCategory: "supplier",
    applicableStepCategories: ["receiving"],
  },
  {
    name: "Food fraud — Counterfeit or mislabelled origin claims",
    type: "fraud",
    description:
      "False declaration of geographical origin (PDO/PGI claims), organic certification, or production method (e.g., non-organic produce sold as organic, farmed fish labelled as wild, non-Champagne region wine labelled as Champagne). Controlled by supply chain traceability, certification verification, and origin testing (isotope / trace element analysis).",
    severity: "2",
    likelihood: "2",
    sourceCategory: "supplier",
    applicableStepCategories: ["receiving"],
  },
  {
    name: "Food fraud — Undeclared allergen introduction via fraud",
    type: "fraud",
    description:
      "Fraudulent substitution or adulteration that unknowingly introduces a priority allergen into the product (e.g., peanut flour used as a filler in spice blends, milk protein added to extend meat products). Anaphylaxis risk for sensitised consumers. Requires allergen-specific testing of high-risk ingredients as part of the VACCP programme.",
    severity: "4",
    likelihood: "2",
    sourceCategory: "supplier",
    applicableStepCategories: ["receiving"],
  },
  {
    name: "Food fraud — Intentional contamination / sabotage",
    type: "fraud",
    description:
      "Deliberate introduction of harmful substances into food during production, storage, or distribution for malicious purposes (food defence threat). Covered under the FDA FSMA food defence rule and CFIA food safety requirements. Controlled by food defence plans: access control, employee screening, supply chain security, and TACCP (Threat Assessment and Critical Control Points) programme.",
    severity: "4",
    likelihood: "1",
    sourceCategory: "personnel",
    applicableStepCategories: ["receiving", "processing", "packaging", "storage", "shipping"],
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
  // Get existing hazard names so we can skip duplicates
  const existing = db.select().from(schema.hazards).all();
  const existingNames = new Set(existing.map((h) => h.name));

  const toInsert = HAZARD_SEEDS.filter((h) => !existingNames.has(h.name));

  if (toInsert.length === 0) {
    console.log(`Hazard database already up to date (${existing.length} hazards). Nothing to add.`);
    return;
  }

  console.log(`Adding ${toInsert.length} new hazards (${existing.length} already exist)...`);

  for (const hazard of toInsert) {
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
        applicableStepCategories: JSON.stringify(hazard.applicableStepCategories),
      })
      .run();
  }

  console.log(`Done. Total hazards in database: ${existing.length + toInsert.length}`);
}

// Run seed if called directly
if (require.main === module) {
  seedHazards();
  console.log("Done.");
}
