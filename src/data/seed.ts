import type {
  Agency, AppState, BillingSubmission, Conversation, Credential, CredentialRequirement, CredentialType,
  Discipline, InvoiceBatch, Patient, Region, User, Visit, VisitRequest, VisitType, VisitTypeCode, ChannelType,
} from '../domain/types';
import { dateFromNow, daysFromNow } from '../domain/format';
import { cityForZip } from '../domain/geo';

export const STATE_VERSION = 7;

const t = (days: number, hour = 9, minute = 0) => daysFromNow(days, hour, minute);
const d = (days: number) => dateFromNow(days);

export const VISIT_TYPES: VisitType[] = [
  { code: 'SOC', label: 'Start of Care', short: 'SOC' },
  { code: 'EVAL', label: 'Evaluation', short: 'EVAL' },
  { code: 'RE_EVAL', label: 'Re-evaluation', short: 'RE-EVAL' },
  { code: 'FUV', label: 'Follow-up visit', short: 'FUV' },
  { code: 'DC', label: 'Discharge visit', short: 'DC' },
];

const officeUsers: User[] = [
  { id: 'u_jordan', name: 'Jordan Avery', role: 'admin', title: 'Director of Operations', email: 'jordan@hhc-demo.example', phone: '(510) 555-0101', status: 'active', includeInPatientChats: false },
  { id: 'u_maya', name: 'Maya Chen', role: 'office', title: 'Intake Coordinator', email: 'maya@hhc-demo.example', phone: '(510) 555-0102', status: 'active', includeInPatientChats: true },
  { id: 'u_sam', name: 'Sam Patel', role: 'office', title: 'Billing Specialist', email: 'sam@hhc-demo.example', phone: '(510) 555-0103', status: 'active', includeInPatientChats: false },
  { id: 'u_lena', name: 'Lena Ortiz', role: 'office', title: 'HR & Credentialing', email: 'lena@hhc-demo.example', phone: '(510) 555-0104', status: 'active', includeInPatientChats: false },
];

const checklist = (done: string[]): User['onboarding'] =>
  [
    ['agreement', 'Independent contractor agreement signed', true],
    ['w9', 'W-9 on file', true],
    ['license', 'Professional license uploaded', true],
    ['cpr', 'CPR / BLS certification uploaded', true],
    ['tb', 'TB test uploaded', true],
    ['physical', 'Annual physical uploaded', true],
    ['drivers', "Driver's license and auto insurance uploaded", true],
    ['background', 'Background check completed', true],
    ['emr', 'Agency EMR access requested', false],
    ['orientation', 'HHC orientation call completed', false],
  ].map(([key, label, required]) => ({ key: key as string, label: label as string, required: required as boolean, done: done.includes('*') || done.includes(key as string) }));

const PT_RATES = { SOC: 120, EVAL: 110, RE_EVAL: 95, FUV: 75, DC: 85 } as const;
const PTA_RATES = { FUV: 60, DC: 65 } as const;
const OT_RATES = { SOC: 115, EVAL: 110, RE_EVAL: 90, FUV: 72, DC: 80 } as const;
const COTA_RATES = { FUV: 58, DC: 62 } as const;
const ST_RATES = { EVAL: 120, RE_EVAL: 100, FUV: 80, DC: 90 } as const;

const clinicians: User[] = [
  { id: 'c_priya', name: 'Priya Natarajan', role: 'clinician', email: 'priya.n@hhc-demo.example', phone: '(510) 555-0201', status: 'active', disciplines: ['PT'], languages: ['English', 'Hindi'], regionIds: ['r_eastbay_south'], homeCity: 'Fremont', homeZip: '94536', acceptingWork: true, rateCard: PT_RATES, onboarding: checklist(['*']), startedOn: d(-400) },
  { id: 'c_marcus', name: 'Marcus Bell', role: 'clinician', email: 'marcus.b@hhc-demo.example', phone: '(510) 555-0202', status: 'active', disciplines: ['PTA'], languages: ['English'], regionIds: ['r_eastbay_south'], homeCity: 'Hayward', homeZip: '94541', acceptingWork: true, rateCard: PTA_RATES, onboarding: checklist(['*']), startedOn: d(-300) },
  { id: 'c_elena', name: 'Elena Vasquez', role: 'clinician', email: 'elena.v@hhc-demo.example', phone: '(510) 555-0203', status: 'active', disciplines: ['OT'], languages: ['English', 'Spanish'], regionIds: ['r_oakland'], homeCity: 'Oakland', homeZip: '94611', acceptingWork: true, rateCard: OT_RATES, onboarding: checklist(['*']), startedOn: d(-520) },
  { id: 'c_daniel', name: 'Daniel Okafor', role: 'clinician', email: 'daniel.o@hhc-demo.example', phone: '(510) 555-0204', status: 'active', disciplines: ['PT'], languages: ['English'], regionIds: ['r_oakland', 'r_eastbay_south'], homeCity: 'Oakland', homeZip: '94601', acceptingWork: true, rateCard: { SOC: 125, EVAL: 115, RE_EVAL: 95, FUV: 78, DC: 88 }, onboarding: checklist(['*']), startedOn: d(-700) },
  { id: 'c_hannah', name: 'Hannah Lindqvist', role: 'clinician', email: 'hannah.l@hhc-demo.example', phone: '(650) 555-0205', status: 'active', disciplines: ['ST'], languages: ['English'], regionIds: ['r_peninsula'], homeCity: 'San Mateo', homeZip: '94401', acceptingWork: true, rateCard: ST_RATES, onboarding: checklist(['*']), startedOn: d(-150) },
  { id: 'c_tomas', name: 'Tomas Reyes', role: 'clinician', email: 'tomas.r@hhc-demo.example', phone: '(408) 555-0206', status: 'active', disciplines: ['COTA'], languages: ['English', 'Spanish'], regionIds: ['r_southbay'], homeCity: 'San Jose', homeZip: '95112', acceptingWork: true, rateCard: COTA_RATES, onboarding: checklist(['*']), startedOn: d(-220) },
  { id: 'c_grace', name: 'Grace Kim', role: 'clinician', email: 'grace.k@hhc-demo.example', phone: '(650) 555-0207', status: 'active', disciplines: ['PT'], languages: ['English', 'Cantonese'], regionIds: ['r_peninsula', 'r_southbay'], homeCity: 'Redwood City', homeZip: '94063', acceptingWork: false, rateCard: PT_RATES, onboarding: checklist(['*']), startedOn: d(-600) },
  { id: 'c_omar', name: 'Omar Haddad', role: 'clinician', email: 'omar.h@hhc-demo.example', phone: '(408) 555-0208', status: 'invited', disciplines: ['PT'], languages: ['English'], regionIds: ['r_southbay'], homeCity: 'Santa Clara', homeZip: '95050', acceptingWork: true, rateCard: PT_RATES, onboarding: checklist(['agreement', 'w9', 'license']), startedOn: d(-6) },
];

