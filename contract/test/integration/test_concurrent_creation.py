"""
Reviewer-requested test (Pavel Kolosov, Issue 1): confirms that under real
concurrent creation load, each caller's transaction correlates unambiguously
to its own correct on-chain id.

Root cause investigation done directly against the contract, not assumed:
create_job/create_listing/purchase already assign an id from a global
counter (`job_id = self.job_count; self.job_count += 1`) AND return that
exact id as the transaction's own return value. GenVM's consensus model
executes each transaction to completion, in a determined order, before the
next one begins -- confirmed empirically by this test itself, which fires
several transactions from the wall clock's point of view "at the same
time" and shows the counter never produces a duplicate or dropped id. The
real bug this session found was never in the contract's own counter --
every prior web-app call site (web/lib/chain-client.ts,
web/app/api/chain/listings/route.ts, .../purchase/route.ts,
web/app/api/chain/jobs/route.ts) was ignoring that return value entirely
and instead re-reading get_job_count()/get_listing_count() *after*
finalizing, then assuming `count - 1` was its own id -- which a genuinely
concurrent creator racing that same follow-up read could invalidate. This
test exercises the CORRECT pattern (reading each transaction's own return
value, exactly what the web app now does after the fix) under real
concurrent load, proving it never misattributes an id even when several
threads submit at nearly the same wall-clock moment.

Run: gltest test/integration/test_concurrent_creation.py -v -s --network studionet
"""

import concurrent.futures

from gltest import get_contract_factory, get_accounts
from gltest.assertions import tx_execution_succeeded


def _deploy():
    factory = get_contract_factory("ProviderCourtEscrow")
    return factory.deploy(args=["https://ipfs.io/ipfs/"])


def _extract_return_value(receipt) -> int:
    """
    Mirrors the fixed web-app logic exactly (see waitFinalized in
    web/lib/genlayer-server.ts and web/lib/genlayer-wallet.ts): reads the
    transaction's own leader_receipt result rather than a follow-up count
    read, which is precisely what makes id correlation immune to a
    concurrent creator's transaction landing in between.
    """
    leader_receipt = receipt["consensus_data"]["leader_receipt"][0]
    payload = leader_receipt["result"]["payload"]
    return int(payload["readable"])


def test_concurrent_create_job_ids_correlate_correctly():
    print("\n=== test_concurrent_create_job_ids_correlate_correctly ===")
    accounts = get_accounts()
    contract = _deploy()
    print("deployed fresh contract instance")

    n = 5
    buyers = accounts[:n]
    print(f"firing {n} create_job() calls concurrently (ThreadPoolExecutor, real threads, "
          f"all in flight at the same wall-clock time) from {n} different accounts")

    def _create(i):
        buyer = buyers[i]
        prompt = f"concurrent-creation-test-prompt-{i}"
        clauses = [{"type": "must_contain", "value": "x", "weight": 1}]
        r = contract.connect(buyer).create_job(
            args=["TEXT", prompt, clauses, 1000, 3600, 3600, 3600, 100]
        ).transact()
        assert tx_execution_succeeded(r)
        return _extract_return_value(r), prompt, buyer.address

    # Real concurrent submission: all n create_job calls are in flight
    # "at the same time" from the wall clock's perspective (threads release
    # the GIL during the underlying network I/O), not submitted one at a
    # time waiting for the previous one to finish first.
    with concurrent.futures.ThreadPoolExecutor(max_workers=n) as executor:
        results = list(executor.map(_create, range(n)))

    print("\nper-thread results (id returned directly from that thread's own transaction):")
    for i, (job_id, prompt, buyer_address) in enumerate(results):
        print(f"  thread {i}: account={buyer_address}  ->  real returned job_id={job_id}  (prompt={prompt!r})")

    ids = [r[0] for r in results]
    print(f"\nall {n} returned ids: {ids}")
    print(f"distinct ids: {sorted(set(ids))}  (count={len(set(ids))})")
    assert len(set(ids)) == n, (
        f"expected {n} distinct job ids under concurrent creation, got {ids} -- "
        f"this would mean two different callers' transactions were assigned the "
        f"same id, or an id was silently dropped"
    )
    assert sorted(ids) == list(range(n)), (
        f"expected job ids to be exactly {{0..{n - 1}}} on a fresh contract "
        f"instance, got {sorted(ids)}"
    )
    print(f"CONFIRMED: {n} concurrent creations produced {n} distinct, sequential ids -- no "
          f"collision, no dropped id.")

    # Confirm each caller's own reported id genuinely correlates to ITS OWN
    # real on-chain data, not another concurrent caller's -- the actual
    # failure mode a count-based ("count - 1") lookup could produce under
    # real concurrent load.
    print("\nverifying each id correlates to the correct real on-chain job (not another "
          "thread's):")
    for job_id, prompt, buyer_address in results:
        job = contract.get_job(args=[job_id]).call()
        match = job["prompt"] == prompt and job["buyer"].lower() == buyer_address.lower()
        print(f"  job_id={job_id}: on-chain buyer={job['buyer']}, on-chain prompt={job['prompt']!r}  "
              f"-> {'CORRECT MATCH' if match else 'MISMATCH'}")
        assert job["prompt"] == prompt, (
            f"job {job_id}'s real on-chain prompt {job['prompt']!r} does not match "
            f"what account {buyer_address} actually submitted ({prompt!r}) -- id "
            f"misattribution under concurrent creation"
        )
        assert job["buyer"].lower() == buyer_address.lower(), (
            f"job {job_id}'s real on-chain buyer {job['buyer']!r} does not match the "
            f"account that actually created it ({buyer_address!r})"
        )

    final_count = contract.get_job_count(args=[]).call()
    print(f"\nfinal on-chain job_count: {final_count} (expected {n})")
    assert final_count == n, f"expected job_count == {n} after {n} concurrent creations, got {final_count}"
    print("RESULT: fix confirmed -- every concurrent creator's id correlates unambiguously "
          "to its own real transaction, with zero misattribution.")
