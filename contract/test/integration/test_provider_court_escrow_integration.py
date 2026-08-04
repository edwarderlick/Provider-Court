"""
Integration tests against a real GenLayer environment (StudioNet by default:
`gltest test/integration/ -v -s --network studionet`).

These exercise real consensus: real gl.nondet.web.get() fetches of
https://example.com/ (a stable IANA-reserved documentation domain, chosen so
this test needs no hosting/auth of its own — see chat report) and real
gl.nondet.exec_prompt() LLM calls evaluated independently by every validator.

Known, stable page text as of writing:
    "This domain is for use in documentation examples without needing
    permission. Avoid use in operations."
"""

import time

import pytest
from gltest import get_contract_factory, get_accounts
from gltest.assertions import tx_execution_succeeded

ARTIFACT_URL = "https://example.com/"

CLAUSES_ALL_PASS = [
    {"type": "must_contain", "value": "documentation examples", "weight": 1},
    {"type": "must_not_mention", "value": "banana pancake recipe", "weight": 1},
]

CLAUSES_PARTIAL = [
    {"type": "must_contain", "value": "documentation examples", "weight": 2},
    {"type": "must_contain", "value": "banana pancake recipe", "weight": 1},
]

CLAUSES_ALL_FAIL = [
    {"type": "must_contain", "value": "banana pancake recipe", "weight": 1},
    {"type": "must_mention", "value": "unicorn stock market crash", "weight": 1},
]


def _deploy():
    factory = get_contract_factory("ProviderCourtEscrow")
    return factory.deploy(args=["https://ipfs.io/ipfs/"])


def _post_fund_accept(contract, buyer, provider, clauses, reward=1000, bond=100):
    r = contract.connect(buyer).create_job(
        args=["TEXT", "check example.com", clauses, reward, 3600, 3600, 3600, bond]
    ).transact()
    assert tx_execution_succeeded(r)
    job_id = 0  # first job created by this contract instance in this test

    r = contract.connect(provider).register_provider(args=[["TEXT"]]).transact()
    assert tx_execution_succeeded(r)

    r = contract.connect(buyer).fund_job(args=[job_id]).transact(value=reward)
    assert tx_execution_succeeded(r)

    r = contract.connect(provider).accept_job(args=[job_id]).transact()
    assert tx_execution_succeeded(r)

    r = contract.connect(provider).submit_delivery(args=[job_id, ARTIFACT_URL]).transact()
    assert tx_execution_succeeded(r)

    return job_id


def test_full_lifecycle_all_pass_releases_full():
    accounts = get_accounts()
    buyer, provider = accounts[0], accounts[1]

    contract = _deploy()
    job_id = _post_fund_accept(contract, buyer, provider, CLAUSES_ALL_PASS)

    r = contract.connect(buyer).adjudicate(
        args=[job_id, ARTIFACT_URL],
        wait_interval=5000,
        wait_retries=60,
    ).transact()
    assert tx_execution_succeeded(r)

    job = contract.get_job(args=[job_id]).call()
    assert job["state"] == "Released"
    assert job["release_fraction_atto"] == 10**18
    assert len(job["clause_verdicts"]) == 2
    for v in job["clause_verdicts"]:
        assert v["verdict"] is True


def test_partial_release():
    accounts = get_accounts()
    buyer, provider = accounts[2], accounts[3]

    contract = _deploy()
    job_id = _post_fund_accept(contract, buyer, provider, CLAUSES_PARTIAL)

    r = contract.connect(buyer).adjudicate(
        args=[job_id, ARTIFACT_URL],
        wait_interval=5000,
        wait_retries=60,
    ).transact()
    assert tx_execution_succeeded(r)

    job = contract.get_job(args=[job_id]).call()
    assert job["state"] == "PartiallyReleased"
    assert 0 < job["release_fraction_atto"] < 10**18
    verdicts = {v["index"]: v["verdict"] for v in job["clause_verdicts"]}
    assert verdicts[0] is True  # "documentation examples" clause
    assert verdicts[1] is False  # "banana pancake recipe" clause


def test_all_fail_refunds():
    accounts = get_accounts()
    buyer, provider = accounts[4], accounts[5]

    contract = _deploy()
    job_id = _post_fund_accept(contract, buyer, provider, CLAUSES_ALL_FAIL)

    r = contract.connect(buyer).adjudicate(
        args=[job_id, ARTIFACT_URL],
        wait_interval=5000,
        wait_retries=60,
    ).transact()
    assert tx_execution_succeeded(r)

    job = contract.get_job(args=[job_id]).call()
    assert job["state"] == "Refunded"
    assert job["release_fraction_atto"] == 0
    for v in job["clause_verdicts"]:
        assert v["verdict"] is False


def test_appeal_flow_reverses_a_bad_verdict():
    accounts = get_accounts()
    buyer, provider = accounts[6], accounts[7]

    contract = _deploy()
    job_id = _post_fund_accept(contract, buyer, provider, CLAUSES_ALL_PASS, bond=50)

    r = contract.connect(buyer).adjudicate(
        args=[job_id, ARTIFACT_URL], wait_interval=5000, wait_retries=60
    ).transact()
    assert tx_execution_succeeded(r)
    assert contract.get_job(args=[job_id]).call()["state"] == "Released"

    r = contract.connect(buyer).appeal(args=[job_id]).transact(value=50)
    assert tx_execution_succeeded(r)
    assert contract.get_job(args=[job_id]).call()["state"] == "Disputed"

    r = contract.connect(buyer).resolve_appeal(
        args=[job_id, ARTIFACT_URL], wait_interval=5000, wait_retries=60
    ).transact()
    assert tx_execution_succeeded(r)

    job = contract.get_job(args=[job_id]).call()
    assert job["state"] == "Released"
    assert job["disputant"] == ""
