from functools import lru_cache

from flask import make_response
from flask.views import MethodView

from expungeservice.demo_records import DemoRecords
from expungeservice.models.record import Alias
from expungeservice.record_creator import RecordCreator
from expungeservice.sb819_analyzer import SB819Analyzer
from expungeservice.sb819_criteria import multnomah
from expungeservice.sb819_criteria.logic_sheet import build, collect_questions
from expungeservice.util import DateWithFuture as date_class, LRUCache


@lru_cache(maxsize=1)
def _logic_sheet():
    """The criteria as a numbered sheet, built once.

    The wording of each question is read off a real analysis rather than restated here, so
    the sheet cannot quote a question the software does not ask.
    """
    record, questions = RecordCreator.build_record(
        DemoRecords.build_search_results,
        "logic-sheet",
        "logic-sheet",
        (Alias("sb", "819", "", ""),),
        {},
        date_class.today(),
        LRUCache(1),
    )
    analysis = SB819Analyzer.build(record)
    return build(multnomah, collect_questions(analysis))


class SB819Rules(MethodView):
    def get(self):
        return make_response(_logic_sheet())


def register(app):
    app.add_url_rule("/api/sb819/rules", view_func=SB819Rules.as_view("sb819_rules"))
