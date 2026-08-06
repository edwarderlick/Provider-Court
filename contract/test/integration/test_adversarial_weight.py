"""
Reviewer-requested test (Pavel Kolosov, Issue 2): proves the weight-
normalization fix in _settle() actually closes the gap, rather than just
looking fixed.

Root cause (confirmed by reading the contract directly, not assumed):
_validate_clause_shape only ever required weight to be a positive integer,
with no upper bound at all -- so a caller (whether the normal off-chain
derivation flow, or anyone calling create_job/create_listing/purchase
directly) could set one easily-satisfied clause's weight arbitrarily high
relative to a genuinely important one, and the old weighted-sum formula
(passed_weight / total_weight) let that single inflated clause dominate the
payout almost entirely regardless of whether the important clause passed.

Uses the exact same real, stable https://example.com/ page content already
proven out by test_provider_court_escrow_integration.py:
    "This domain is for use in documentation examples without needing
    permission. Avoid use in operations."
so "documentation examples" is a real clause that genuinely passes and
"banana pancake recipe" is a real clause that genuinely fails -- this is
real GenVM consensus + a real LLM verdict, not a mocked adjudicator.

Run: gltest test/integration/test_adversarial_weight.py -v -s --network studionet
"""

from gltest import get_contract_factory, get_accounts
from gltest.assertions import tx_execution_succeeded

ARTIFACT_URL = "https://example.com/"
ATTO = 10**18


def _deploy():
    factory = get_contract_factory("ProviderCourtEscrow")
    return factory.deploy(args=["https://ipfs.io/ipfs/"])


def _post_fund_accept_deliver(contract, buyer, provider, clauses, reward=1000, bond=100):
    r = contract.connect(buyer).create_job(
        args=["TEXT", "check example.com", clauses, reward, 3600, 3600, 3600, bond]
    ).transact()
    assert tx_execution_succeeded(r)
    job_id = 0  # first job created by this fresh contract instance

    r = contract.connect(provider).register_provider(args=[["TEXT"]]).transact()
    assert tx_execution_succeeded(r)

    r = contract.connect(buyer).fund_job(args=[job_id]).transact(value=reward)
    assert tx_execution_succeeded(r)

    r = contract.connect(provider).accept_job(args=[job_id]).transact()
    assert tx_execution_succeeded(r)

    r = contract.connect(provider).submit_delivery(args=[job_id, ARTIFACT_URL]).transact()
    assert tx_execution_succeeded(r)

    return job_id


