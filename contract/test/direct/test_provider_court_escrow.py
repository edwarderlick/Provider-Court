import json

import pytest

CLAUSES = [
    {"type": "must_contain", "value": "hello world", "weight": 2},
    {"type": "must_not_mention", "value": "lorem ipsum", "weight": 1},
]

VERDICTS_ALL_PASS = json.dumps(
    [
        {"index": 0, "verdict": True, "evidence": "found it"},
        {"index": 1, "verdict": True, "evidence": "absent, as required"},
    ]
)
VERDICTS_PARTIAL = json.dumps(
    [
        {"index": 0, "verdict": True, "evidence": "found it"},
        {"index": 1, "verdict": False, "evidence": "mentioned anyway"},
    ]
)
VERDICTS_ALL_FAIL = json.dumps(
    [
        {"index": 0, "verdict": False, "evidence": "missing"},
        {"index": 1, "verdict": False, "evidence": "mentioned anyway"},
    ]
)


def deploy(direct_deploy):
    return direct_deploy("provider_court_escrow.py")


def register_and_fund_and_accept(direct_vm, contract, buyer, provider, reward=1000):
    direct_vm.sender = buyer
    job_id = contract.create_job(
        "TEXT", "do the thing", CLAUSES, reward, 3600, 3600, 3600, 100
    )
    direct_vm.value = reward
    contract.fund_job(job_id)
    direct_vm.value = 0

    direct_vm.sender = provider
    contract.register_provider(["TEXT"])
    contract.accept_job(job_id)
    return job_id


# ---------------------------------------------------------------------
# Provider registry
# ---------------------------------------------------------------------


def test_register_provider(direct_vm, direct_deploy, direct_alice):
    contract = deploy(direct_deploy)
    direct_vm.sender = direct_alice
    contract.register_provider(["TEXT", "AUDIO"])

    info = contract.get_provider(direct_alice.as_hex)
    assert info["modalities"] == ["TEXT", "AUDIO"]


def test_register_provider_twice_reverts(direct_vm, direct_deploy, direct_alice):
    contract = deploy(direct_deploy)
    direct_vm.sender = direct_alice
    contract.register_provider(["TEXT"])

    with direct_vm.expect_revert("already registered"):
        contract.register_provider(["AUDIO"])


def test_register_unknown_modality_reverts(direct_vm, direct_deploy, direct_alice):
    contract = deploy(direct_deploy)
    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("unknown modality"):
        contract.register_provider(["VIDEO"])


# ---------------------------------------------------------------------
# Job creation / funding / cancellation
# ---------------------------------------------------------------------


def test_create_job_listed(direct_vm, direct_deploy, direct_alice):
    contract = deploy(direct_deploy)
    direct_vm.sender = direct_alice
    job_id = contract.create_job("TEXT", "prompt", CLAUSES, 1000, 3600, 3600, 3600, 100)

    job = contract.get_job(job_id)
    assert job["state"] == "Listed"
    assert job["buyer"] == direct_alice.as_hex
    assert job["reward_atto"] == 1000
    assert len(job["clauses"]) == 2


def test_create_job_rejects_bad_clause_type(direct_vm, direct_deploy, direct_alice):
    contract = deploy(direct_deploy)
    direct_vm.sender = direct_alice
    bad_clauses = [{"type": "must_be_awesome", "value": "x", "weight": 1}]
    with direct_vm.expect_revert("unknown clause type"):
        contract.create_job("TEXT", "prompt", bad_clauses, 1000, 3600, 3600, 3600, 100)


def test_create_job_rejects_zero_weight(direct_vm, direct_deploy, direct_alice):
    contract = deploy(direct_deploy)
    direct_vm.sender = direct_alice
    bad_clauses = [{"type": "must_contain", "value": "x", "weight": 0}]
    with direct_vm.expect_revert("weight must be a positive integer"):
        contract.create_job("TEXT", "prompt", bad_clauses, 1000, 3600, 3600, 3600, 100)


