// Reach Your Representative: address -> district -> members -> contact protocol.
// All data is fetched live from public sources; nothing is stored server-side.

const LEGISLATORS_URL = "https://unitedstates.github.io/congress-legislators/legislators-current.json";
const OFFICES_URL = "https://unitedstates.github.io/congress-legislators/legislators-district-offices.json";
const TIGER = "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Legislative/MapServer";
const LAYER_CD119 = 4;
const LAYER_CD120 = 0;
const LAYER_SLDU = 1;
const LAYER_SLDL = 2;
const GEOCODER = "https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress";
const PHOTO_URL = (id) => `https://unitedstates.github.io/images/congress/225x275/${id}.jpg`;

const FIPS = {
  "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA", "08": "CO", "09": "CT", "10": "DE", "11": "DC",
  "12": "FL", "13": "GA", "15": "HI", "16": "ID", "17": "IL", "18": "IN", "19": "IA", "20": "KS", "21": "KY",
  "22": "LA", "23": "ME", "24": "MD", "25": "MA", "26": "MI", "27": "MN", "28": "MS", "29": "MO", "30": "MT",
  "31": "NE", "32": "NV", "33": "NH", "34": "NJ", "35": "NM", "36": "NY", "37": "NC", "38": "ND", "39": "OH",
  "40": "OK", "41": "OR", "42": "PA", "44": "RI", "45": "SC", "46": "SD", "47": "TN", "48": "TX", "49": "UT",
  "50": "VT", "51": "VA", "53": "WA", "54": "WV", "55": "WI", "56": "WY", "60": "AS", "66": "GU", "69": "MP",
  "72": "PR", "78": "VI",
};
const STATE_NAMES = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut",
  DE: "Delaware", DC: "District of Columbia", FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois",
  IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana",
  NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York",
  NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania",
  RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah",
  VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
  AS: "American Samoa", GU: "Guam", MP: "Northern Mariana Islands", PR: "Puerto Rico", VI: "U.S. Virgin Islands",
};
const NO_SENATORS = new Set(["DC", "AS", "GU", "MP", "PR", "VI"]);

const state = {
  legislators: [],
  houseByKey: new Map(), // "TX-37" -> legislator
  senByState: new Map(), // "TX" -> [legislators]
  offices: new Map(),    // bioguide -> [district offices]
  location: null,        // { lat, lng, address, cd119, cd120, sldu, sldl, stateAbbr }
  members: [],
  protocolId: null,
  agency: "ssa",
  recipientIdx: 0,
  form: {},
};

const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
const districtKey = (abbr, cd) => `${abbr}-${normalizeCd(cd)}`;
// Census uses "00" for at-large and "98" for non-voting delegates; the legislators file uses 0 for both.
function normalizeCd(cd) {
  const n = parseInt(cd, 10);
  return Number.isNaN(n) || n === 98 ? 0 : n;
}
function districtLabel(abbr, cd) {
  const n = normalizeCd(cd);
  return n === 0 ? `${abbr} at-large` : `${abbr}-${n}`;
}

// ---------- Data loading ----------

async function loadLegislators() {
  const [legs, offices] = await Promise.all([
    fetch(LEGISLATORS_URL).then((r) => r.json()),
    fetch(OFFICES_URL).then((r) => r.json()).catch(() => []),
  ]);
  state.legislators = legs;
  for (const l of legs) {
    const t = l.terms[l.terms.length - 1];
    if (t.type === "rep") state.houseByKey.set(districtKey(t.state, t.district), l);
    else {
      if (!state.senByState.has(t.state)) state.senByState.set(t.state, []);
      state.senByState.get(t.state).push(l);
    }
  }
  for (const o of offices) state.offices.set(o.id.bioguide, o.offices || []);
}

