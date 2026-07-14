from .client import YecoLens
from .trace import Trace, TraceChunk

from . import auto as _auto_module
from .auto import (
    auto as start_auto,
    unpatch,
    auto_intercept,
    patch_openai,
    patch_ollama,
    get_client,
)

auto = start_auto

__version__ = "1.0.0"
__all__ = [
    "YecoLens",
    "Trace",
    "TraceChunk",
    "auto",
    "start_auto",
    "unpatch",
    "auto_intercept",
    "patch_openai",
    "patch_ollama",
    "get_client",
]