def test_adversarial_weight_cannot_dominate_payout():
    """
    Deliberately constructs the exact gaming pattern Issue 2 describes: an
    easy, trivially-satisfied clause given a wildly inflated weight, and the
    genuinely important clause given a token weight of 1.

    Under the OLD (buggy) weighted-sum formula this would have settled at
    total_weight=1001, passed_weight=1000 (only the easy clause passes) ->
    fraction = 1000/1001 ~= 0.999001 ATTO -- the buyer would pay ~99.9% of
    the full price despite the one clause they actually cared about
    completely failing. That is precisely the unfair outcome being tested
    against here.

    Under the FIXED equal-weighting formula, every clause counts as exactly
    one vote regardless of its stored weight: total_weight=2,
    passed_weight=1 -> fraction is exactly 1/2 (50%), a proportionate
    reflection of "1 of 2 real requirements were met" -- not a number an
    inflated weight can push arbitrarily close to 100%.
    """
    accounts = get_accounts()
    buyer, provider = accounts[6], accounts[7]

    adversarial_clauses = [
        # The easy clause: "documentation examples" genuinely appears on
        # example.com's real page, so this WILL pass -- and its weight is
        # set absurdly high to try to dominate the rubric.
        {"type": "must_contain", "value": "documentation examples", "weight": 1000},
        # The important/hard clause: "banana pancake recipe" genuinely does
        # NOT appear, so this WILL fail -- given only a token weight of 1
        # under the old scheme, exactly the gaming pattern Issue 2 warns
        # about (an easily-satisfied clause with a heavy weight, a harder
        # one with a token weight).
        {"type": "must_contain", "value": "banana pancake recipe", "weight": 1},
    ]

    print("\n=== test_adversarial_weight_cannot_dominate_payout ===")
    print(f"clause weights: easy clause weight=1000, important clause weight=1  (1000:1 skew)")

    contract = _deploy()
    job_id = _post_fund_accept_deliver(contract, buyer, provider, adversarial_clauses)
    print(f"deployed contract, created+delivered job_id={job_id}")

    r = contract.connect(buyer).adjudicate(
        args=[job_id, ARTIFACT_URL],
    ).transact(wait_interval=5000, wait_retries=60)
    assert tx_execution_succeeded(r)
    print("adjudicate() finalized via real GenVM consensus")

    job = contract.get_job(args=[job_id]).call()
    verdicts = {v["index"]: v["verdict"] for v in job["clause_verdicts"]}
    print(f"clause 0 (\"documentation examples\", weight=1000) verdict: {'PASS' if verdicts[0] else 'FAIL'}")
    print(f"clause 1 (\"banana pancake recipe\", weight=1) verdict:    {'PASS' if verdicts[1] else 'FAIL'}")
    assert verdicts[0] is True, "the easy/inflated-weight clause should genuinely pass"
    assert verdicts[1] is False, "the important/token-weight clause should genuinely fail"

    old_buggy_fraction = (1000 * ATTO) // 1001  # what the pre-fix weighted formula would have produced
    fixed_fraction = job["release_fraction_atto"]
    print(f"OLD (buggy) weighted-sum formula would have settled at: {old_buggy_fraction / ATTO:.4%}  (1000/1001)")
    print(f"NEW (fixed) equal-weighting formula actually settled at: {fixed_fraction / ATTO:.4%}  (1/2)")
    print(f"job.state: {job['state']}")

    assert fixed_fraction == ATTO // 2, (
        f"expected exactly 50% (1 of 2 clauses passed, equal weighting) but got "
        f"{fixed_fraction / ATTO:.4%} -- weight normalization is not actually in effect"
    )
    assert fixed_fraction < old_buggy_fraction, (
        "sanity check: the fixed fraction must be meaningfully lower than what the "
        "old weight-dominated formula would have produced for this exact scenario"
    )
    assert job["state"] == "PartiallyReleased"
    print("RESULT: fix confirmed -- payout reflects 1 of 2 clauses passed (50%), not the "
          "weight-dominated ~99.9% the old formula would have produced.")


def test_extreme_weight_skew_still_normalizes_to_equal_shares():
    """
    Same shape, but with an even more extreme weight (1,000,000 to 1) to
    prove there is no magnitude at all a party can inflate a clause's
    weight to and still bias the outcome -- confirming the fix is not just
    a higher cap, but a genuine removal of weight's influence on payout.
    """
    accounts = get_accounts()
    buyer, provider = accounts[8], accounts[9]

    extreme_clauses = [
        {"type": "must_contain", "value": "documentation examples", "weight": 1_000_000},
        {"type": "must_contain", "value": "banana pancake recipe", "weight": 1},
    ]

    print("\n=== test_extreme_weight_skew_still_normalizes_to_equal_shares ===")
    print(f"clause weights: easy clause weight=1,000,000, important clause weight=1  (1,000,000:1 skew)")

    contract = _deploy()
    job_id = _post_fund_accept_deliver(contract, buyer, provider, extreme_clauses)
    print(f"deployed contract, created+delivered job_id={job_id}")

    r = contract.connect(buyer).adjudicate(
        args=[job_id, ARTIFACT_URL],
    ).transact(wait_interval=5000, wait_retries=60)
    assert tx_execution_succeeded(r)
    print("adjudicate() finalized via real GenVM consensus")

    job = contract.get_job(args=[job_id]).call()
    fixed_fraction = job["release_fraction_atto"]
    old_buggy_fraction = (1_000_000 * ATTO) // 1_000_001
    print(f"OLD (buggy) weighted-sum formula would have settled at: {old_buggy_fraction / ATTO:.6%}  (999999999.../1000001)")
    print(f"NEW (fixed) equal-weighting formula actually settled at: {fixed_fraction / ATTO:.4%}  (1/2)")
    assert fixed_fraction == ATTO // 2, (
        "a 1,000,000-to-1 weight skew must still settle at exactly 50% -- any deviation "
        "means weight is still influencing payout at extreme values"
    )
    print("RESULT: fix confirmed -- even a 1,000,000:1 weight skew still settles at exactly "
          "50%, proving weight has zero influence on payout at any magnitude.")