function jsonp(url, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const cb = `__geo_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    const script = document.createElement("script");
    const timer = setTimeout(() => { cleanup(); reject(new Error("The address service timed out.")); }, timeoutMs);
    function cleanup() { clearTimeout(timer); delete window[cb]; script.remove(); }
    window[cb] = (data) => { cleanup(); resolve(data); };
    script.onerror = () => { cleanup(); reject(new Error("Could not reach the address service.")); };
    script.src = `${url}&format=jsonp&callback=${cb}`;
    document.head.appendChild(script);
  });
}

async function geocodeAddress(address) {
  const url = `${GEOCODER}?address=${encodeURIComponent(address)}&benchmark=Public_AR_Current&vintage=Current_Current&layers=all`;
  const data = await jsonp(url);
  const match = data?.result?.addressMatches?.[0];
  if (!match) return null;
  const geos = match.geographies || {};
  const pick = (re) => { const k = Object.keys(geos).find((key) => re.test(key)); return k ? geos[k][0] : null; };
  const cd119 = pick(/119th Congressional/);
  const cd120 = pick(/120th Congressional/);
  return {
    lat: match.coordinates.y,
    lng: match.coordinates.x,
    address: match.matchedAddress,
    cd119: cd119 && { state: cd119.STATE, cd: cd119.CD119, geoid: cd119.GEOID },
    cd120: cd120 && { state: cd120.STATE, cd: cd120.CD120, geoid: cd120.GEOID },
    sldu: pick(/Legislative Districts - Upper/)?.NAME || null,
    sldl: pick(/Legislative Districts - Lower/)?.NAME || null,
  };
}

async function queryPoint(layer, lat, lng, fields = "*") {
  const url = `${TIGER}/${layer}/query?geometry=${lng},${lat}&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=${fields}&returnGeometry=false&f=json`;
  const j = await fetch(url).then((r) => r.json());
  return j.features?.[0]?.attributes || null;
}

async function lookupPoint(lat, lng) {
  const [a119, a120, up, low] = await Promise.all([
    queryPoint(LAYER_CD119, lat, lng),
    queryPoint(LAYER_CD120, lat, lng).catch(() => null),
    queryPoint(LAYER_SLDU, lat, lng, "NAME").catch(() => null),
    queryPoint(LAYER_SLDL, lat, lng, "NAME").catch(() => null),
  ]);
  if (!a119) return null;
  return {
    lat, lng, address: null,
    cd119: { state: a119.STATE, cd: a119.CD119, geoid: a119.GEOID },
    cd120: a120 && { state: a120.STATE, cd: a120.CD120, geoid: a120.GEOID },
    sldu: up?.NAME || null,
    sldl: low?.NAME || null,
  };
}

// ---------- Map ----------

const map = L.map("map", { zoomControl: true, minZoom: 3 }).setView([39.5, -98.35], 4);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 18,
  attribution: "© OpenStreetMap",
}).addTo(map);

let districtsLayer = null;
let selectedLayer = null;
let homeMarker = null;

const css = getComputedStyle(document.documentElement);
const PARTY_COLOR = {
  D: css.getPropertyValue("--dem").trim(),
  R: css.getPropertyValue("--rep").trim(),
  I: css.getPropertyValue("--ind").trim(),
  V: css.getPropertyValue("--vac").trim(),
};
const partyLetter = (l) => (!l ? "V" : ({ Democrat: "D", Republican: "R" })[l.terms.at(-1).party] || "I");

function featureMember(f) {
  const abbr = FIPS[f.properties.STATE];
  return abbr ? state.houseByKey.get(districtKey(abbr, f.properties.CD119)) : null;
}

async function loadDistrictMap() {
  const url = `${TIGER}/${LAYER_CD119}/query?where=1%3D1&outFields=GEOID,STATE,CD119&returnGeometry=true&outSR=4326&maxAllowableOffset=0.01&geometryPrecision=3&f=geojson`;
  const geo = await fetch(url).then((r) => r.json());
  districtsLayer = L.geoJSON(geo, {
    style: (f) => ({ color: "#ffffff", weight: 0.6, fillColor: PARTY_COLOR[partyLetter(featureMember(f))], fillOpacity: 0.38 }),
    onEachFeature: (f, layer) => {
      const abbr = FIPS[f.properties.STATE];
      const m = featureMember(f);
      const who = m ? `${esc(m.name.official_full || `${m.name.first} ${m.name.last}`)} (${partyLetter(m)})` : "Vacant";
      layer.bindTooltip(`<strong>${esc(districtLabel(abbr, f.properties.CD119))}</strong><br>${who}`, { sticky: true });
      layer.on({
        mouseover: () => layer.setStyle({ fillOpacity: 0.6 }),
        mouseout: () => districtsLayer.resetStyle(layer),
      });
    },
  }).addTo(map);
  // Click anywhere: query the exact point rather than trusting the simplified shape.
  map.on("click", (e) => selectPoint(e.latlng.lat, e.latlng.lng, false));
}

async function highlightDistrict(geoid) {
  if (selectedLayer) { map.removeLayer(selectedLayer); selectedLayer = null; }
  const url = `${TIGER}/${LAYER_CD119}/query?where=GEOID%3D%27${encodeURIComponent(geoid)}%27&outFields=GEOID&returnGeometry=true&outSR=4326&maxAllowableOffset=0.0005&f=geojson`;
  try {
    const geo = await fetch(url).then((r) => r.json());
    selectedLayer = L.geoJSON(geo, {
      style: { color: css.getPropertyValue("--accent").trim(), weight: 3, fillOpacity: 0.08 },
      interactive: false,
    }).addTo(map);
    return selectedLayer.getBounds();
  } catch {
    return null;
  }
}

// ---------- Lookup flows ----------

function setStatus(msg, isError = false) {
  const el = $("#search-status");
  el.textContent = msg;
  el.classList.toggle("error", isError);
}

async function searchAddress(address) {
  setStatus("Looking up your address…");
  try {
    const loc = await geocodeAddress(address);
    if (!loc) {
      setStatus("We couldn't match that address. Include the street number, city, and state (or ZIP). P.O. boxes can't be matched.", true);
      return;
    }
    if (!loc.cd119) {
      // Geocoder matched but didn't return districts; fall back to a point query.
      const pt = await lookupPoint(loc.lat, loc.lng);
      if (pt) Object.assign(loc, { cd119: pt.cd119, cd120: pt.cd120, sldu: pt.sldu, sldl: pt.sldl });
    }
    await showLocation(loc, true);
    setStatus(`Matched: ${loc.address}`);
  } catch (err) {
    setStatus(err.message || "Something went wrong. Please try again.", true);
  }
}

async function selectPoint(lat, lng, isHome) {
  setStatus("Finding district…");
  try {
    const loc = await lookupPoint(lat, lng);
    if (!loc) { setStatus("That spot isn't inside a U.S. congressional district.", true); return; }
    await showLocation(loc, isHome);
    setStatus(isHome ? "Using your current location." : "Showing the district you clicked. Enter your address for the most accurate match.");
  } catch {
    setStatus("Couldn't reach the Census district service. Please try again.", true);
  }
}

async function showLocation(loc, isHome) {
  loc.stateAbbr = FIPS[loc.cd119.state];
  state.location = loc;
  state.members = membersFor(loc);
  state.recipientIdx = 0;

  if (homeMarker) { map.removeLayer(homeMarker); homeMarker = null; }
  if (isHome) homeMarker = L.circleMarker([loc.lat, loc.lng], { radius: 7, color: "#fff", weight: 2, fillColor: "#111", fillOpacity: 1 }).addTo(map);

  renderResults();
  const bounds = await highlightDistrict(loc.cd119.geoid);
  if (bounds && bounds.isValid()) map.fitBounds(bounds, { padding: [30, 30], maxZoom: 12 });
}

function membersFor(loc) {
  const abbr = loc.stateAbbr;
  const list = [];
  const rep = state.houseByKey.get(districtKey(abbr, loc.cd119.cd));
  list.push(rep ? { leg: rep, kind: "house" } : { leg: null, kind: "house" });
  if (!NO_SENATORS.has(abbr)) {
    const sens = (state.senByState.get(abbr) || []).slice().sort((a, b) => a.terms.at(-1).start.localeCompare(b.terms.at(-1).start));
    for (const s of sens) list.push({ leg: s, kind: "senate" });
  }
  return list;
}

// ---------- Member helpers ----------

function houseTitle(abbr) {
  if (abbr === "PR") return "Resident Commissioner";
  if (NO_SENATORS.has(abbr)) return "Delegate";
  return "Representative";
}
function memberTitle(m) {
  if (!m.leg) return "Representative";
  const title = m.kind === "senate" ? "Senator" : houseTitle(m.leg.terms.at(-1).state);
  return `${title} ${m.leg.name.last}`;
}
function fullName(l) { return l.name.official_full || `${l.name.first} ${l.name.last}`; }

function nearestOffice(leg) {
  const offices = (state.offices.get(leg.id.bioguide) || []).filter((o) => o.phone || o.address);
  if (!offices.length) return null;
  const { lat, lng } = state.location;
  const dist = (o) => (o.latitude == null ? Infinity : (o.latitude - lat) ** 2 + ((o.longitude - lng) * Math.cos(lat * Math.PI / 180)) ** 2);
  return offices.slice().sort((a, b) => dist(a) - dist(b))[0];
}
function officeLine(o) {
  return [o.address, o.suite, o.building, `${o.city || ""}, ${o.state || ""} ${o.zip || ""}`.trim()].filter(Boolean).join(", ");
}
const tel = (p) => `tel:+1${String(p).replace(/\D/g, "")}`;
function contactUrl(leg) { const t = leg.terms.at(-1); return t.contact_form || t.url; }

// ---------- Rendering ----------

function renderResults() {
  const loc = state.location;
  const abbr = loc.stateAbbr;
  $("#intro").hidden = true;
  $("#results").hidden = false;

  let notice = "";
  if (loc.cd120 && (loc.cd120.state !== loc.cd119.state || normalizeCd(loc.cd120.cd) !== normalizeCd(loc.cd119.cd))) {
    notice = `<div class="notice"><strong>District lines are changing.</strong> Starting January 3, 2027, this address will be in <strong>${esc(districtLabel(FIPS[loc.cd120.state], loc.cd120.cd))}</strong>. The members below serve you until then.</div>`;
  }
  $("#district-head").innerHTML = `
    <div class="district-title">${esc(STATE_NAMES[abbr] || abbr)} · ${esc(districtLabel(abbr, loc.cd119.cd))}</div>
    <div class="district-sub">${loc.address ? esc(loc.address) : "Selected on the map"} · 119th Congress</div>
    ${notice}`;

  $("#members").innerHTML = state.members.map(renderMember).join("");
  renderIssues();
  if (state.protocolId) renderProtocol();
}

function renderMember(m) {
  if (!m.leg) {
    return `<div class="member"><div class="ph"></div><div><div class="role">${esc(houseTitle(state.location.stateAbbr))}</div>
      <div class="name">Seat currently vacant</div>
      <div class="office-line">While a seat is vacant, the Clerk of the House runs the office and still handles casework. Your senators can also help.</div></div></div>`;
  }
  const l = m.leg;
  const t = l.terms.at(-1);
  const p = partyLetter(l);
  const off = nearestOffice(l);
  const role = m.kind === "senate" ? `U.S. Senator · ${t.state_rank ? t.state_rank[0].toUpperCase() + t.state_rank.slice(1) : ""}` : `U.S. ${houseTitle(t.state)}`;
  return `<div class="member">
    <img src="${PHOTO_URL(l.id.bioguide)}" alt="" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'ph'}))">
    <div>
      <div class="role">${esc(role)}</div>
      <div class="name">${esc(fullName(l))}<span class="party ${p}">${p}</span></div>
      <div class="contact">
        ${t.phone ? `<a href="${tel(t.phone)}">DC ${esc(t.phone)}</a>` : ""}
        ${off?.phone ? `<a href="${tel(off.phone)}">Local ${esc(off.phone)}</a>` : ""}
        ${contactUrl(l) ? `<a href="${esc(contactUrl(l))}" target="_blank" rel="noopener">Contact form ↗</a>` : ""}
        ${t.url ? `<a href="${esc(t.url)}" target="_blank" rel="noopener">Website ↗</a>` : ""}
      </div>
      ${off ? `<div class="office-line">Nearest office: ${esc(officeLine(off))}</div>` : ""}
    </div>
  </div>`;
}

function renderIssues() {
  $("#issues").innerHTML = PROTOCOLS.map((p) => `
    <button class="issue" role="listitem" data-id="${p.id}" aria-pressed="${state.protocolId === p.id}">
      <strong>${esc(p.title)}</strong><span>${esc(p.blurb)}</span>
    </button>`).join("");
}

function recipientsFor(p) {
  const withLeg = state.members.filter((m) => m.leg);
  if (p.target === "state") return [];
  return withLeg;
}

function channelHtml(ch, i, p, m) {
  let actions = "";
  const l = m?.leg;
  const t = l?.terms.at(-1);
  if (ch.kind === "phone-district" && l) {
    const off = nearestOffice(l);
    if (off?.phone) actions = `<a class="btn small primary" href="${tel(off.phone)}">Call ${esc(off.city || "district")} office · ${esc(off.phone)}</a>`;
    else if (t.phone) actions = `<a class="btn small primary" href="${tel(t.phone)}">Call ${esc(t.phone)} and ask for the district office</a>`;
  } else if (ch.kind === "phone-dc" && l && t.phone) {
    actions = state.members.filter((x) => x.leg).map((x) =>
      `<a class="btn small ${x === m ? "primary" : ""}" href="${tel(x.leg.terms.at(-1).phone)}">${esc(memberTitle(x))} · ${esc(x.leg.terms.at(-1).phone)}</a>`).join("");
  } else if (ch.kind === "form" && l && contactUrl(l)) {
    const targets = p.target === "all" ? state.members.filter((x) => x.leg && contactUrl(x.leg)) : [m];
    actions = targets.map((x) =>
      `<a class="btn small" href="${esc(contactUrl(x.leg))}" target="_blank" rel="noopener">Open ${esc(memberTitle(x))}'s site ↗</a>`).join("");
  } else if (ch.kind === "link") {
    actions = `<a class="btn small" href="${esc(ch.href)}" target="_blank" rel="noopener">Open ↗</a>`;
  } else if (ch.kind === "statelegis") {
    const loc = state.location;
    const parts = [loc.sldu && `State Senate: <strong>${esc(loc.sldu)}</strong>`, loc.sldl && `State House: <strong>${esc(loc.sldl)}</strong>`].filter(Boolean);
    actions = `${parts.length ? `<div class="small" style="width:100%">${parts.join(" · ")}</div>` : ""}
      <a class="btn small" href="https://openstates.org/find_your_legislator/" target="_blank" rel="noopener">Find your state legislators ↗</a>`;
  }
  return `<li class="channel"><div><span class="rank">${i + 1}.</span><strong>${esc(ch.label)}</strong></div>
    ${ch.note ? `<div class="note">${esc(ch.note)}</div>` : ""}
    ${actions ? `<div class="actions">${actions}</div>` : ""}</li>`;
}

