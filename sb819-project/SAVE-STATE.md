# SB-819 — Save State

Where the work stands as of 7 September 2026, on branch `jw/sb819`, everything committed.
The branch is five commits on top of `upstream/master` (codeforpdx), which local `master`
matches. Nothing is pushed.

Read [design.md](design.md) for feature 1 and [question-answers-plan.md](question-answers-plan.md)
for the question mechanics. The `.html` files beside them are published renderings of earlier
drafts; the `.md` files are the ones kept current. This file is the resume point: what is
done, what is decided, what is not checked, and what bites you when you pick it up again.

---

## What exists

A volunteer searching a record sees a badge beside the **Ineligible** heading in the search
summary. It opens an SB-819 view listing only the Multnomah convictions that expungement
cannot reach, sorted into three sections, with the Multnomah District Attorney's limiting
criteria applied to each and the unresolved ones put as questions the volunteer answers with
the client. Answering re-sorts the sections live. A **Full rules** link opens a generated
logic sheet of every rule the software applies, at `/sb819-rules`.

Each pathway opens with the one question that defines who it is for. "Is the applicant
currently incarcerated?" is asked alone, and the rest of Excessive Sentencing appears only on
Yes; "has the applicant fully completed the sentence on this case?" does the same for
Collateral Consequences. A gate answered No reveals nothing and folds nothing.

### Backend

| File | Role |
| --- | --- |
| `models/sb819.py` | Statuses, pathways, scopes, criteria, the resolution algebra |
| `sb819_analyzer.py` | Filters to in-scope charges, runs the county ruleset, rolls up |
| `sb819_criteria/multnomah.py` | The twenty criteria, with wording, page cite, scope, key and gate |
| `sb819_criteria/registerable_sex_offenses.py` | The ORS 163A.005(5) list, with attempts read off the charge name |
| `sb819_criteria/logic_sheet.py` | Builds the numbered sheet from the criteria |
| `endpoints/sb819_rules.py` | `GET /api/sb819/rules` |

Edits to existing files: one field on `RecordSummary`, one call in `RecordSummarizer`, one
block in `serializer.py`, and the demo record.

### Frontend

Everything lives in `components/RecordSearch/SB819/` plus `components/SB819Rules/`,
`redux/sb819Slice.ts`, `redux/sb819AnswersSlice.ts`, and `service/featureFlags.ts`.

The record view's own `Case`, `Cases`, `Charge` and `Charges` components are **untouched**.
The SB-819 view renders its own `SB819Case` and `SB819Charge`. An earlier attempt threaded
render-prop slots through those four shared components; it was reverted, and should stay
reverted.

Edits to existing files: `App/index.tsx` (route), `Layout/index.tsx` (view),
`RecordSummary/index.tsx` and `RecordSummary/ChargesList.tsx` (badge), `Record/types.ts`
(the analysis on the summary payload), `redux/store.tsx` (two reducers), and
`Demo/DemoInfo.tsx` (the demo record).

### Demo record

Alias **sb / 819**, ten cases, listed on the demo page. It exercises every criterion and every
question, and the rules sheet reads its question wording from it, so a question the demo
record never raises would be missing from the sheet; a test pins all fourteen.

| Case | Charge | Exercises |
| --- | --- | --- |
| SB819-100 | Theft II, misdemeanor | Eligible for expungement; never enters the view |
| SB819-200 | Assault I, Clackamas | Excluded by county |
| SB819-300 | DUII, misdemeanor | Fails the felony criterion |
| SB819-400 | Aggravated Murder | Fails its main criterion |
| SB819-500 | Rape II | Registerable sex offense; a felony sex crime on the record |
| SB819-600 | Robbery II | Person felony |
| SB819-700 | Racketeering | Non-person felony |
| SB819-800 | Assault II, amended | The sentencing-level question |
| SB819-900 | Arson I at 17 | Under 18 at the offense |
| SB819-1000 | Kidnapping I | Registerable only if the victim was under 18; asked |

---

## Verified

| | |
| --- | --- |
| Backend | 538 passing under Python 3.11; 2 failures need the `wkhtmltopdf` binary and are unrelated |
| Frontend | 32 suites, 188 tests |
| Types | `tsc --noEmit` clean |
| Lint | `pyflakes` clean on every SB-819 backend file |
| Rules page | Rendered at `localhost:5001/sb819-rules` in headless Chrome and read end to end |
| Payload | Shape, criteria metadata and the rules endpoint checked against a running Flask |

The "How determined" column on the rules sheet was audited note by note against the functions
in `multnomah.py` and `registerable_sex_offenses.py`. Every note now states what the code
does. Three judgment calls inside it are the developer's, not the District Attorney's:

1. **The filter/verdict split.** Page 3 lists four main criteria. Two are applied as a filter
   (wrong county, or expungeable, and the charge leaves the analysis) and two as a verdict
   (not a felony, aggravated murder, reported ineligible). Sections 1 and 2 of the sheet say
   so, but it is a reading of how the JIU operates.
2. **Conditionally registerable offences.** Ten statutes require reporting only in
   circumstances OECI does not record, such as the age of the victim or a court designation.
   They are asked about. An attempt or conspiracy at one is asked about the same way.
