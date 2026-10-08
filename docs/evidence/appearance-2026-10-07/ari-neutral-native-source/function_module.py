"""Load the exact builder definitions without its terminal CLI invocation."""
import ast
import hashlib
from pathlib import Path
from types import ModuleType

EXPECTED = "270e87d563ab0212835ec2c63b4d6364a1031397979152b0af14bccdc7753065"

def load_builder(path):
    path = Path(path)
    raw = path.read_bytes()
    if hashlib.sha256(raw).hexdigest() != EXPECTED:
        raise RuntimeError("Builder source identity changed")
    tree = ast.parse(raw, filename=str(path))
    last = tree.body[-1]
    if not (isinstance(last, ast.Expr) and isinstance(last.value, ast.Call)
            and isinstance(last.value.func, ast.Name) and last.value.func.id == "main"
            and not last.value.args and not last.value.keywords):
        raise RuntimeError("Expected exactly one terminal main() invocation")
    tree.body.pop()
    module = ModuleType("sugata_owned_builder_functions")
    module.__file__ = str(path)
    exec(compile(tree, str(path), "exec"), module.__dict__)
    return module
