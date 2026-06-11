/**
 * Canonical reference list for the HACCP Plan App.
 * Used both in the References UI tab and the PDF export.
 */

export interface Reference {
  id: string;
  category: string;
  citation: string;         // Short citation label shown in-line (e.g. "CAC/RCP 1-1969")
  title: string;            // Full title of the document
  publisher: string;        // Issuing body
  year: string;             // Year of the edition referenced
  description: string;      // One-sentence explanation of what it drives in this app
  url?: string;             // Canonical public URL (optional)
}

export const REFERENCES: Reference[] = [

  // ── HACCP Methodology ─────────────────────────────────────────────────────

  {
    id: "codex-cxc1",
    category: "HACCP Methodology",
    citation: "CXC 1-1969, Rev. 2020",
    title: "General Principles of Food Hygiene",
    publisher: "Codex Alimentarius Commission (FAO/WHO)",
    year: "2020",
    description:
      "Primary basis for the HACCP system: the 7 principles, CCP Decision Tree (Q1–Q4), process flow diagram format, hazard analysis methodology, and GHP/PRP distinction.",
    url: "https://www.fao.org/fao-who-codexalimentarius/codex-texts/codes-of-practice/en/",
  },
  {
    id: "codex-cac-rcp45",
    category: "HACCP Methodology",
    citation: "CAC/RCP 45-1997",
    title: "Code of Practice for Fish and Fishery Products",
    publisher: "Codex Alimentarius Commission (FAO/WHO)",
    year: "2012",
    description:
      "Reference for histamine, marine biotoxins (PSP, ASP, DSP, NSP, ciguatoxin), Anisakis, and Vibrio hazard parameters in the hazard database.",
    url: "https://www.fao.org/fao-who-codexalimentarius/",
  },

  // ── Canadian Regulatory Framework ─────────────────────────────────────────

  {
    id: "sfcr",
    category: "Canadian Regulations",
    citation: "SFCR, SOR/2018-108",
    title: "Safe Food for Canadians Regulations",
    publisher: "Government of Canada",
    year: "2019",
    description:
      "Legal basis for the Preventive Control Plan. Provides the SFCR section cross-references (s.47–89) displayed on each Prerequisite Program card.",
    url: "https://laws-lois.justice.gc.ca/eng/regulations/SOR-2018-108/",
  },
  {
    id: "sfca",
    category: "Canadian Regulations",
    citation: "S.C. 2012, c. 24",
    title: "Safe Food for Canadians Act",
    publisher: "Government of Canada",
    year: "2012",
    description:
      "Enabling legislation for the SFCR. Establishes the regulatory framework for food safety and preventive control plans.",
    url: "https://laws-lois.justice.gc.ca/eng/acts/S-1.1/",
  },
  {
    id: "fdr-allergens",
    category: "Canadian Regulations",
    citation: "FDR B.01.010.1",
    title: "Food and Drug Regulations — Priority Food Allergen Labelling",
    publisher: "Health Canada / Government of Canada",
    year: "2021",
    description:
      "Defines Canada's 14 priority food allergens and the sulphite >10 ppm threshold used in the hazard database allergen entries.",
    url: "https://laws-lois.justice.gc.ca/eng/regulations/C.R.C.,_c._870/",
  },
  {
    id: "pcpa-mrl",
    category: "Canadian Regulations",
    citation: "Pest Control Products Act, S.C. 2002, c. 28",
    title: "Pest Control Products Act — Maximum Residue Limits",
    publisher: "Health Canada / PMRA",
    year: "2002",
    description:
      "Basis for pesticide and herbicide MRL hazard entries and likelihood ratings in the chemical hazard database.",
    url: "https://laws-lois.justice.gc.ca/eng/acts/P-9.01/",
  },

  // ── CFIA Guidance ─────────────────────────────────────────────────────────

  {
    id: "fsep",
    category: "CFIA Guidance",
    citation: "FSEP Technical Document",
    title: "Food Safety Enhancement Program (FSEP) Technical Document",
    publisher: "Canadian Food Inspection Agency (CFIA)",
    year: "2018",
    description:
      "Defines the seven PRP categories (A–G) and element codes used throughout the Prerequisite Program registry.",
    url: "https://inspection.canada.ca/en/preventive-controls/preventive-control-plans/food-safety-enhancement-program",
  },
  {
    id: "fsep-legacy-sfcr-map",
    category: "CFIA Guidance",
    citation: "Legacy FSEP → SFCR Mapping",
    title: "Mapping of Legacy FSEP Sections to SFCR Guidance Categories and Legal Sections",
    publisher: "Canadian Food Inspection Agency (CFIA)",
    year: "2019",
    description:
      "Cross-reference table used to align legacy FSEP subsection numbers (A.2.1–G.3.2) with specific SFCR legal sections and CFIA Auditor Framework elements.",
  },
  {
    id: "cfia-listeria",
    category: "CFIA Guidance",
    citation: "CFIA Listeria Policy",
    title: "Policy on Listeria monocytogenes in Ready-to-Eat Foods",
    publisher: "Canadian Food Inspection Agency (CFIA)",
    year: "2011",
    description:
      "Used to calibrate Listeria monocytogenes severity and control parameters in the biological hazard database.",
    url: "https://inspection.canada.ca/food-safety-for-industry/food-chemistry-and-microbiology/food-microbiology/listeria-policy/eng/1352824546303/1352824822033",
  },
  {
    id: "cfia-contaminants",
    category: "CFIA Guidance",
    citation: "CFIA Contaminants Reference",
    title: "Chemical Contaminants Reference Database",
    publisher: "Canadian Food Inspection Agency (CFIA)",
    year: "2020",
    description:
      "Reference for heavy metal hazards (lead, cadmium, mercury, inorganic arsenic) and veterinary drug residue entries in the chemical hazard database.",
    url: "https://inspection.canada.ca/food-safety-for-industry/chemical-residues-microbiology/chemical-residues/eng/1356184190969/1356184373945",
  },

  // ── International Standards ────────────────────────────────────────────────

  {
    id: "iso22000",
    category: "International Standards",
    citation: "ISO 22000:2018",
    title: "Food Safety Management Systems — Requirements for any organization in the food chain",
    publisher: "International Organization for Standardization (ISO)",
    year: "2018",
    description:
      "Basis for the 4×4 Severity × Likelihood risk matrix and the definition of 'significant hazard' used in the hazard analysis.",
    url: "https://www.iso.org/standard/65464.html",
  },
  {
    id: "iso-ts22002",
    category: "International Standards",
    citation: "ISO/TS 22002-1:2009",
    title: "Prerequisite Programmes on Food Safety — Part 1: Food Manufacturing",
    publisher: "International Organization for Standardization (ISO)",
    year: "2009",
    description:
      "Informs the scope and content of PRP categories, particularly sanitation, pest control, and facility design programs.",
    url: "https://www.iso.org/standard/44001.html",
  },

  // ── WHO / FAO Scientific Assessments ──────────────────────────────────────

  {
    id: "jecfa",
    category: "WHO / FAO Scientific Assessments",
    citation: "FAO/WHO JECFA",
    title: "Joint FAO/WHO Expert Committee on Food Additives — Monographs and Evaluations",
    publisher: "Food and Agriculture Organization / World Health Organization",
    year: "Various",
    description:
      "Source for mycotoxin hazard parameters (aflatoxins B1/B2/G1/G2, DON, fumonisins B1/B2, OTA, patulin, zearalenone) and dioxin/PCB tolerances in the chemical hazard database.",
    url: "https://www.fao.org/food/food-safety-quality/scientific-advice/jecfa/en/",
  },
  {
    id: "who-iarc",
    category: "WHO / FAO Scientific Assessments",
    citation: "IARC Monographs",
    title: "IARC Monographs on the Identification of Carcinogenic Hazards to Humans",
    publisher: "International Agency for Research on Cancer (WHO)",
    year: "Various",
    description:
      "Classification basis for process-generated chemical hazards: acrylamide (Group 2A), nitrosamines (Group 2A), PAHs/benzo[a]pyrene (Group 1), and heterocyclic amines.",
    url: "https://monographs.iarc.who.int/",
  },
  {
    id: "efsa-ecdc",
    category: "WHO / FAO Scientific Assessments",
    citation: "EFSA/ECDC Zoonoses Reports",
    title: "European Union Summary Report on Zoonoses, Zoonotic Agents and Food-borne Outbreaks",
    publisher: "European Food Safety Authority (EFSA) / European Centre for Disease Prevention and Control (ECDC)",
    year: "Annual",
    description:
      "Used to calibrate prevalence-based likelihood ratings for Salmonella, Campylobacter, Yersinia, and other zoonotic pathogens in the biological hazard database.",
    url: "https://www.efsa.europa.eu/en/publications",
  },

  // ── US Regulatory Benchmarks ──────────────────────────────────────────────

  {
    id: "usda-fsis-haccp",
    category: "US Regulatory Benchmarks",
    citation: "9 CFR Part 417",
    title: "Hazard Analysis and Critical Control Point (HACCP) Systems",
    publisher: "USDA Food Safety and Inspection Service (FSIS)",
    year: "2015",
    description:
      "Benchmark critical limits for thermal processing, pH, and water activity referenced in CCP detail descriptions.",
    url: "https://www.ecfr.gov/current/title-9/chapter-III/subchapter-E/part-417",
  },
  {
    id: "ec-2073",
    category: "US / EU Benchmarks",
    citation: "EC No 2073/2005",
    title: "Commission Regulation on Microbiological Criteria for Foodstuffs",
    publisher: "European Commission",
    year: "2005",
    description:
      "Used as an international benchmark for severity/likelihood ratings for E. coli O157:H7, non-O157 STEC, Cronobacter sakazakii, and other pathogens.",
    url: "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32005R2073",
  },
];

export const REFERENCE_CATEGORIES = [
  "HACCP Methodology",
  "Canadian Regulations",
  "CFIA Guidance",
  "International Standards",
  "WHO / FAO Scientific Assessments",
  "US Regulatory Benchmarks",
  "US / EU Benchmarks",
];