function whoHtml(p) {
  const loc = state.location;
  if (p.target === "state") {
    return `<div class="who"><strong>Contact: your state legislators or local government, not Congress</strong>
      ${loc.sldu || loc.sldl ? `<span class="small">${[loc.sldu, loc.sldl].filter(Boolean).map(esc).join(" · ")}</span>` : ""}</div>`;
  }
  const rs = recipientsFor(p);
  if (!rs.length) return `<div class="who"><strong>This House seat is vacant.</strong> Contact the Clerk of the House (clerk.house.gov) or one of your senators.</div>`;
  if (p.target === "all") {
    return `<div class="who"><strong>Contact all ${rs.length} of your members${p.office === "dc" ? " at their Washington offices" : ""}</strong>
      <span class="small">${rs.map((m) => esc(memberTitle(m))).join(", ")}. Each one votes or acts separately.</span></div>`;
  }
  const first = rs[0];
  const office = p.office === "district" ? "local (district) office" : "Washington office";
  return `<div class="who"><strong>Recommended: ${esc(memberTitle(first))}'s ${office}</strong>
    <span class="small">${first.kind === "house" ? "Your House member's office is usually the closest and least busy. A senator's office works too, but contact only one office about the same case." : ""}</span></div>`;
}

const FIELD_DEFS = {
  name: { label: "Your full name", type: "text", ac: "name" },
  phone: { label: "Phone", type: "tel", ac: "tel" },
  email: { label: "Email", type: "email", ac: "email" },
  org: { label: "Organization (optional)", type: "text", ac: "organization" },
  bill: { label: "Bill number or topic", type: "text", placeholder: "H.R. 1234" },
};

