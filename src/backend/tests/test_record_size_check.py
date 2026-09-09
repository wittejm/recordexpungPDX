from expungeservice.models.case import OeciCase
from expungeservice.models.charge import OeciCharge, EditStatus
from expungeservice.models.disposition import DispositionCreator
from expungeservice.record_creator import RecordCreator
from expungeservice.util import DateWithFuture as date_class, LRUCache
from tests.factories.case_factory import CaseSummaryFactory


def test_case_with_117_missing_dispositions_is_rejected_before_expansion():
    # 2**117 combinations; the test only finishes if the check runs before the case is expanded.
    summary = CaseSummaryFactory.create(case_number="X0001", type_status=["Offense Felony", "Closed"])
    charges = tuple(
        OeciCharge(
            ambiguous_charge_id=f"X0001-{i}",
            name="Sexual Abuse in the First Degree",
            statute="163.427",
            level="Felony Class B",
            date=date_class(2008, 1, 1),
            disposition=DispositionCreator.empty(),
            probation_revoked=None,
            balance_due_in_cents=0,
            edit_status=EditStatus.UNCHANGED,
        )
        for i in range(117)
    )

    def search(username, password, aliases, cache):
        return [OeciCase(summary, charges)], []

    record, questions = RecordCreator.build_record(search, "u", "p", (), {}, date_class.today(), LRUCache(4))
    assert record.cases == ()
    assert questions == {}
    assert len(record.errors) == 1 and "too large to analyze" in record.errors[0]
    assert "Case [X0001] has 117 charges with a missing disposition" in record.errors[0]
