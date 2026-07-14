import json
import math

import pytest

import yeco_lens
from yeco_lens import auto, unpatch, auto_intercept, patch_openai
from yeco_lens.client import YecoLens

auto_module = yeco_lens._auto_module


class _Delta:
    def __init__(self, content):
        self.content = content


class _LogprobEntry:
    def __init__(self, token, logprob, top_logprobs):
        self.token = token
        self.logprob = logprob
        self.top_logprobs = top_logprobs


class _LogprobContent:
    def __init__(self, entries):
        self.content = entries


class _Choice:
    def __init__(self, delta=None, logprobs=None):
        self.delta = delta
        self.logprobs = logprobs


class _Chunk:
    def __init__(self, choices):
        self.choices = choices


class _FakeLogprobToken:
    def __init__(self, token, logprob):
        self.token = token
        self.logprob = logprob


class FakeCompletions:
    last_kwargs = None

    def create(self, **kwargs):
        FakeCompletions.last_kwargs = kwargs
        yield _Chunk([
            _Choice(
                delta=_Delta("Milano"),
                logprobs=_LogprobContent([
                    _LogprobEntry("Milano", math.log(0.62), [
                        _FakeLogprobToken("Milano", math.log(0.62)),
                        _FakeLogprobToken("Roma", math.log(0.28)),
                        _FakeLogprobToken("Torino", math.log(0.10)),
                    ]),
                ]),
            )
        ])
        yield _Chunk([
            _Choice(
                delta=_Delta("."),
                logprobs=_LogprobContent([
                    _LogprobEntry(".", math.log(0.99), [
                        _FakeLogprobToken(".", math.log(0.99)),
                    ]),
                ]),
            )
        ])


@pytest.fixture(autouse=True)
def _reset_patches():
    unpatch()
    FakeCompletions.last_kwargs = None
    yield
    unpatch()


@pytest.fixture
def fake_client():
    sent = []

    class FakeWS:
        def send(self, raw):
            sent.append(json.loads(raw))
        def close(self):
            pass

    auto_module._client = YecoLens(connect=False)
    auto_module._client._ws = FakeWS()
    auto_module._client._connected = True
    yield sent
    auto_module._client = None


def test_patch_openai_forces_logprobs_and_tees_to_dashboard(fake_client):
    sent = fake_client
    assert patch_openai(_completions_cls=FakeCompletions) is True

    inst = FakeCompletions()
    stream = inst.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": "Capital of Italy?"}],
        stream=True,
    )
    tokens = []
    for chunk in stream:
        if chunk.choices and chunk.choices[0].delta.content:
            tokens.append(chunk.choices[0].delta.content)

    assert tokens == ["Milano", "."]
    assert FakeCompletions.last_kwargs["logprobs"] is True
    assert FakeCompletions.last_kwargs["top_logprobs"] == 10
    types_sent = [m["type"] for m in sent]
    assert types_sent == ["trace.start", "trace.token", "trace.token", "trace.end"]
    assert sent[1]["step"]["token"] == "Milano"
    assert [a["token"] for a in sent[1]["step"]["alternatives"]] == ["Roma", "Torino"]
    assert sent[-1]["text"] == "Milano."


def test_unpatch_restores_original(fake_client):
    original = FakeCompletions.create
    patch_openai(_completions_cls=FakeCompletions)
    assert FakeCompletions.create is not original

    unpatch()
    assert FakeCompletions.create is original


def test_auto_context_manager(fake_client):
    original = FakeCompletions.create
    with auto_intercept(enable_openai=False, enable_ollama=False):
        assert FakeCompletions.create is original
    assert FakeCompletions.create is original

    patch_openai(_completions_cls=FakeCompletions)
    assert FakeCompletions.create is not original
    unpatch()
    assert FakeCompletions.create is original


def test_patch_without_completions_arg_returns_false_when_openai_absent(monkeypatch):
    import sys
    monkeypatch.setitem(sys.modules, "openai.resources.chat.completions", None)
    assert patch_openai() is False


def test_patch_is_idempotent(fake_client):
    patch_openai(_completions_cls=FakeCompletions)
    patched_once = FakeCompletions.create
    patch_openai(_completions_cls=FakeCompletions)
    assert FakeCompletions.create is patched_once


def test_auto_returns_results_dict(fake_client):
    results = auto(enable_openai=False, enable_ollama=False)
    assert results == {}


def test_thread_local_trace_isolation():
    """Each thread should see its own active trace (threading.local fix)."""
    import threading
    from yeco_lens.client import YecoLens
    from yeco_lens.trace import Trace

    client = YecoLens(connect=False)
    results = {}

    def thread_a():
        trace_a = Trace(client, "trace-a", "model-a", "sdk", [])
        client._set_active_trace(trace_a)
        import time
        time.sleep(0.05)  # let thread B run
        results["a_sees"] = client._current_trace()
        results["a_id"] = client._current_trace().id if client._current_trace() else None

    def thread_b():
        import time
        time.sleep(0.02)
        trace_b = Trace(client, "trace-b", "model-b", "sdk", [])
        client._set_active_trace(trace_b)
        results["b_sees"] = client._current_trace()
        results["b_id"] = client._current_trace().id if client._current_trace() else None

    ta = threading.Thread(target=thread_a)
    tb = threading.Thread(target=thread_b)
    ta.start()
    tb.start()
    ta.join(timeout=2)
    tb.join(timeout=2)

    assert results.get("a_id") == "trace-a", f"Thread A should see trace-a, got {results.get('a_id')}"
    assert results.get("b_id") == "trace-b", f"Thread B should see trace-b, got {results.get('b_id')}"
    # Main thread should see no trace
    assert client._current_trace() is None
