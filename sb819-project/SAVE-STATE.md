# SB-819 — Save State

Where the work stands as of 5 September 2026, on branch `jw/sb819`, **nothing committed**.
Everything below is in the working tree.

Read [design.md](design.md) for feature 1 and [question-answers-plan.md](question-answers-plan.md)
for the question mechanics. This file is the resume point: what is done, what is decided,
what is not checked, and what bites you when you pick it up again.

---

## What exists

A volunteer searching a record sees a badge beside the **Ineligible** heading in the search
summary. It opens an SB-819 view listing only the Multnomah convictions that expungement
cannot reach, sorted into three sections, with the Multnomah District Attorney's limiting
criteria applied to each and the unresolved ones put as questions the volunteer answers with
the client. Answering re-sorts the sections live. A **Full rules** link opens a generated
logic sheet of every rule the software applies.

### Backend

| File | Role |
| --- | --- |
| `models/sb819.py` | Statuses, pathways, scopes, criteria, the resolution algebra |
| `sb819_analyzer.py` | Filters to in-scope charges, runs the county ruleset, rolls up |
| `sb819_criteria/multnomah.py` | The twenty criteria, with wording, page cite, scope and key |
| `sb819_criteria/registerable_sex_offenses.py` | The ORS 163A.005(5) list |
| `sb819_criteria/logic_sheet.py` | Builds the numbered sheet from the criteria |
| `endpoints/sb819_rules.py` | `GET /api/sb819/rules` |

Edits to existing files are four: one field on `RecordSummary`, one call in
`RecordSummarizer`, one block in `serializer.py`, and the demo record.

### Frontend

Everything lives in `components/RecordSearch/SB819/` plus `components/SB819Rules/`,
`redux/sb819Slice.ts`, `redux/sb819AnswersSlice.ts`, and `service/featureFlags.ts`.

The record view's own `Case`, `Cases`, `Charge` and `Charges` components are **untouched**.
The SB-819 view renders its own `SB819Case` and `SB819Charge`. An earlier attempt threaded
render-prop slots through those four shared components; it was reverted, and should stay
reverted.

Edits to existing files are five: `App/index.tsx` (route), `Layout/index.tsx` (view),
`RecordSummary/index.tsx` and `RecordSummary/ChargesList.tsx` (badge), `Record/types.ts`
(the analysis on the summary payload), `redux/store.tsx` (two reducers), and
`Demo/DemoInfo.tsx` (the demo record).

### Demo record

Alias **sb / 819**, nine cases, listed on the demo page. Exercises every criterion: a
control charge that never enters the view, a Clackamas charge excluded by county, a
misdemeanor failing the felony criterion, aggravated murder, a registerable sex offence, a
person felony, a non-person felony, an amended disposition, and an offence committed under 18.

---

## Verified

| | |
| --- | --- |
| Backend | 512 passing, 83 of them SB-819 |
| Frontend | 32 suites, 58 tests in the SB-819 and feature-flag suites |
| Types | `tsc --noEmit` clean |
| Lint | `pyflakes` clean on all new backend files |

**Eight backend failures and eight errors are pre-existing.** They are identical on a clean
checkout of `HEAD`, verified with `git archive`. All are Python 3.14 incompatibilities in a
repo pinned to 3.7 — `ast.Str`, `typing.io`, `pkg_resources` — plus a missing `wkhtmltopdf`
binary. Do not chase them.

Checked against the running stack, not inferred: the payload shape, the criteria metadata
reaching the browser, and the rules endpoint.

---

## Not verified

**Nobody has looked at the rules page in a browser.** The JSON it renders from is verified;
the rendering is not.

**The "How determined" prose is unreviewed.** Twenty entries, about 634 words, in
`logic_sheet.py`. It states the operational test for each criterion — what "felony" means in
the data, how aggravated murder is matched. Tests enforce that every criterion *has* a note
and that no note outlives its criterion. Nothing checks that a note is *true*. This is the
part a lawyer auditing will lean on hardest, and an error in it is confident and invisible.
Have Michael read that column before the sheet goes to the legal team.

Three judgment calls inside it are mine, not the District Attorney's:

1. **The filter/verdict split.** Page 3 lists four main criteria. Two are applied as a filter
   (wrong county, or expungeable — the charge leaves the analysis) and two as a verdict
   (not a felony, aggravated murder — reported ineligible). Sections 1 and 2 of the sheet
   say so, but it is a reading of how the JIU operates.
2. **Conditionally registerable offences.** Ten statutes require reporting only in
   circumstances OECI does not record, such as the age of the victim or a court designation.
   They are asked about rather than assumed either way.
