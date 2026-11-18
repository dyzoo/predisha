import { formatKickoffLabel } from './format'
import { hashString, mulberry32 } from './random-pure'

export interface RandomTeamGroup {
  name: string
  teams: string[]
}

export interface RandomSelectionDraft {
  fixtureId: string
  fixtureLabel: string
  competition: string
  kickoffIso: string
  kickoffLabel: string
  marketId: string
  marketName: string
  selectionId: string
  selectionLabel: string
  odds: number
  probability: number
  custom: true
}

export const RANDOM_TEAM_GROUPS: RandomTeamGroup[] = [
  {
    name: 'England — EFL Championship',
    teams: [
      'Birmingham City', 'Blackburn Rovers', 'Bolton Wanderers', 'Bristol City', 'Burnley',
      'Cardiff City', 'Charlton Athletic', 'Derby County', 'Lincoln City', 'Middlesbrough',
      'Millwall', 'Norwich City', 'Portsmouth', 'Preston North End', 'Queens Park Rangers',
      'Sheffield United', 'Southampton', 'Stoke City', 'Swansea City', 'Watford',
      'West Bromwich Albion', 'West Ham United', 'Wolverhampton Wanderers', 'Wrexham',
    ],
  },
  {
    name: 'Spain — Segunda División',
    teams: [
      'Albacete', 'Almería', 'Andorra', 'Burgos', 'Cádiz', 'Castellón', 'Celta Fortuna',
      'Ceuta', 'Córdoba', 'Eibar', 'Eldense', 'Girona', 'Granada', 'Las Palmas', 'Leganés',
      'Mallorca', 'Real Oviedo', 'Real Sociedad B', 'Sabadell', 'Sporting Gijón',
      'Tenerife', 'Valladolid',
    ],
  },
  {
    name: 'Germany — 2. Bundesliga',
    teams: [
      'Arminia Bielefeld', 'VfL Bochum', 'Eintracht Braunschweig', 'Energie Cottbus',
      'SV Darmstadt 98', 'Dynamo Dresden', 'Greuther Fürth', 'Hannover 96',
      '1. FC Heidenheim', 'Hertha BSC', '1. FC Kaiserslautern', 'Karlsruher SC',
      'Holstein Kiel', '1. FC Magdeburg', '1. FC Nürnberg', 'VfL Osnabrück',
      'FC St. Pauli', 'VfL Wolfsburg',
    ],
  },
  {
    name: 'Italy — Serie B',
    teams: [
      'Arezzo', 'Ascoli', 'Avellino', 'Benevento', 'Carrarese', 'Catanzaro', 'Cesena',
      'Cremonese', 'Empoli', 'Hellas Verona', 'Juve Stabia', 'Mantova', 'Modena', 'Padova',
      'Palermo', 'Pisa', 'Sampdoria', 'Südtirol', 'Vicenza', 'Virtus Entella',
    ],
  },
  {
    name: 'France — Ligue 2',
    teams: [
      'AS Nancy Saint-Étienne', 'Clermont Foot', 'Dijon', 'Guingamp', 'Annecy', 'Metz',
      'Nantes', 'Sochaux', 'Grenoble', 'Montpellier', 'Pau FC', 'Red Star', 'Rodez',
      'Reims', 'Stade Lavallois', 'Boulogne', 'Dunkerque',
    ],
  },
  {
    name: 'Netherlands — Eerste Divisie',
    teams: [
      'Almere City', 'AZ Alkmaar U21', 'De Graafschap', 'FC Den Bosch', 'FC Dordrecht',
      'FC Eindhoven', 'FC Emmen', 'FC Utrecht U21', 'FC Volendam', 'Helmond Sport',
      'Heracles Almelo', 'Jong Ajax', 'Jong PSV', 'MVV Maastricht', 'NAC Breda',
      'RKC Waalwijk', 'Roda JC', 'TOP Oss', 'Vitesse', 'VVV-Venlo',
    ],
  },
  {
    name: 'Portugal — Liga Portugal 2',
    teams: [
      'Chaves', 'Felgueiras', 'Penafiel', 'Vizela', 'Porto B', 'Portimonense',
      'Lusitânia Lourosa', 'Feirense', 'Leixões', 'União de Leiria', 'Sporting CP B',
      'Benfica B', 'Torreense', 'Tondela', 'AFS', 'Académica', 'Amarante', 'Farense',
    ],
  },
  {
    name: 'Scotland — Scottish Championship',
    teams: [
      'Arbroath', 'Ayr United', 'Dunfermline Athletic', 'Greenock Morton',
      'Inverness Caledonian Thistle', 'Livingston', 'Partick Thistle', "Queen's Park",
      'Raith Rovers', 'Stenhousemuir',
    ],
  },
  {
    name: 'Turkey — TFF 1. Lig',
    teams: [
      'Antalyaspor', 'Bandırmaspor', 'Batman Petrolspor', 'Bodrum FK', 'Boluspor',
      'Bursaspor', 'Esenler Erokspor', 'Fatih Karagümrük', 'Iğdır FK', 'İstanbulspor',
      'Kayserispor', 'Keçiörengücü', 'Manisa FK', 'Mardin 1969', 'Muğlaspor',
      'Pendikspor', 'Sarıyer', 'Sivasspor', 'Ümraniyespor', 'Vanspor',
    ],
  },
  {
    name: 'Belgium — Challenger Pro League',
    teams: [
      'RSCA Futures', 'Beerschot', 'Club NXT', 'Excelsior Virton', 'FCV Dender EH',
      'Francs Borains', 'Jong Genk', 'Jong KAA Gent', 'KAS Eupen', 'Sporting Hasselt',
      'Lierse SK', 'Patro Eisden', 'RFC Liège', 'KSC Lokeren', 'RFC Seraing',
    ],
  },
  {
    name: 'Brazil — Campeonato Brasileiro Série B',
    teams: [
      'América Mineiro', 'Athletic Club', 'Atlético Goianiense', 'Avaí', 'Botafogo-SP',
      'Ceará', 'CRB', 'Criciúma', 'Cuiabá', 'Fortaleza', 'Goiás', 'Juventude',
      'Londrina', 'Náutico', 'Novorizontino', 'Operário Ferroviário', 'Ponte Preta',
      'São Bernardo', 'Sport Recife', 'Vila Nova',
    ],
  },
  {
    name: 'Argentina — Primera Nacional',
    teams: [
      'Acassuso', 'Agropecuario Argentino', 'All Boys', 'Almagro', 'Almirante Brown',
      'Atlanta', 'Atlético Rafaela', 'Atlético San Miguel', 'Los Andes', 'Central Norte',
      'Chacarita Juniors', 'Chaco For Ever', 'Ciudad de Bolívar', 'Colegiales',
      'Colón de Santa Fe', 'Defensores de Belgrano', 'Deportivo Madryn', 'Deportivo Maipú',
      'Deportivo Morón', 'Estudiantes de Caseros', 'Ferro Carril Oeste', 'Ferrocarril Midland',
      'Gimnasia de Jujuy', 'Gimnasia y Tiro', 'Godoy Cruz', 'Güemes', 'Mitre',
      'Nueva Chicago', 'Patronato', 'Quilmes', 'Racing de Córdoba', 'San Martín de San Juan',
      'San Martín de Tucumán', 'San Telmo', 'Temperley', 'Tristán Suárez',
    ],
  },
  {
    name: 'Japan — J2 League',
    teams: [
      'RB Omiya Ardija', 'Júbilo Iwata', 'Vegalta Sendai', 'Sagan Tosu', 'Tokushima Vortis',
      'Shonan Bellmare', 'Hokkaido Consadole Sapporo', 'Montedio Yamagata',
      'Albirex Niigata', 'Yokohama FC', 'FC Imabari', 'Tochigi City', 'Iwaki FC',
      'Kataller Toyama', 'Fujieda MYFC', 'Ventforet Kofu', 'Blaublitz Akita',
      'Oita Trinita', 'Tegevajaro Miyazaki', 'Vanraure Hachinohe',
    ],
  },
]