const agencies: Agency[] = [
  { id: 'ag_bayside', name: 'Bayside Home Health', emrLabel: 'Kinnser', emrDomain: 'kinnser.net', billingAddress: '2200 Harbor Bay Pkwy, Alameda, CA 94502', contactEmail: 'ap@bayside-demo.example', active: true, terms: 'Net 30', rateCard: { SOC: 165, EVAL: 150, RE_EVAL: 120, FUV: 95, DC: 110 } },
  { id: 'ag_goldengate', name: 'Golden Gate Home Care', emrLabel: 'Devero', emrDomain: 'devero.com', billingAddress: '455 Market St, Suite 1200, San Francisco, CA 94105', contactEmail: 'billing@ggcare-demo.example', active: true, terms: 'Net 45', rateCard: { SOC: 170, EVAL: 155, RE_EVAL: 125, FUV: 100, DC: 115 } },
  { id: 'ag_redwood', name: 'Redwood Home Health Services', emrLabel: 'HHMD', emrDomain: 'hhmd.example', billingAddress: '1010 Broadway, Oakland, CA 94607', contactEmail: 'accounts@redwoodhh-demo.example', active: true, terms: 'Net 30', rateCard: { SOC: 160, EVAL: 145, RE_EVAL: 115, FUV: 90, DC: 105 } },
  { id: 'ag_peninsula', name: 'Peninsula Care Partners', emrLabel: 'Kinnser', emrDomain: 'kinnser.net', billingAddress: '1900 S Norfolk St, San Mateo, CA 94403', contactEmail: 'ap@peninsulacare-demo.example', active: true, terms: 'Net 30', rateCard: { SOC: 175, EVAL: 160, RE_EVAL: 130, FUV: 100, DC: 120 } },
];

const regions: Region[] = [
  { id: 'r_eastbay_south', name: 'East Bay South', mode: 'zip', zips: ['94536', '94538', '94560', '94541', '94544', '94577'], clinicianIds: ['c_priya', 'c_marcus', 'c_daniel'] },
  { id: 'r_oakland', name: 'Oakland / Berkeley', mode: 'zip', zips: ['94601', '94607', '94611', '94621', '94702', '94710'], clinicianIds: ['c_elena', 'c_daniel'] },
  { id: 'r_peninsula', name: 'Peninsula', mode: 'zip', zips: ['94014', '94015', '94401', '94404', '94063', '94301'], clinicianIds: ['c_hannah', 'c_grace'] },
  { id: 'r_southbay', name: 'South Bay', mode: 'polygon', zips: ['95112', '95123', '95128', '95050', '94086'], polygonLabel: 'Drawn area: San Jose, Santa Clara and Sunnyvale', clinicianIds: ['c_tomas', 'c_grace', 'c_omar'] },
  { id: 'r_contra_costa', name: 'Contra Costa', mode: 'zip', zips: ['94520', '94596'], clinicianIds: [] },
];

const credentialRequirements: CredentialRequirement[] = [
  { type: 'license', label: 'Professional license', blocksNewWork: true, appliesTo: 'all', reminderDays: [30, 14, 7, 0] },
  { type: 'cpr', label: 'CPR / BLS certification', blocksNewWork: true, appliesTo: 'all', reminderDays: [30, 14, 7, 0] },
  { type: 'tb', label: 'TB test', blocksNewWork: true, appliesTo: 'all', reminderDays: [30, 14, 7, 0] },
  { type: 'physical', label: 'Annual physical', blocksNewWork: true, appliesTo: 'all', reminderDays: [30, 14, 7, 0] },
  { type: 'drivers_license', label: "Driver's license", blocksNewWork: true, appliesTo: 'all', reminderDays: [30, 14, 7, 0] },
  { type: 'auto_insurance', label: 'Auto insurance', blocksNewWork: true, appliesTo: 'all', reminderDays: [30, 14, 7, 0] },
  { type: 'background', label: 'Background check', blocksNewWork: true, appliesTo: 'all', reminderDays: [30, 0] },
  { type: 'liability', label: 'Professional liability insurance', blocksNewWork: false, appliesTo: 'all', reminderDays: [30, 7] },
];

// ---- Credentials: default everyone valid, then apply scenario tweaks ----
const DEFAULT_EXPIRY: Record<CredentialType, number> = {
  license: 400, cpr: 300, tb: 200, physical: 250, drivers_license: 900, auto_insurance: 150, background: 500, liability: 180,
};
const FILE_LABEL: Record<CredentialType, string> = {
  license: 'license', cpr: 'cpr-card', tb: 'tb-result', physical: 'physical', drivers_license: 'drivers-license', auto_insurance: 'auto-insurance', background: 'background-check', liability: 'liability-coi',
};
function credsFor(c: User, tweaks: Partial<Record<CredentialType, Partial<Credential> | null>> = {}): Credential[] {
  const out: Credential[] = [];
  const last = c.name.split(' ')[1]!.toLowerCase();
  for (const req of credentialRequirements) {
    const tweak = tweaks[req.type];
    if (tweak === null) {
      out.push({ id: `cr_${c.id}_${req.type}`, clinicianId: c.id, type: req.type, status: 'missing', history: [] });
      continue;
    }
    const base: Credential = {
      id: `cr_${c.id}_${req.type}`,
      clinicianId: c.id,
      type: req.type,
      fileName: `${last}-${FILE_LABEL[req.type]}.pdf`,
      issuedOn: d(-120),
      expiresOn: d(DEFAULT_EXPIRY[req.type] - ((c.id.charCodeAt(2) * 7) % 60)),
      status: 'approved',
      uploadedAt: t(-120, 10),
      reviewedBy: 'u_lena',
      reviewedAt: t(-119, 11),
      history: [{ at: t(-120, 10), actorId: c.id, text: 'Uploaded document' }, { at: t(-119, 11), actorId: 'u_lena', text: 'Approved' }],
    };
    out.push({ ...base, ...(tweak ?? {}) });
  }
  return out;
}

