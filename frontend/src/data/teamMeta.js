// Flag ISO codes (flag-icons) + FIFA ranking per team.
// FIFA ranks are the pre-tournament list — intentionally static for the
// whole World Cup. Keys must match team names in the DB exactly.
const TEAM_META = {
  'ארגנטינה':          { code: 'ar',     fifa: 1 },
  'ספרד':              { code: 'es',     fifa: 2 },
  'צרפת':              { code: 'fr',     fifa: 3 },
  'אנגליה':            { code: 'gb-eng', fifa: 4 },
  'פורטוגל':           { code: 'pt',     fifa: 5 },
  'ברזיל':             { code: 'br',     fifa: 6 },
  'מרוקו':             { code: 'ma',     fifa: 7 },
  'הולנד':             { code: 'nl',     fifa: 8 },
  'בלגיה':             { code: 'be',     fifa: 9 },
  'גרמניה':            { code: 'de',     fifa: 10 },
  'קרואטיה':           { code: 'hr',     fifa: 11 },
  'קולומביה':          { code: 'co',     fifa: 13 },
  'מקסיקו':            { code: 'mx',     fifa: 14 },
  'סנגל':              { code: 'sn',     fifa: 15 },
  'אורוגוואי':         { code: 'uy',     fifa: 16 },
  'ארה"ב':             { code: 'us',     fifa: 17 },
  'יפן':               { code: 'jp',     fifa: 18 },
  'שווייץ':            { code: 'ch',     fifa: 19 },
  'איראן':             { code: 'ir',     fifa: 20 },
  'טורקיה':            { code: 'tr',     fifa: 22 },
  'אקוודור':           { code: 'ec',     fifa: 23 },
  'אוסטריה':           { code: 'at',     fifa: 24 },
  'דרום קוריאה':       { code: 'kr',     fifa: 25 },
  'אוסטרליה':          { code: 'au',     fifa: 27 },
  "אלג'יריה":          { code: 'dz',     fifa: 28 },
  'מצרים':             { code: 'eg',     fifa: 29 },
  'קנדה':              { code: 'ca',     fifa: 30 },
  'נורבגיה':           { code: 'no',     fifa: 31 },
  'חוף השנהב':         { code: 'ci',     fifa: 33 },
  'פנמה':              { code: 'pa',     fifa: 34 },
  'שבדיה':             { code: 'se',     fifa: 38 },
  "צ'כיה":             { code: 'cz',     fifa: 40 },
  'פראגוואי':          { code: 'py',     fifa: 41 },
  'סקוטלנד':           { code: 'gb-sct', fifa: 42 },
  'טוניסיה':           { code: 'tn',     fifa: 45 },
  'קונגו הדמוקרטית':   { code: 'cd',     fifa: 46 },
  'אוזבקיסטן':         { code: 'uz',     fifa: 50 },
  'קטאר':              { code: 'qa',     fifa: 56 },
  'עיראק':             { code: 'iq',     fifa: 57 },
  'דרום אפריקה':       { code: 'za',     fifa: 60 },
  'ערב הסעודית':       { code: 'sa',     fifa: 61 },
  'ירדן':              { code: 'jo',     fifa: 63 },
  'בוסניה והרצגובינה': { code: 'ba',     fifa: 64 },
  'כף ורדה':           { code: 'cv',     fifa: 67 },
  'גאנה':              { code: 'gh',     fifa: 73 },
  'קוראסאו':           { code: 'cw',     fifa: 82 },
  'האיטי':             { code: 'ht',     fifa: 83 },
  'ניו זילנד':         { code: 'nz',     fifa: 85 },
}

// Normalize Hebrew geresh/apostrophe variants so צ׳כיה and צ'כיה both match
export function getTeamMeta(name) {
  if (!name) return null
  return TEAM_META[name] || TEAM_META[name.replace(/׳/g, "'")] || null
}
