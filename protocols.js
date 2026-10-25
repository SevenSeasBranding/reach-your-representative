// Contact protocols: one entry per kind of problem a constituent might bring.
// Each protocol says who to contact, which office, how, what to prepare,
// and builds a ready-to-send message from the form fields.
//
// target:  "house"   -> the House member is the recommended first contact
//          "all"     -> contact the House member and both senators
//          "state"   -> not a federal matter; route to state/local officials
// office:  "district" | "dc" -> which office the message should go to

const AGENCIES = {
  ssa: {
    name: "Social Security Administration",
    docs: ["Social Security number (give it by phone or on the release form, never in an email)", "Claim or appeal number", "Copies of any letters SSA sent you", "Dates you applied, called, or visited an SSA office"],
  },
  cms: {
    name: "Medicare / Centers for Medicare & Medicaid Services",
    docs: ["Medicare number (from your red-white-and-blue card)", "Claim numbers and dates of service", "Explanation of Benefits or denial letters", "Name of your plan if you have Medicare Advantage or Part D"],
  },
  va: {
    name: "Department of Veterans Affairs",
    docs: ["VA file number or SSN (by phone or on the release form)", "DD-214 (discharge papers)", "Claim number and the date you filed", "Any decision letters", "Name of your Veterans Service Officer, if you have one"],
  },
  irs: {
    name: "Internal Revenue Service",
    docs: ["Tax years involved", "Copies of IRS notices (the notice number is in the top right corner, e.g. CP2000)", "Dates you filed or responded", "Note: for hardship cases the IRS Taxpayer Advocate Service (1-877-777-4778) can also help"],
  },
  uscis: {
    name: "U.S. Citizenship & Immigration Services",
    docs: ["Receipt number(s) (3 letters + 10 digits, e.g. IOE0123456789)", "A-number, if you have one", "Copies of receipt notices and any requests for evidence", "Current case status from uscis.gov/casestatus"],
  },
  state: {
    name: "State Department / Passports",
    docs: ["Application locator number", "Date and place you applied", "Proof of upcoming international travel (itinerary or ticket)", "Date of birth exactly as on the application"],
  },
  studentaid: {
    name: "Federal Student Aid / Department of Education",
    docs: ["Loan servicer name and account number", "Copies of letters or emails from the servicer", "Which program is involved (PSLF, income-driven repayment, discharge, etc.)"],
  },
  fema: {
    name: "FEMA / disaster assistance",
    docs: ["FEMA registration number", "Disaster declaration number, if known", "Inspection dates and any determination letters", "Photos and receipts for damage"],
  },
  usps: {
    name: "U.S. Postal Service",
    docs: ["Tracking numbers or affected addresses", "Dates of the problem", "Any case number from a USPS complaint (usps.com or 1-800-275-8777)"],
  },
  dod: {
    name: "Military / Department of Defense",
    docs: ["Service member's full name, rank, branch, and unit", "DoD ID or SSN (by phone or on the release form)", "What you have already tried through the chain of command"],
  },
  other: {
    name: "Other federal agency",
    docs: ["Agency name and the office you dealt with", "Any case, claim, or reference numbers", "Copies of letters or emails from the agency"],
  },
};

