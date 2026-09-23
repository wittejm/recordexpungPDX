"""Main criteria gate all three SB-819 pathways (MCDA Information Sheet, page 3)."""

from dataclasses import replace

from expungeservice.models.disposition import DispositionCreator
from expungeservice.models.sb819 import SB819Outcome, SB819Status
from expungeservice.sb819_criteria import multnomah
from expungeservice.util import DateWithFuture as date_class

from tests.factories.sb819_factory import SB819Factory


def outcomes(charge, case, record):
    return {r.criterion.name: r for r in multnomah.main_criteria(charge, case, record)}


def test_multnomah_conviction_passes_the_county_criterion():
    record, case, charge = SB819Factory.single_charge_record()
    result = outcomes(charge, case, record)[multnomah.IN_MULTNOMAH.name]
    assert result.outcome is SB819Outcome.PASSED


def test_felony_level_passes():
    record, case, charge = SB819Factory.single_charge_record(level="Felony Class B")
    result = outcomes(charge, case, record)[multnomah.SENTENCED_AS_FELONY.name]
    assert result.outcome is SB819Outcome.PASSED


def test_felony_unclassified_counts_as_a_felony():
    record, case, charge = SB819Factory.single_charge_record(
        name="Possession of Weapon by Prison Inmate", statute="166.275", level="Felony Class A"
    )
    result = outcomes(charge, case, record)[multnomah.SENTENCED_AS_FELONY.name]
    assert result.outcome is SB819Outcome.PASSED


def test_misdemeanor_level_fails_the_felony_criterion():
    record, case, charge = SB819Factory.single_charge_record(
        name="Driving Under the Influence of Intoxicants", statute="813.010", level="Misdemeanor Class A"
    )
    result = outcomes(charge, case, record)[multnomah.SENTENCED_AS_FELONY.name]
    assert result.outcome is SB819Outcome.FAILED


def test_amended_disposition_makes_the_sentencing_level_uncertain():
    record, case, charge = SB819Factory.single_charge_record(
        level="Felony Class A",
        disposition=DispositionCreator.create(date=date_class.today(), ruling="Convicted", amended=True),
    )
    result = outcomes(charge, case, record)[multnomah.SENTENCED_AS_FELONY.name]
    assert result.outcome is SB819Outcome.UNKNOWN
    assert result.question.text == "Was this conviction sentenced as a felony?"
    assert result.question.if_no is SB819Status.INELIGIBLE


def test_lesser_charge_disposition_makes_the_sentencing_level_uncertain():
    # A lesser-charge ruling makes the charge type ambiguous, so the disposition is applied
    # to a built charge rather than routed back through the classifier.
    record, case, charge = SB819Factory.single_charge_record(level="Felony Class A")
    lesser = replace(charge.disposition, lesser_charge=True)
    charge = replace(charge, disposition=lesser)
    result = outcomes(charge, case, record)[multnomah.SENTENCED_AS_FELONY.name]
    assert result.outcome is SB819Outcome.UNKNOWN


def test_aggravated_murder_fails_by_statute():
    record, case, charge = SB819Factory.single_charge_record(
        name="Aggravated Murder", statute="163.095", level="Felony Class A"
    )
    result = outcomes(charge, case, record)[multnomah.NOT_AGGRAVATED_MURDER.name]
    assert result.outcome is SB819Outcome.FAILED


def test_aggravated_murder_fails_by_name_when_the_statute_is_missing():
    record, case, charge = SB819Factory.single_charge_record(
        name="Aggravated Murder", statute="", level="Felony Class A"
    )
    result = outcomes(charge, case, record)[multnomah.NOT_AGGRAVATED_MURDER.name]
    assert result.outcome is SB819Outcome.FAILED


def test_ordinary_murder_is_not_aggravated_murder():
    """SB 819 excludes aggravated murder only. Murder II is not excluded, though the
    SevereCharge charge type covers both."""
    record, case, charge = SB819Factory.single_charge_record(
        name="Murder in the Second Degree", statute="163.115", level="Felony Class A"
    )
    result = outcomes(charge, case, record)[multnomah.NOT_AGGRAVATED_MURDER.name]
    assert result.outcome is SB819Outcome.PASSED