const credentials: Credential[] = [
  ...credsFor(clinicians[0]!), // Priya - all good
  ...credsFor(clinicians[1]!), // Marcus
  ...credsFor(clinicians[2]!, { drivers_license: { expiresOn: d(12) } }), // Elena - expiring
  ...credsFor(clinicians[3]!, {
    cpr: { expiresOn: d(-9), history: [{ at: t(-380, 10), actorId: 'c_daniel', text: 'Uploaded document' }, { at: t(-379, 11), actorId: 'u_lena', text: 'Approved' }, { at: t(-9, 6), actorId: 'system', text: 'Expired - blocks new requests' }] },
  }), // Daniel - expired CPR blocks new work
  ...credsFor(clinicians[4]!, { tb: { expiresOn: d(21) } }), // Hannah - TB expiring
  ...credsFor(clinicians[5]!),
  ...credsFor(clinicians[6]!),
  ...credsFor(clinicians[7]!, { cpr: null, tb: null, physical: null, drivers_license: null, auto_insurance: null, background: { status: 'under_review', reviewedBy: undefined, reviewedAt: undefined, uploadedAt: t(-1, 15), history: [{ at: t(-1, 15), actorId: 'c_omar', text: 'Uploaded document' }] }, liability: null }), // Omar onboarding
];
// Hannah uploaded a TB renewal that is under review (supersedes when approved)
credentials.push({
  id: 'cr_c_hannah_tb_renewal', clinicianId: 'c_hannah', type: 'tb', fileName: 'lindqvist-tb-result-renewal.pdf', issuedOn: d(-2), expiresOn: d(363), status: 'under_review', uploadedAt: t(-1, 18, 20),
  history: [{ at: t(-1, 18, 20), actorId: 'c_hannah', text: 'Uploaded renewal document' }],
});

// ---- Patients ----
interface P { id: string; first: string; last: string; dob: string; mrn?: string; phone: string; street: string; zip: string; agencyId: string; insurance: string; officeNotes?: string; clinicianNotes?: string; discipline: Discipline; visitType: VisitTypeCode; receivedDays: number; caseNotes: string }
const pDefs: P[] = [
  { id: 'p_whitfield', first: 'Dorothy', last: 'Whitfield', dob: '1941-03-18', mrn: 'BHH-20417', phone: '(510) 555-0301', street: '38921 Cherry St, Apt 12', zip: '94536', agencyId: 'ag_bayside', insurance: 'Medicare', clinicianNotes: 'Walker in home. Daughter present for visits.', discipline: 'PT', visitType: 'SOC', receivedDays: -8, caseNotes: 'PT SOC after hip replacement. Frequency per eval.' },
  { id: 'p_castillo', first: 'Raymond', last: 'Castillo', dob: '1955-11-02', mrn: 'GG-77812', phone: '(510) 555-0302', street: '24556 Amador St', zip: '94541', agencyId: 'ag_goldengate', insurance: 'Medicare Advantage', clinicianNotes: 'PTA to follow 2w3. Spanish preferred.', discipline: 'PTA', visitType: 'FUV', receivedDays: -6, caseNotes: 'PTA follow-up under PT plan of care.' },
  { id: 'p_chao', first: 'Mei-Ling', last: 'Chao', dob: '1948-07-09', mrn: 'RHH-1190', phone: '(510) 555-0303', street: '5860 Broadway Terrace', zip: '94611', agencyId: 'ag_redwood', insurance: 'Medicare', clinicianNotes: 'OT eval - ADL retraining after CVA. Call before arrival.', discipline: 'OT', visitType: 'EVAL', receivedDays: -4, caseNotes: 'OT eval requested by agency case manager.' },
  { id: 'p_reyes', first: 'Antonio', last: 'Reyes-Ferreira', dob: '1939-01-27', mrn: 'PCP-33021', phone: '(408) 555-0304', street: '1445 N 4th St', zip: '95112', agencyId: 'ag_peninsula', insurance: 'Medi-Cal', clinicianNotes: 'COTA follow-up 1w4. Spanish speaking.', discipline: 'COTA', visitType: 'FUV', receivedDays: -2, caseNotes: 'COTA to follow after OT eval completed by agency staff.' },
  { id: 'p_jenkins', first: 'Harold', last: 'Jenkins', dob: '1946-05-30', mrn: 'GG-78003', phone: '(650) 555-0305', street: '90 Skyline Dr', zip: '94014', agencyId: 'ag_goldengate', insurance: 'Medicare', clinicianNotes: 'ST eval for dysphagia. Wife is primary caregiver.', discipline: 'ST', visitType: 'EVAL', receivedDays: -1, caseNotes: 'ST eval, PTSOC completed by agency RN.' },
  { id: 'p_nakamura', first: 'Beatrice', last: 'Nakamura', dob: '1950-09-14', mrn: 'BHH-20488', phone: '(510) 555-0306', street: '6310 Thornton Ave', zip: '94560', agencyId: 'ag_bayside', insurance: 'Medicare', clinicianNotes: 'PT eval this week. Gated community - code in office notes.', officeNotes: 'Gate code 4471. Agency CM: Nina.', discipline: 'PT', visitType: 'EVAL', receivedDays: -1, caseNotes: 'PT eval after fall at home. No fracture.' },
  { id: 'p_brennan', first: 'Walter', last: 'Brennan', dob: '1943-12-05', mrn: 'RHH-1204', phone: '(925) 555-0307', street: '2151 Salvio St', zip: '94520', agencyId: 'ag_redwood', insurance: 'Medicare', clinicianNotes: 'PT SOC.', discipline: 'PT', visitType: 'SOC', receivedDays: -13, caseNotes: 'PT SOC. Outside current coverage.' },
  { id: 'p_marsh', first: 'Linda', last: 'Marsh', dob: '1952-02-21', mrn: 'RHH-1177', phone: '(510) 555-0308', street: '41200 Blacow Rd', zip: '94538', agencyId: 'ag_redwood', insurance: 'Medicare', clinicianNotes: 'PT follow-up 1w2.', discipline: 'PT', visitType: 'FUV', receivedDays: -26, caseNotes: 'PT follow-up visits under active plan of care.' },
  { id: 'p_espinoza', first: 'Gloria', last: 'Espinoza', dob: '1937-08-11', mrn: 'PCP-33150', phone: '(408) 555-0309', street: '5788 Snell Ave', zip: '95123', agencyId: 'ag_peninsula', insurance: 'Medicare', clinicianNotes: 'PT SOC. Spanish speaking.', discipline: 'PT', visitType: 'SOC', receivedDays: -9, caseNotes: 'PT SOC. No available PT in South Bay.' },
  { id: 'p_delgado', first: 'Frank', last: 'Delgado', dob: '1944-04-03', mrn: 'BHH-20301', phone: '(510) 555-0310', street: '3350 Fruitvale Ave', zip: '94601', agencyId: 'ag_bayside', insurance: 'Medicare', clinicianNotes: 'PT SOC. Second floor, no elevator.', discipline: 'PT', visitType: 'SOC', receivedDays: -31, caseNotes: 'PT SOC after CHF admission.' },
  { id: 'p_okonkwo', first: 'Adaeze', last: 'Okonkwo', dob: '1958-06-16', mrn: 'BHH-20501', phone: '(510) 555-0311', street: '3825 Peralta Blvd', zip: '94536', agencyId: 'ag_bayside', insurance: 'Medicare', clinicianNotes: 'PT follow-up 2w2. Prefers afternoons.', discipline: 'PT', visitType: 'FUV', receivedDays: -19, caseNotes: 'PT follow-up visits; eval completed by agency PT.' },
];

