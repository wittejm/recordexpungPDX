# SB-819 — Save State

Branch `jw/sb819`, committed, not pushed, on top of `upstream/master` (codeforpdx). `origin`
is the wittejm fork and its master is stale; reason from `upstream/master`.

[design.md](design.md) covers feature 1, [question-answers-plan.md](question-answers-plan.md)
the question mechanics, and [OUTSTANDING-QUESTIONS.md](OUTSTANDING-QUESTIONS.md) what goes
to Michael and Cody. This file holds only what the code cannot tell you.

---

## Decisions worth not relitigating

**Only convictions enter the analysis, and only `INELIGIBLE` ones.** A dismissed traffic
violation is ineligible for expungement too, and would otherwise be listed as an ineligible
conviction. A charge that becomes eligible on a future date is expungeable under ORS 137.225,
so expungement remains its route. Traffic violations and parking tickets are left out even
when convicted, as the record summary leaves them out.

**Non-Multnomah charges are excluded from the view entirely**, never marked ineligible.
Marking them would read as a decision the District Attorney has not made.

**Each pathway has one gate.** The pathway's other questions are held until the gate is
answered in the pathway's favour, so the form grows as the client's circumstances come out.
Jordan asked for this explicitly: questions expand on the gate's answer, never collapse.

**The applicant's birth year is read across the record.** Some case headers lack one, and a
case a volunteer adds by hand carries 1900 until edited. Disagreement between cases is
treated as unknown, so the question is asked.

**Three criteria take no part in any status**: the JIU's judgment that an avenue of
investigation exists, and the two showings the applicant assembles later. Counting them
pinned Actual Innocence and Collateral Consequences at Needs More Analysis permanently,
which left the top section unreachable for anyone not currently incarcerated.

**A failed alternative inside a disjunction group is not a bar.** This has been implemented
wrongly three times, once in Python and twice in TypeScript, so it is pinned by
`src/shared/sb819ResolutionFixtures.json`, which both test suites execute. Do not add a
fourth place that reasons about failures without going through `disqualifying_results` or
`disqualifyingCriteria`.

**An answered question is never hidden.** It is the record of a decision and the only way
back from it.

**Answers are ephemeral.** Redux only. Cleared by reload, by Start Over, and by a new search,
since the answer targets carry no name and one client's answers would otherwise reach the
next client's record. An edit to the current record keeps them.

**The record view's `Case`, `Cases`, `Charge` and `Charges` components stay untouched.** An
earlier attempt threaded render-prop slots through them; it was reverted, and should stay
reverted.

---

## Release gating

The badge, the view and the rules page render only on `localhost` and `dev.recordsponge.com`;
any other hostname counts as production. A build-time `REACT_APP_SB819` overrides that.

**The gate is frontend-only.** Every `/search` and `/demo` response, on production too,
carries the full analysis, and `/api/sb819/rules` is served everywhere. Nothing on production
renders it, but the criteria are in the payload for anyone reading it. Gating server-side,
in `RecordSummarizer` and the rules route registration, is a deploy decision.

**Consequence:** the legal team cannot reach the rules page unless they can reach staging.
Ungating it publishes unreleased criteria on the public site, so decide deliberately.

---

## Known issue outside SB-819

Found while probing, left untouched because it changes expungement results:
`ChargeClassifier._person_felony` matches the full statute string exactly against six-digit
sections, so a Class B person felony that OECI records with a subsection, such as Robbery II
as `164.405(1)(a)`, classifies as a plain Class B felony and reports as eligible after seven
years. The SB-819 person-crime test matches by section and does not share this defect.

---

## Running it

### Without Docker

The repo pins Python 3.7, which Homebrew no longer ships. Python 3.11 runs everything,
including the Flask app; Python 3.14 cannot boot Flask and fails sixteen unrelated tests.

```
python3.11 -m venv /path/to/venv && /path/to/venv/bin/pip install \
  'flask==1.1.2' 'werkzeug==1.0.1' 'jinja2==2.11.2' 'markupsafe==1.1.1' 'itsdangerous==1.1.0' \
  'click==7.1.2' 'dacite==1.0.2' 'pytest==7.4.4' 'pytest-lazy-fixture==0.6.3' 'hypothesis==4.50.8' \
  'requests-mock==1.8.0' 'requests==2.23.0' 'beautifulsoup4==4.8.1' 'markdown2==2.3.9' 'pdfkit==0.6.1' \
  'pdfrw==0.4' 'python-dateutil==2.8.1' 'pyjwt==1.7.1' 'flask-bcrypt==0.7.1' 'python-dotenv==0.13.0' \
  'flask-script==2.0.6' cryptography pyflakes
cd src/backend && PYTHONPATH=. /path/to/venv/bin/python -m pytest tests -q
```

`pip install -e .` fails on this Python; `PYTHONPATH=.` from `src/backend` replaces it. Two
tests need the `wkhtmltopdf` binary and fail without it.

To see the app, build the frontend and let Flask serve it:

```
cd src/frontend && CI=true npx react-scripts build
cd src/backend && PYTHONPATH=. TIER=development SECRET_KEY=dev /path/to/venv/bin/python -c \
  "from expungeservice.wsgi import application; application.run(port=5001)"
open http://localhost:5001/sb819-rules
```

The frontend dev server's proxy points at the Docker hostname `expungeservice`, so
`npm start` does not reach a Flask started this way.

### With Docker

Frontend on **3000**, backend on **5001**, since port 5000 on macOS is taken by ControlCenter.
A brand-new module in `endpoints/` needs `docker restart recordexpungpdx-expungeservice-1`;
the auto-reloader watches only files already imported.

### Traps

- **`luxon` is declared and locked but can be missing from `node_modules`.** Sixteen
  frontend suites fail to load without it; `npm install --no-save luxon` fixes it without
  touching the manifests.
- **Never run `black` across `expungeservice/`.** It reformats two dozen unrelated files.
  Name the files you changed. Line length is 120.

---

## Next

1. Send Michael and Cody [OUTSTANDING-QUESTIONS.md](OUTSTANDING-QUESTIONS.md).
2. Decide whether the rules page should be public, and whether the analysis should be gated
   server-side.
3. Push the branch and open the pull request against codeforpdx.

Not started: any county but Multnomah, part 2 of the project (the paperwork guide), and
anything touching the summary PDF or the expungement forms.

`slapstick-routine.txt` at the repository root is a sketch about all this. It is not code.
