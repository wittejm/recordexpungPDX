"""Multnomah County's published SB-819 limiting criteria.

Source: Multnomah County District Attorney, Justice Integrity Unit, "SB 819 Application
Information Sheet", version 2021.11.05. Page cites on each criterion refer to it.

The JIU screens three kinds of application. Four main criteria gate all three; each
pathway then adds its own. A charge is analyzed only if it is a Multnomah conviction that
RecordSponge found ineligible under ORS 137.225, so both of those main criteria always
pass here and are reported for transparency.
"""

from typing import List, Optional

from expungeservice.charge_creator import ChargeCreator
from expungeservice.models.charge import EditStatus
from expungeservice.models.charge_types.person_felony import PersonFelonyClassB
from expungeservice.models.charge_types.sex_crimes import SexCrime
from expungeservice.models.sb819 import (
    SB819Criterion,
    SB819Scope,
    SB819CriterionResult,
    SB819Determination,
    SB819Outcome,
    SB819Pathway,
    SB819Question,
    SB819Ruleset,
    SB819Status,
)
from expungeservice.sb819_criteria.registerable_sex_offenses import (
    is_conditionally_registerable,
    is_registerable_sex_offense,
)
from expungeservice.util import DateWithFuture as date_class

COUNTY = "Multnomah"

AGGRAVATED_MURDER_STATUTE = "163095"

# The disjunction on page 4: Excessive Sentencing requires any one of these five.
SENTENCE_ALTERNATIVES = "excessive-sentencing-alternatives"

# OAR 213-003-0001(14), the person felony definition, as one set of statute sections.
# PersonFelonyClassB.statutes carries the list, except for the crimes the charge classifier
# files under other charge types before it reaches that list: the sex crimes, three marijuana
# offenses, inmate weapon possession, and the felony traffic offenses. Those are named here so
# that a person crime is a person crime whatever its expungement charge type.
PERSON_FELONY_SECTIONS = frozenset(
    PersonFelonyClassB.statutes
    + SexCrime.statutes
    + [
        "163355",  # Rape III
        "163385",  # Sodomy III
        "166275",  # Inmate in Possession of Weapon
        "475B359",  # Arson Incident to Manufacture of Cannabinoid Extract I
        "475B367",  # Causing Another Person to Ingest Marijuana
        "475B371",  # Administration of Marijuana to Another Person Under 18
        "811705",  # Hit and Run Vehicle (Injury)
    ]
) - {"163467", "163687"}  # Private indecency and Encouraging Child Sexual Abuse III are not person felonies
# The OAR names these by subsection, so only a charge recorded with that subsection matches.
PERSON_FELONY_SUBSECTIONS = tuple(PersonFelonyClassB.statutes_with_subsection) + (
    "1631603",  # Felony Assault IV, ORS 163.160(3)
    "8130105",  # Felony Driving Under the Influence of Intoxicants, ORS 813.010(5)
)


# ---------------------------------------------------------------------------
# Criteria
# ---------------------------------------------------------------------------

IN_MULTNOMAH = SB819Criterion(
    key="in-multnomah",
    name="Conviction is from Multnomah County",
    description="The JIU can only accept applicants whose convictions are from Multnomah County.",
    citation="Pages 1, 3",
    determination=SB819Determination.OECI,
)

NOT_EXPUNGEABLE = SB819Criterion(
    key="not-expungeable",
    name="Conviction is not expungeable under ORS 137.225",
    description=(
        "SB 819 relief applies to convictions that are not eligible for expungement. "
        "If the record can be expunged, that is the required route instead."
    ),
    citation="Page 3",
    determination=SB819Determination.OECI,
)

SENTENCED_AS_FELONY = SB819Criterion(
    key="sentenced-as-felony",
    name="Conviction was sentenced as a felony",
    description="Only convictions sentenced as felonies qualify. Misdemeanor-sentenced convictions are ineligible.",
    citation="Page 3",
    determination=SB819Determination.OECI,
)

NOT_AGGRAVATED_MURDER = SB819Criterion(
    key="not-aggravated-murder",
    name="Conviction is not aggravated murder",
    description="Aggravated murder convictions are categorically excluded from SB 819 relief.",
    citation="Page 3",
    determination=SB819Determination.OECI,
)