function builderHtml(p) {
  const rs = recipientsFor(p);
  const f = state.form;
  const field = (key) => {
    const d = FIELD_DEFS[key];
    return `<label>${esc(d.label)}<input type="${d.type}" data-field="${key}" value="${esc(f[key] || "")}" ${d.ac ? `autocomplete="${d.ac}"` : ""} ${d.placeholder ? `placeholder="${esc(d.placeholder)}"` : ""}></label>`;
  };
  const simple = p.fields.filter((k) => FIELD_DEFS[k]);
  const rows = [];
  for (let i = 0; i < simple.length; i += 2) rows.push(`<div class="row">${simple.slice(i, i + 2).map(field).join("")}</div>`);

  const agencySel = p.fields.includes("agency")
    ? `<label>Which agency?<select data-field="agency">${Object.entries(AGENCIES).map(([k, a]) =>
        `<option value="${k}" ${state.agency === k ? "selected" : ""}>${esc(a.name)}</option>`).join("")}</select></label>` : "";
  const positionSel = p.fields.includes("position")
    ? `<label>Your position<select data-field="position">
        <option value="support" ${f.position !== "oppose" ? "selected" : ""}>Support</option>
        <option value="oppose" ${f.position === "oppose" ? "selected" : ""}>Oppose</option></select></label>` : "";
  const recipSel = rs.length > 1
    ? `<label>Write to<select data-field="recipient">${rs.map((m, i) =>
        `<option value="${i}" ${state.recipientIdx === i ? "selected" : ""}>${esc(memberTitle(m))}</option>`).join("")}</select></label>` : "";
  const selects = [recipSel, agencySel, positionSel].filter(Boolean);
  const selRow = selects.length ? `<div class="row">${selects.join("")}</div>` : "";

  return `<div class="builder">
    ${selRow}
    ${rows.join("")}
    <label>Details<textarea data-field="details" rows="4" placeholder="Short and factual: what happened, when, and what you are asking for.">${esc(f.details || "")}</textarea></label>
    <div id="draft" class="draft"></div>
    <div class="draft-actions">
      <button type="button" class="btn primary" id="copy-draft">Copy message</button>
      ${p.phoneScript ? `<button type="button" class="btn" id="copy-script">Copy phone script</button>` : ""}
      <span id="copy-status" class="muted small" role="status" aria-live="polite"></span>
    </div>
    <p class="muted small" style="margin:0">Paste this into the official contact form. Offices give priority to messages sent through their website, where they can confirm you are a constituent.</p>
  </div>`;
}

