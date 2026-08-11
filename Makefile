.PHONY: dev install provision redeploy

# Local development — runs backend + frontend in parallel
dev:
	@echo "Starting backend on :3001 and frontend on :5173..."
	@(cd backend && npm run dev) & (cd frontend && npm run dev) & wait

install:
	cd backend && npm install
	cd frontend && npm install

# Provision a new Linode VM and deploy the app to it.
# Required env vars: LINODE_TOKEN, ROOT_PASS
# Optional: REGION, TYPE, IMAGE, LABEL
provision:
	@test -n "$$LINODE_TOKEN" || (echo "ERROR: Set LINODE_TOKEN" && exit 1)
	@test -n "$$ROOT_PASS"    || (echo "ERROR: Set ROOT_PASS" && exit 1)
	bash deploy/provision-vm.sh

# Push code updates to an already-running VM.
# Required: SERVER_IP
redeploy:
	@test -n "$$SERVER_IP" || (echo "ERROR: Set SERVER_IP" && exit 1)
	bash deploy/redeploy.sh
