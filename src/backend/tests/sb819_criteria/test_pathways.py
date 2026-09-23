"""The three JIU application pathways (MCDA Information Sheet, pages 3 to 5)."""

from dateutil.relativedelta import relativedelta

from expungeservice.models.sb819 import (
    SB819Outcome,
    SB819Pathway,
    SB819PathwayResult,
    SB819Status,
)
from expungeservice.sb819_criteria import multnomah
from expungeservice.util import DateWithFuture as date_class

from tests.factories.sb819_factory import SB819Factory


def by_name(results):
    return {r.criterion.name: r for r in results}


# --- Actual Innocence -------------------------------------------------------


def test_actual_innocence_never_resolves_past_needing_more_analysis():
    """The pathway rests on a claim and an investigation the record cannot settle."""
    record, case, charge = SB819Factory.single_charge_record()
    result = SB819PathwayResult.build(SB819Pathway.ACTUAL_INNOCENCE, multnomah.actual_innocence(charge, case, record))
    assert result.status is SB819Status.NEEDS_MORE_ANALYSIS
    assert all(r.outcome is SB819Outcome.UNKNOWN for r in result.criterion_results)


def test_actual_innocence_asks_whether_innocence_is_asserted():
    record, case, charge = SB819Factory.single_charge_record()
    results = by_name(multnomah.actual_innocence(charge, case, record))
    question = results[multnomah.INNOCENCE_CLAIM.name].question
    assert question.if_yes is SB819Status.POSSIBLY_ELIGIBLE
    assert question.if_no is SB819Status.INELIGIBLE


# --- Excessive Sentencing ---------------------------------------------------


def test_a_record_without_felony_sex_crimes_clears_the_recidivist_sentencing_statutes():
    """ORS 137.690 and ORS 137.719 reach sex crimes only."""
    record, case, charge = SB819Factory.single_charge_record()
    results = by_name(multnomah.excessive_sentencing(charge, case, record))
    assert results[multnomah.NOT_REPEAT_SEX_OFFENDER.name].outcome is SB819Outcome.PASSED


def test_a_felony_sex_crime_conviction_leaves_the_recidivist_statutes_open():
    sex_crime = SB819Factory.charge(
        case_number="2", name="Rape in the Second Degree", statute="163.365", level="Felony Class B"
    )
    robbery = SB819Factory.charge(case_number="1")
    record = SB819Factory.record(
        [SB819Factory.case([robbery], case_number="1"), SB819Factory.case([sex_crime], case_number="2")]
    )
    case = record.cases[0]
    results = by_name(multnomah.excessive_sentencing(robbery, case, record))
    result = results[multnomah.NOT_REPEAT_SEX_OFFENDER.name]
    assert result.outcome is SB819Outcome.UNKNOWN
    assert "[2]" in result.explanation


def test_a_deleted_sex_crime_conviction_no_longer_counts_against_the_record():
    """A volunteer who deletes a mis-attributed charge takes it out of every criterion."""
    from dataclasses import replace

    from expungeservice.models.charge import EditStatus

    sex_crime = SB819Factory.charge(
        case_number="2", name="Rape in the Second Degree", statute="163.365", level="Felony Class B"
    )
    robbery = SB819Factory.charge(case_number="1")
    record = SB819Factory.record(
        [
            SB819Factory.case([robbery], case_number="1"),
            SB819Factory.case([replace(sex_crime, edit_status=EditStatus.DELETE)], case_number="2"),
        ]
    )
    results = by_name(multnomah.excessive_sentencing(robbery, record.cases[0], record))
    assert results[multnomah.NOT_REPEAT_SEX_OFFENDER.name].outcome is SB819Outcome.PASSED


def test_a_crime_committed_well_before_18_passes_the_age_alternative():
    offense_date = date_class.today() - relativedelta(years=20)
    record, case, charge = SB819Factory.single_charge_record(date=offense_date, birth_year=str(offense_date.year - 15))
    results = by_name(multnomah.excessive_sentencing(charge, case, record))
    assert results[multnomah.UNDER_18_AT_OFFENSE.name].outcome is SB819Outcome.PASSED


def test_a_crime_committed_well_after_18_fails_the_age_alternative():
    offense_date = date_class.today() - relativedelta(years=20)
    record, case, charge = SB819Factory.single_charge_record(date=offense_date, birth_year=str(offense_date.year - 30))
    results = by_name(multnomah.excessive_sentencing(charge, case, record))
    assert results[multnomah.UNDER_18_AT_OFFENSE.name].outcome is SB819Outcome.FAILED