const patients: Patient[] = pDefs.map((p) => ({
  id: p.id,
  firstName: p.first,
  lastName: p.last,
  dob: p.dob,
  mrn: p.mrn,
  phone: p.phone,
  address: { street: p.street, city: cityForZip(p.zip), state: 'CA', zip: p.zip },
  agencyId: p.agencyId,
  emrRef: `${agencies.find((a) => a.id === p.agencyId)!.emrLabel}: ${agencies.find((a) => a.id === p.agencyId)!.name.split(' ')[0]}`,
  insurance: p.insurance,
  officeNotes: p.officeNotes ?? '',
  clinicianNotes: p.clinicianNotes ?? '',
  referrals: [{ id: `ref_${p.id}`, receivedOn: d(p.receivedDays), discipline: p.discipline, visitTypeCode: p.visitType, caseNotes: p.caseNotes, source: 'Agency email' }],
  attachments: p.id === 'p_whitfield' ? [{ id: 'att_1', name: 'referral-face-sheet.pdf', uploadedAt: t(-8, 10), by: 'u_maya' }] : [],
  createdAt: t(p.receivedDays, 9, 30),
  history: [{ at: t(p.receivedDays, 9, 30), actorId: 'u_maya', text: 'Patient and referral added' }],
}));

// ---- Requests ----
function req(
  p: P, status: VisitRequest['status'], opts: Partial<VisitRequest> & { createdDays: number; visitByDays: number; recipients: VisitRequest['recipients'] },
): VisitRequest {
  const patient = patients.find((x) => x.id === p.id)!;
  const { createdDays, visitByDays, ...rest } = opts;
  return {
    id: `rq_${p.id.slice(2)}`,
    patientId: p.id,
    referralId: `ref_${p.id}`,
    agencyId: p.agencyId,
    discipline: p.discipline,
    visitTypeCode: p.visitType,
    visitBy: t(visitByDays, 23, 59),
    notesToClinicians: patient.clinicianNotes,
    officeNotes: patient.officeNotes,
    languages: p.clinicianNotes?.includes('Spanish') ? ['Spanish'] : [],
    assignMode: 'fcfs',
    groups: [{ no: 1, delayMinutes: 0, releasedAt: t(createdDays, 9, 45) }],
    status,
    createdAt: t(createdDays, 9, 40),
    createdBy: 'u_maya',
    log: [
      { at: t(createdDays, 9, 40), actorId: 'u_maya', text: 'Request created' },
      { at: t(createdDays, 9, 45), actorId: 'u_maya', text: `Sent to ${opts.recipients.filter((r) => r.sentAt).length} clinician(s) in priority group 1 (first-come-first-served)` },
    ],
    ...rest,
  };
}
const rcp = (clinicianId: string, days: number, hour: number, extra: Partial<VisitRequest['recipients'][number]> = {}) => ({
  clinicianId, groupNo: 1, sentAt: t(days, hour, 45), readAt: null, response: null, respondedAt: null, ...extra,
});