function renderProtocol() {
  const p = PROTOCOLS.find((x) => x.id === state.protocolId);
  const el = $("#protocol");
  if (!p) { el.hidden = true; return; }
  const rs = recipientsFor(p);
  const m = rs[Math.min(state.recipientIdx, rs.length - 1)] || null;
  const agencyDocs = p.hasAgency ? AGENCIES[state.agency].docs : [];
  const prep = [...p.prepare, ...agencyDocs];

  el.hidden = false;
  el.innerHTML = `
    <h2>${esc(p.title)}</h2>
    <p class="why">${esc(p.why)}</p>
    ${whoHtml(p)}

    <h3>How to reach them, best first</h3>
    <ul class="channels">${p.channels.map((ch, i) => channelHtml(ch, i, p, m)).join("")}</ul>

    <h3>Have this ready${p.hasAgency ? ` · ${esc(AGENCIES[state.agency].name)}` : ""}</h3>
    <ul class="checklist">${prep.map((t, i) => `<li><label><input type="checkbox" id="prep-${i}"><span>${esc(t)}</span></label></li>`).join("")}</ul>

    <h3>Steps that get results</h3>
    <ol class="steps">${p.steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol>

    <h3>What to expect</h3>
    <div class="timeline"><span aria-hidden="true">⏱</span><span>${esc(p.timeline)}</span></div>

    <h3>Write your message</h3>
    ${builderHtml(p)}

    <h3>Always</h3>
    <ul class="tips">${UNIVERSAL_TIPS.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>`;
  updateDraft();
}

