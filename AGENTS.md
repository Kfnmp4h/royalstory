# Delivery rules

- Treat `origin/main` at `https://github.com/Kfnmp4h/royalstory.git` as the canonical project version.
- After every verified, user-facing change, create a Git commit and push it to GitHub before reporting the change as delivered.
- Do not leave implementation, documentation, assets, or configuration as local-only work.
- Verify the working tree is clean and the local branch tracks `origin/main` after each push.
- Never store credentials, access tokens, or private user data in the repository.
- Game state must not use local persistence such as `localStorage`, `sessionStorage`, `IndexedDB`, cookies, or filesystem saves unless the user explicitly changes that product requirement.
