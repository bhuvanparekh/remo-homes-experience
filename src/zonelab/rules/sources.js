/**
 * The official documents every rule number comes from. Each rule in the
 * engine cites the LAMC section and links to one of these, so a visitor can
 * read the exact text.
 *
 * The LAMC itself is published by American Legal (codelibrary.amlegal.com);
 * its pages don't support deep links we can verify, so we link the City's
 * own published documents that state the same rule.
 */

export const DOCS = {
  // City Planning, "Generalized Summary of Zoning Regulations", CP-7150, updated January 2026.
  summary: 'https://planning.lacity.gov/odocument/eadcb225-a16b-4ce6-bc94-c915408c2b04/Zoning_Code_Summary',
  // City Planning checklist CP-4061, Hillside Area Development Standards (Ord. 184,802 text).
  hillside: 'https://planning.lacity.gov/odocument/1e2d684a-9c77-40b1-b700-9d90f32ca8d1/Hillside%20Single%20Family%20Zones.pdf',
  // Ordinance 184,802 (single-family zone rules, effective 17 Mar 2017), signed copy, Council File 14-0656.
  ord184802: 'https://cityclerk.lacity.org/onlinedocs/2014/14-0656_ORD_184802_3-13-17.pdf',
  // City Planning zoning information ZI-2462: summary of Ord. 184,802.
  zi2462: 'https://zimas.lacity.org/documents/zoneinfo/ZI2462.pdf',
  // Zoning Administrator Memo 143 Rev. 1 (Aug 2025): ADUs, LAMC §12.22 A.33 and Gov. Code §66323.
  adu: 'https://planning.lacity.gov/odocument/be4db130-aa38-4637-b35a-d24304d50ff2/ZA_Memo_143_Revision_1_Chapter1.pdf',
  // City Planning SB 9 implementation memo (revised for SB 450 and AB 1061).
  sb9: 'https://planning.lacity.gov/odocument/bef6b998-de32-4090-9557-5f98711c6c15/SB9_Memo_2-7-22MG_-_signed.pdf',
  // City Planning SB 9 FAQ, revised 24 Aug 2026.
  sb9faq: 'https://planning.lacity.gov/odocument/597fb369-6fbd-4148-a057-3f33233405d2/SB9FAQ2.7l.pdf',
  // The LAMC, Chapter I (Planning and Zoning Code), American Legal.
  lamc: 'https://codelibrary.amlegal.com/codes/los_angeles/latest/lapz/0-0-0-1',
}

/** A citation: the section text, linked to the document that states it. */
export const cite = (text, doc = 'summary') => ({ text, href: DOCS[doc] })