const requests: VisitRequest[] = [
  req(pDefs[0]!, 'assigned', { createdDays: -8, visitByDays: -4, assignedClinicianId: 'c_priya', assignedAt: t(-8, 11, 5), recipients: [
    rcp('c_priya', -8, 9, { readAt: t(-8, 10, 50), response: 'available', respondedAt: t(-8, 11, 5), comment: 'Can see Thursday afternoon.' }),
    rcp('c_daniel', -8, 9, { readAt: t(-8, 12, 0), response: 'not_available', respondedAt: t(-8, 12, 2) }),
  ], log: [
    { at: t(-8, 9, 40), actorId: 'u_maya', text: 'Request created' },
    { at: t(-8, 9, 45), actorId: 'u_maya', text: 'Sent to 2 clinicians in priority group 1 (first-come-first-served)' },
    { at: t(-8, 11, 5), actorId: 'c_priya', text: 'Responded Available' },
    { at: t(-8, 11, 5), actorId: 'system', text: 'Assigned to Priya Natarajan (first eligible acceptance)' },
  ] }),
  req(pDefs[1]!, 'assigned', { createdDays: -6, visitByDays: -1, assignedClinicianId: 'c_marcus', assignedAt: t(-6, 10, 20), recipients: [
    rcp('c_marcus', -6, 9, { readAt: t(-6, 10, 15), response: 'available', respondedAt: t(-6, 10, 20) }),
  ], log: [
    { at: t(-6, 9, 40), actorId: 'u_maya', text: 'Request created' },
    { at: t(-6, 9, 45), actorId: 'u_maya', text: 'Sent to 1 clinician in priority group 1 (first-come-first-served)' },
    { at: t(-6, 10, 20), actorId: 'c_marcus', text: 'Responded Available' },
    { at: t(-6, 10, 20), actorId: 'system', text: 'Assigned to Marcus Bell (first eligible acceptance)' },
  ] }),
  req(pDefs[2]!, 'assigned', { createdDays: -4, visitByDays: 2, assignedClinicianId: 'c_elena', assignedAt: t(-3, 8, 10), recipients: [
    rcp('c_elena', -4, 9, { readAt: t(-3, 8, 0), response: 'available', respondedAt: t(-3, 8, 10) }),
  ], log: [
    { at: t(-4, 9, 40), actorId: 'u_maya', text: 'Request created' },
    { at: t(-4, 9, 45), actorId: 'u_maya', text: 'Sent to 1 clinician in priority group 1 (first-come-first-served)' },
    { at: t(-3, 8, 10), actorId: 'c_elena', text: 'Responded Available' },
    { at: t(-3, 8, 10), actorId: 'system', text: 'Assigned to Elena Vasquez (first eligible acceptance)' },
  ] }),
  req(pDefs[3]!, 'pending', { createdDays: -2, visitByDays: 0, recipients: [
    rcp('c_tomas', -2, 9, { readAt: t(-1, 7, 30) }),
  ], groups: [{ no: 1, delayMinutes: 0, releasedAt: t(-2, 9, 45) }, { no: 2, delayMinutes: 120, releasedAt: null }], log: [
    { at: t(-2, 9, 40), actorId: 'u_maya', text: 'Request created' },
    { at: t(-2, 9, 45), actorId: 'u_maya', text: 'Sent to 1 clinician in priority group 1 (first-come-first-served)' },
    { at: t(-1, 7, 30), actorId: 'c_tomas', text: 'Read the request' },
  ] }),
  req(pDefs[4]!, 'pending', { createdDays: -1, visitByDays: 3, recipients: [rcp('c_hannah', -1, 14)], groups: [{ no: 1, delayMinutes: 0, releasedAt: t(-1, 14, 45) }] }),
  req(pDefs[5]!, 'pending', { createdDays: -1, visitByDays: 4, recipients: [rcp('c_priya', -1, 16)], groups: [{ no: 1, delayMinutes: 0, releasedAt: t(-1, 16, 45) }], log: [
    { at: t(-1, 16, 40), actorId: 'u_maya', text: 'Request created' },
    { at: t(-1, 16, 45), actorId: 'u_maya', text: 'Sent to 1 clinician in priority group 1 (first-come-first-served). Daniel Okafor excluded: credential block (CPR expired).' },
  ] }),
  req(pDefs[6]!, 'closed', { createdDays: -13, visitByDays: -10, closedReason: 'unstaffed', recipients: [], groups: [{ no: 1, delayMinutes: 0, releasedAt: null }], log: [
    { at: t(-13, 9, 40), actorId: 'u_maya', text: 'Request created' },
    { at: t(-13, 9, 42), actorId: 'system', text: 'No clinician covers ZIP 94520 for PT' },
    { at: t(-10, 17, 0), actorId: 'u_maya', text: 'Closed - unstaffed. Agency notified.' },
  ] }),
  req(pDefs[7]!, 'assigned', { createdDays: -26, visitByDays: -22, assignedClinicianId: 'c_priya', assignedAt: t(-26, 10, 0), recipients: [
    rcp('c_priya', -26, 9, { readAt: t(-26, 9, 55), response: 'available', respondedAt: t(-26, 10, 0) }),
  ], log: [
    { at: t(-26, 9, 40), actorId: 'u_maya', text: 'Request created' },
    { at: t(-26, 9, 45), actorId: 'u_maya', text: 'Sent to 2 clinicians in priority group 1 (first-come-first-served)' },
    { at: t(-26, 10, 0), actorId: 'system', text: 'Assigned to Priya Natarajan (first eligible acceptance)' },
  ] }),
  req(pDefs[8]!, 'closed', { createdDays: -9, visitByDays: -6, closedReason: 'unstaffed', recipients: [], groups: [{ no: 1, delayMinutes: 0, releasedAt: null }], log: [
    { at: t(-9, 9, 40), actorId: 'u_maya', text: 'Request created' },
    { at: t(-9, 9, 42), actorId: 'system', text: 'Grace Kim covers 95123 but is not accepting new work' },
    { at: t(-6, 17, 0), actorId: 'u_maya', text: 'Closed - unstaffed. Agency notified.' },
  ] }),
  req(pDefs[9]!, 'assigned', { createdDays: -31, visitByDays: -27, assignedClinicianId: 'c_daniel', assignedAt: t(-31, 11, 0), recipients: [
    rcp('c_daniel', -31, 9, { readAt: t(-31, 10, 50), response: 'available', respondedAt: t(-31, 11, 0) }),
    rcp('c_priya', -31, 9, { readAt: t(-31, 12, 0) }),
  ], log: [
    { at: t(-31, 9, 40), actorId: 'u_maya', text: 'Request created' },
    { at: t(-31, 9, 45), actorId: 'u_maya', text: 'Sent to 2 clinicians in priority group 1 (first-come-first-served)' },
    { at: t(-31, 11, 0), actorId: 'system', text: 'Assigned to Daniel Okafor (first eligible acceptance)' },
  ] }),
  req(pDefs[10]!, 'assigned', { createdDays: -19, visitByDays: -15, assignedClinicianId: 'c_priya', assignedAt: t(-19, 10, 30), recipients: [
    rcp('c_priya', -19, 9, { readAt: t(-19, 10, 25), response: 'available', respondedAt: t(-19, 10, 30) }),
  ], log: [
    { at: t(-19, 9, 40), actorId: 'u_maya', text: 'Request created' },
    { at: t(-19, 9, 45), actorId: 'u_maya', text: 'Sent to 1 clinician in priority group 1 (first-come-first-served)' },
    { at: t(-19, 10, 30), actorId: 'system', text: 'Assigned to Priya Natarajan (first eligible acceptance)' },
  ] }),
];