INNOCENCE_CLAIM = SB819Criterion(
    key="innocence-claim",
    name="Applicant asserts actual innocence of the conviction",
    description="An actual innocence claim is one in which an individual asserts that they are innocent of the crime.",
    citation="Page 3",
    determination=SB819Determination.QUESTION,
    pathway=SB819Pathway.ACTUAL_INNOCENCE,
)

INVESTIGATION_AVENUE = SB819Criterion(
    key="investigation-avenue",
    name="The JIU can identify an avenue of investigation",
    description=(
        "The JIU accepts an actual innocence application when it can identify one or more avenues of "
        "investigation with the potential to substantiate the claim of innocence."
    ),
    citation="Page 3",
    determination=SB819Determination.DISCRETION,
    pathway=SB819Pathway.ACTUAL_INNOCENCE,
)

CURRENTLY_INCARCERATED = SB819Criterion(
    key="currently-incarcerated",
    scope=SB819Scope.RECORD,
    name="Applicant is currently incarcerated",
    description="This application type is for applicants who are still incarcerated.",
    citation="Page 3",
    determination=SB819Determination.QUESTION,
    pathway=SB819Pathway.EXCESSIVE_SENTENCING,
    is_gate=True,
)

FIVE_YEARS_SERVED = SB819Criterion(
    key="five-years-served",
    name="Applicant has served at least 5 years of the term of incarceration",
    description="The applicant must have served at least five years of the term of incarceration on their sentence.",
    citation="Page 3",
    determination=SB819Determination.QUESTION,
    pathway=SB819Pathway.EXCESSIVE_SENTENCING,
)

NOT_GLOBAL_PLEA = SB819Criterion(
    key="not-global-plea",
    scope=SB819Scope.CASE,
    name="Conviction was not part of a global plea deal across counties",
    description="The conviction must not have been part of a global plea deal with multiple counties.",
    citation="Page 3",
    determination=SB819Determination.QUESTION,
    pathway=SB819Pathway.EXCESSIVE_SENTENCING,
)

NOT_REPEAT_SEX_OFFENDER = SB819Criterion(
    key="not-repeat-sex-offender",
    name="Conviction is not subject to ORS 137.690 or ORS 137.719",
    description=(
        "ORS 137.690 imposes a 25-year mandatory minimum on a repeat major felony sex crime. "
        "ORS 137.719 imposes a presumptive life sentence on a felony sex crime after two prior "
        "felony sex crime sentences. Both reach sex crimes only."
    ),
    citation="Page 3",
    determination=SB819Determination.OECI,
    pathway=SB819Pathway.EXCESSIVE_SENTENCING,
)

JUVENILE_TRANSFER = SB819Criterion(
    key="juvenile-transfer",
    scope=SB819Scope.RECORD,
    name="Sentenced as a juvenile and approaching transfer to adult prison",
    description=(
        "The applicant was sentenced as a juvenile, has a term of incarceration remaining, is "
        "approaching age 25, and will be transferred to adult prison."
    ),
    citation="Page 4",
    determination=SB819Determination.QUESTION,
    pathway=SB819Pathway.EXCESSIVE_SENTENCING,
    disjunction_group=SENTENCE_ALTERNATIVES,
)

UNDER_18_AT_OFFENSE = SB819Criterion(
    key="under-18-at-offense",
    name="Applicant committed the crime when under 18",
    description="The applicant committed the crime when they were under 18 years of age.",
    citation="Page 4",
    determination=SB819Determination.OECI,
    pathway=SB819Pathway.EXCESSIVE_SENTENCING,
    disjunction_group=SENTENCE_ALTERNATIVES,
)

OVER_60_OR_ILL = SB819Criterion(
    key="over-60-or-ill",
    scope=SB819Scope.RECORD,
    name="Applicant is over 60, terminally or debilitatingly ill, or on hospice care",
    description=(
        "The applicant is over the age of 60, or has a terminal or debilitating illness, or is "
        "currently on hospice care."
    ),
    citation="Page 4",
    determination=SB819Determination.OECI,
    pathway=SB819Pathway.EXCESSIVE_SENTENCING,
    disjunction_group=SENTENCE_ALTERNATIVES,
)

