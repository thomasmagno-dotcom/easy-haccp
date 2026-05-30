/**
 * Seed the PRP registry with all standard FSEP prerequisite programs.
 *
 * Source: CFIA Food Safety Enhancement Program (FSEP) Technical Document
 * https://inspection.canada.ca/en/preventive-controls/preventive-control-plans/food-safety-enhancement-program
 *
 * Only inserts programs that do not already exist (matched by fsepCode).
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { prpMaster } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { generateId } from "@/lib/utils";

const FSEP_PROGRAMS = [
  // ── A. Premises ───────────────────────────────────────────────────────────
  {
    fsepCode: "A.1",
    prpType: "A",
    programName: "Outside Property",
    description:
      "Maintenance of grounds surrounding the establishment to minimize contamination risks. Includes drainage, waste storage areas, roadways, and parking lot upkeep.",
  },
  {
    fsepCode: "A.2",
    prpType: "A",
    programName: "Establishment — Design, Construction and Maintenance",
    description:
      "Physical design, construction materials, and maintenance of the building interior. Covers floors, walls, ceilings, doors, windows, and separation of incompatible operations.",
  },
  {
    fsepCode: "A.2.2",
    prpType: "A",
    programName: "Movement of Persons and Things",
    description:
      "Control of personnel and material flow within the establishment to prevent cross-contamination between raw and ready-to-eat areas.",
  },
  {
    fsepCode: "A.2.3",
    prpType: "A",
    programName: "Lighting",
    description:
      "Adequate lighting of sufficient intensity in all work areas, inspection stations, and storage areas in compliance with regulatory requirements.",
  },
  {
    fsepCode: "A.2.4",
    prpType: "A",
    programName: "Ventilation",
    description:
      "Ventilation systems that prevent condensation, control odours, and minimize air contamination of food contact surfaces. Includes HVAC maintenance.",
  },
  {
    fsepCode: "A.2.5",
    prpType: "A",
    programName: "Waste and Inedible / Food Disposal",
    description:
      "Procedures for handling, storing, and disposing of waste, inedible material, and by-products to prevent contamination of food and food contact surfaces.",
  },
  {
    fsepCode: "A.3.1",
    prpType: "A",
    programName: "Employee Facilities",
    description:
      "Adequate change rooms, washrooms, lunchrooms, and locker facilities maintained in a clean and sanitary condition. Physically separated from food processing areas.",
  },
  {
    fsepCode: "A.3.2",
    prpType: "A",
    programName: "Hand-Washing Stations and Sanitizing Installations",
    description:
      "Sufficient number of hand-washing stations equipped with hot and cold running water, soap, and single-use towels or air dryers, located at appropriate points throughout the facility.",
  },
  {
    fsepCode: "A.4",
    prpType: "A",
    programName: "Water, Ice and Steam Supply",
    description:
      "Potable water supply adequate in quantity and pressure for all food production, cleaning, and sanitation needs. Includes water quality testing, ice production, and steam generation.",
  },

  // ── B. Food Conveyances, Purchasing, Receiving and Storage ────────────────
  {
    fsepCode: "B.1",
    prpType: "B",
    programName: "Food Conveyances",
    description:
      "Vehicles and containers used to transport food products, ingredients, and packaging materials are clean, maintained, and appropriate for the product. Includes temperature control during transport.",
  },
  {
    fsepCode: "B.2.1",
    prpType: "B",
    programName: "Purchasing and Receiving",
    description:
      "Approved supplier program, incoming material specifications, and receiving inspection procedures. Covers verification of supplier compliance and acceptance/rejection criteria.",
  },
  {
    fsepCode: "B.2.2",
    prpType: "B",
    programName: "Storage",
    description:
      "Proper storage conditions for ingredients, packaging materials, and finished products including temperature and humidity control, FIFO rotation, and segregation of incompatible materials.",
  },

  // ── C. Conveyances and Equipment in the Establishment ────────────────────
  {
    fsepCode: "C.1.1",
    prpType: "C",
    programName: "Equipment — Design and Installation",
    description:
      "Food contact equipment is designed and installed to be cleanable, sanitary, and appropriate for its intended use. Meets applicable food safety standards and minimizes contamination risks.",
  },
  {
    fsepCode: "C.1.2",
    prpType: "C",
    programName: "Equipment Maintenance and Calibration",
    description:
      "Preventive maintenance program for all equipment and a calibration program for measuring and monitoring devices critical to food safety (thermometers, scales, metal detectors, etc.).",
  },

  // ── D. Personnel ─────────────────────────────────────────────────────────
  {
    fsepCode: "D.1.1",
    prpType: "D",
    programName: "General Food Hygiene Training",
    description:
      "Training program ensuring all employees understand basic food hygiene principles including personal hygiene, cross-contamination prevention, and their role in food safety.",
  },
  {
    fsepCode: "D.1.2",
    prpType: "D",
    programName: "Technical Training",
    description:
      "Job-specific technical training for employees performing critical food safety functions, including HACCP team training, CCP monitoring, and corrective action procedures.",
  },
  {
    fsepCode: "D.2",
    prpType: "D",
    programName: "General Food Hygiene Program",
    description:
      "Written policies and procedures for personal hygiene: hand washing, illness reporting, protective clothing, jewellery restrictions, eating/drinking/smoking prohibitions, and visitor controls.",
  },

  // ── E. Sanitation and Pest Control ───────────────────────────────────────
  {
    fsepCode: "E.1",
    prpType: "E",
    programName: "Sanitation Program",
    description:
      "Master sanitation schedule covering all areas, equipment, and utensils. Includes cleaning frequency, methods, chemicals used (with MSDS/SDS), concentrations, contact times, and verification procedures.",
  },
  {
    fsepCode: "E.2",
    prpType: "E",
    programName: "Pest Control Program",
    description:
      "Integrated pest management program covering prevention, monitoring, and control of insects, rodents, and birds. Includes approved pesticide list, application records, and third-party pest control documentation.",
  },

  // ── F. Recall System ─────────────────────────────────────────────────────
  {
    fsepCode: "F.1",
    prpType: "F",
    programName: "Recall Plan",
    description:
      "Documented product recall plan that enables rapid identification and withdrawal of affected product from the marketplace. Includes recall team contacts, customer notification procedures, and mock recall program.",
  },
  {
    fsepCode: "F.2.1",
    prpType: "F",
    programName: "Traceability System — Documents",
    description:
      "Record-keeping system that enables traceability of ingredients, packaging, and finished products one step back and one step forward through the supply chain.",
  },
  {
    fsepCode: "F.2.2",
    prpType: "F",
    programName: "Labelling for Traceability",
    description:
      "Product coding and labelling procedures that uniquely identify each lot or batch of finished product to support traceability and recall activities.",
  },

  // ── G. Operational Prerequisite Programs ─────────────────────────────────
  {
    fsepCode: "G.1",
    prpType: "G",
    programName: "Allergen, Gluten and Added Sulphites Control",
    description:
      "Program to prevent undeclared allergens, gluten, and sulphites in finished products. Includes ingredient control, production scheduling, dedicated equipment, label verification, and cleaning validation for allergen changeovers.",
  },
  {
    fsepCode: "G.2",
    prpType: "G",
    programName: "Food Additives, Processing Aids and Added Nutrients",
    description:
      "Controls to ensure food additives, processing aids, and nutrients are approved for use, added at correct levels, and properly declared on labels in compliance with Food and Drug Regulations.",
  },
  {
    fsepCode: "G.3",
    prpType: "G",
    programName: "Foreign Material Control Program",
    description:
      "Program to prevent physical contamination of food products. Includes glass and brittle plastic policy, metal detection/X-ray procedures, wood control, and maintenance of food safety filters and screens.",
  },
] as const;

export async function POST() {
  const existing = await db.select().from(prpMaster).all();
  const existingCodes = new Set(existing.map((r) => r.fsepCode).filter(Boolean));

  const toInsert = FSEP_PROGRAMS.filter((p) => !existingCodes.has(p.fsepCode));

  if (toInsert.length === 0) {
    return NextResponse.json({ inserted: 0, message: "All FSEP programs already exist." });
  }

  for (const program of toInsert) {
    await db
      .insert(prpMaster)
      .values({
        id: generateId(),
        programName: program.programName,
        prpType: program.prpType,
        fsepCode: program.fsepCode,
        description: program.description,
        documentReference: null,
        documentUrl: null,
        documentSource: null,
        owner: null,
        reviewFrequency: "Annually",
        lastReviewDate: null,
        nextReviewDate: null,
      })
      .run();
  }

  return NextResponse.json({
    inserted: toInsert.length,
    message: `Loaded ${toInsert.length} standard FSEP prerequisite program${toInsert.length !== 1 ? "s" : ""}.`,
  });
}
