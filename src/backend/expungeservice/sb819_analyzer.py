"""Applies a county's SB-819 limiting criteria to the charges expungement cannot reach.

This runs after RecordMerger.merge, since it reads the merged charge eligibility, and is
invoked from RecordSummarizer. It reads the record and adds no state to it.
"""

from typing import List

from expungeservice.models.charge import EditStatus
from expungeservice.models.expungement_result import ChargeEligibilityStatus
from expungeservice.models.record import Record
from expungeservice.models.sb819 import SB819Analysis, SB819ChargeAnalysis
from expungeservice.sb819_criteria import for_county


class SB819Analyzer:
    @staticmethod
    def build(record: Record) -> SB819Analysis:
        charge_analyses: List[SB819ChargeAnalysis] = []
        counties: List[str] = []
        for case in record.cases:
            ruleset = for_county(case.summary.location)
            if not ruleset:
                continue
            if ruleset.county not in counties:
                counties.append(ruleset.county)
            for charge in case.charges:
                if SB819Analyzer._in_scope(charge):
                    charge_analyses.append(ruleset.analyze(charge, case, record))
        return SB819Analysis(charge_analyses=tuple(charge_analyses), counties_analyzed=tuple(counties))

    @staticmethod
    def _in_scope(charge) -> bool:
        """Only convictions expungement cannot reach.

        SB 819 sets aside convictions, so a charge has to be one. Expungement ineligibility
        alone does not make it one: a dismissed traffic violation is ineligible for expungement
        too, and would otherwise be reported as an ineligible conviction.

        Traffic violations and parking tickets are left out even when convicted. The record
        summary hides them, so the summary's count of ineligible charges is what the view is
        opened from, and a page of speeding tickets reported as ineligible convictions would
        tell a volunteer nothing.

        The JIU criterion is that the conviction is not expungeable under ORS 137.225, which
        is a categorical test. A charge that becomes eligible on a future date is expungeable
        under 137.225 and belongs on that route instead, so only INELIGIBLE qualifies.
        """
        if charge.edit_status == EditStatus.DELETE:
            return False
        if not charge.convicted():
            return False
        if charge.charge_type.hidden_in_record_summary(charge.disposition):
            return False
        charge_eligibility = charge.expungement_result.charge_eligibility
        if not charge_eligibility:
            return False
        return charge_eligibility.status == ChargeEligibilityStatus.INELIGIBLE