// ---- Visits ----
function visit(p: P, clinicianId: string, o: Partial<Visit> & { plannedDays: number | null }): Visit {
  const { plannedDays, ...rest } = o;
  return {
    id: `v_${p.id.slice(2)}`,
    requestId: `rq_${p.id.slice(2)}`,
    patientId: p.id,
    clinicianId,
    agencyId: p.agencyId,
    visitTypeCode: p.visitType,
    discipline: p.discipline,
    plannedDate: plannedDays === null ? null : d(plannedDays),
    plotStatus: 'not_plotted',
    plotUpdatedAt: null,
    officeNote: '',
    visitCompletedAt: null,
    noteCompletedAt: null,
    history: [],
    ...rest,
  };
}
const visits: Visit[] = [
  visit(pDefs[0]!, 'c_priya', { plannedDays: -5, plotStatus: 'plotted', plotUpdatedAt: t(-7, 14), visitCompletedAt: t(-5, 15, 10), noteCompletedAt: t(-5, 20, 30), billingSubmissionId: 'bs_whitfield', history: [{ at: t(-7, 14), actorId: 'u_maya', text: 'Marked plotted in Kinnser' }, { at: t(-5, 20, 30), actorId: 'c_priya', text: 'Confirmed visit and note completion' }] }),
  visit(pDefs[1]!, 'c_marcus', { plannedDays: -1, plotStatus: 'plotted', plotUpdatedAt: t(-5, 13), visitCompletedAt: t(-1, 16, 0), noteCompletedAt: t(-1, 19, 0), billingSubmissionId: 'bs_castillo', history: [{ at: t(-5, 13), actorId: 'u_maya', text: 'Marked plotted in Devero' }, { at: t(-1, 19, 0), actorId: 'c_marcus', text: 'Confirmed visit and note completion' }] }),
  visit(pDefs[2]!, 'c_elena', { plannedDays: 1, plotStatus: 'not_plotted', history: [{ at: t(-3, 8, 10), actorId: 'system', text: 'Visit created on assignment' }] }),
  visit(pDefs[7]!, 'c_priya', { plannedDays: -23, plotStatus: 'plotted', plotUpdatedAt: t(-25, 11), visitCompletedAt: t(-23, 14, 0), noteCompletedAt: t(-23, 18, 0), billingSubmissionId: 'bs_marsh', history: [] }),
  visit(pDefs[9]!, 'c_daniel', { plannedDays: -28, plotStatus: 'plotted', plotUpdatedAt: t(-30, 11), visitCompletedAt: t(-28, 12, 0), noteCompletedAt: t(-28, 21, 0), billingSubmissionId: 'bs_delgado', history: [] }),
  visit(pDefs[10]!, 'c_priya', { plannedDays: -16, plotStatus: 'plotted', plotUpdatedAt: t(-18, 11), visitCompletedAt: t(-16, 15, 0), noteCompletedAt: t(-16, 19, 30), billingSubmissionId: 'bs_okonkwo', history: [] }),
];

// ---- Billing submissions ----
function sub(id: string, p: P, clinicianId: string, visitDays: number, clinicianRate: number, o: Partial<BillingSubmission>): BillingSubmission {
  return {
    id, visitId: `v_${p.id.slice(2)}`, clinicianId, patientId: p.id, agencyId: p.agencyId, visitDate: d(visitDays), visitTypeCode: p.visitType,
    clinicianRate, agencyRate: null, memo: '', status: 'submitted', submittedAt: t(visitDays, 20, 45), payoutStatus: 'pending', history: [{ at: t(visitDays, 20, 45), actorId: clinicianId, text: 'Submitted for billing review' }],
    ...o,
  };
}
const submissions: BillingSubmission[] = [
  sub('bs_whitfield', pDefs[0]!, 'c_priya', -5, 120, { status: 'approved', agencyRate: 165, reviewedAt: t(-4, 10), reviewedBy: 'u_sam', invoiceBatchId: 'inv_bayside_1', exportedAt: t(-3, 16), payoutStatus: 'approved', memo: 'SOC completed; daughter present.', history: [
    { at: t(-5, 20, 45), actorId: 'c_priya', text: 'Submitted for billing review' },
    { at: t(-4, 10), actorId: 'u_sam', text: 'Approved. Clinician rate $120.00, agency rate $165.00 snapshotted.' },
    { at: t(-3, 16), actorId: 'u_sam', text: 'Included in invoice INV-BHH-1042 and exported for QuickBooks' },
  ] }),
  sub('bs_castillo', pDefs[1]!, 'c_marcus', -1, 60, { memo: 'FUV completed. Patient progressing with gait training.' }),
  sub('bs_marsh', pDefs[7]!, 'c_priya', -23, 75, { status: 'approved', agencyRate: 90, reviewedAt: t(-22, 9), reviewedBy: 'u_sam', invoiceBatchId: 'inv_redwood_1', exportedAt: t(-20, 16), payoutStatus: 'paid', paymentDate: d(-12), paymentRef: 'ACH 88214', history: [
    { at: t(-23, 20, 45), actorId: 'c_priya', text: 'Submitted for billing review' },
    { at: t(-22, 9), actorId: 'u_sam', text: 'Approved. Clinician rate $75.00, agency rate $90.00 snapshotted.' },
    { at: t(-20, 16), actorId: 'u_sam', text: 'Included in invoice INV-RHH-0311 and exported for QuickBooks' },
    { at: t(-12, 11), actorId: 'u_sam', text: 'Payout marked paid - ACH 88214' },
  ] }),
  sub('bs_delgado', pDefs[9]!, 'c_daniel', -28, 125, { status: 'approved', agencyRate: 165, reviewedAt: t(-27, 9), reviewedBy: 'u_sam', invoiceBatchId: 'inv_bayside_0', exportedAt: t(-26, 16), payoutStatus: 'paid', paymentDate: d(-14), paymentRef: 'ACH 88190', history: [
    { at: t(-28, 21, 30), actorId: 'c_daniel', text: 'Submitted for billing review' },
    { at: t(-27, 9), actorId: 'u_sam', text: 'Approved. Clinician rate $125.00, agency rate $165.00 snapshotted.' },
    { at: t(-26, 16), actorId: 'u_sam', text: 'Included in invoice INV-BHH-1039 and exported for QuickBooks' },
    { at: t(-14, 11), actorId: 'u_sam', text: 'Payout marked paid - ACH 88190' },
  ] }),
  sub('bs_okonkwo', pDefs[10]!, 'c_priya', -16, 75, { status: 'returned', returnReason: 'Visit date does not match the date plotted in Kinnser. Please confirm the actual visit date and resubmit.', reviewedAt: t(-14, 10), reviewedBy: 'u_sam', memo: 'FUV completed.', history: [
    { at: t(-16, 20, 45), actorId: 'c_priya', text: 'Submitted for billing review' },
    { at: t(-14, 10), actorId: 'u_sam', text: 'Returned: Visit date does not match the date plotted in Kinnser. Please confirm the actual visit date and resubmit.' },
  ] }),
];

