# SB-819 Eligibility Analysis — Design

Feature 1 of the SB-819 project: screen charges that RecordSponge finds ineligible
under ORS 137.225/137.226 against Multnomah County's published SB-819 limiting criteria.

## Background

SB 819 (2021) allows a District Attorney, jointly with a convicted person, to petition a
court to reconsider a conviction or sentence. The statute grants the DA broad discretion,
but each county's DA publishes limiting criteria that gate which applications the office
will screen at all. Multnomah County's Justice Integrity Unit (JIU) publishes those
criteria in the [SB-819 Application Information Sheet](https://www.mcda.us/wp-content/uploads/2021/11/SB-819-Application-Information-Sheet.pdf) (version 2021.11.05), which is the
source for every rule in this document; page cites throughout refer to it.

Most of the JIU's limiting criteria are determinable from the same OECI data RecordSponge
already collects. Volunteers currently promise SB-819 relief to people the criteria
exclude. Screening those criteria automatically is the deliverable.

## Scope

In scope: Multnomah County; all three JIU application pathways; criteria determinable from
OECI, plus display-only questions for criteria that depend on facts OECI does not carry.

Out of scope: other counties (the criteria registry is keyed by county so they are
additive); the two narrative Collateral Consequences criteria (substantial rehabilitation,
manifest hardship), which belong to part 2 of the project; the paperwork guide; the summary
PDF; Generate Paperwork; the Expanded view.

## What enters the analysis

A charge is analyzed when both hold:

- Its case location is Multnomah. Other counties are excluded from the view entirely. A
  Clackamas charge marked "SB-819 Ineligible" would read as "the DA said no" when the truth
  is that Clackamas's policy is not yet implemented.
- Its merged `charge_eligibility.status` is `INELIGIBLE`. The JIU criterion is that the
  conviction is *not expungeable* under ORS 137.225 — SB 819 is the route for records that
  expungement cannot reach. A charge that becomes eligible on a future date is expungeable
  under 137.225, so `WILL_BE_ELIGIBLE`, `POSSIBLY_ELIGIBLE`, `NEEDS_MORE_ANALYSIS`,
  `UNKNOWN`, and `INELIGIBLE_IF_RESTITUTION_OWED` are all out of scope.

Both conditions are also reported as passed main criteria on the charges that survive them,
so the detail panel shows the full criteria list rather than an unexplained subset.

## Criteria

### Main criteria — gate all three pathways (page 3)

| Criterion | Determination | On failure |
| --- | --- | --- |
| Conviction is from Multnomah County | `case.summary.location` | Excluded from view |
| Conviction is not expungeable under ORS 137.225 | merged `charge_eligibility.status == INELIGIBLE` | Excluded from view |
| Conviction was sentenced as a felony | `charge.level` (OECI verbatim), "Felony Unclassified" counts as a felony | Ineligible |
| Conviction is not aggravated murder | statute `163095`, falling back to `"aggravated murder"` in the charge name | Ineligible |

The felony criterion resolves to Unknown, carrying a "Was this conviction sentenced as a
felony?" question, when `disposition.lesser_charge` or `disposition.amended` is set or the
charge typed as `ReducedToViolation`. Those signal that the sentencing level may differ
from the charging level, which is the level the criterion turns on.

Aggravated murder detection is deliberately narrower than the `SevereCharge` charge type,
which name-matches all murder. SB 819 excludes aggravated murder (ORS 163.095) only;
Murder II (ORS 163.115) is not excluded.

### Pathway 1 — Actual Innocence (page 3)

| Criterion | Determination |
| --- | --- |
| Applicant asserts actual innocence of the conviction | Question |
| The JIU can identify an avenue of investigation with potential to substantiate the claim | JIU discretion |

This pathway adds no criterion that can be screened from a record. It rests on a claim the
applicant has to make and an investigation the JIU has to find, neither of which the record
settles, so it resolves to Needs More Analysis for every charge that clears the main
criteria.

### Pathway 2 — Excessive Sentencing (pages 3–4)

All four gates must hold, plus at least one of the five alternatives.

| Criterion | Determination |
| --- | --- |
| Applicant is currently incarcerated | Question |
| Applicant has served at least 5 years of the term of incarceration | Question |
| Conviction was not part of a global plea deal with multiple counties | Question |
| Conviction is not subject to ORS 137.690 or ORS 137.719 | Ruled out from OECI when the record carries no felony sex crime convictions; otherwise a question |
| — at least one of — | |
| Sentenced as a juvenile, term remaining, approaching 25, transferring to adult prison | Question |
| Committed the crime when under 18 | `case.summary.birth_year` against `charge.date` |
| Over 60, or terminal or debilitating illness, or on hospice | Age from `birth_year`; illness is a question |
| Non-person crimes totaling more than 10 years | Person status from `PersonFelonyClassB.statutes`; sentence length is a question |
| Person crimes totaling more than 16 years | as above |

ORS 137.690 (25-year mandatory minimum on a repeat major felony sex crime) and ORS 137.719
(presumptive life on a felony sex crime with two prior felony sex crime sentences) both
reach sex crimes only, so a record with no felony sex crime convictions is affirmatively
clear of them. That check can only produce a pass, never a disqualification.

This pathway requires current incarceration, which a RecordSponge user sitting at a clinic
table almost never is. It is implemented for completeness and resolves at the first
question for nearly every real record.

### Pathway 3 — Collateral Consequences (page 5)

| Criterion | Determination |
| --- | --- |
| Applicant has fully completed the sentence, including all post-prison supervision or probation | Question |
| Conviction is not a registerable sex offense | ORS 163A offense list |
| Conviction did not involve domestic violence | Question, carrying the exception below |
| Applicant demonstrates substantial rehabilitation and low risk of further criminality | Part 2 |
| Applicant demonstrates manifest and particularized hardship | Part 2 |

A domestic violence conviction is not disqualifying if it was committed while the applicant
was a juvenile and did not involve an intimate partner. The question carries that exception
as a note.

Sentence completion is not determinable from OECI. The scraped fields are case
`current_status`, `balance_due_in_cents`, `restitution`, and `probation_revoked`; none of
them carry post-prison supervision or probation end dates. Case status "Closed" describes
the court case, not supervision.

The registerable sex offense list comes from ORS 163A rather than the existing
`SexCrime.statutes`, which was built for the ORS 137.225(6)(a) expungement exclusion and
covers a different, narrower set.

## Statuses and roll-up

Three statuses, matching the view's three sections:

- **Possibly SB-819 Eligible** — every applicable criterion passed.
- **Needs More Analysis** — no criterion failed, and at least one is unresolved.
- **SB-819 Ineligible** — at least one criterion failed on data we have.

A failed main criterion sets the charge to Ineligible and the pathways are not evaluated;
the failing criterion is still reported so the view can show why. Otherwise each pathway
resolves independently, and the charge takes the best status across the three.

The five Excessive Sentencing alternatives on page 4 are a disjunction: the group is
satisfied if any one alternative passes, and only disqualifies when every one of them
fails. A single failed alternative is never reported as a bar, since reporting it as one
would read as a disqualification the criteria do not impose.

When Collateral Consequences is blocked but another pathway is not, the detail panel says
so. A registerable sex offense blocks that pathway alone, and reporting it as a flat
"SB-819 Ineligible" would turn away someone whose Actual Innocence route is open.

### Possibly SB-819 Eligible is unreachable

No charge reaches the top section, for a reason worth stating plainly rather than
discovering later:

- Actual Innocence has no screenable criterion, so it never disqualifies and never fully clears.
- Excessive Sentencing has no OECI-determinable disqualifier at all. The ORS 137.690/137.719
  check produces only passes.
- Collateral Consequences has exactly one OECI disqualifier, the registerable sex offense
  list. Sentence completion and domestic violence are both questions, and both apply to
  every charge, since nothing in OECI indicates whether a conviction involved DV.

So no charge can be disqualified from all three pathways, and none can clear every
question. Every charge surviving the main criteria lands in Needs More Analysis.

The main criteria still do the work the feature exists for — county, expungeability, felony
level, and aggravated murder disqualify a real share of charges, which is the overpromising
the proposal set out to stop. The split above Ineligible is what collapses, and each Needs
More Analysis charge lists its own open questions, which is the actionable output.

Michael's criteria table marks sentence completion "OECI only", so he may have a signal in
mind that is not in the data we scrape. That is an open question for him, recorded below.
Treating a closed case with no balance and no revoked probation as presumptive sentence
completion would populate the top section, at the cost of telling someone still on
post-prison supervision that they are possibly eligible.

## Backend architecture

The analysis reads merged `charge_eligibility`, which exists only after
`RecordMerger.merge`, so it runs as a post-pass in `RecordSummarizer.summarize`. The
ambiguous-charge expansion, the expunger, and the `Charge` dataclass are untouched.

New files:

- `models/sb819.py` — `SB819Status`, `SB819Pathway`, `SB819Criterion` (name, description,
  page cite, pathway), `SB819CriterionOutcome`, `SB819Question` (text, status if yes,
  status if no, optional note), `SB819CriterionResult`, `SB819PathwayResult`,
  `SB819ChargeAnalysis`, `SB819Analysis`.
- `sb819_analyzer.py` — filters to in-scope charges, runs the county ruleset, rolls up.
- `sb819_criteria/multnomah.py` — one function per criterion, each returning a
  `SB819CriterionResult` carrying the DA sheet's own wording and page cite.
- `sb819_criteria/registerable_sex_offenses.py` — the ORS 163A statute list.
- `sb819_criteria/__init__.py` — county to ruleset registry.

Edits to existing files:

- `models/record_summary.py` — one field, `sb819_analysis`.
- `record_summarizer.py` — one call in `summarize`.
- `serializer.py` — one block in `record_summary_to_json`.
- `demo_records.py` — the new demo record.

`SB819Analysis` keys charge analyses by `ambiguous_charge_id`.

## Frontend architecture

The SB-819 view is a mode of the default record view. It is unavailable in the Expanded
view, where the badge is hidden.

### Release gating

The badge and the view render only on localhost and on `dev.recordsponge.com`. Any other
hostname, `recordsponge.com` included, resolves to production and hides both, so an
unrecognized domain conceals unreleased work rather than exposing it. A build-time
`REACT_APP_SB819` overrides the tier in either direction. Resolution lives in
`service/featureFlags.ts`.

New files under `components/RecordSearch/SB819/`:

- `index.tsx` — the view, rendering only in-scope charges.
- `SB819Badge.tsx` — the badge beside the Ineligible group header in the summary panel.
  Always rendered when the analysis has any in-scope charge, always clickable. Reads
  "Charges possibly SB-819 eligible" when any charge is Possibly Eligible or Needs More
  Analysis, "No charges SB-819 eligible" otherwise.
- `SB819Summary.tsx` — the view's own summary panel: the three sections, and the button
  that returns to the normal view.
- `SB819ChargesList.tsx` — section rendering.
- `SB819Criteria.tsx` — the extra charge-detail section: matching criteria with their page
  cites, and the questions, rendered as static text in the form "Is such and such yes/no?
  If yes: Ineligible. If no: Possibly eligible."
- `types.ts` — mirrors the backend structures.
- `redux/sb819Slice.ts` — the view-mode flag.

The questions are display-only. They do not use the existing `Questions`/`Question`/`Answer`
machinery, which dispatches `SELECT_ANSWER`, accumulates edits, and re-requests
`/api/search` for re-analysis. SB-819 questions carry no state and trigger no request.

Edits to existing files:

- `Record/types.ts` — the new types.
- `Layout/index.tsx` — conditional render, gated to the non-Expanded view.
- `RecordSummary/ChargesList.tsx` — badge insertion.
- `redux/store.tsx` — register the reducer.
- `Record/Case.tsx`, `Record/Charges.tsx`, `Record/Charge.tsx` — an optional
  `renderSB819ChargeSection` prop threaded through, one line each, so the SB-819 criteria section
  can be injected into the existing charge panel and all SB-819 rendering stays in new
  files.

## Demo record

Alias `("sb", "819", "", "")`, listed in `DemoInfo.tsx`. The record exercises every rule:

| Case | Charge | Demonstrates |
| --- | --- | --- |
| Multnomah | Misdemeanor Class A conviction, aged out | Normally eligible; absent from the view |
| Clackamas | Felony Class A conviction | Excluded from the view by county |
| Multnomah | DUII conviction, Misdemeanor Class A | Fails the felony criterion |
| Multnomah | Aggravated Murder, ORS 163.095 | Fails the aggravated murder criterion |
| Multnomah | Rape II, ORS 163.365, Felony Class B | Registerable sex offense; blocks Collateral Consequences, survives via the other pathways |
| Multnomah | Robbery II, ORS 164.405, person felony Class B | Passes all main criteria; Needs More Analysis with the full question set |
| Multnomah | Possession of Weapon by Prison Inmate, ORS 166.275, Felony Class A | Non-person felony; exercises the non-person sentencing alternative |
| Multnomah | Assault II, ORS 163.175, Felony Class A, amended disposition | Triggers the "sentenced as a felony?" question |
| Multnomah | Arson I, ORS 164.325, committed before the applicant turned 18 | Passes the Excessive Sentencing age alternative |

## Testing

Backend tests in `tests/`, following the existing per-charge-type layout: one module per
criterion covering pass, fail, and unknown; roll-up tests across pathways; and a test
asserting the demo record produces the statuses in the table above.

## Open questions for Michael and Cody

1. Sentence completion is marked "OECI only" but is not in the data we scrape. Is there a
   signal in OECI we are missing, or should it stay a question?
2. Does the registerable sex offense criterion track the full ORS 163A reporting
   obligation, including attempts and out-of-state equivalents?
3. Does "sentenced as a felony" turn on the sentencing level rather than the charging
   level, and how should a felony charge with a reduced or amended disposition be treated?
4. Which county's criteria should follow Multnomah?
