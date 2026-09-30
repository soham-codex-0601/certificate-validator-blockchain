import json
from pathlib import Path

from web3 import Web3

from ..config import get_settings


settings = get_settings()


class BlockchainService:
    """
    CertiChain blockchain service.

    IMPORTANT:
    The backend NEVER stores an issuer private key.

    MetaMask signs transactions in the browser.

    This backend only:
    - reads the Sepolia blockchain
    - verifies transactions
    - validates certificate hashes
    """

    def __init__(self) -> None:

        self.enabled = settings.blockchain_enabled

        self.w3 = None

        self.contract = None

        if not self.enabled:
            return

        if not settings.blockchain_rpc_url:
            raise RuntimeError(
                "BLOCKCHAIN_RPC_URL is required when blockchain is enabled"
            )

        if not settings.blockchain_contract_address:
            raise RuntimeError(
                "BLOCKCHAIN_CONTRACT_ADDRESS is required when blockchain is enabled"
            )

        self.w3 = Web3(
            Web3.HTTPProvider(
                settings.blockchain_rpc_url
            )
        )

        if not self.w3.is_connected():
            raise RuntimeError(
                "Unable to connect to blockchain RPC"
            )

        if settings.blockchain_chain_id is not None:

            actual_chain_id = int(
                self.w3.eth.chain_id
            )

            if actual_chain_id != settings.blockchain_chain_id:

                raise RuntimeError(
                    f"Wrong blockchain network. "
                    f"Expected {settings.blockchain_chain_id}, "
                    f"got {actual_chain_id}"
                )

        # Load ABI
        abi_path = (
            Path(__file__).resolve().parents[2]
            / "abi"
            / "CertificateRegistry.json"
        )

        if not abi_path.exists():
            raise RuntimeError(
                f"Contract ABI not found: {abi_path}"
            )

        self.abi = json.loads(
            abi_path.read_text(
                encoding="utf-8"
            )
        )

        self.contract = self.w3.eth.contract(
            address=Web3.to_checksum_address(
                settings.blockchain_contract_address
            ),
            abi=self.abi
        )

    def get_certificate(
        self,
        certificate_id: str
    ) -> dict:

        if not self.enabled:
            raise RuntimeError(
                "Blockchain is disabled"
            )

        if self.contract is None:
            raise RuntimeError(
                "Blockchain contract is not initialized"
            )

        (
            certificate_hash,
            issuer,
            timestamp,
            exists,
            revoked
        ) = self.contract.functions.getCertificate(
            certificate_id
        ).call()

        return {
            "certificate_hash": Web3.to_hex(
                certificate_hash
            ),

            "issuer_address": issuer,

            "timestamp": int(timestamp),

            "exists": bool(exists),

            "revoked": bool(revoked),
        }

    def finalize_transaction(
        self,
        certificate_id: str,
        certificate_hash: str,
        tx_hash: str
    ) -> dict:

        if not self.enabled:
            raise RuntimeError(
                "Blockchain is disabled"
            )

        if self.contract is None:
            raise RuntimeError(
                "Blockchain contract is not initialized"
            )

        if self.w3 is None:
            raise RuntimeError(
                "Web3 provider is not initialized"
            )

        # Normalize transaction hash
        tx_hash = tx_hash.lower()

        # Wait for transaction
        receipt = self.w3.eth.wait_for_transaction_receipt(
            tx_hash,
            timeout=180
        )

        if receipt.status != 1:
            raise RuntimeError(
                "Blockchain transaction failed"
            )

        # Retrieve transaction
        tx = self.w3.eth.get_transaction(
            tx_hash
        )

        contract_address = Web3.to_checksum_address(
            settings.blockchain_contract_address
        )

        # Make sure transaction went to our contract
        if tx.get("to") is None:

            raise RuntimeError(
                "Transaction was not sent to the CertiChain contract"
            )

        transaction_to = Web3.to_checksum_address(
            tx["to"]
        )

        if transaction_to != contract_address:

            raise RuntimeError(
                "Transaction was sent to the wrong contract"
            )

        # Read certificate from blockchain
        chain_certificate = self.get_certificate(
            certificate_id
        )

        if not chain_certificate["exists"]:

            raise RuntimeError(
                "Certificate is not registered on-chain"
            )

        expected_hash = certificate_hash.lower()

        if not expected_hash.startswith("0x"):
            expected_hash = "0x" + expected_hash

        blockchain_hash = (
            chain_certificate["certificate_hash"]
            .lower()
        )

        if blockchain_hash != expected_hash:

            raise RuntimeError(
                "On-chain certificate hash does not match uploaded file"
            )

        # Transaction sender
        issuer_address = Web3.to_checksum_address(
            tx["from"]
        )

        blockchain_issuer = Web3.to_checksum_address(
            chain_certificate["issuer_address"]
        )

        if blockchain_issuer != issuer_address:

            raise RuntimeError(
                "Blockchain issuer does not match transaction sender"
            )

        return {
            "transaction_hash": tx_hash,

            "issuer_address": issuer_address,

            "timestamp": chain_certificate["timestamp"],
        }


blockchain = BlockchainService()