/**
 * Seed / refresh the PRP registry with all standard FSEP prerequisite programs.
 *
 * Source: CFIA Food Safety Enhancement Program (FSEP) Technical Document
 * Mapping: Legacy FSEP Section → New SFCR Guidance → Specific SFCR Legal Sections
 *
 * This endpoint upserts (insert or update) all standard programs so that
 * re-running it after a code correction will fix existing records.
 *
 * It also removes deprecated codes that do not appear in the FSEP document
 * (only if those records have zero hazard associations).
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { prpMaster, hazardPrp } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import { generateId } from "@/lib/utils";

type FsepProgram = {
  fsepCode: string;
  prpType: string;
  programName: string;
  description: string;
  sfcrSection: string;
};

const FSEP_PROGRAMS: FsepProgram[] = [
  // ── A. Premises ───────────────────────────────────────────────────────────
  {
    fsepCode: "A.1",
    prpType: "A",
    programName: "Outside Property",
    description:
      "Maintenance of grounds surrounding the establishment to minimize contamination risks. Includes drainage, waste storage areas, roadways, and parking lot upkeep.",
    sfcrSection: "s.56, s.59",
  },
  {
    fsepCode: "A.2",
    prpType: "A",
    programName: "Inside Property",
    description:
      "Physical design, construction materials, and maintenance of the building interior. Covers floors, walls, ceilings, doors, windows, and separation of incompatible operations.",
    sfcrSection: "s.57–62",
  },
  {
    fsepCode: "A.2.1",
    prpType: "A",
    programName: "Structural Design & Maintenance",
    description:
      "Design, construction, and ongoing maintenance of the building structure including floors, walls, ceilings, and all interior surfaces to prevent contamination.",
    sfcrSection: "s.57–62",
  },
  {
    fsepCode: "A.2.2",
    prpType: "A",
    programName: "Lighting",
    description:
      "Adequate lighting of sufficient intensity in all work areas, inspection stations, and storage areas in compliance with regulatory requirements.",
    sfcrSection: "s.66",
  },
  {
    fsepCode: "A.2.3",
    prpType: "A",
    programName: "Ventilation",
    description:
      "Ventilation systems that prevent condensation, control odours, and minimize air contamination of food contact surfaces. Includes HVAC maintenance.",
    sfcrSection: "s.67",
  },
  {
    fsepCode: "A.2.4",
    prpType: "A",
    programName: "Waste Disposal & Drainage",
    description:
      "Procedures for handling, storing, and disposing of waste, inedible material, and by-products to prevent contamination of food and food contact surfaces.",
    sfcrSection: "s.69–71",
  },
  {
    fsepCode: "A.3",
    prpType: "A",
    programName: "Sanitary Facilities",
    description:
      "Adequate sanitary facilities including washrooms, handwash stations, and employee amenities maintained in a clean and sanitary condition.",
    sfcrSection: "s.63–65",
  },
  {
    fsepCode: "A.3.1",
    prpType: "A",
    programName: "Employee Amenities",
    description:
      "Adequate change rooms, washrooms, lunchrooms, and locker facilities maintained in a clean and sanitary condition. Physically separated from food processing areas.",
    sfcrSection: "s.63–65",
  },
  {
    fsepCode: "A.3.2",
    prpType: "A",
    programName: "Handwash & Sanitizing Stations",
    description:
      "Sufficient number of hand-washing stations equipped with hot and cold running water, soap, and single-use towels or air dryers, located at appropriate points throughout the facility.",
    sfcrSection: "s.63–65",
  },
  {
    fsepCode: "A.4",
    prpType: "A",
    programName: "Water, Ice and Steam Quality",
    description:
      "Potable water supply adequate in quantity and pressure for all food production, cleaning, and sanitation needs. Includes water quality testing, ice production, and steam generation.",
    sfcrSection: "s.68",
  },

  // ── B. Food Conveyances, Purchasing, Receiving and Storage ────────────────
  {
    fsepCode: "B.1",
    prpType: "B",
    programName: "Food Conveyances",
    description:
      "Vehicles and containers used to transport food products, ingredients, and packaging materials are clean, maintained, and appropriate for the product. Includes temperature control during transport.",
    sfcrSection: "s.49–52",
  },
  {
    fsepCode: "B.2",
    prpType: "B",
    programName: "Purchasing, Receiving and Storage",
    description:
      "Controls covering supplier approval, incoming material inspection, and proper storage of ingredients, packaging, and finished goods.",
    sfcrSection: "s.72–74",
  },
  {
    fsepCode: "B.2.1",
    prpType: "B",
    programName: "Purchasing, Receiving & Shipping",
    description:
      "Approved supplier program, incoming material specifications, and receiving inspection procedures. Covers verification of supplier compliance and acceptance/rejection criteria.",
    sfcrSection: "s.72–74",
  },
  {
    fsepCode: "B.2.2",
    prpType: "B",
    programName: "Storage",
    description:
      "Proper storage conditions for ingredients, packaging materials, and finished products including temperature and humidity control, FIFO rotation, and segregation of incompatible materials.",
    sfcrSection: "s.74",
  },
  {
    fsepCode: "B.2.3",
    prpType: "B",
    programName: "Control of Non-Food Chemicals",
    description:
      "Management of cleaning agents, lubricants, pesticides, and other non-food chemicals to prevent contamination of food, food contact surfaces, and packaging.",
    sfcrSection: "s.72–73",
  },

  // ── C. Conveyances and Equipment in the Establishment ────────────────────
  {
    fsepCode: "C.1",
    prpType: "C",
    programName: "Equipment Design and Installation",
    description:
      "Food contact equipment is designed, constructed, and installed to be cleanable, sanitary, and appropriate for its intended use.",
    sfcrSection: "s.53–55",
  },
  {
    fsepCode: "C.1.1",
    prpType: "C",
    programName: "Equipment Cleanability & Design",
    description:
      "Food contact equipment is designed and installed to be cleanable, sanitary, and appropriate for its intended use. Meets applicable food safety standards and minimizes contamination risks.",
    sfcrSection: "s.53–55",
  },
  {
    fsepCode: "C.2",
    prpType: "C",
    programName: "Equipment Maintenance & Calibration",
    description:
      "Preventive maintenance program for all equipment and a calibration program for measuring and monitoring devices critical to food safety.",
    sfcrSection: "s.53",
  },
  {
    fsepCode: "C.2.1",
    prpType: "C",
    programName: "Preventive Maintenance & Calibration",
    description:
      "Scheduled preventive maintenance for all food safety-related equipment and a calibration program for thermometers, scales, metal detectors, and other critical instruments.",
    sfcrSection: "s.53",
  },

  // ── D. Personnel ─────────────────────────────────────────────────────────
  {
    fsepCode: "D.1",
    prpType: "D",
    programName: "Training",
    description:
      "Documented training program ensuring all employees have the competencies required for their food safety responsibilities.",
    sfcrSection: "s.80",
  },
  {
    fsepCode: "D.1.1",
    prpType: "D",
    programName: "Hygiene & Technical Training",
    description:
      "Training program ensuring all employees understand basic food hygiene principles and have job-specific technical skills for critical food safety functions.",
    sfcrSection: "s.80",
  },
  {
    fsepCode: "D.2",
    prpType: "D",
    programName: "Hygiene and Health Requirements",
    description:
      "Written policies and procedures for personal hygiene: hand washing, illness reporting, protective clothing, jewellery restrictions, eating/drinking/smoking prohibitions, and visitor controls.",
    sfcrSection: "s.76–79",
  },
  {
    fsepCode: "D.2.1",
    prpType: "D",
    programName: "Personal Cleanliness",
    description:
      "Requirements for employee personal hygiene including handwashing procedures, protective clothing, and behavior in food handling areas.",
    sfcrSection: "s.76–79",
  },
  {
    fsepCode: "D.2.2",
    prpType: "D",
    programName: "Communicable Diseases & Illness",
    description:
      "Policies for employees to report illness and procedures to prevent contamination from communicable diseases.",
    sfcrSection: "s.76–79",
  },
  {
    fsepCode: "D.2.3",
    prpType: "D",
    programName: "Visitor & Contractor Controls",
    description:
      "Controls governing visitors and contractors in food handling areas including hygiene requirements, sign-in procedures, and escorting rules.",
    sfcrSection: "s.76–79",
  },

  // ── E. Sanitation and Pest Control ───────────────────────────────────────
  {
    fsepCode: "E.1",
    prpType: "E",
    programName: "Sanitation Program",
    description:
      "Master sanitation schedule covering all areas, equipment, and utensils. Includes cleaning frequency, methods, chemicals used (with SDS), concentrations, contact times, and verification procedures.",
    sfcrSection: "s.49–50, s.75",
  },
  {
    fsepCode: "E.1.1",
    prpType: "E",
    programName: "Cleaning & Sanitizing SOPs",
    description:
      "Standard operating procedures for cleaning and sanitizing all food contact and non-food contact surfaces, equipment, and utensils.",
    sfcrSection: "s.49–50, s.75",
  },
  {
    fsepCode: "E.1.2",
    prpType: "E",
    programName: "Pre-Operational Inspections",
    description:
      "Inspection procedures conducted before production starts to verify sanitation is complete and equipment is fit for use.",
    sfcrSection: "s.75",
  },
  {
    fsepCode: "E.2",
    prpType: "E",
    programName: "Pest Control Program",
    description:
      "Integrated pest management program covering prevention, monitoring, and control of insects, rodents, and birds. Includes approved pesticide list, application records, and third-party pest control documentation.",
    sfcrSection: "s.59, s.75",
  },
  {
    fsepCode: "E.2.1",
    prpType: "E",
    programName: "Exclusion & Elimination SOPs",
    description:
      "SOPs for physical exclusion measures, monitoring devices, and chemical/biological elimination methods for pest control.",
    sfcrSection: "s.59, s.75",
  },

  // ── F. Recall System ─────────────────────────────────────────────────────
  {
    fsepCode: "F.1",
    prpType: "F",
    programName: "Recall Plan",
    description:
      "Documented product recall plan that enables rapid identification and withdrawal of affected product from the marketplace. Includes recall team contacts, traceability system, customer notification procedures, and mock recall program.",
    sfcrSection: "s.82–89",
  },
  {
    fsepCode: "F.1.1",
    prpType: "F",
    programName: "Traceback & Product Codes",
    description:
      "Record-keeping and product coding system that enables traceability of ingredients, packaging, and finished products one step back and one step forward through the supply chain.",
    sfcrSection: "s.82–85",
  },
  {
    fsepCode: "F.1.2",
    prpType: "F",
    programName: "Recall Response Protocols",
    description:
      "Procedures for investigating potential recalls, notifying customers and regulatory authorities, and managing the recall process.",
    sfcrSection: "s.86–89",
  },
  {
    fsepCode: "F.1.3",
    prpType: "F",
    programName: "Mock Recalls",
    description:
      "Annual or periodic mock recall exercises to test the effectiveness of the recall system and traceability procedures.",
    sfcrSection: "s.86–89",
  },

  // ── G. Operational Prerequisite Programs ─────────────────────────────────
  {
    fsepCode: "G.1",
    prpType: "G",
    programName: "Allergen Management Control",
    description:
      "Program to prevent undeclared allergens and gluten in finished products. Includes ingredient control, production scheduling, dedicated equipment, label verification, and cleaning validation for allergen changeovers.",
    sfcrSection: "s.47",
  },
  {
    fsepCode: "G.1.1",
    prpType: "G",
    programName: "Cross-Contact Prevention",
    description:
      "Procedures to prevent cross-contact of allergens including production scheduling, equipment segregation, cleaning between runs, and label review.",
    sfcrSection: "s.47",
  },
  {
    fsepCode: "G.2",
    prpType: "G",
    programName: "Foreign Matter Control",
    description:
      "Program to prevent physical contamination of food products. Includes glass and brittle plastic policy, metal detection/X-ray procedures, wood control, and maintenance of food safety filters and screens.",
    sfcrSection: "s.47",
  },
  {
    fsepCode: "G.2.1",
    prpType: "G",
    programName: "Physical Hazard Controls",
    description:
      "Specific controls for physical hazards including glass policy, metal detection, bone/shell controls, and equipment inspection programs.",
    sfcrSection: "s.47",
  },
  {
    fsepCode: "G.3",
    prpType: "G",
    programName: "Other Product-Specific Controls",
    description:
      "Operational controls for product-specific hazards not covered elsewhere, including processing environment controls and rework formulation controls.",
    sfcrSection: "s.47–48",
  },
  {
    fsepCode: "G.3.1",
    prpType: "G",
    programName: "Processing Environment Controls",
    description:
      "Environmental monitoring and control procedures specific to the processing environment to prevent contamination.",
    sfcrSection: "s.47–48",
  },
  {
    fsepCode: "G.3.2",
    prpType: "G",
    programName: "Rework Formulation Control",
    description:
      "Controls governing the use of rework in finished products to prevent allergen cross-contact, identity preservation issues, and unintended formulation changes.",
    sfcrSection: "s.47–48",
  },
] as const;

// Codes present in old seed data that do not exist in the FSEP document
// These will be deleted only if they have zero hazard links
const DEPRECATED_CODES = ["A.2.5", "C.1.2", "D.1.2", "F.2.1", "F.2.2"];

export async function POST() {
  const existing = await db.select().from(prpMaster).all();
  const byCode = new Map(existing.map((r) => [r.fsepCode ?? "", r]));

  let inserted = 0;
  let updated = 0;

  for (const program of FSEP_PROGRAMS) {
    const record = byCode.get(program.fsepCode);
    if (record) {
      await db
        .update(prpMaster)
        .set({
          programName:  program.programName,
          prpType:      program.prpType,
          description:  program.description,
          sfcrSection:  program.sfcrSection,
        })
        .where(eq(prpMaster.id, record.id))
        .run();
      updated++;
    } else {
      await db
        .insert(prpMaster)
        .values({
          id:           generateId(),
          programName:  program.programName,
          prpType:      program.prpType,
          fsepCode:     program.fsepCode,
          sfcrSection:  program.sfcrSection,
          description:  program.description,
          documentReference: null,
          documentUrl:  null,
          documentSource: null,
          owner:        null,
          reviewFrequency: "Annually",
          lastReviewDate: null,
          nextReviewDate: null,
        })
        .run();
      inserted++;
    }
  }

  // Clean up deprecated codes with no hazard links
  let removed = 0;
  const deprecatedRecords = existing.filter(
    (r) => r.fsepCode && DEPRECATED_CODES.includes(r.fsepCode),
  );
  for (const rec of deprecatedRecords) {
    const links = await db
      .select()
      .from(hazardPrp)
      .where(eq(hazardPrp.prpMasterId, rec.id))
      .all();
    if (links.length === 0) {
      await db.delete(prpMaster).where(eq(prpMaster.id, rec.id)).run();
      removed++;
    }
  }

  return NextResponse.json({
    inserted,
    updated,
    removed,
    message: `FSEP template refreshed: ${inserted} added, ${updated} updated, ${removed} deprecated removed.`,
  });
}
