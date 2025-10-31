# Final Submission Checklist

## ✅ Completed

- [x] All 10 agents implemented
- [x] Combined x402 server ready (`x402-server/index.ts`)
- [x] All submission files updated with:
  - [x] Solana wallet: `Dp3jTty3X9tcRjBK7gbaFGvbYd1EB357rRuhR5FmexX1`
  - [x] Deployment URLs: `https://x402.haxters.com/{agent-path}`

## 📋 What You Need to Do

### 1. Deploy Server (On Your Server)

```bash
# Push code to server (or use git pull)
cd /path/to/x402-server
npm install
PORT=3005 npm start
```

### 2. Configure Domain

- Ensure `x402.haxters.com` points to your server
- Configure SSL/HTTPS
- Set up reverse proxy (nginx/caddy) to forward to `localhost:3005`
- Configure x402 protocol access

### 3. Verify Deployment

Test endpoints:
- `https://x402.haxters.com/` (should show agent list)
- `https://x402.haxters.com/fresh-markets-watch/entrypoints/scan_new_pairs/invoke`
- Test at least one agent to confirm it works

### 4. Create 10 Pull Requests

For each bounty, create a PR:
1. Go to: https://github.com/daydreamsai/agent-bounties
2. Click "New Pull Request"
3. Use template from `.github/PULL_REQUEST_TEMPLATE.md`
4. Link to the issue (e.g., `Closes #1`)
5. Include submission file path
6. Check all acceptance criteria

## 🎯 Quick PR Template

For each PR:

```markdown
## Bounty Submission

**Related Issue:** #X

## Submission File

**File Path:** `submissions/[agent-name].md`

## Live Link

**Deployment URL:** https://x402.haxters.com/[agent-path]

## Acceptance Criteria

- [x] Meets all technical specifications
- [x] Deployed on a domain
- [x] Reachable via x402
- [x] All acceptance criteria from issue met
- [x] Submission file added

## Solana Wallet

**Wallet Address:** Dp3jTty3X9tcRjBK7gbaFGvbYd1EB357rRuhR5FmexX1
```

## 📝 Notes

- Submit PRs quickly (first-come, first-served)
- All submission files are ready in `submissions/` directory
- Deployment URLs assume x402.haxters.com is live
- If domain differs, update submission files before PRs

