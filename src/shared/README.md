# Shared fixtures

Test data read by both the backend and the frontend suites.

`sb819ResolutionFixtures.json` states how SB-819 criteria compose into a status. The rule
set is applied in Python when a record is analyzed and again in TypeScript when a volunteer
answers a question, so the two implementations have to agree. Both suites execute this file,
and a disagreement fails a test rather than reaching a volunteer.