3. **Excluding the unsettleable criteria** from status. See the decision below.

---

## For Michael: where to look

The parts an auditor should read, in the order they matter:

1. **`HOW_DETERMINED` in `sb819_criteria/logic_sheet.py`**, or the same text on the rules
   page. Twenty notes stating each criterion's operational test. Tests enforce that every
   criterion has one; nothing checks that one is true.
2. **`PERSON_FELONY_SECTIONS` in `multnomah.py`.** The person-crime test for the two sentence
   alternatives on page 4. It is the OAR 213-003-0001(14) list as `person_felony.py` encodes
   it, with the entries that file comments out restored: the sex crimes, three marijuana
   offences, inmate weapon possession, and the two felony traffic offences. A test holds the
   set equal to that file's list.
3. **`registerable_sex_offenses.py`.** The ORS 163A.005(5) list, the ten conditional
   statutes, and the crime-name fragments that read an attempt or conspiracy off a charge
   name. The fragments are a guess at how OECI names inchoate charges; see open question 5.
4. **`SB819Analyzer._in_scope`.** What enters the analysis at all: a conviction, not hidden
   from the record summary, that RecordSponge finds ineligible under ORS 137.225.
5. **The resolution algebra**, `_resolve_outcomes` and `disqualifying_results` in
   `models/sb819.py`, mirrored in `resolveAnalysis.ts`, both run against
   `src/shared/sb819ResolutionFixtures.json`.

---

## Decisions worth not relitigating

**Only convictions enter the analysis, and only `INELIGIBLE` ones.** A dismissed traffic
violation is ineligible for expungement too, and would otherwise be listed as an ineligible
conviction. A charge that becomes eligible on a future date is expungeable under ORS 137.225,
so expungement remains its route. Traffic violations and parking tickets are left out even
when convicted, as the record summary leaves them out.

**Non-Multnomah charges are excluded from the view entirely**, never marked ineligible.
Marking them would read as a decision the District Attorney has not made.

**Each pathway has one gate, declared on the criterion.** `is_gate` marks the question that
defines who the pathway is for. The pathway's other questions are held, in every panel and on
every charge row, until the gate is answered in the pathway's favour. An open main-criterion
question on a charge holds every pathway question on that charge the same way, with no flag.
A gate is a single Question criterion per pathway and never one of several alternatives; a
test pins that.

**The applicant's birth year is read across the record.** OECI puts a birth year on each
case header; some cases lack one, and a case a volunteer adds by hand carries 1900 until it
is edited. The age criteria take the one year every case agrees on, and treat it as unknown,
so that the question is asked, where none is recorded or the cases disagree.

**Three criteria take no part in any status**: the JIU's judgment that an avenue of
investigation exists, and the two showings the applicant assembles later. Counting them
pinned Actual Innocence and Collateral Consequences at Needs More Analysis permanently,
which left the top section unreachable for anyone not currently incarcerated. "Possibly
SB-819 Eligible" means: clears every criterion the record and the client can settle.

**A failed alternative inside a disjunction group is not a bar.** The five Excessive
Sentencing alternatives are satisfied by any one of them. This rule has been implemented
wrongly three times, once in Python and twice in TypeScript, so it is pinned by
`src/shared/sb819ResolutionFixtures.json`, which both test suites execute, including the
list of criteria that bar each pathway.

**An answered question is never hidden.** It is the record of a decision and the only way
back from it. A held question that was answered before its gate turned stays on screen;
a question nothing turns on any more, ruled out by some answer other than its gate, is set
aside behind a disclosure, never dropped.

**Failures are reported as what happened, not what was required.** Criterion names are
requirements, some positive and some negative, so a name shown as a reason states the
opposite of the failure. A criterion settled from the record reports its explanation; one
settled by the client reports the question and the answer given.

**Answers are ephemeral.** Redux only. Cleared by reload, by Start Over, and by a new search,
since the answer targets carry no name and one client's answers would otherwise be applied to
the next client's record. An edit to the current record keeps them.

---

## Open questions for Michael and Cody

1. Sentence completion is marked "OECI only" in Michael's table but is not in the data we
   scrape: there is no post-prison supervision or probation end date. It is asked of the
   client. Is there a signal we are missing?
2. Does the registerable sex offence criterion track the full ORS 163A reporting obligation,
   including out-of-state equivalents?
3. Does "sentenced as a felony" turn on the sentencing level rather than the charging level,
   and how should a reduced or amended disposition be treated?
4. Which county's criteria follow Multnomah?
5. **How does OECI name an attempt or a conspiracy?** The registerable-sex-offence and
   person-crime tests read an inchoate charge off its name, matching fragments such as
   "rape" or "encouraging child sexual abuse" beside "attempt" or "conspir". If OECI records
   "Attempt to Commit a Class B Felony" without naming the object crime, these charges pass
   as not registerable, which is the wrong direction for a screening tool.