def test_fund_job_wrong_value_reverts(direct_vm, direct_deploy, direct_alice):
    contract = deploy(direct_deploy)
    direct_vm.sender = direct_alice
    job_id = contract.create_job("TEXT", "prompt", CLAUSES, 1000, 3600, 3600, 3600, 100)

    direct_vm.value = 999
    with direct_vm.expect_revert("must exactly equal reward_atto"):
        contract.fund_job(job_id)


def test_fund_job_by_non_buyer_reverts(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = deploy(direct_deploy)
    direct_vm.sender = direct_alice
    job_id = contract.create_job("TEXT", "prompt", CLAUSES, 1000, 3600, 3600, 3600, 100)

    direct_vm.sender = direct_bob
    direct_vm.value = 1000
    with direct_vm.expect_revert("only the buyer can fund"):
        contract.fund_job(job_id)


def test_fund_job_success(direct_vm, direct_deploy, direct_alice):
    contract = deploy(direct_deploy)
    direct_vm.sender = direct_alice
    job_id = contract.create_job("TEXT", "prompt", CLAUSES, 1000, 3600, 3600, 3600, 100)
    direct_vm.value = 1000
    contract.fund_job(job_id)

    assert contract.get_job(job_id)["state"] == "Funded"


def test_cancel_listed_job(direct_vm, direct_deploy, direct_alice):
    contract = deploy(direct_deploy)
    direct_vm.sender = direct_alice
    job_id = contract.create_job("TEXT", "prompt", CLAUSES, 1000, 3600, 3600, 3600, 100)
    contract.cancel_job(job_id)

    assert contract.get_job(job_id)["state"] == "Cancelled"


def test_cancel_by_non_buyer_reverts(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = deploy(direct_deploy)
    direct_vm.sender = direct_alice
    job_id = contract.create_job("TEXT", "prompt", CLAUSES, 1000, 3600, 3600, 3600, 100)

    direct_vm.sender = direct_bob
    with direct_vm.expect_revert("only the buyer can cancel"):
        contract.cancel_job(job_id)


# ---------------------------------------------------------------------
# Accept / deliver + deadlines
# ---------------------------------------------------------------------


def test_accept_job_requires_registered_provider(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    contract = deploy(direct_deploy)
    direct_vm.sender = direct_alice
    job_id = contract.create_job("TEXT", "prompt", CLAUSES, 1000, 3600, 3600, 3600, 100)
    direct_vm.value = 1000
    contract.fund_job(job_id)
    direct_vm.value = 0

    direct_vm.sender = direct_bob
    with direct_vm.expect_revert("not registered for modality"):
        contract.accept_job(job_id)


def test_accept_job_wrong_modality_reverts(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = deploy(direct_deploy)
    direct_vm.sender = direct_alice
    job_id = contract.create_job("TEXT", "prompt", CLAUSES, 1000, 3600, 3600, 3600, 100)
    direct_vm.value = 1000
    contract.fund_job(job_id)
    direct_vm.value = 0

    direct_vm.sender = direct_bob
    contract.register_provider(["AUDIO"])
    with direct_vm.expect_revert("not registered for modality"):
        contract.accept_job(job_id)


def test_accept_job_success(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = deploy(direct_deploy)
    job_id = register_and_fund_and_accept(direct_vm, contract, direct_alice, direct_bob)

    job = contract.get_job(job_id)
    assert job["state"] == "Accepted"
    assert job["provider"] == direct_bob.as_hex
    assert job["deliver_by"] != ""


def test_accept_job_past_accept_by_expires(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = deploy(direct_deploy)
    direct_vm.sender = direct_alice
    job_id = contract.create_job("TEXT", "prompt", CLAUSES, 1000, 10, 3600, 3600, 100)
    direct_vm.value = 1000
    contract.fund_job(job_id)
    direct_vm.value = 0

    direct_vm.warp("2999-01-01T00:00:00Z")

    direct_vm.sender = direct_bob
    contract.register_provider(["TEXT"])
    with direct_vm.expect_revert("accept_by deadline has passed"):
        contract.accept_job(job_id)

    assert contract.get_job(job_id)["state"] == "Expired"


def test_submit_delivery_by_non_provider_reverts(
    direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie
):
    contract = deploy(direct_deploy)
    job_id = register_and_fund_and_accept(direct_vm, contract, direct_alice, direct_bob)

    direct_vm.sender = direct_charlie
    with direct_vm.expect_revert("only the assigned provider"):
        contract.submit_delivery(job_id, "QmTestCid")


def test_submit_delivery_success(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = deploy(direct_deploy)
    job_id = register_and_fund_and_accept(direct_vm, contract, direct_alice, direct_bob)

    direct_vm.sender = direct_bob
    contract.submit_delivery(job_id, "QmTestCid")

    job = contract.get_job(job_id)
    assert job["state"] == "Delivered"
    assert job["cid"] == "QmTestCid"


def test_check_deadlines_missed(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = deploy(direct_deploy)
    direct_vm.sender = direct_alice
    job_id = contract.create_job("TEXT", "prompt", CLAUSES, 1000, 3600, 10, 3600, 100)
    direct_vm.value = 1000
    contract.fund_job(job_id)
    direct_vm.value = 0

    direct_vm.sender = direct_bob
    contract.register_provider(["TEXT"])
    contract.accept_job(job_id)

    direct_vm.warp("2999-01-01T00:00:00Z")
    result = contract.check_deadlines(job_id)

    assert result == "Missed"
    assert contract.get_job(job_id)["state"] == "Missed"


# ---------------------------------------------------------------------
# Adjudication
# ---------------------------------------------------------------------


def _delivered_job(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = deploy(direct_deploy)
    job_id = register_and_fund_and_accept(direct_vm, contract, direct_alice, direct_bob)
    direct_vm.sender = direct_bob
    contract.submit_delivery(job_id, "QmTestCid")
    return contract, job_id


def test_adjudicate_all_pass_releases_full(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract, job_id = _delivered_job(direct_vm, direct_deploy, direct_alice, direct_bob)

    direct_vm.mock_web(r".*QmTestCid.*", {"status": 200, "body": "hello world, nothing else"})
    direct_vm.mock_llm(r".*", VERDICTS_ALL_PASS)

    direct_vm.sender = direct_alice
    fraction = contract.adjudicate(job_id, "QmTestCid")

    assert fraction == 10**18
    job = contract.get_job(job_id)
    assert job["state"] == "Released"
    assert job["release_fraction_atto"] == 10**18
    assert len(job["clause_verdicts"]) == 2


def test_adjudicate_partial_release(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract, job_id = _delivered_job(direct_vm, direct_deploy, direct_alice, direct_bob)

    direct_vm.mock_web(r".*QmTestCid.*", {"status": 200, "body": "hello world, lorem ipsum"})
    direct_vm.mock_llm(r".*", VERDICTS_PARTIAL)

    fraction = contract.adjudicate(job_id, "QmTestCid")

    # weight 2 passed, weight 1 failed, total weight 3 -> 2/3 atto-scaled
    assert fraction == (2 * 10**18) // 3
    job = contract.get_job(job_id)
    assert job["state"] == "PartiallyReleased"


def test_adjudicate_all_fail_refunds(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract, job_id = _delivered_job(direct_vm, direct_deploy, direct_alice, direct_bob)

    direct_vm.mock_web(r".*QmTestCid.*", {"status": 200, "body": "nothing relevant here"})
    direct_vm.mock_llm(r".*", VERDICTS_ALL_FAIL)

    fraction = contract.adjudicate(job_id, "QmTestCid")

    assert fraction == 0
    assert contract.get_job(job_id)["state"] == "Refunded"


def test_adjudicate_wrong_cid_reverts(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract, job_id = _delivered_job(direct_vm, direct_deploy, direct_alice, direct_bob)

    with direct_vm.expect_revert("cid does not match"):
        contract.adjudicate(job_id, "QmSomeOtherCid")


def test_adjudicate_validator_agrees_on_matching_verdicts(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    contract, job_id = _delivered_job(direct_vm, direct_deploy, direct_alice, direct_bob)

    direct_vm.mock_web(r".*QmTestCid.*", {"status": 200, "body": "hello world, nothing else"})
    direct_vm.mock_llm(r".*", VERDICTS_ALL_PASS)

    contract.adjudicate(job_id, "QmTestCid")

    # Validator re-runs leader_fn with the SAME mocks still active -> same
    # booleans -> must agree.
    agrees = direct_vm.run_validator()
    assert agrees is True


def test_adjudicate_validator_disagrees_on_mismatched_verdicts(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    contract, job_id = _delivered_job(direct_vm, direct_deploy, direct_alice, direct_bob)

    direct_vm.mock_web(r".*QmTestCid.*", {"status": 200, "body": "hello world, nothing else"})
    direct_vm.mock_llm(r".*", VERDICTS_ALL_PASS)

    contract.adjudicate(job_id, "QmTestCid")

    # Simulate a leader that claimed everything failed, while our (validator)
    # re-run -- using the same mocks -- says everything passed: must disagree.
    agrees = direct_vm.run_validator(leader_result=json.loads(VERDICTS_ALL_FAIL))
    assert agrees is False


# ---------------------------------------------------------------------
# Appeal / resolve_appeal
# ---------------------------------------------------------------------


def test_appeal_requires_settled_job(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = deploy(direct_deploy)
    job_id = register_and_fund_and_accept(direct_vm, contract, direct_alice, direct_bob)

    direct_vm.sender = direct_alice
    direct_vm.value = 100
    with direct_vm.expect_revert("no settled verdict"):
        contract.appeal(job_id)


def test_appeal_and_resolve_success_returns_bond(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    contract, job_id = _delivered_job(direct_vm, direct_deploy, direct_alice, direct_bob)

    direct_vm.mock_web(r".*QmTestCid.*", {"status": 200, "body": "nothing relevant here"})
    direct_vm.mock_llm(r".*", VERDICTS_ALL_FAIL)
    contract.adjudicate(job_id, "QmTestCid")
    assert contract.get_job(job_id)["state"] == "Refunded"

    direct_vm.clear_mocks()

    direct_vm.sender = direct_bob  # provider disputes the all-fail verdict
    direct_vm.value = 100
    contract.appeal(job_id)
    direct_vm.value = 0
    assert contract.get_job(job_id)["state"] == "Disputed"

    # Re-adjudication this time finds everything passes.
    direct_vm.mock_web(r".*QmTestCid.*", {"status": 200, "body": "hello world, nothing else"})
    direct_vm.mock_llm(r".*", VERDICTS_ALL_PASS)
    fraction = contract.resolve_appeal(job_id, "QmTestCid")

    assert fraction == 10**18
    job = contract.get_job(job_id)
    assert job["state"] == "Released"
    assert job["disputant"] == ""


def test_appeal_window_closed_reverts(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract, job_id = _delivered_job(direct_vm, direct_deploy, direct_alice, direct_bob)

    direct_vm.mock_web(r".*QmTestCid.*", {"status": 200, "body": "hello world, nothing else"})
    direct_vm.mock_llm(r".*", VERDICTS_ALL_PASS)
    contract.adjudicate(job_id, "QmTestCid")

    direct_vm.warp("2999-01-01T00:00:00Z")
    direct_vm.sender = direct_alice
    direct_vm.value = 100
    with direct_vm.expect_revert("appeal window has closed"):
        contract.appeal(job_id)
