import ast
from pathlib import Path


VERSIONS_DIR = Path(__file__).resolve().parents[1] / "alembic" / "versions"


def _assignment_literal(path: Path, name: str):
    module = ast.parse(path.read_text(encoding="utf-8"))
    for node in module.body:
        if not isinstance(node, ast.Assign):
            continue
        for target in node.targets:
            if isinstance(target, ast.Name) and target.id == name:
                return ast.literal_eval(node.value)
    raise AssertionError(f"{name} not found in {path.name}")


def test_alembic_revisions_are_unique():
    revisions: dict[str, str] = {}

    for path in VERSIONS_DIR.glob("*.py"):
        revision = _assignment_literal(path, "revision")
        assert revision not in revisions, f"duplicate revision {revision} in {path.name} and {revisions[revision]}"
        revisions[revision] = path.name


def test_core_hr_module_merges_the_parallel_0021_histories():
    down_revision = _assignment_literal(VERSIONS_DIR / "0022_core_hr_module.py", "down_revision")
    billing_revision = _assignment_literal(
        VERSIONS_DIR / "0021_tenant_payment_tracking_and_anchor_day.py",
        "revision",
    )

    assert billing_revision == "0021_billing_payment_tracking"
    assert down_revision == ("0021", "0021_billing_payment_tracking")