const invoiceBatches: InvoiceBatch[] = [
  { id: 'inv_bayside_0', invoiceNo: 'INV-BHH-1039', agencyId: 'ag_bayside', from: d(-45), to: d(-26), lineIds: ['bs_delgado'], total: 165, status: 'exported', createdAt: t(-26, 15, 50), createdBy: 'u_sam', exportedAt: t(-26, 16), exportedBy: 'u_sam', fileName: 'quickbooks-bayside-INV-BHH-1039.csv' },
  { id: 'inv_redwood_1', invoiceNo: 'INV-RHH-0311', agencyId: 'ag_redwood', from: d(-30), to: d(-20), lineIds: ['bs_marsh'], total: 90, status: 'exported', createdAt: t(-20, 15, 50), createdBy: 'u_sam', exportedAt: t(-20, 16), exportedBy: 'u_sam', fileName: 'quickbooks-redwood-INV-RHH-0311.csv' },
  { id: 'inv_bayside_1', invoiceNo: 'INV-BHH-1042', agencyId: 'ag_bayside', from: d(-10), to: d(-3), lineIds: ['bs_whitfield'], total: 165, status: 'exported', createdAt: t(-3, 15, 50), createdBy: 'u_sam', exportedAt: t(-3, 16), exportedBy: 'u_sam', fileName: 'quickbooks-bayside-INV-BHH-1042.csv' },
];