const OUTCOMES = [
  { selectionId: 'HOME', selectionLabel: 'Home win' },
  { selectionId: 'DRAW', selectionLabel: 'Draw' },
  { selectionId: 'AWAY', selectionLabel: 'Away win' },
]

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 32)
}

function oddsFor(probability: number): number {
  return Math.max(1.01, Math.round((1 / probability) * 0.94 * 100) / 100)
}

export function buildRandomSelections({
  count,
  kickoffIso,
  leagueName = 'ANY',
  prefix = `custom-${Date.now()}`,
}: {
  count: number
  kickoffIso: string
  leagueName?: string
  prefix?: string
}): RandomSelectionDraft[] {
  const kickoff = new Date(kickoffIso)
  const kickoffAt = Number.isNaN(kickoff.getTime())
    ? new Date(Date.now() + 5 * 60_000).toISOString()
    : kickoff.toISOString()
  const groups = leagueName === 'ANY'
    ? RANDOM_TEAM_GROUPS
    : RANDOM_TEAM_GROUPS.filter(group => group.name === leagueName)
  if (groups.length === 0) return []
  const seedBase = `${prefix}-${kickoffAt}-${leagueName}`
  const random = mulberry32(hashString(seedBase))
  const drafts: RandomSelectionDraft[] = []
  const usedPairs = new Set<string>()

  for (let index = 0; index < count; index += 1) {
    let home = ''
    let away = ''
    let group = groups[0]
    for (let attempt = 0; attempt < 20; attempt += 1) {
      group = groups[Math.floor(random() * groups.length)]
      const homeIndex = Math.floor(random() * group.teams.length)
      let awayIndex = Math.floor(random() * group.teams.length)
      if (awayIndex === homeIndex) awayIndex = (awayIndex + 1) % group.teams.length
      home = group.teams[homeIndex]
      away = group.teams[awayIndex]
      const pair = `${group.name}:${[home, away].sort().join('|')}`
      if (!usedPairs.has(pair)) {
        usedPairs.add(pair)
        break
      }
    }

    const outcome = OUTCOMES[Math.floor(random() * OUTCOMES.length)]
    const probability = Math.round((0.34 + random() * 0.24) * 100) / 100
    const fixtureId = `${prefix}-${index + 1}-${slugify(home)}-${slugify(away)}`

    drafts.push({
      fixtureId,
      fixtureLabel: `${home} vs ${away}`,
      competition: group.name,
      kickoffIso: kickoffAt,
      kickoffLabel: formatKickoffLabel(kickoffAt),
      marketId: '1x2',
      marketName: 'Match result',
      selectionId: outcome.selectionId,
      selectionLabel: outcome.selectionLabel,
      odds: oddsFor(probability),
      probability,
      custom: true,
    })
  }

  return drafts
}
