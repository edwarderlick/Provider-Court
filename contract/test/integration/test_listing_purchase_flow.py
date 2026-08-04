"""
Integration test for the provider-listed-services pivot: create_listing +
purchase() replacing create_job/fund_job/accept_job as the buyer-facing entry
point, while submit_delivery/adjudicate/appeal/resolve_appeal/claim_settlement
stay the exact same code already proven out by
test_provider_court_escrow_integration.py.

Run: gltest test/integration/test_listing_purchase_flow.py -v -s --network studionet
"""

import time

from gltest import get_contract_factory, get_accounts
from gltest.assertions import tx_execution_succeeded
from gltest.types import TransactionStatus

ARTIFACT_URL = "https://example.com/"
APPEAL_WINDOW_SECONDS = 5

CLAUSES_ALL_PASS = [
    {"type": "must_contain", "value": "documentation examples", "weight": 1},
    {"type": "must_not_mention", "value": "banana pancake recipe", "weight": 1},
]


def _deploy(fulfillment_operator: str):
    factory = get_contract_factory("ProviderCourtEscrow")
    return factory.deploy(args=["https://ipfs.io/ipfs/", fulfillment_operator])


def test_purchase_spawns_order_and_relayer_can_deliver():
    accounts = get_accounts()
    buyer, provider, relayer, stranger = accounts[0], accounts[1], accounts[2], accounts[3]

    contract = _deploy(relayer.address)

    # legacy registration path, unchanged
    r = contract.connect(provider).register_provider(args=[["TEXT"]]).transact()
    assert tx_execution_succeeded(r)

    # provider lists a service once
    r = contract.connect(provider).create_listing(
        args=["TEXT", "check example.com", CLAUSES_ALL_PASS, 1000, 3600, APPEAL_WINDOW_SECONDS, 100]
    ).transact()
    assert tx_execution_succeeded(r)
    listing_id = 0
    listing = contract.connect(buyer).get_listing(args=[listing_id]).call()
    assert listing["active"] is True
    assert listing["provider"].lower() == provider.address.lower()

    # a stranger (not the provider, not the relayer) must not be able to
    # submit delivery even after a valid purchase -- confirms the auth
    # change only added the relayer, not "anyone"
    r = contract.connect(buyer).purchase(args=[listing_id]).transact(value=1000)
    assert tx_execution_succeeded(r)
    order_id = 0
    order = contract.connect(buyer).get_order(args=[order_id]).call()
    assert order["state"] == "Accepted"  # payment IS the claim -- no accept_job step
    assert order["provider"].lower() == provider.address.lower()
    assert order["buyer"].lower() == buyer.address.lower()
    assert order["listing_id"] == listing_id

    r = contract.connect(stranger).submit_delivery(args=[order_id, ARTIFACT_URL]).transact()
    assert not tx_execution_succeeded(r), "a stranger must not be able to submit delivery"

    # the relayer (fulfillment_operator) delivers on the provider's behalf --
    # this is the auto-delivery path the app will actually use
    r = contract.connect(relayer).submit_delivery(args=[order_id, ARTIFACT_URL]).transact()
    assert tx_execution_succeeded(r)

    # adjudication/settlement: completely unmodified code path
    r = contract.connect(buyer).adjudicate(args=[order_id, ARTIFACT_URL]).transact()
    assert tx_execution_succeeded(r)
    order = contract.connect(buyer).get_order(args=[order_id]).call()
    assert order["state"] == "Released"
    assert order["settled"] is False

    print(f"    waiting {APPEAL_WINDOW_SECONDS + 3}s for appeal window to close...")
    time.sleep(APPEAL_WINDOW_SECONDS + 3)
    r = contract.connect(buyer).claim_settlement(args=[order_id]).transact(
        wait_transaction_status=TransactionStatus.FINALIZED
    )
    assert tx_execution_succeeded(r)
    order = contract.connect(buyer).get_order(args=[order_id]).call()
    assert order["settled"] is True

    # listing stays live for a second, independent purchase (reusable by design)
    r = contract.connect(buyer).purchase(args=[listing_id]).transact(value=1000)
    assert tx_execution_succeeded(r)
    second_order_id = 1
    second_order = contract.connect(buyer).get_order(args=[second_order_id]).call()
    assert second_order["listing_id"] == listing_id
    assert second_order["id"] != order["id"]

    # deactivating stops further purchases
    r = contract.connect(provider).set_listing_active(args=[listing_id, False]).transact()
    assert tx_execution_succeeded(r)
    r = contract.connect(buyer).purchase(args=[listing_id]).transact(value=1000)
    assert not tx_execution_succeeded(r), "purchase must fail once the listing is deactivated"


def test_legacy_create_job_path_still_works_unmodified():
    accounts = get_accounts()
    buyer, provider, relayer = accounts[0], accounts[1], accounts[2]

    contract = _deploy(relayer.address)

    r = contract.connect(provider).register_provider(args=[["TEXT"]]).transact()
    assert tx_execution_succeeded(r)

    r = contract.connect(buyer).create_job(
        args=["TEXT", "check example.com", CLAUSES_ALL_PASS, 1000, 3600, 3600, APPEAL_WINDOW_SECONDS, 100]
    ).transact()
    assert tx_execution_succeeded(r)
    job_id = 0

    r = contract.connect(buyer).fund_job(args=[job_id]).transact(value=1000)
    assert tx_execution_succeeded(r)

    r = contract.connect(provider).accept_job(args=[job_id]).transact()
    assert tx_execution_succeeded(r)

    # legacy path: the provider themselves delivers, exactly as before --
    # the relayer being configured must not change this.
    r = contract.connect(provider).submit_delivery(args=[job_id, ARTIFACT_URL]).transact()
    assert tx_execution_succeeded(r)

    job = contract.connect(buyer).get_job(args=[job_id]).call()
    assert job["state"] == "Delivered"