NON_PERSON_OVER_10_YEARS = SB819Criterion(
    key="non-person-over-10-years",
    scope=SB819Scope.RECORD,
    name="Non-person crime with sentences longer than 10 years in total",
    description="The conviction is for a non-person crime and the sentences total more than 10 years.",
    citation="Page 4",
    determination=SB819Determination.QUESTION,
    pathway=SB819Pathway.EXCESSIVE_SENTENCING,
    disjunction_group=SENTENCE_ALTERNATIVES,
)

PERSON_OVER_16_YEARS = SB819Criterion(
    key="person-over-16-years",
    scope=SB819Scope.RECORD,
    name="Person crime with sentences longer than 16 years in total",
    description="The conviction is for a person crime and the sentences total more than 16 years.",
    citation="Page 4",
    determination=SB819Determination.QUESTION,
    pathway=SB819Pathway.EXCESSIVE_SENTENCING,
    disjunction_group=SENTENCE_ALTERNATIVES,
)

SENTENCE_COMPLETED = SB819Criterion(
    key="sentence-completed",
    scope=SB819Scope.CASE,
    name="Applicant has fully completed the sentence",
    description=(
        "The applicant must have fully completed their sentence, including all post-prison "
        "supervision or probation, before applying under this pathway."
    ),
    citation="Page 4",
    determination=SB819Determination.QUESTION,
    pathway=SB819Pathway.COLLATERAL_CONSEQUENCES,
    is_gate=True,
)

NOT_REGISTERABLE_SEX_OFFENSE = SB819Criterion(
    key="not-registerable-sex-offense",
    name="Conviction is not a registerable sex offense",
    description="Registerable sex offenses are excluded from the collateral consequences pathway.",
    citation="Page 5",
    determination=SB819Determination.OECI,
    pathway=SB819Pathway.COLLATERAL_CONSEQUENCES,
)

NO_DOMESTIC_VIOLENCE = SB819Criterion(
    key="no-domestic-violence",
    name="Conviction did not involve domestic violence",
    description=(
        "A domestic violence conviction is not disqualifying if it was committed while the "
        "applicant was a juvenile and did not involve an intimate partner."
    ),
    citation="Page 5",
    determination=SB819Determination.QUESTION,
    pathway=SB819Pathway.COLLATERAL_CONSEQUENCES,
)

SUBSTANTIAL_REHABILITATION = SB819Criterion(
    key="substantial-rehabilitation",
    name="Applicant demonstrates substantial rehabilitation and low risk",
    description=(
        "The applicant must demonstrate substantial rehabilitation and present as low risk for "
        "further criminality. Factors include treatment, payment of financial obligations, compliance "
        "with court conditions, pro-social involvement, stable employment, academic or professional "
        "accomplishments, and no subsequent convictions."
    ),
    citation="Page 5",
    determination=SB819Determination.PART_TWO,
    pathway=SB819Pathway.COLLATERAL_CONSEQUENCES,
)

