// The story, on a 120 BPM grid (one beat = 0.5 s): every cut lands on a beat.
// Shot kinds: intro, outro (logo), card (lines; _words_ get an underline), globe, slot,
// statement, apps, credit, and product (a scene: setup + script, see src/scenes/).
import demo from './scenes/demo.mjs'

const shot = (name, start, end, rest) => ({ name, start, end, ...rest })

const LOGOS = ['googlesheets', 'notion', 'figma', 'googledrive', 'dropbox', 'trello', 'airtable', 'zoom', 'gmail', 'googlecalendar', 'miro', 'asana']
  .map((s) => `assets/logos/${s}.svg`)

export const SHOTS = [
  shot('intro', 0, 2, { kind: 'intro' }),
  shot('c-hello', 2, 4, { kind: 'card', lines: ['Introducing Acme.'] }),
  shot('c-home', 4, 7.5, { kind: 'globe', head: 'One home for all your reports.', logos: LOGOS }),

  // The main flow first: ask, it is built, it lands in the list.
  shot('c-ask', 7.5, 9.5, { kind: 'card', lines: ['Ask for a report in _plain words_.'] }),
  shot('d-demo', 9.5, 21.5, demo),

  // "Share it with your ___": rolls through people and teams before landing on "team."
  shot('c-share', 21.5, 24, {
    kind: 'slot', before: 'Share it with your', after: '', intro: 0.05,
    items: [{ person: 'Bob', colour: '#e8613c' }, { person: 'Alice', colour: '#3b82f6' }, { team: 'Data team' },
      { logo: 'assets/logos/figma.svg' }, { text: 'team.' }],
    moves: [[0.25, 1.65, 'last', 'step']],
  }),

  // Breadth: what other kinds of users run.
  shot('d-apps', 24, 31, { kind: 'apps' }),

  // Values, one idea per card; the technical name is a quiet line.
  shot('c-free', 31, 34, { kind: 'statement', head: 'Free and open source.', sub: 'MIT License' }),
  shot('credit', 34, 37.5, { kind: 'credit' }),
  shot('outro', 37.5, 40, { kind: 'outro' }),
]

export const TOTAL = SHOTS[SHOTS.length - 1].end
