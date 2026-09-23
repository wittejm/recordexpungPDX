from dataclasses import replace

from expungeservice.models.charge import Charge
from expungeservice.models.disposition import DispositionCreator
from expungeservice.models.expungement_result import ChargeEligibility, ChargeEligibilityStatus
from expungeservice.models.record import Record
from expungeservice.util import DateWithFuture as date_class

from tests.factories.case_factory import CaseFactory
from tests.factories.charge_factory import ChargeFactory


class SB819Factory:
    """Builds records shaped the way SB-819 analysis expects: merged charge eligibility present.

    The analyzer runs after RecordMerger, so charges reaching it always carry a
    charge_eligibility. ChargeFactory leaves that unset, so it is filled in here.
    """

    @staticmethod
    def charge(
        case_number="1",
        name="Robbery in the Second Degree",
        statute="164.405",
        level="Felony Class B",
        location="Multnomah",
        eligibility=ChargeEligibilityStatus.INELIGIBLE,
        date=None,
        disposition=None,
        violation_type="Offense Felony",
    ) -> Charge:
        disposition = disposition or DispositionCreator.create(date=date or date_class.today(), ruling="Convicted")
        charge = ChargeFactory.create(
            case_number=case_number,
            name=name,
            statute=statute,
            level=level,
            date=date,
            disposition=disposition,
            violation_type=violation_type,
            location=location,
        )
        return SB819Factory.with_eligibility(charge, eligibility)

    @staticmethod
    def with_eligibility(charge: Charge, status: ChargeEligibilityStatus) -> Charge:
        expungement_result = replace(
            charge.expungement_result,
            charge_eligibility=ChargeEligibility(status, status.value),
        )
        return replace(charge, expungement_result=expungement_result)

    @staticmethod
    def case(charges, case_number="1", location="Multnomah", birth_year="1990"):
        # OECI leaves the birth year off the case header for some records; None does the same.
        return CaseFactory.create(
            info=["John Doe", birth_year] if birth_year else ["John Doe"],
            case_number=case_number,
            date_location=["1/1/1995", location],
            type_status=["Offense Felony", "Closed"],
            charges=charges,
        )

    @staticmethod
    def record(cases) -> Record:
        return Record(tuple(cases))

    @staticmethod
    def single_charge_record(**kwargs):
        """A one-case, one-charge record, returning (record, case, charge)."""
        location = kwargs.get("location", "Multnomah")
        birth_year = kwargs.pop("birth_year", "1990")
        charge = SB819Factory.charge(**kwargs)
        case = SB819Factory.case([charge], case_number=charge.case_number, location=location, birth_year=birth_year)
        return SB819Factory.record([case]), case, charge