def test_turning_18_in_the_year_of_the_offense_is_unresolved():
    """OECI records a birth year, not a birth date, so the boundary year cannot be settled."""
    offense_date = date_class.today() - relativedelta(years=20)
    record, case, charge = SB819Factory.single_charge_record(date=offense_date, birth_year=str(offense_date.year - 18))
    results = by_name(multnomah.excessive_sentencing(charge, case, record))
    assert results[multnomah.UNDER_18_AT_OFFENSE.name].outcome is SB819Outcome.UNKNOWN


def test_a_clearly_over_60_applicant_passes_the_age_or_illness_alternative():
    record, case, charge = SB819Factory.single_charge_record(birth_year=str(date_class.today().year - 70))
    results = by_name(multnomah.excessive_sentencing(charge, case, record))
    assert results[multnomah.OVER_60_OR_ILL.name].outcome is SB819Outcome.PASSED


def test_the_applicant_age_is_read_across_the_record():
    """One applicant, one age: a case with no birth year borrows it from the others, and a
    case a volunteer added by hand carries a placeholder year that is never an age."""
    this_year = date_class.today().year
    dated = SB819Factory.charge(case_number="1")
    undated = SB819Factory.charge(case_number="2")
    added = SB819Factory.charge(case_number="3")
    record = SB819Factory.record(
        [
            SB819Factory.case([dated], case_number="1", birth_year=str(this_year - 70)),
            SB819Factory.case([undated], case_number="2", birth_year=None),
            SB819Factory.case([added], case_number="3", birth_year=str(multnomah.PLACEHOLDER_BIRTH_YEAR)),
        ]
    )
    for charge, case in zip([dated, undated, added], record.cases):
        results = by_name(multnomah.excessive_sentencing(charge, case, record))
        assert results[multnomah.OVER_60_OR_ILL.name].outcome is SB819Outcome.PASSED, case.summary.case_number


def test_cases_that_disagree_about_the_birth_year_leave_age_unknown():
    this_year = date_class.today().year
    first = SB819Factory.charge(case_number="1")
    second = SB819Factory.charge(case_number="2")
    record = SB819Factory.record(
        [
            SB819Factory.case([first], case_number="1", birth_year=str(this_year - 70)),
            SB819Factory.case([second], case_number="2", birth_year=str(this_year - 30)),
        ]
    )
    results = by_name(multnomah.excessive_sentencing(first, record.cases[0], record))
    assert results[multnomah.OVER_60_OR_ILL.name].outcome is SB819Outcome.UNKNOWN
    assert results[multnomah.UNDER_18_AT_OFFENSE.name].outcome is SB819Outcome.UNKNOWN


def test_a_younger_applicant_may_still_qualify_through_illness():
    """Age alone never fails this alternative; an applicant under 60 may be ill or on hospice."""
    record, case, charge = SB819Factory.single_charge_record(birth_year=str(date_class.today().year - 30))
    results = by_name(multnomah.excessive_sentencing(charge, case, record))
    assert results[multnomah.OVER_60_OR_ILL.name].outcome is SB819Outcome.UNKNOWN


def test_a_person_crime_rules_out_the_non_person_sentence_alternative():
    record, case, charge = SB819Factory.single_charge_record(
        name="Robbery in the Second Degree", statute="164.405", level="Felony Class B"
    )
    results = by_name(multnomah.excessive_sentencing(charge, case, record))
    assert results[multnomah.NON_PERSON_OVER_10_YEARS.name].outcome is SB819Outcome.FAILED
    assert results[multnomah.PERSON_OVER_16_YEARS.name].outcome is SB819Outcome.UNKNOWN


def test_a_non_person_crime_rules_out_the_person_sentence_alternative():
    record, case, charge = SB819Factory.single_charge_record(name="Racketeering", statute="166.720", level="Felony Class A")
    results = by_name(multnomah.excessive_sentencing(charge, case, record))
    assert results[multnomah.PERSON_OVER_16_YEARS.name].outcome is SB819Outcome.FAILED
    assert results[multnomah.NON_PERSON_OVER_10_YEARS.name].outcome is SB819Outcome.UNKNOWN


def test_person_crimes_the_classifier_files_elsewhere_are_still_person_crimes():
    """The OAR names sex crimes, inmate weapon possession and felony DUII as person felonies;
    the charge classifier reaches them under other charge types first."""
    for name, statute in [
        ("Rape in the Second Degree", "163.365"),
        ("Possession of Weapon by Prison Inmate", "166.275"),
        ("Driving Under the Influence of Intoxicants", "813.010(5)"),
    ]:
        record, case, charge = SB819Factory.single_charge_record(name=name, statute=statute, level="Felony Class B")
        results = by_name(multnomah.excessive_sentencing(charge, case, record))
        assert results[multnomah.NON_PERSON_OVER_10_YEARS.name].outcome is SB819Outcome.FAILED, name
        assert results[multnomah.PERSON_OVER_16_YEARS.name].outcome is SB819Outcome.UNKNOWN, name