MANIFEST_HARDSHIP = SB819Criterion(
    key="manifest-hardship",
    name="Applicant demonstrates manifest and particularized hardship",
    description=(
        "The applicant must show a consequence of the conviction more severe than a typical similarly "
        "situated individual, such as housing, professional licensure, continued employment, or access "
        "to necessary medical treatment or therapy."
    ),
    citation="Page 5",
    determination=SB819Determination.PART_TWO,
    pathway=SB819Pathway.COLLATERAL_CONSEQUENCES,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _is_felony_level(level: str) -> bool:
    # "Felony Unclassified" counts; the JIU criterion turns on felony sentencing, not class.
    return "felony" in level.lower()


def _sentencing_level_is_uncertain(charge) -> bool:
    """True when the level OECI records may not be the level the charge was sentenced at."""
    return (
        charge.disposition.lesser_charge
        or charge.disposition.amended
        or "reduced to violation" in charge.charge_type.type_name.lower()
    )


def _is_aggravated_murder(charge) -> bool:
    # Narrower than the SevereCharge charge type, which name-matches all murder. SB 819
    # excludes aggravated murder (ORS 163.095) only; Murder II (ORS 163.115) is not excluded.
    return charge.statute.upper().startswith(AGGRAVATED_MURDER_STATUTE) or "aggravated murder" in charge.name.lower()


# The birth year OeciCase.empty gives a case a volunteer adds by hand, until it is edited.
PLACEHOLDER_BIRTH_YEAR = 1900


def _record_birth_year(record) -> Optional[int]:
    """The applicant's birth year, which is a fact about the person and not about any case.

    Read across every case so that two convictions on one record cannot disagree about the
    applicant's age. Where the cases carry different years the record may hold more than one
    person, and the year is treated as unknown.
    """
    years = {
        case.summary.birth_year
        for case in record.cases
        if case.summary.birth_year and case.summary.birth_year != PLACEHOLDER_BIRTH_YEAR
    }
    return years.pop() if len(years) == 1 else None


def _estimated_age(birth_year: Optional[int], on_date) -> Optional[int]:
    """Year-granularity age. OECI carries a birth year, not a birth date."""
    if not birth_year:
        return None
    return on_date.year - birth_year


def _felony_sex_crime_convictions(record) -> List:
    return [
        charge
        for charge in record.charges
        if charge.edit_status != EditStatus.DELETE
        and charge.convicted()
        and _is_felony_level(charge.level)
        and is_registerable_sex_offense(charge.statute, charge.name)
    ]


def _is_person_crime(charge) -> bool:
    """The conviction's statute is on the OAR 213-003-0001 person felony list.

    Matched by section, so a statute OECI records with a subsection, such as 164.405(1)(a),
    is still the person crime 164.405. A statute the OAR names by subsection matches only
    when the charge carries that subsection.
    """
    section = ChargeCreator._set_section(charge.statute) or charge.statute  # ORS 97.981 is five digits
    return section in PERSON_FELONY_SECTIONS or charge.statute.startswith(PERSON_FELONY_SUBSECTIONS)


# ---------------------------------------------------------------------------
# Main criteria
# ---------------------------------------------------------------------------


def main_criteria(charge, case, record) -> List[SB819CriterionResult]:
    return [
        _in_multnomah(case),
        _not_expungeable(charge),
        _sentenced_as_felony(charge),
        _not_aggravated_murder(charge),
    ]


def _in_multnomah(case) -> SB819CriterionResult:
    return SB819CriterionResult(
        criterion=IN_MULTNOMAH,
        outcome=SB819Outcome.PASSED,
        explanation=f"The conviction is from {case.summary.location} County.",
    )


def _not_expungeable(charge) -> SB819CriterionResult:
    return SB819CriterionResult(
        criterion=NOT_EXPUNGEABLE,
        outcome=SB819Outcome.PASSED,
        explanation="RecordSponge found this conviction ineligible for expungement under ORS 137.225.",
    )


def _sentenced_as_felony(charge) -> SB819CriterionResult:
    if not _is_felony_level(charge.level):
        return SB819CriterionResult(
            criterion=SENTENCED_AS_FELONY,
            outcome=SB819Outcome.FAILED,
            explanation=f'This conviction is recorded at the level "{charge.level}", which is not a felony.',
        )
    if _sentencing_level_is_uncertain(charge):
        return SB819CriterionResult(
            criterion=SENTENCED_AS_FELONY,
            outcome=SB819Outcome.UNKNOWN,
            explanation=(
                f'This conviction is charged at "{charge.level}", but the disposition indicates the charge was '
                "reduced or amended, so the level it was sentenced at may be lower."
            ),
            question=SB819Question(
                text="Was this conviction sentenced as a felony?",
                if_yes=SB819Status.POSSIBLY_ELIGIBLE,
                if_no=SB819Status.INELIGIBLE,
            ),
        )
    return SB819CriterionResult(
        criterion=SENTENCED_AS_FELONY,
        outcome=SB819Outcome.PASSED,
        explanation=f'This conviction was sentenced as a felony ("{charge.level}").',
    )


def _not_aggravated_murder(charge) -> SB819CriterionResult:
    if _is_aggravated_murder(charge):
        return SB819CriterionResult(
            criterion=NOT_AGGRAVATED_MURDER,
            outcome=SB819Outcome.FAILED,
            explanation="This conviction is for aggravated murder, which SB 819 excludes categorically.",
        )
    return SB819CriterionResult(
        criterion=NOT_AGGRAVATED_MURDER,
        outcome=SB819Outcome.PASSED,
        explanation="This conviction is not for aggravated murder.",
    )


# ---------------------------------------------------------------------------
# Pathway 1: Actual Innocence
# ---------------------------------------------------------------------------


def actual_innocence(charge, case, record) -> List[SB819CriterionResult]:
    """This pathway adds no criterion that can be screened from a record.

    It rests on a claim the applicant has to make and an investigation the JIU has to find,
    neither of which the record settles, so it never resolves past needing more analysis.
    """
    return [
        SB819CriterionResult(
            criterion=INNOCENCE_CLAIM,
            outcome=SB819Outcome.UNKNOWN,
            explanation="This pathway requires the applicant to assert innocence of the crime.",
            question=SB819Question(
                text="Is the applicant asserting that they are actually innocent of this conviction?",
                if_yes=SB819Status.POSSIBLY_ELIGIBLE,
                if_no=SB819Status.INELIGIBLE,
            ),
        ),
        SB819CriterionResult(
            criterion=INVESTIGATION_AVENUE,
            outcome=SB819Outcome.UNKNOWN,
            explanation=(
                "Whether the JIU can identify an avenue of investigation with the potential to substantiate "
                "the claim is decided during its review."
            ),
        ),
    ]


# ---------------------------------------------------------------------------
# Pathway 2: Excessive Sentencing
# ---------------------------------------------------------------------------


def excessive_sentencing(charge, case, record) -> List[SB819CriterionResult]:
    return [
        SB819CriterionResult(
            criterion=CURRENTLY_INCARCERATED,
            outcome=SB819Outcome.UNKNOWN,
            explanation="OECI does not record whether the applicant is in custody.",
            question=SB819Question(
                text="Is the applicant currently incarcerated?",
                if_yes=SB819Status.POSSIBLY_ELIGIBLE,
                if_no=SB819Status.INELIGIBLE,
            ),
        ),
        SB819CriterionResult(
            criterion=FIVE_YEARS_SERVED,
            outcome=SB819Outcome.UNKNOWN,
            explanation="OECI does not record sentence length or time served.",
            question=SB819Question(
                text="Has the applicant served at least five years of the term of incarceration on this sentence?",
                if_yes=SB819Status.POSSIBLY_ELIGIBLE,
                if_no=SB819Status.INELIGIBLE,
            ),
        ),
        SB819CriterionResult(
            criterion=NOT_GLOBAL_PLEA,
            outcome=SB819Outcome.UNKNOWN,
            explanation="OECI does not record the terms of a plea agreement.",
            question=SB819Question(
                text="Was this conviction part of a global plea deal involving multiple counties?",
                if_yes=SB819Status.INELIGIBLE,
                if_no=SB819Status.POSSIBLY_ELIGIBLE,
            ),
        ),
        _not_repeat_sex_offender(record),
        _juvenile_transfer(),
        _under_18_at_offense(charge, record),
        _over_60_or_ill(record),
        _non_person_over_10_years(charge),
        _person_over_16_years(charge),
    ]


def _not_repeat_sex_offender(record) -> SB819CriterionResult:
    convictions = _felony_sex_crime_convictions(record)
    if not convictions:
        return SB819CriterionResult(
            criterion=NOT_REPEAT_SEX_OFFENDER,
            outcome=SB819Outcome.PASSED,
            explanation=(
                "The record contains no felony sex crime convictions, so neither ORS 137.690 nor "
                "ORS 137.719 can apply."
            ),
        )
    case_numbers = ", ".join(sorted({f"[{c.case_number}]" for c in convictions}))
    return SB819CriterionResult(
        criterion=NOT_REPEAT_SEX_OFFENDER,
        outcome=SB819Outcome.UNKNOWN,
        explanation=(
            f"The record contains felony sex crime convictions on {case_numbers}. Both statutes require "
            "prior convictions, which cannot be counted from this record alone."
        ),
        question=SB819Question(
            text="Was this conviction sentenced under ORS 137.690 or ORS 137.719?",
            if_yes=SB819Status.INELIGIBLE,
            if_no=SB819Status.POSSIBLY_ELIGIBLE,
        ),
    )


def _juvenile_transfer() -> SB819CriterionResult:
    return SB819CriterionResult(
        criterion=JUVENILE_TRANSFER,
        outcome=SB819Outcome.UNKNOWN,
        explanation="OECI does not record whether the applicant faces transfer to adult prison.",
        question=SB819Question(
            text=(
                "Was the applicant sentenced as a juvenile, with incarceration remaining, approaching age 25 "
                "and facing transfer to adult prison?"
            ),
            if_yes=SB819Status.POSSIBLY_ELIGIBLE,
            if_no=SB819Status.INELIGIBLE,
        ),
    )


def _under_18_at_offense(charge, record) -> SB819CriterionResult:
    age = _estimated_age(_record_birth_year(record), charge.date)
    if age is None:
        return SB819CriterionResult(
            criterion=UNDER_18_AT_OFFENSE,
            outcome=SB819Outcome.UNKNOWN,
            explanation="No birth year is recorded for the applicant, so age at the time of the offense is unknown.",
            question=SB819Question(
                text="Was the applicant under 18 when this crime was committed?",
                if_yes=SB819Status.POSSIBLY_ELIGIBLE,
                if_no=SB819Status.INELIGIBLE,
            ),
        )
    if age < 18:
        return SB819CriterionResult(
            criterion=UNDER_18_AT_OFFENSE,
            outcome=SB819Outcome.PASSED,
            explanation=f"The applicant was about {age} at the time of this offense.",
        )
    if age == 18:
        # OECI carries a birth year, not a birth date, so 18 straddles the boundary.
        return SB819CriterionResult(
            criterion=UNDER_18_AT_OFFENSE,
            outcome=SB819Outcome.UNKNOWN,
            explanation=(
                "The applicant turned 18 in the year of this offense. OECI records a birth year only, so "
                "whether the crime came before or after that birthday cannot be determined."
            ),
            question=SB819Question(
                text="Was the applicant under 18 when this crime was committed?",
                if_yes=SB819Status.POSSIBLY_ELIGIBLE,
                if_no=SB819Status.INELIGIBLE,
            ),
        )
    return SB819CriterionResult(
        criterion=UNDER_18_AT_OFFENSE,
        outcome=SB819Outcome.FAILED,
        explanation=f"The applicant was about {age} at the time of this offense.",
    )


def _over_60_or_ill(record) -> SB819CriterionResult:
    age = _estimated_age(_record_birth_year(record), date_class.today())
    if age is not None and age >= 62:
        return SB819CriterionResult(
            criterion=OVER_60_OR_ILL,
            outcome=SB819Outcome.PASSED,
            explanation=f"The applicant is about {age}, which is over 60.",
        )
    # Age alone never fails this criterion; an applicant under 60 may still be ill or on hospice.
    return SB819CriterionResult(
        criterion=OVER_60_OR_ILL,
        outcome=SB819Outcome.UNKNOWN,
        explanation=(
            f"The applicant is about {age}, which is not clearly over 60. OECI does not record illness or "
            "hospice status."
            if age is not None
            else "No birth year is recorded, and OECI does not record illness or hospice status."
        ),
        question=SB819Question(
            text="Is the applicant over 60, terminally or debilitatingly ill, or currently on hospice care?",
            if_yes=SB819Status.POSSIBLY_ELIGIBLE,
            if_no=SB819Status.INELIGIBLE,
        ),
    )


def _non_person_over_10_years(charge) -> SB819CriterionResult:
    if _is_person_crime(charge):
        return SB819CriterionResult(
            criterion=NON_PERSON_OVER_10_YEARS,
            outcome=SB819Outcome.FAILED,
            explanation="This conviction is for a person crime, so the non-person threshold does not apply.",
        )
    return SB819CriterionResult(
        criterion=NON_PERSON_OVER_10_YEARS,
        outcome=SB819Outcome.UNKNOWN,
        explanation="This conviction is for a non-person crime. OECI does not record sentence length.",
        question=SB819Question(
            text="Do the applicant's sentences for non-person crimes total more than 10 years?",
            if_yes=SB819Status.POSSIBLY_ELIGIBLE,
            if_no=SB819Status.INELIGIBLE,
        ),
    )


def _person_over_16_years(charge) -> SB819CriterionResult:
    if not _is_person_crime(charge):
        return SB819CriterionResult(
            criterion=PERSON_OVER_16_YEARS,
            outcome=SB819Outcome.FAILED,
            explanation="This conviction is for a non-person crime, so the person threshold does not apply.",
        )
    return SB819CriterionResult(
        criterion=PERSON_OVER_16_YEARS,
        outcome=SB819Outcome.UNKNOWN,
        explanation="This conviction is for a person crime. OECI does not record sentence length.",
        question=SB819Question(
            text="Do the applicant's sentences for person crimes total more than 16 years?",
            if_yes=SB819Status.POSSIBLY_ELIGIBLE,
            if_no=SB819Status.INELIGIBLE,
        ),
    )


# ---------------------------------------------------------------------------
# Pathway 3: Collateral Consequences
# ---------------------------------------------------------------------------


def collateral_consequences(charge, case, record) -> List[SB819CriterionResult]:
    return [
        _sentence_completed(),
        _not_registerable_sex_offense(charge),
        _no_domestic_violence(),
        SB819CriterionResult(
            criterion=SUBSTANTIAL_REHABILITATION,
            outcome=SB819Outcome.UNKNOWN,
            explanation="Assessed from the applicant's own materials, outside this analysis.",
        ),
        SB819CriterionResult(
            criterion=MANIFEST_HARDSHIP,
            outcome=SB819Outcome.UNKNOWN,
            explanation="Assessed from the applicant's own materials, outside this analysis.",
        ),
    ]


def _sentence_completed() -> SB819CriterionResult:
    return SB819CriterionResult(
        criterion=SENTENCE_COMPLETED,
        outcome=SB819Outcome.UNKNOWN,
        explanation=(
            "OECI does not record post-prison supervision or probation end dates. A case status of "
            "Closed describes the court case, not supervision."
        ),
        question=SB819Question(
            text=(
                "Has the applicant fully completed the sentence on this case, including all post-prison "
                "supervision and probation?"
            ),
            if_yes=SB819Status.POSSIBLY_ELIGIBLE,
            if_no=SB819Status.INELIGIBLE,
        ),
    )


def _not_registerable_sex_offense(charge) -> SB819CriterionResult:
    if is_registerable_sex_offense(charge.statute, charge.name):
        if is_conditionally_registerable(charge.statute, charge.name):
            return SB819CriterionResult(
                criterion=NOT_REGISTERABLE_SEX_OFFENSE,
                outcome=SB819Outcome.UNKNOWN,
                explanation=(
                    "This offense requires sex offender reporting only in circumstances OECI does not "
                    "record, such as the age of the victim or a court designation."
                ),
                question=SB819Question(
                    text="Does this conviction require the applicant to report as a sex offender?",
                    if_yes=SB819Status.INELIGIBLE,
                    if_no=SB819Status.POSSIBLY_ELIGIBLE,
                ),
            )
        return SB819CriterionResult(
            criterion=NOT_REGISTERABLE_SEX_OFFENSE,
            outcome=SB819Outcome.FAILED,
            explanation="This conviction is a registerable sex offense under ORS 163A.005.",
        )
    return SB819CriterionResult(
        criterion=NOT_REGISTERABLE_SEX_OFFENSE,
        outcome=SB819Outcome.PASSED,
        explanation="This conviction is not a registerable sex offense under ORS 163A.005.",
    )


def _no_domestic_violence() -> SB819CriterionResult:
    return SB819CriterionResult(
        criterion=NO_DOMESTIC_VIOLENCE,
        outcome=SB819Outcome.UNKNOWN,
        explanation="OECI does not record whether a conviction involved domestic violence.",
        question=SB819Question(
            text="Did this conviction involve domestic violence?",
            if_yes=SB819Status.INELIGIBLE,
            if_no=SB819Status.POSSIBLY_ELIGIBLE,
            note=(
                "A domestic violence conviction is not disqualifying if it was committed while the applicant "
                "was a juvenile and did not involve an intimate partner."
            ),
        ),
    )


RULESET = SB819Ruleset(
    county=COUNTY,
    main_criteria=main_criteria,
    pathways={
        SB819Pathway.ACTUAL_INNOCENCE: actual_innocence,
        SB819Pathway.EXCESSIVE_SENTENCING: excessive_sentencing,
        SB819Pathway.COLLATERAL_CONSEQUENCES: collateral_consequences,
    },
)