// ---- Conversations ----
const intakeTeam = ['u_maya', 'u_jordan'];
function patientChat(p: P, clinicianId: string, assignedDays: number, hour: number, extraMsgs: Conversation['messages'] = []): Conversation {
  const patient = patients.find((x) => x.id === p.id)!;
  const clinician = clinicians.find((c) => c.id === clinicianId)!;
  const agency = agencies.find((a) => a.id === p.agencyId)!;
  return {
    id: `conv_${p.id.slice(2)}`,
    kind: 'patient',
    patientId: p.id,
    name: `${patient.firstName} ${patient.lastName}`,
    memberIds: [...intakeTeam, clinicianId],
    messages: [
      { id: `m_${p.id}_1`, authorId: 'u_maya', at: t(assignedDays, hour, 2), body: `Thank you for accepting the ${p.visitType === 'FUV' ? 'follow-up visits' : VISIT_TYPES.find((v) => v.code === p.visitType)!.label} for ${patient.firstName} ${patient.lastName}, @${clinician.name}. Please wait until the visit is plotted in ${agency.emrLabel} before seeing the patient. After your assessment, please report frequency and effective date, and any DME needs. Thank you!` },
      ...extraMsgs,
    ],
    lastReadAt: { u_maya: t(0, 8), u_jordan: t(0, 8) },
  };
}
const conversations: Conversation[] = [
  patientChat(pDefs[0]!, 'c_priya', -8, 11, [
    { id: 'm_w2', authorId: 'c_priya', at: t(-7, 15, 20), body: 'Thank you! I can do Thursday afternoon. Is the visit plotted yet?' },
    { id: 'm_w3', authorId: 'u_maya', at: t(-7, 14, 5), body: 'Plotted in Kinnser for Thursday. You are good to go.' },
    { id: 'm_w4', authorId: 'c_priya', at: t(-5, 20, 35), body: 'Visit done. Frequency 2w4 effective this week. Patient needs a shower chair - DME order requested with agency.' },
  ]),
  patientChat(pDefs[1]!, 'c_marcus', -6, 10, [
    { id: 'm_c2', authorId: 'c_marcus', at: t(-1, 19, 5), body: 'Visit completed and note is in Devero. Submitting billing now.' },
  ]),
  patientChat(pDefs[2]!, 'c_elena', -3, 8, [
    { id: 'm_ch2', authorId: 'c_elena', at: t(-1, 9, 15), body: 'Planning to see Mrs. Chao tomorrow morning. Has the eval been plotted in HHMD yet?' },
  ]),
  patientChat(pDefs[7]!, 'c_priya', -26, 10),
  patientChat(pDefs[9]!, 'c_daniel', -31, 11),
  patientChat(pDefs[10]!, 'c_priya', -19, 10, [
    { id: 'm_o2', authorId: 'u_sam', at: t(-14, 10, 5), body: 'Hi Priya - I returned the billing line for this visit; Kinnser shows the visit plotted one day later than your submission. Can you confirm the date?' },
  ]),
];
// Department channels per clinician + announcements
const channelMembers: Record<ChannelType, string[]> = {
  intake: ['u_maya', 'u_jordan'], hr: ['u_lena', 'u_jordan'], billing: ['u_sam', 'u_jordan'], medical_records: ['u_maya', 'u_lena'], announcements: officeUsers.map((u) => u.id),
};
const channelNames: Record<ChannelType, string> = { intake: 'Intake', hr: 'Human Resources', billing: 'Billing', medical_records: 'Medical Records', announcements: 'Announcements' };
for (const c of clinicians.filter((x) => x.status !== 'inactive')) {
  for (const type of ['intake', 'hr', 'billing', 'medical_records'] as ChannelType[]) {
    const conv: Conversation = {
      id: `ch_${type}_${c.id}`, kind: 'channel', channelType: type, clinicianId: c.id, name: `${channelNames[type]} - ${c.name} ${c.disciplines![0]}`,
      memberIds: [...channelMembers[type], c.id], messages: [], lastReadAt: {},
    };
    if (c.id === 'c_priya' && type === 'billing') {
      conv.messages.push({ id: 'm_bp1', authorId: 'u_sam', at: t(-14, 10, 10), body: 'Hi Priya, one line from your last cycle was returned (Okonkwo FUV). Please check the visit date and resubmit from Billing.' });
    }
    if (c.id === 'c_priya' && type === 'hr') {
      conv.messages.push({ id: 'm_hp1', authorId: 'u_lena', at: t(-40, 9, 0), body: 'Hi Priya, your updated auto insurance was approved. Nothing else due this quarter.' });
      conv.messages.push({ id: 'm_hp2', authorId: 'c_priya', at: t(-40, 9, 40), body: 'Great, thank you Lena!' });
    }
    if (c.id === 'c_priya' && type === 'intake') {
      conv.messages.push({ id: 'm_ip1', authorId: 'u_maya', at: t(-2, 13, 0), body: 'Priya, we have a few PT evals coming in Newark this week - keep an eye on Requests.' });
    }
    if (c.id === 'c_daniel' && type === 'hr') {
      conv.messages.push({ id: 'm_hd1', authorId: 'system', at: t(-9, 6, 0), body: 'Reminder: CPR / BLS certification for Daniel Okafor expired today. New requests are blocked until a valid document is approved.' });
      conv.messages.push({ id: 'm_hd2', authorId: 'u_lena', at: t(-8, 9, 0), body: 'Hi Daniel - your CPR card expired. Please upload the renewal from Onboarding & Credentials so we can keep sending you patients.' });
    }
    if (c.id === 'c_elena' && type === 'hr') {
      conv.messages.push({ id: 'm_he1', authorId: 'system', at: t(-2, 6, 0), body: "Reminder: Driver's license for Elena Vasquez expires in 14 days." });
    }
    conversations.push(conv);
  }
}
conversations.push({
  id: 'ch_announcements', kind: 'channel', channelType: 'announcements', name: 'Announcements',
  memberIds: [...officeUsers.map((u) => u.id), ...clinicians.filter((c) => c.status === 'active').map((c) => c.id)],
  messages: [
    { id: 'm_a1', authorId: 'u_jordan', at: t(-3, 8, 0), body: 'Billing cycle reminder: submit all visits through the 15th by Friday so agency invoices go out on time. Rates are pre-filled - no need to type them.' },
    { id: 'm_a2', authorId: 'u_lena', at: t(-10, 9, 0), body: 'Credential renewals now show reminders in the app 30, 14 and 7 days before expiry. Upload renewals from Onboarding & Credentials.' },
  ],
  lastReadAt: {},
});

export function buildSeed(): AppState {
  return {
    version: STATE_VERSION,
    users: [...officeUsers, ...clinicians],
    agencies,
    visitTypes: VISIT_TYPES,
    patients,
    requests,
    visits,
    submissions,
    invoiceBatches,
    credentials,
    credentialRequirements,
    overrides: [],
    regions,
    conversations,
    activity: [
      { id: 'act_1', at: t(-3, 16), actorId: 'u_sam', action: 'export', entity: 'Invoice INV-BHH-1042', detail: 'QuickBooks file downloaded (1 line, $165.00)' },
      { id: 'act_2', at: t(-1, 16, 45), actorId: 'u_maya', action: 'request.send', entity: 'Request for Beatrice Nakamura', detail: 'Sent to 1 clinician; Daniel Okafor excluded by credential block' },
      { id: 'act_3', at: t(-9, 6), actorId: 'system', action: 'credential.expired', entity: 'Daniel Okafor - CPR / BLS', detail: 'Blocks new requests' },
      { id: 'act_4', at: t(-14, 10), actorId: 'u_sam', action: 'billing.return', entity: 'Submission bs_okonkwo', detail: 'Returned to clinician with reason' },
    ],
    notifications: [
      { id: 'n_1', userId: 'c_priya', at: t(-1, 16, 45), text: 'New visit request: PT Evaluation in Newark 94560 (Bayside Home Health)', link: '/clinician/requests', read: false },
      { id: 'n_2', userId: 'c_priya', at: t(-14, 10), text: 'Billing submission returned: Adaeze Okonkwo FUV - see reason', link: '/clinician/billing', read: false },
      { id: 'n_3', userId: 'c_elena', at: t(-2, 6), text: "Driver's license expires in 14 days - upload a renewal", link: '/clinician/credentials', read: false },
      { id: 'n_4', userId: 'c_daniel', at: t(-9, 6), text: 'CPR / BLS certification expired - new requests blocked until renewed', link: '/clinician/credentials', read: false },
    ],
    session: { role: null, userId: null },
    seq: 1000,
  };
}