def test_a_person_crime_recorded_with_a_subsection_is_still_a_person_crime():
    record, case, charge = SB819Factory.single_charge_record(
        name="Robbery in the Second Degree", statute="164.405(1)(a)", level="Felony Class B"
    )
    results = by_name(multnomah.excessive_sentencing(charge, case, record))
    assert results[multnomah.NON_PERSON_OVER_10_YEARS.name].outcome is SB819Outcome.FAILED


def test_the_person_felony_sections_are_the_whole_oar_list():
    """PersonFelonyClassB comments out the entries it files under other charge types. The
    SB-819 set has to be that file's list with the comments restored, nothing more."""
    import re
    from pathlib import Path

    from expungeservice.models.charge_types import person_felony

    source = Path(person_felony.__file__).read_text()
    listed = set(re.findall(r'^\s*#?\s*"([0-9A-Z]+)",', source, flags=re.M))
    from expungeservice.charge_creator import ChargeCreator

    def is_bare_section(statute):
        return ChargeCreator._set_section(statute) in (statute, "")

    assert multnomah.PERSON_FELONY_SECTIONS == {s for s in listed if is_bare_section(s)}
    assert set(multnomah.PERSON_FELONY_SUBSECTIONS) == {s for s in listed if not is_bare_section(s)}


def test_one_failed_alternative_does_not_disqualify_the_pathway():
    """The five alternatives on page 4 are a disjunction; any one of them suffices."""
    record, case, charge = SB819Factory.single_charge_record(
        name="Robbery in the Second Degree", statute="164.405", level="Felony Class B"
    )
    result = SB819PathwayResult.build(
        SB819Pathway.EXCESSIVE_SENTENCING, multnomah.excessive_sentencing(charge, case, record)
    )
    assert result.status is SB819Status.NEEDS_MORE_ANALYSIS
    assert multnomah.NON_PERSON_OVER_10_YEARS.name not in [r.criterion.name for r in result.blocking_results]


# --- Collateral Consequences ------------------------------------------------


def test_a_registerable_sex_offense_blocks_collateral_consequences():
    record, case, charge = SB819Factory.single_charge_record(
        name="Rape in the Second Degree", statute="163.365", level="Felony Class B"
    )
    result = SB819PathwayResult.build(
        SB819Pathway.COLLATERAL_CONSEQUENCES, multnomah.collateral_consequences(charge, case, record)
    )
    assert result.status is SB819Status.INELIGIBLE
    assert [r.criterion.name for r in result.blocking_results] == [multnomah.NOT_REGISTERABLE_SEX_OFFENSE.name]


def test_an_offense_registerable_only_on_unrecorded_facts_is_asked_about():
    record, case, charge = SB819Factory.single_charge_record(
        name="Kidnapping in the First Degree", statute="163.235", level="Felony Class A"
    )
    results = by_name(multnomah.collateral_consequences(charge, case, record))
    result = results[multnomah.NOT_REGISTERABLE_SEX_OFFENSE.name]
    assert result.outcome is SB819Outcome.UNKNOWN
    assert result.question is not None


def test_sentence_completion_is_asked_rather_than_read_from_the_record():
    """OECI carries no post-prison supervision or probation end date."""
    record, case, charge = SB819Factory.single_charge_record()
    results = by_name(multnomah.collateral_consequences(charge, case, record))
    result = results[multnomah.SENTENCE_COMPLETED.name]
    assert result.outcome is SB819Outcome.UNKNOWN
    assert result.question.if_no is SB819Status.INELIGIBLE


def test_the_domestic_violence_question_carries_the_juvenile_exception():
    record, case, charge = SB819Factory.single_charge_record()
    results = by_name(multnomah.collateral_consequences(charge, case, record))
    question = results[multnomah.NO_DOMESTIC_VIOLENCE.name].question
    assert question.if_yes is SB819Status.INELIGIBLE
    assert "juvenile" in question.note and "intimate partner" in question.note


def test_the_narrative_criteria_are_reported_without_a_question():
    record, case, charge = SB819Factory.single_charge_record()
    results = by_name(multnomah.collateral_consequences(charge, case, record))
    for criterion in [multnomah.SUBSTANTIAL_REHABILITATION, multnomah.MANIFEST_HARDSHIP]:
        assert results[criterion.name].question is None