const PROTOCOLS = [
  {
    id: "casework",
    title: "Problem with a federal agency",
    callTopic: "a problem I am having with a federal agency",
    blurb: "Stuck benefit, lost application, IRS notice, VA claim, immigration case, student loans.",
    target: "house",
    office: "district",
    why: "Congressional offices have caseworkers whose job is to work agency problems for constituents. They have direct liaison contacts inside agencies, and an inquiry from a member's office usually gets a file reviewed by a person.",
    channels: [
      { kind: "phone-district", label: "Call the district office and ask for a caseworker", note: "Fastest way to open a case. Casework is handled locally, not in Washington." },
      { kind: "form", label: "Or use the casework / \"help with a federal agency\" page on the member's website", note: "Many offices let you sign the privacy release online." },
    ],
    prepare: [
      "A signed Privacy Act release form. The office cannot legally ask the agency about your file without your written permission. Download it from the member's website or ask the caseworker to send it.",
      "A one-page timeline: what you applied for, when, who you spoke with, and what happened.",
      "Copies (never originals) of every letter from the agency.",
    ],
    steps: [
      "Try the agency first and write down the case numbers and dates. Caseworkers can do more when you have already tried the normal route.",
      "Contact ONE office only: the House member or one senator. If you open the same case with several offices, the agency gets duplicate inquiries and the case can slow down.",
      "Return the privacy release quickly. The case does not start until the office has it.",
      "Ask the caseworker for their name, direct line, and how often to expect updates.",
      "If you hear nothing in 2 weeks, follow up politely and give your case number.",
    ],
    timeline: "The office usually contacts the agency within a few days of getting the release. Agency replies often take 2–8 weeks, depending on the agency.",
    hasAgency: true,
    fields: ["agency", "details"],
    template: (c) => `Dear ${c.memberTitle},

I am a constituent living at ${c.address}, and I am asking for your office's help with a problem I am having with the ${c.agencyName}.

${c.details || "[Describe what you applied for, when, and what has happened since.]"}

I have tried to resolve this directly with the agency. I am ready to sign a Privacy Act release form so your office can make an inquiry on my behalf. Please tell me how to send it.

I can be reached at ${c.contact}.

Thank you for your help.

Sincerely,
${c.name}`,
  },
  {
    id: "passport",
    title: "Urgent passport or travel emergency",
    callTopic: "an urgent passport problem",
    blurb: "International travel in the next 2–3 weeks and your passport has not arrived.",
    target: "house",
    office: "district",
    why: "Congressional offices have liaisons at the State Department's passport agencies who can check status and sometimes speed up a pending application for imminent travel.",
    channels: [
      { kind: "phone-district", label: "Call the district office today", note: "Do not email for this. Say \"urgent passport\" at the start of the call." },
    ],
    prepare: [
      "Your application locator number and the date you applied.",
      "Proof of travel: a ticket or itinerary showing your departure date.",
      "A signed Privacy Act release form (the office will send it).",
    ],
    steps: [
      "If you travel within 14 days and have not applied yet, book an urgent appointment at a passport agency (1-877-487-2778). Congressional offices can only help with applications already submitted.",
      "Call the district office with your locator number and travel date.",
      "Send the privacy release and travel proof right away, the same day if you can.",
      "Keep your phone on. The office may need to reach you quickly.",
    ],
    timeline: "Same day to a few days for status. Results depend on how close the travel date is.",
    fields: ["details"],
    template: (c) => `Dear ${c.memberTitle},

I am a constituent at ${c.address} with urgent international travel, and my passport application is still pending.

${c.details || "[Application locator number, date applied, and travel date.]"}

I can provide proof of travel and a signed Privacy Act release right away. Please contact me at ${c.contact}.

Thank you,
${c.name}`,
  },
  {
    id: "policy",
    title: "Share my view on a bill or policy",
    callTopic: "a bill",
    blurb: "Support or oppose legislation, or tell your members how an issue affects you.",
    target: "all",
    office: "dc",
    why: "Offices count constituent contacts by issue and position, and staff report the totals to the member. A short, personal message from a verified constituent counts most, especially in the days before a vote.",
    channels: [
      { kind: "phone-dc", label: "Call the Washington office", note: "Fastest and gets counted the same day. You will usually talk to a staff assistant. That is normal, and your view still gets logged." },
      { kind: "form", label: "Email through the member's website contact form", note: "Congress mostly ignores outside email addresses. Use the official form so the office can confirm you are a constituent." },
      { kind: "letter", label: "Avoid paper letters for anything time-sensitive", note: "Mail to Capitol Hill goes through security screening and can take weeks." },
    ],
    prepare: [
      "The bill number (e.g. H.R. 1234 or S. 567). Look it up at congress.gov.",
      "Your position in one sentence: support or oppose.",
      "One or two sentences on how it affects you, your family, your work, or your town.",
    ],
    steps: [
      "Contact all three of your members: your House representative and both senators. Each one votes separately.",
      "Start with your name and your city or ZIP code, so they know you are a constituent.",
      "Keep to one issue per call or message.",
      "Ask: \"Where does the member stand on this?\" Write down the answer.",
      "Contact them again when the bill moves (committee vote, floor vote). Timing matters.",
    ],
    timeline: "Calls are logged right away. Written replies to form emails usually come in 2–6 weeks.",
    fields: ["bill", "position", "details"],
    template: (c) => `Dear ${c.memberTitle},

I am your constituent from ${c.cityZip}. I am writing to ask you to ${c.positionVerb} ${c.bill || "[bill number or policy]"}.

${c.details || "[One or two sentences on why this matters to you personally.]"}

Please let me know where you stand on this issue.

Sincerely,
${c.name}
${c.address}`,
    phoneScript: (c) => `Hi, my name is ${c.name || "[your name]"} and I'm a constituent from ${c.cityZip}. I'm calling to ask ${c.memberShort} to ${c.positionVerb} ${c.bill || "[bill number]"}. ${c.details ? c.details + " " : ""}Can you tell me where ${c.memberShort} stands on this? Thank you.`,
  },
  {
    id: "meeting",
    title: "Request a meeting",
    callTopic: "requesting a meeting",
    blurb: "Meet the member or their staff about an issue, by yourself or with a group.",
    target: "house",
    office: "district",
    why: "Meetings go through a scheduler. Requests that clearly say who you are, what you want to discuss, and what you are asking for are more likely to be accepted. A meeting with the staffer who covers your issue is often more useful than a short meeting with the member.",
    channels: [
      { kind: "form", label: "Submit the scheduling or meeting request form on the member's website", note: "Most offices require this written request before booking anything." },
      { kind: "phone-district", label: "Follow up with the district office after 5–7 business days", note: "Ask for the scheduler by name." },
    ],
    prepare: [
      "Who will attend (names, and whether they are constituents).",
      "The topic and your specific ask, in one sentence.",
      "Two or three date ranges. District meetings are easiest during congressional recess weeks.",
      "A one-page handout to leave with the staff.",
    ],
    steps: [
      "Send the request 3–4 weeks before your preferred dates.",
      "Be willing to meet with staff. Legislative staff often write the briefing the member reads.",
      "Confirm the meeting 2 days before.",
      "Send a thank-you email afterward that repeats your ask.",
    ],
    timeline: "Usually 1–4 weeks to schedule.",
    fields: ["details"],
    template: (c) => `Dear Scheduler,

I am a constituent at ${c.address}${c.org ? ` and I represent ${c.org}` : ""}. I would like to request a meeting with ${c.memberTitle} or the appropriate staff member.

Topic and request:
${c.details || "[One or two sentences on the issue and what you are asking for.]"}

Preferred dates: [list 2–3 date ranges]
Attendees: [names]

Please contact me at ${c.contact}.

Thank you,
${c.name}`,
  },
  {
    id: "funding",
    title: "Support for a local project or grant",
    callTopic: "a letter of support for a local project",
    blurb: "A letter of support for a federal grant, or a Community Project Funding request.",
    target: "all",
    office: "district",
    why: "Members can write support letters for federal grant applications and submit Community Project Funding (earmark) requests for local public projects. Both have deadlines, and offices need time to review.",
    channels: [
      { kind: "form", label: "Check the member's website for a \"Grants\" or \"Community Project Funding\" page", note: "House requests usually open in late winter or spring, with firm deadlines." },
      { kind: "phone-district", label: "Call the district office and ask for the grants coordinator", note: "" },
    ],
    prepare: [
      "Grant program name, funding agency, and the application deadline.",
      "A one-page project summary: who it serves, how much it costs, and its local impact.",
      "A draft support letter. Offices often start from a draft you provide.",
    ],
    steps: [
      "Ask at least 3 weeks before your grant deadline.",
      "Ask your House member and both senators. Each can write a letter.",
      "Send your materials as one PDF.",
      "Tell the office the outcome. Offices track funded projects in their district.",
    ],
    timeline: "Support letters: 1–3 weeks. Community Project Funding follows the yearly appropriations calendar.",
    fields: ["details"],
    template: (c) => `Dear ${c.memberTitle},

On behalf of ${c.org || "[organization]"}, located at ${c.address}, I am asking for a letter of support for our application to [grant program / agency], due [deadline].

${c.details || "[Project summary: who it serves, cost, and local impact.]"}

I have attached a project summary and a draft letter for your staff to use. Please contact me at ${c.contact}.

Thank you for your consideration,
${c.name}`,
  },
  {
    id: "invite",
    title: "Invite my member to an event",
    callTopic: "inviting the member to an event",
    blurb: "Town hall, ribbon cutting, school visit, community meeting.",
    target: "house",
    office: "district",
    why: "Members plan district time weeks in advance around recess calendars. Early invitations with clear details are much more likely to be accepted, and if the member cannot come, offices often send staff.",
    channels: [
      { kind: "form", label: "Send a written invitation through the scheduling request form", note: "" },
      { kind: "phone-district", label: "Call the district office to confirm it was received", note: "" },
    ],
    prepare: ["Event name, date, time, and location", "Expected attendance and who will be there", "Whether speaking is expected, and for how long", "Press attendance, if any"],
    steps: ["Invite 4–6 weeks ahead.", "Say whether a staff member would be welcome if the member cannot attend.", "Send a reminder 1 week before."],
    timeline: "Replies usually come 1–3 weeks before the event.",
    fields: ["details"],
    template: (c) => `Dear ${c.memberTitle},

${c.org ? `On behalf of ${c.org}, I` : "I"} would like to invite you to attend:

${c.details || "[Event name, date, time, location, expected attendance, and the role you'd like the member to play.]"}

If your schedule does not allow it, we would welcome a member of your staff. Please contact me at ${c.contact}.

Sincerely,
${c.name}
${c.address}`,
  },
  {
    id: "services",
    title: "Tours, flags, academy nominations",
    callTopic: "a tour, flag, or nomination request",
    blurb: "Capitol or White House tours, flags flown over the Capitol, military academy nominations, greetings.",
    target: "house",
    office: "dc",
    why: "These routine services each have their own request form and deadlines on the member's website.",
    channels: [{ kind: "form", label: "Use the request forms on the member's website", note: "Look under \"Services\"." }],
    prepare: [
      "White House tours: request 21 days to 3 months ahead. You will need full legal names for security screening.",
      "Capitol tours: request at least 2–4 weeks ahead. Spring and summer fill up fast.",
      "Military academy nominations: deadlines are usually in the fall for admission the following year.",
      "Flags: give the date and the person or occasion to honor.",
    ],
    steps: ["Find the specific form on the website.", "Submit it as early as possible.", "If you have not heard back by 2 weeks before your date, call the DC office."],
    timeline: "Varies by service.",
    fields: ["details"],
    template: (c) => `Dear ${c.memberTitle},

I am a constituent at ${c.address}, and I would like to request:

${c.details || "[Tour / flag / nomination details and dates.]"}

Please contact me at ${c.contact}.

Thank you,
${c.name}`,
  },
  {
    id: "oversight",
    title: "Report waste, fraud, or misconduct",
    callTopic: "reporting waste or fraud in a federal program",
    blurb: "Misuse of federal funds, contractor fraud, or misconduct at a federal agency.",
    target: "house",
    office: "district",
    why: "Every federal agency has an independent Inspector General that investigates fraud. Report there first, then tell your member, who can press the agency to act and protect whistleblowers from retaliation.",
    channels: [
      { kind: "link", href: "https://www.oversight.gov/", label: "File with the agency's Inspector General (oversight.gov lists them all)", note: "This creates an official record. You can usually stay anonymous." },
      { kind: "form", label: "Then tell your member through their contact form, and include your IG case number", note: "" },
    ],
    prepare: ["Who, what, when, where, and how you know", "Any documents you are allowed to share. Never send classified or legally protected information by email.", "Your IG complaint number"],
    steps: ["File with the IG.", "Contact your member and give the IG number.", "If you are a federal employee or contractor, ask about whistleblower protections before you share anything."],
    timeline: "IG reviews can take months. Your member's office can ask for status updates.",
    fields: ["agency", "details"],
    hasAgency: true,
    template: (c) => `Dear ${c.memberTitle},

I am a constituent at ${c.address}. I have reported a matter involving the ${c.agencyName} to its Office of Inspector General (complaint #[number]), and I am asking your office to follow up.

${c.details || "[Brief, factual summary.]"}

Please contact me at ${c.contact}.

Sincerely,
${c.name}`,
  },
  {
    id: "statelocal",
    title: "State or local issue",
    callTopic: "a local issue",
    blurb: "Roads, schools, police, local taxes, DMV, unemployment benefits, Medicaid eligibility, utilities.",
    target: "state",
    office: "district",
    why: "Members of Congress cannot fix city, county, or state problems, and offices will usually send you elsewhere. Going straight to the right level saves you weeks. Unemployment insurance and Medicaid eligibility are run by the states, even though they get federal money.",
    channels: [
      { kind: "statelegis", label: "Contact your state legislators (your districts are shown below)", note: "For state agencies, state law, and state benefits." },
      { kind: "link", href: "https://www.usa.gov/local-governments", label: "Contact your city or county government", note: "For roads, trash, zoning, local police, and schools." },
    ],
    prepare: ["Your exact address", "Photos, dates, and any reference numbers"],
    steps: ["Pick the right level: city/county for local services, state legislator for state agencies and law.", "If the problem involves federal money or a federal agency, come back and choose \"Problem with a federal agency\"."],
    timeline: "Varies.",
    fields: ["details"],
    template: (c) => `Dear [state legislator / council member],

I am a constituent at ${c.address}, and I am writing about:

${c.details || "[Describe the issue.]"}

Please contact me at ${c.contact}.

Thank you,
${c.name}`,
  },
];

const UNIVERSAL_TIPS = [
  "Always include your full home address. Offices respond mainly to constituents and check where you live.",
  "Be brief and polite. The staff member you talk to decides what gets passed up.",
  "Keep a log: date, who you talked to, and what they said.",
  "Life-threatening emergency? Call 911. Congressional offices cannot send help.",
];
