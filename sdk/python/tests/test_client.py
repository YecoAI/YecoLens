import json
import math
from dataclasses import dataclass
from typing import Any

from yeco_lens import YecoLens
from yeco_lens.client import YecoLens as YecoLensDirect


class FakeWS:
    def __init__(self):
        self.sent: list[dict] = []

    def send(self, raw: str):
        self.sent.append(json.loads(raw))

    def close(self):
        pass


def make_client() -> tuple[YecoLens, FakeWS]:
    yeco = YecoLens(connect=False)
    fake = FakeWS()
    yeco._ws = fake
    yeco._connected = True
    return yeco, fake


def test_trace_emits_start_token_end():
    yeco, fake = make_client()
    with yeco.trace(model="gpt-4o", user_message="hi") as t:
        t.emit_step("Hello", math.log(0.9), [])
        t.emit_step(" world", math.log(0.8), [])

    types = [m["type"] for m in fake.sent]
    assert types == ["trace.start", "trace.token", "trace.token", "trace.end"]

    assert fake.sent[0]["model"] == "gpt-4o"
    assert fake.sent[0]["messages"] == [{"role": "user", "content": "hi"}]

    assert fake.sent[1]["step"]["token"] == "Hello"
    assert fake.sent[1]["step"]["index"] == 0
    assert fake.sent[2]["step"]["token"] == " world"
    assert fake.sent[2]["step"]["index"] == 1

    end = fake.sent[3]
    assert end["text"] == "Hello world"
    assert end["durationMs"] >= 0


def test_trace_emits_error_on_exception():
    yeco, fake = make_client()
    try:
        with yeco.trace(model="gpt-4o", user_message="hi"):
            raise RuntimeError("boom")
    except RuntimeError:
        pass

    types = [m["type"] for m in fake.sent]
    assert types == ["trace.start", "trace.error"]
    assert "boom" in fake.sent[1]["error"]


def test_emit_step_with_alternatives():
    yeco, fake = make_client()
    with yeco.trace(model="gpt-4o", user_message="?") as t:
        t.emit_step(
            "Milano",
            math.log(0.62),
            [
                {"token": "Roma", "logprob": math.log(0.28)},
                {"token": "Torino", "logprob": math.log(0.10)},
            ],
        )

    step = fake.sent[1]["step"]
    assert step["token"] == "Milano"
    assert [a["token"] for a in step["alternatives"]] == ["Roma", "Torino"]
    assert 0 < step["entropy"] < 1
    assert abs(step["probability"] + sum(a["probability"] for a in step["alternatives"]) - 1.0) < 1e-6


def test_client_no_ops_when_disconnected():
    yeco = YecoLens(connect=False)
    assert not yeco.connected
    with yeco.trace(model="gpt-4o", user_message="hi") as t:
        t.emit_step("Hello", 0.0, [])
    assert True


def test_send_swallows_errors():
    yeco = YecoLens(connect=False)

    class BrokenWS:
        def send(self, raw):
            raise ConnectionError("dropped")

    yeco._ws = BrokenWS()
    yeco._connected = True
    yeco._send({"type": "trace.start", "traceId": "x", "model": "m", "provider": "sdk", "messages": []})
    assert not yeco._connected
