"""
Full state-machine + adjudication walkthrough against an ALREADY-DEPLOYED
contract on StudioNet. Talks to it via the raw genlayer_py client (bypassing
gltest's ContractFactory, whose schema-autodetection has an unrelated snag in
this environment) so we can attach native `value` to the payable
fund_job/appeal calls.

Run: gltest test/integration/test_studio_walkthrough.py -v -s --network studionet
"""

import time

from gltest import get_gl_client, get_accounts
from gltest.assertions import tx_execution_succeeded

CONTRACT = "0x8432b1AE7346F1aF0B333Faf1b4B99a954AeED40"
ARTIFACT_URL = "https://example.com/"
APPEAL_WINDOW_SECONDS = 5


def _w(client, account, method, args, value=0, wait_status="ACCEPTED"):
    print(f">>> write {method}({args}) value={value} sender={account.address}")
    tx_hash = client.write_contract(
        address=CONTRACT, function_name=method, account=account, args=args, value=value
    )
    receipt = client.wait_for_transaction_receipt(
        transaction_hash=tx_hash, status=wait_status, interval=5000, retries=60
    )
    ok = tx_execution_succeeded(receipt)
    print(f"    -> status={receipt.get('status_name')} ok={ok}")
    if not ok:
        leader = receipt["consensus_data"]["leader_receipt"][0]
        print("    leader result:", leader.get("result"))
    assert ok, f"{method} failed: {receipt}"
    return receipt


def _r(client, method, args=None):
    return client.read_contract(address=CONTRACT, function_name=method, args=args or [])


def test_full_walkthrough_on_deployed_contract():
    client = get_gl_client()
    accounts = get_accounts()
    buyer, provider = accounts[0], accounts[1]

    if not _r(client, "get_provider", [provider.address]):
        _w(client, provider, "register_provider", [["TEXT"]])

    scenarios = [
        (
            "ALL_PASS",
            [
                {"type": "must_contain", "value": "documentation examples", "weight": 1},
                {"type": "must_not_mention", "value": "banana pancake recipe", "weight": 1},
            ],
            "Released",
        ),
        (
            "PARTIAL",
            [
                {"type": "must_contain", "value": "documentation examples", "weight": 2},
                {"type": "must_contain", "value": "banana pancake recipe", "weight": 1},
            ],
            "PartiallyReleased",
        ),
        (
            "ALL_FAIL",
            [
                {"type": "must_contain", "value": "banana pancake recipe", "weight": 1},
                {"type": "must_mention", "value": "unicorn stock market crash", "weight": 1},
            ],
            "Refunded",
        ),
    ]

    job_ids = {}
    for label, clauses, expected_state in scenarios:
        print(f"\n== scenario {label} (expect {expected_state}) ==")
        job_id = int(_r(client, "get_job_count"))
        _w(
            client,
            buyer,
            "create_job",
            ["TEXT", f"check example.com ({label})", clauses, 1000, 3600, 3600, APPEAL_WINDOW_SECONDS, 100],
        )
        _w(client, buyer, "fund_job", [job_id], value=1000)
        _w(client, provider, "accept_job", [job_id])
        _w(client, provider, "submit_delivery", [job_id, ARTIFACT_URL])
        _w(client, buyer, "adjudicate", [job_id, ARTIFACT_URL])

        job = _r(client, "get_job", [job_id])
        print(f"    final state={job['state']} fraction={job['release_fraction_atto']} settled={job['settled']}")
        assert job["state"] == expected_state
        assert job["settled"] is False  # not paid out yet -- claim_settlement does that
        job_ids[label] = job_id

    print("\n== claim_settlement (PARTIAL job) ==")
    jid = job_ids["PARTIAL"]
    print(f"    waiting {APPEAL_WINDOW_SECONDS + 3}s for appeal window to close...")
    time.sleep(APPEAL_WINDOW_SECONDS + 3)
    # NOTE: StudioNet's eth_getBalance does not appear to reflect
    # emit_transfer payouts even well after FINALIZED (confirmed by polling
    # 60s+ post-finalization) -- studio is a gasless consensus simulator, not
    # a full economic settlement environment. `settled` flipping to True with
    # no execution error is the reliable signal here: the first version of
    # this contract threw a real "SystemError: 7: inbalance" when it tried to
    # pay out more than the contract's actual balance (the double-payout bug
    # this design fixes), so a clean, error-free claim_settlement is good
    # evidence the payout math and balance accounting are correct. Real
    # value movement is verified for real on testnet (see chat report).
    _w(client, buyer, "claim_settlement", [jid], wait_status="FINALIZED")
    job = _r(client, "get_job", [jid])
    assert job["settled"] is True

    print("\n== appeal flow on the ALL_PASS job ==")
    jid = job_ids["ALL_PASS"]
    _w(client, buyer, "appeal", [jid], value=100)
    job = _r(client, "get_job", [jid])
    assert job["state"] == "Disputed"

    _w(client, buyer, "resolve_appeal", [jid, ARTIFACT_URL])
    job = _r(client, "get_job", [jid])
    print(f"    after resolve_appeal: state={job['state']} fraction={job['release_fraction_atto']}")
    assert job["state"] == "Released"
    assert job["settled"] is False

    print(f"    waiting {APPEAL_WINDOW_SECONDS + 3}s for the new appeal window to close...")
    time.sleep(APPEAL_WINDOW_SECONDS + 3)
    _w(client, buyer, "claim_settlement", [jid], wait_status="FINALIZED")
    job = _r(client, "get_job", [jid])
    assert job["settled"] is True
