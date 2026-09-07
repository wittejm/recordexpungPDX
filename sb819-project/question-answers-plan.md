# SB-819 Question Mechanics

Feature 2 of the SB-819 project: let a volunteer answer the criteria questions with the
client and watch charges resolve, with the answers evaluated entirely in the browser.

Feature 1 ([design.md](design.md)) screens the criteria that OECI settles and states the
rest as questions the reader answers aloud. This adds the mechanics: the questions become
answerable, answers propagate, and charges move between the three sections as they are
given.

## Decisions taken

| | |
| --- | --- |
| Scope granularity | Three scopes: record, case, charge |
| Persistence | Redux only, cleared on reload and by Start Over; nothing on disk |
| Global questions | One panel at the top of the view; charges show a single collapsed status row |
| Decided pathways | Remaining questions fold behind a one-line reason |
| Unanswerable criteria | Excluded from status; rendered as next-step instructions |
| Existing machinery | Untouched. No new request path, nothing in the summary PDF |

## Question inventory

Fourteen questions. Five are facts about the applicant, so asking them per charge would ask
the same thing up to nine times on the demo record alone.

### Record scope — asked once (5)

All five belong to Excessive Sentencing.

| Question | Why record scope |
| --- | --- |
| Is the applicant currently incarcerated? | A person is or is not in custody |
| Sentenced as a juvenile, approaching 25, facing transfer to adult prison? | A present circumstance, not a property of any conviction |
| Over 60, terminally or debilitatingly ill, or on hospice care? | A personal attribute |
| Do non-person sentences total more than 10 years? | An aggregate across sentences; per-charge is the wrong shape |
| Do person sentences total more than 16 years? | An aggregate across sentences |

### Case scope — one answer per case (2)

| Question | Why case scope |
| --- | --- |
| Has the applicant fully completed the sentence on this case, including post-prison supervision and probation? | The DA sheet says "on this case" |
| Was this conviction part of a global plea deal across counties? | A plea agreement covers a case |

### Charge scope (7)

Four appear only in specific circumstances.

| Question | When it appears |
| --- | --- |
| Was this conviction sentenced as a felony? | Only on an amended, lesser-charge, or reduced disposition |
| Is the applicant asserting actual innocence of this conviction? | Always |
| Has the applicant served at least five years on this sentence? | Always |
| Was this conviction sentenced under ORS 137.690 or ORS 137.719? | Only when the record carries felony sex crime convictions |
| Was the applicant under 18 when this crime was committed? | Only when the birth year is missing or the age lands exactly on 18 |
| Does this conviction require reporting as a sex offender? | Only for the conditionally registerable statutes |
| Did this conviction involve domestic violence? | Always |

"Served at least five years" is filed under charge scope, though a sentence arguably
attaches to a case. It only matters on a multi-charge case.

### The shape of the common case

"Is the applicant currently incarcerated?" gates all of Excessive Sentencing. For a client
sitting at a clinic table the answer is No, which rules out that pathway and folds away
nine of the fourteen questions. One answer collapses most of the form.

## What "Possibly SB-819 Eligible" means

Every criterion is settled from one of two sources. An OECI criterion is settled by the
record. A Question criterion is settled by the client's answer. A criterion resolves to
Passed or Failed once its source speaks, and stays Unknown until then.

Three criteria have neither source:

| Criterion | Pathway | Who settles it |
| --- | --- | --- |
| The JIU can identify an avenue of investigation | Actual Innocence | The District Attorney, during its own review, after the application is filed |
| Substantial rehabilitation and low risk | Collateral Consequences | The applicant, through documents assembled in part 2 |
| Manifest and particularized hardship | Collateral Consequences | The applicant, the same way |

Nothing the volunteer can read or ask resolves these three. Counting them toward status
would pin Actual Innocence and Collateral Consequences at Needs More Analysis permanently,
leaving Excessive Sentencing as the only pathway that can clear — and its first gate asks
whether the applicant is currently incarcerated, which is No for a client sitting at a
clinic table. Every path through the questions would end at Needs More Analysis or
Ineligible, and answering could only ever move a charge downward.

**These three are therefore excluded from the status computation and presented as
instructions rather than questions.** "Possibly SB-819 Eligible" means this conviction
clears every limiting criterion the DA publishes and the client can answer. What remains is
the second stage the proposal describes: the personal statement, the letters of
recommendation, and the disciplinary records, shown as a next-steps list on the charges
that reach it.

The unanswered baseline is unchanged by this. With no answers given the real questions are
still Unknown, so every pathway still sits at Needs More Analysis and every charge lands
where it does today. Excluding the three only raises the ceiling once answers arrive.

### What this makes the questions for

The questionnaire terminates in a verdict in both directions rather than only in exclusion,
which shapes three things in the interface:

- **Completion is meaningful.** A charge reaches the top section only when every answerable
  criterion on some pathway is answered and passing, so a charge shows how many questions
  stand between it and a result.
- **The three unanswerable criteria are a next-steps list**, surfaced on charges that clear,
  rather than criteria rows carrying an unresolved marker.
- **Question order matters.** Questions that can produce a positive result come first.

## Resolution model

