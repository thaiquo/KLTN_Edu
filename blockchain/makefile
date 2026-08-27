SHELL := bash

-include .env

FOUNDRY := $(HOME)/.foundry/bin
FORGE := $(if $(wildcard $(FOUNDRY)/forge),$(FOUNDRY)/forge,forge)
ANVIL := $(if $(wildcard $(FOUNDRY)/anvil),$(FOUNDRY)/anvil,anvil)

SCRIPT := script/DeployEduConnectEscrow.s.sol:DeployEduConnectEscrow
LOCAL_RPC_URL ?= http://127.0.0.1:8545
ANVIL_PLATFORM ?= 0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266

.PHONY: fmt fmt-check build test coverage gas-report export-abi check anvil deploy-anvil check-sepolia deploy-sepolia

fmt:
	$(FORGE) fmt

fmt-check:
	$(FORGE) fmt --check

build:
	$(FORGE) build

test:
	$(FORGE) test -vvv

coverage:
	$(FORGE) coverage --report summary

gas-report:
	$(FORGE) test --gas-report

export-abi:
	./scripts/export-abi.sh

check: fmt-check build test

anvil:
	$(ANVIL) --silent --port 8545

deploy-anvil: check
	$(FORGE) script $(SCRIPT) \
		--rpc-url "$(LOCAL_RPC_URL)" \
		--sender "$(ANVIL_PLATFORM)" \
		--unlocked \
		--broadcast \
		-vvv

check-sepolia:
	@test -n "$(SEPOLIA_RPC_URL)" || (echo "Missing SEPOLIA_RPC_URL" && exit 1)
	@test -n "$(ACCOUNT)" || (echo "Missing Foundry keystore ACCOUNT" && exit 1)
	@test -n "$(PLATFORM_WALLET)" || (echo "Missing PLATFORM_WALLET" && exit 1)
	@test -n "$(ADMIN_WALLET)" || (echo "Missing ADMIN_WALLET" && exit 1)
	@test -n "$(ETHERSCAN_API_KEY)" || (echo "Missing ETHERSCAN_API_KEY" && exit 1)

deploy-sepolia: check check-sepolia
	$(FORGE) script $(SCRIPT) \
		--rpc-url "$(SEPOLIA_RPC_URL)" \
		--account "$(ACCOUNT)" \
		--broadcast \
		--verify \
		--etherscan-api-key "$(ETHERSCAN_API_KEY)" \
		-vvv