3. **Excluding the unsettleable criteria** from status. See the decision below.

---

## Decisions worth not relitigating

**Only `INELIGIBLE` charges enter the analysis.** A charge that becomes eligible on a future
date is expungeable under ORS 137.225, so expungement remains its route.

**Non-Multnomah charges are excluded from the view entirely**, never marked ineligible.
Marking them would read as a decision the District Attorney has not made.

**Three criteria take no part in any status**: the JIU's judgment that an avenue of
investigation exists, and the two showings the applicant assembles later. Counting them
pinned Actual Innocence and Collateral Consequences at Needs More Analysis permanently,
which left the top section unreachable for anyone not currently incarcerated. "Possibly
SB-819 Eligible" now means: clears every criterion the record and the client can settle.

**A failed alternative inside a disjunction group is not a bar.** The five Excessive
Sentencing alternatives are satisfied by any one of them. This rule has been implemented
wrongly three times — once in Python, twice in TypeScript — so it is pinned by
`src/shared/sb819ResolutionFixtures.json`, which both test suites execute.

**An answered question is never hidden.** It is the record of a decision and the only way
back from it. Questions that stop mattering are set aside behind a disclosure, never dropped.

**Failures are reported as what happened, not what was required.** Criterion names are
requirements, some positive and some negative, so a name shown as a reason states the
opposite of the failure. A criterion settled from the record reports its explanation; one
settled by the client reports the question and the answer given.

**Answers are ephemeral.** Redux only, cleared by reload and by Start Over. Nothing on disk,
nothing in the search request, nothing in the summary PDF.

---

## Open questions for Michael and Cody

1. Sentence completion is marked "OECI only" in Michael's table but is not in the data we
   scrape — there is no post-prison supervision or probation end date. It is currently asked
   of the client. Is there a signal we are missing?
2. Does the registerable sex offence criterion track the full ORS 163A reporting obligation,
   including attempts and out-of-state equivalents?
3. Does "sentenced as a felony" turn on the sentencing level rather than the charging level,
   and how should a reduced or amended disposition be treated?
4. Which county's criteria follow Multnomah?

---

## Release gating

The badge, the view and the rules page render only on `localhost` and on
`dev.recordsponge.com`. Any other hostname resolves to production and hides all three, so an
unrecognised domain conceals unreleased work rather than exposing it. A build-time
`REACT_APP_SB819` overrides the tier in either direction. Resolution lives in
`service/featureFlags.ts`.

**Consequence:** the legal team cannot reach the rules page unless they can reach staging.
Ungating it publishes unreleased criteria on the public site, so decide deliberately.

---

## Running it

The Docker stack: frontend on **3000**, backend on **5001** — port 5000 on macOS is taken by
ControlCenter, not Flask.

```
curl -s -X POST http://localhost:5001/api/demo -H 'Content-Type: application/json' \
  -d '{"aliases":[{"first_name":"sb","last_name":"819","middle_name":"","birth_date":""}]}'
curl -s http://localhost:5001/api/sb819/rules
```

### Traps that cost time

- **A new endpoint module needs a container restart.** The auto-reloader watches imported
  files, so a brand-new module in `endpoints/` is never picked up and the route silently
  falls through to the static handler, serving `index.html`.
  `docker restart recordexpungpdx-expungeservice-1`.
- **Run pytest with `-p no:hypothesispytest`.** The pinned hypothesis plugin imports
  `distutils`, gone in Python 3.12+.
- **`luxon` is declared and locked but missing from the local `node_modules`.** Sixteen
  frontend suites fail to load without it; `npm install --no-save luxon` fixes it without
  touching the manifests. That install also clears about twenty-five stale
  `react-router-dom` type errors.
- **Never run `black` across `expungeservice/`.** It reformats two dozen unrelated files.
  Name the files you changed.
- **The app cannot boot under Python 3.14 at all** — `Flask(__name__)` throws in werkzeug
  1.0.1. Verify serialization through `ExpungeModelEncoder` directly instead.

---

## If you pick this up next

Highest value first:

1. Load the rules page in a browser and read the "How determined" column. Both are unchecked.
2. Send Michael the four open questions. Question 1 changes what the top section can mean.
3. Decide whether the rules page should be public so the legal team can read it.
4. Commit. Nothing is committed, and the working tree holds about three days of work.

Not started: any county but Multnomah, part 2 of the project (the paperwork guide), and
anything touching the summary PDF or the expungement forms.

---

`slapstick-routine.txt` at the repository root is a sketch about all this. It is not code.