function draftContext() {
  const p = PROTOCOLS.find((x) => x.id === state.protocolId);
  const rs = recipientsFor(p);
  const m = rs[Math.min(state.recipientIdx, rs.length - 1)];
  const f = state.form;
  const loc = state.location;
  const address = loc.address || "[your full home address]";
  const zip = loc.address?.match(/\b\d{5}\b(?!.*\b\d{5}\b)/)?.[0];
  const city = loc.address?.split(",").slice(-3, -2)[0]?.trim();
  const contact = [f.phone, f.email].filter(Boolean).join(" or ") || "[phone or email]";
  return {
    memberTitle: m ? memberTitle(m) : "Representative",
    memberShort: m ? memberTitle(m) : "the member",
    name: f.name || "[Your name]",
    address,
    cityZip: city && zip ? `${titleCase(city)}, ${loc.stateAbbr} ${zip}` : (zip || "[your city and ZIP]"),
    contact,
    details: (f.details || "").trim(),
    agencyName: AGENCIES[state.agency].name,
    bill: (f.bill || "").trim(),
    positionVerb: f.position === "oppose" ? "oppose" : "support",
    org: (f.org || "").trim(),
  };
}
const titleCase = (s) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

function updateDraft() {
  const p = PROTOCOLS.find((x) => x.id === state.protocolId);
  const box = $("#draft");
  if (!p || !box) return;
  box.textContent = p.template(draftContext());
}