Specified precisely here because it is implemented twice, in Python and in TypeScript.

1. **Answer to outcome.** For an unresolved criterion carrying a question, Yes gives Failed
   when `if_yes` is Ineligible and Passed otherwise; No reads `if_no` the same way.
   Unanswered stays Unknown. The three criteria settled by neither the record nor the
   client take no part in this or any later step; they are rendered as instructions.
2. **Disjunction groups.** Any member Passed makes the group Passed; otherwise any Unknown
   makes it Unknown; only an all-failed group fails. This is what keeps a single failed
   Excessive Sentencing alternative from reading as a bar.
3. **Pathway status.** Any Failed gives Ineligible; otherwise any Unknown gives Needs More
   Analysis; otherwise Possibly Eligible.
4. **Charge status.** A failed main criterion gives Ineligible and the pathways are not
   evaluated. Otherwise the charge takes the worse of the main-criteria status and the best
   pathway status.
5. **Sections.** Charges re-bucket into the three sections on every answer.

## Where the logic lives

All resolution runs in the browser. The payload already carries what is needed: every
unresolved criterion ships `if_yes` and `if_no`, so an answer maps straight to an outcome,
and the rest is the algebra above.

The backend needs three additive metadata fields and no logic change:

- `scope` on `SB819Criterion`, because whether a fact concerns the person, the case, or the
  conviction is legal knowledge and belongs beside the criteria. A list of criterion names
  in TypeScript would drift the first time one is reworded.
- `disjunction_group` in the serializer. Without it the frontend cannot collapse the
  Excessive Sentencing alternatives and would read one failed alternative as fatal.
- `question_key`, a stable identifier that answers key off, so rewording a question does not
  silently discard the answer to it.

### Keeping the two resolvers honest

The resolution algebra existing in two languages is the real cost of evaluating in the
browser. The backend stays authoritative for what the criteria are and how they compose;
only the small pure resolver is duplicated.

A single fixture table of criteria, answers, and expected statuses lives in the repository
and is executed by both the pytest and the jest suite. Drift between the two
implementations fails a test rather than reaching a volunteer.

## Interface

Three collapses, all built on the existing `useDisclosure` hook and `DisclosureIcon`.

**Main criteria** collapse to a single line when all four pass. A failed or unresolved main
criterion keeps the section open, since it is either the disqualifying reason or an open
question.

**Global criteria on a charge** collapse to one status row rather than five entries: a
status dot, "Applicant circumstances", and the resolved effect, such as "rules out
Excessive Sentencing". Green when every global answer is in and none disqualify this
charge, red when an answer disqualifies a pathway, purple when any is unanswered. The dot
reflects each criterion's resolved contribution, so a global criterion failing inside a
disjunction group does not turn the row red unless the whole group fails. Expanding gives
one compact line per criterion, each linking to the panel where it is answered.

**A decided pathway** folds its remaining questions behind its one-line reason.

**A charge that clears** carries a next-steps list in place of the three unanswerable
criteria: the personal statement, the letters of recommendation, and the disciplinary
records the JIU will want, plus the note that the DA decides for itself whether an
innocence claim is investigable.

## Files

### Backend

| File | Change |
| --- | --- |
| `models/sb819.py` | `SB819Scope` enum; `scope` and `question_key` on `SB819Criterion` |
| `sb819_criteria/multnomah.py` | A scope and key on each of the seventeen criteria |
| `serializer.py` | Emit `scope`, `question_key`, `disjunction_group` |

### Frontend

| File | Purpose |
| --- | --- |
| `redux/sb819AnswersSlice.ts` | Answers keyed by scope, target, and question key |
| `SB819/resolveAnalysis.ts` | The pure resolver |
| `SB819/SB819Question.tsx` | A Yes/No control with a clear action |
| `SB819/SB819GlobalPanel.tsx` | The five record-scope questions |
| `SB819/SB819CaseQuestions.tsx` | The two case-scope questions |
| `SB819/SB819Criteria.tsx` | The three collapses |
| `SB819/index.tsx`, `SB819Summary.tsx`, `SB819ChargesList.tsx` | Read the resolved analysis |
| `Record/Case.tsx` | A `renderSB819CaseSection` prop mirroring `renderSB819ChargeSection` |

`Case.tsx` is the only existing frontend file this feature edits.

## Testing

- Backend: every criterion carries a scope and a unique key; the five record-scope and two
  case-scope criteria are asserted by name.
- Frontend: the resolver against the shared fixture table; a global answer propagating to
  every charge; a case answer reaching both charges on one case and neither charge on
  another; a pathway collapsing when decided; the main criteria collapsing only when all
  four pass; answers clearing on Start Over.
- The resolver ignores criteria marked Discretion or Part 2 when computing status, and the
  unanswered baseline still matches the backend's own output charge for charge.
- Both suites execute the same fixture table.

Given that the last defect in this feature was a payload shape asserted independently on
each side of the seam, the fixture is authored once and read by both, rather than restated
in each suite.

## Out of scope

Answers reach neither the search request nor the summary PDF, and the existing
question and answer machinery in `models/record.py` and `Record/Questions.tsx` is not
touched. Answers do not survive a reload.
