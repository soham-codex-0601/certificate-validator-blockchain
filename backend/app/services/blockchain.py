import json
from pathlib import Path

from web3 import Web3

from ..config import get_settings

settings = get_settings()


class BlockchainService:
    def __init__(self) -> None:
        self.enabled = settings.blockchain_enabled

        if not self.enabled:
            self.w3 = None
            self.contract = None
            self.account = None
            return

        if not settings.blockchain_rpc_url:
            raise RuntimeError("BLOCKCHAIN_RPC_URL is required when blockchain is enabled")
        if not settings.blockchain_contract_address:
            raise RuntimeError("BLOCKCHAIN_CONTRACT_ADDRESS is required when blockchain is enabled")
        if not settings.issuer_private_key:
            raise RuntimeError("ISSUER_PRIVATE_KEY is required when blockchain is enabled")

        self.w3 = Web3(Web3.HTTPProvider(settings.blockchain_rpc_url))
        if not self.w3.is_connected():
            raise RuntimeError("Unable to connect to blockchain RPC")

        abi_path = Path(__file__).resolve().parents[2] / "abi" / "CertificateRegistry.json"
        self.abi = json.loads(abi_path.read_text(encoding="utf-8"))

        self.contract = self.w3.eth.contract(
            address=Web3.to_checksum_address(settings.blockchain_contract_address),
            abi=self.abi,
        )
        self.account = self.w3.eth.account.from_key(settings.issuer_private_key)

    def register_certificate(self, certificate_id: str, certificate_hash: str) -> dict:
        if not self.enabled:
            raise RuntimeError("Blockchain is disabled")

        hash_bytes = bytes.fromhex(certificate_hash)
        nonce = self.w3.eth.get_transaction_count(self.account.address, "pending")

        tx = self.contract.functions.registerCertificate(
            certificate_id,
            hash_bytes,
        ).build_transaction({
            "from": self.account.address,
            "nonce": nonce,
            "chainId": self.w3.eth.chain_id,
            "gas": 300_000,
            "maxFeePerGas": self.w3.to_wei("50", "gwei"),
            "maxPriorityFeePerGas": self.w3.to_wei("2", "gwei"),
        })

        signed = self.account.sign_transaction(tx)
        tx_hash = self.w3.eth.send_raw_transaction(signed.raw_transaction)
        receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=180)

        if receipt.status != 1:
            raise RuntimeError("Blockchain transaction failed")

        return {
            "transaction_hash": tx_hash.hex(),
            "issuer_address": self.account.address,
            "timestamp": self.get_certificate(certificate_id)["timestamp"],
        }

    def get_certificate(self, certificate_id: str) -> dict:
        if not self.enabled:
            raise RuntimeError("Blockchain is disabled")

        certificate_hash, issuer, timestamp, exists = (
            self.contract.functions.getCertificate(certificate_id).call()
        )

        return {
            "certificate_hash": "0x" + bytes(certificate_hash).hex(),
            "issuer_address": issuer,
            "timestamp": int(timestamp),
            "exists": bool(exists),
        }


blockchain = BlockchainService()
