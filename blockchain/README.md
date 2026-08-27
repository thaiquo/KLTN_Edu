# EDUCONNECT Blockchain

Foundry workspace for the EDUCONNECT V1 master USDC escrow.

## Baseline

```text
Foundry: 1.7.1
Solidity: 0.8.36
OpenZeppelin Contracts: 5.7.0
Networks: Anvil 31337, Ethereum Sepolia 11155111
```

The project deploys one `EduConnectEscrow` contract that manages many isolated
agreement IDs. Phase P2 implements agreement registration, exact USDC funding,
per-session settlement, disputes, expiration, cancellation/refund, roles and
emergency pause behavior. P3 has been deployed and exercised on an ephemeral
local Anvil chain only; no Sepolia contract has been deployed.

## Prerequisites on Windows

Use Git Bash and add Foundry to the current shell when necessary:

```bash
export PATH="$PATH:$HOME/.foundry/bin"
forge --version
```

## Commands

```bash
cd blockchain
forge fmt --check
forge lint
forge build
forge test -vvv
forge coverage --report summary
forge test --gas-report
./scripts/export-abi.sh
make check
make export-abi
```

## Reproduce the P3 local deployment

Use two Git Bash terminals. This flow uses Anvil's unlocked local accounts, so
no private key or `.env` value is required.

Terminal 1:

```bash
cd blockchain
anvil --silent --port 8545
```

Terminal 2, against a freshly started default Anvil instance:

```bash
cd blockchain
export LOCAL_RPC_URL="http://127.0.0.1:8545"
export ANVIL_PLATFORM="0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266"

cast chain-id --rpc-url "$LOCAL_RPC_URL"
forge script script/DeployEduConnectEscrow.s.sol:DeployEduConnectEscrow \
  --rpc-url "$LOCAL_RPC_URL" \
  --sender "$ANVIL_PLATFORM" \
  --unlocked \
  --broadcast \
  -vvv
```

The command must print chain ID `31337`, the mock token address, and the escrow
address. Public addresses and the manually validated register/fund/settlement/
dispute transaction hashes are recorded in
`deployments/anvil-31337.json` and `deployments/anvil-p3-evidence.md`.

An unlocked local transaction follows this pattern:

```bash
cast send "$ESCROW_ADDRESS" \
  "fundAgreement(bytes32)" "$AGREEMENT_ID" \
  --from "$ANVIL_STUDENT" \
  --unlocked \
  --rpc-url "$LOCAL_RPC_URL"
```

For a 24-hour settlement window on Anvil only:

```bash
cast rpc evm_increaseTime 86401 --rpc-url "$LOCAL_RPC_URL"
cast rpc evm_mine --rpc-url "$LOCAL_RPC_URL"
```

Restarting Anvil resets all local addresses, transactions, token balances, and
contract state. Never copy these local addresses into Sepolia configuration.

## Reference command notes

- `forge compile` is an alias of `forge build`; this project uses `forge build`.
- `forge create` can deploy one contract, but EDUCONNECT uses the Solidity
  deployment script because local and Sepolia need different token handling.
- A deployment is only sent to a chain with `--broadcast`; without it, Forge
  performs a dry run.
- The keystore option is `--account`, not `--acount`.
- `source .env` affects only the current Git Bash terminal.
- Alchemy is an RPC provider; it does not hold funds or private keys and cannot
  make Sepolia blocks confirm faster.
- Verification can use Etherscan or Sourcify. A verification failure does not
  invalidate an already successful deployment.
- Chainlink is intentionally excluded from V1 because each agreement already
  stores a fixed USDC amount.

Do not deploy to Sepolia before the Solidity, invariant, Anvil, backend, and
local end-to-end checkpoints pass.

The lowercase `makefile` contains safe local targets and a gated Sepolia target.
It never contains a private key. `make deploy-anvil` uses only Anvil's unlocked
local account; `make deploy-sepolia` requires a Foundry keystore `ACCOUNT` and
runtime environment values.