async function copyText(text, label) {
  const status = $("#copy-status");
  try {
    await navigator.clipboard.writeText(text);
    status.textContent = `${label} copied.`;
  } catch {
    status.textContent = "Couldn't copy automatically. Select the text and copy it yourself.";
  }
  setTimeout(() => { if (status) status.textContent = ""; }, 3000);
}

// ---------- Events ----------

$("#search-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const v = $("#address").value.trim();
  if (v) searchAddress(v);
});

$("#locate").addEventListener("click", () => {
  if (!navigator.geolocation) { setStatus("Your browser can't share location. Enter your address instead.", true); return; }
  setStatus("Getting your location…");
  navigator.geolocation.getCurrentPosition(
    (pos) => selectPoint(pos.coords.latitude, pos.coords.longitude, true),
    () => setStatus("Location was blocked or unavailable. Enter your address instead.", true),
    { enableHighAccuracy: true, timeout: 10000 },
  );
});

$("#issues").addEventListener("click", (e) => {
  const btn = e.target.closest(".issue");
  if (!btn) return;
  state.protocolId = btn.dataset.id;
  state.recipientIdx = 0;
  renderIssues();
  renderProtocol();
  $("#protocol").scrollIntoView({ behavior: "smooth", block: "start" });
});

$("#protocol").addEventListener("input", (e) => {
  const key = e.target.dataset.field;
  if (!key) return;
  if (key === "agency") { state.agency = e.target.value; renderProtocol(); return; }
  if (key === "recipient") { state.recipientIdx = Number(e.target.value); renderProtocol(); return; }
  state.form[key] = e.target.value;
  updateDraft();
});

$("#protocol").addEventListener("click", (e) => {
  if (e.target.id === "copy-draft") copyText($("#draft").textContent, "Message");
  if (e.target.id === "copy-script") {
    const p = PROTOCOLS.find((x) => x.id === state.protocolId);
    copyText(p.phoneScript(draftContext()), "Phone script");
  }
});

// ---------- Boot ----------

(async function init() {
  setStatus("Loading member data…");
  try {
    await loadLegislators();
    setStatus("");
  } catch {
    setStatus("Couldn't load member data. Check your connection and reload.", true);
    return;
  }
  try {
    await loadDistrictMap();
  } catch {
    // The lookup still works without the national overlay.
  }
  $("#map-loading").remove();
})();