6. **Is the Date column on an OECI charge the offence date?** The under-18 alternative
   subtracts the birth year from it and fails the criterion at 19 or older. The rest of
   RecordSponge fills "Date of arrest" on the forms from the same column. For an offence
   prosecuted years later, an arrest date would overstate the age. If the column can be an
   arrest date, the 19-or-older branch should become a question.
7. **Should the two gates inform each other?** An applicant currently incarcerated has not
   completed the sentence, so Yes to the first could answer No to the second on every case.
   The reverse does not hold: No to incarceration says nothing about post-prison supervision.
   Today the two are asked independently.

---

## Known issues outside SB-819

Found while probing, left untouched because they change expungement results:

- **`ChargeClassifier._person_felony` receives the full statute string** and matches it
  exactly against six-digit sections, so a Class B person felony that OECI records with a
  subsection, such as Robbery II as `164.405(1)(a)`, is classified as a plain Class B felony
  and reported as eligible after seven years. The SB-819 person-crime test matches by section
  and does not share this defect.

---

## Release gating

The badge, the view and the rules page render only on `localhost` and on
`dev.recordsponge.com`. Any other hostname resolves to production and hides all three, so an
unrecognised domain conceals unreleased work. A build-time `REACT_APP_SB819` overrides the
tier in either direction. Resolution lives in `service/featureFlags.ts`.

**The gate is frontend-only.** Every `/search` and `/demo` response, on production too,
carries the full analysis: about ten kilobytes per ineligible Multnomah felony, with each
criterion's name, description and page cite repeated per charge, and `/api/sb819/rules` is
served everywhere. Nothing on production renders it, but the criteria are in the payload for
anyone reading it. A server-side switch that decides once whether `RecordSummarizer` attaches
an analysis and whether the rules route registers would close both, and is a deploy-config
decision.

**Consequence of the gate:** the legal team cannot reach the rules page unless they can reach
staging. Ungating it publishes unreleased criteria on the public site, so decide
deliberately.

---

## Running it

### Without Docker

The repo pins Python 3.7, which Homebrew no longer ships. Python 3.11 runs everything,
including the Flask app, which Python 3.14 cannot boot.

```
python3.11 -m venv /path/to/venv && /path/to/venv/bin/pip install \
  'flask==1.1.2' 'werkzeug==1.0.1' 'jinja2==2.11.2' 'markupsafe==1.1.1' 'itsdangerous==1.1.0' \
  'click==7.1.2' 'dacite==1.0.2' 'pytest==7.4.4' 'pytest-lazy-fixture==0.6.3' 'hypothesis==4.50.8' \
  'requests-mock==1.8.0' 'requests==2.23.0' 'beautifulsoup4==4.8.1' 'markdown2==2.3.9' 'pdfkit==0.6.1' \
  'pdfrw==0.4' 'python-dateutil==2.8.1' 'pyjwt==1.7.1' 'flask-bcrypt==0.7.1' 'python-dotenv==0.13.0' \
  'flask-script==2.0.6' cryptography pyflakes
cd src/backend && PYTHONPATH=. /path/to/venv/bin/python -m pytest tests -q
```

`pip install -e .` fails on this Python; `PYTHONPATH=.` from `src/backend` replaces it.

To see the app, build the frontend and let Flask serve it:

```
cd src/frontend && CI=true npx react-scripts build
cd src/backend && PYTHONPATH=. TIER=development SECRET_KEY=dev /path/to/venv/bin/python -c \
  "from expungeservice.wsgi import application; application.run(port=5001)"
open http://localhost:5001/sb819-rules
```

The frontend dev server's proxy points at the Docker hostname `expungeservice`, so
`npm start` does not reach a Flask started this way. Headless Chrome
(`--headless=new --screenshot`) renders the page but often fails to exit; kill it.

### With Docker

Frontend on **3000**, backend on **5001**, since port 5000 on macOS is taken by ControlCenter.

```
curl -s -X POST http://localhost:5001/api/demo -H 'Content-Type: application/json' \
  -d '{"aliases":[{"first_name":"sb","last_name":"819","middle_name":"","birth_date":""}]}'
curl -s http://localhost:5001/api/sb819/rules
```

A brand-new module in `endpoints/` needs `docker restart recordexpungpdx-expungeservice-1`;
the auto-reloader watches only files already imported.

### Traps that cost time

- **`luxon` is declared and locked but can be missing from `node_modules`.** Sixteen
  frontend suites fail to load without it; `npm install --no-save luxon` fixes it without
  touching the manifests.
- **Never run `black` across `expungeservice/`.** It reformats two dozen unrelated files.
  Name the files you changed. Line length is 120.
- **`origin` is the wittejm fork and its `master` is stale.** Reason from `upstream/master`.

---

## If you pick this up next

1. Send Michael the seven open questions. Questions 5 and 6 change what the record can
   settle; question 1 changes what the top section can mean.
2. Decide whether the rules page should be public so the legal team can read it, and
   whether the analysis should be gated server-side.
3. Push the branch and open the pull request against codeforpdx.

Not started: any county but Multnomah, part 2 of the project (the paperwork guide), and
anything touching the summary PDF or the expungement forms.

---

`slapstick-routine.txt` at the repository root is a sketch about all this. It is not code.
