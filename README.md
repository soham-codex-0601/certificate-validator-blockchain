# CertiChain

Blockchain-backed certificate verification.

## Structure

- `frontend/` — public verifier UI
- `backend/` — FastAPI API
- `backend/contracts/` — Solidity registry
- `backend/abi/` — deployed contract ABI

## Quick start

1. Copy `backend/.env.example` to `backend/.env`.
2. Set `JWT_SECRET_KEY`.
3. Install `backend/requirements.txt`.
4. Start FastAPI:
   `uvicorn app.main:app --reload` from `backend/`.
5. Open `frontend/index.html` with a local static server.
6. Configure a blockchain RPC, deployed contract address and server-side issuer wallet before using certificate issuance.

The application intentionally does not treat a database record alone as proof of authenticity: verification checks the blockchain record and compares the certificate hash.
