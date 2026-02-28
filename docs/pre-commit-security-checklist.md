# Pre-Commit Security Checklist
**Date:** November 7, 2024

## ✅ Files Verified Safe for Git

### Excluded Files (via .gitignore):
- ✅ `.env` and all `.env.*` files
- ✅ `data/` directory (contains user data)
- ✅ `security-logs/` directory
- ✅ `ARCHIVE/` directory (may contain old code)
- ✅ All `*.backup*` files
- ✅ `node_modules/` directory
- ✅ All `*.log` files
- ✅ IDE files (`.vscode/`, `.idea/`, etc.)
- ✅ Cache directories (`.cache/`, `.cursor-server/`)

### Files Safe to Commit:
- ✅ `server.js` - No hardcoded secrets (uses environment variables)
- ✅ `config.js` - Only placeholder values
- ✅ `package.json` / `package-lock.json` - Standard dependencies
- ✅ `docs/` - Documentation files
- ✅ `views/` - EJS templates
- ✅ `public/` - Public assets
- ✅ `.gitignore` - Properly configured

## 🔍 Security Verification Steps

### 1. Environment Variables
- ✅ All secrets stored in `.env` file (excluded from git)
- ✅ No hardcoded API keys in source code
- ✅ No hardcoded tokens in source code
- ✅ No hardcoded passwords in source code

### 2. Backup Files
- ✅ All `*.backup*` files excluded via `.gitignore`
- ✅ Backup files in `data/` directory excluded
- ✅ No backup files in root directory

### 3. Sensitive Data
- ✅ User data in `data/` directory excluded
- ✅ Security logs excluded
- ✅ Archive directory excluded

### 4. Code Review
- ✅ No Postmark tokens hardcoded
- ✅ No Twilio credentials hardcoded
- ✅ No Stripe keys hardcoded
- ✅ No JWT secrets hardcoded
- ✅ No OpenAI API keys hardcoded

## ⚠️ Before Pushing to Git

1. **Verify .gitignore is working:**
   ```bash
   git status --ignored
   ```

2. **Check for any tracked sensitive files:**
   ```bash
   git ls-files | grep -E "\.env|\.backup|data/|security-logs"
   ```

3. **Verify no secrets in tracked files:**
   ```bash
   git grep -i "password.*=.*['\"]" -- ':!*.md' ':!docs/*'
   git grep -i "secret.*=.*['\"]" -- ':!*.md' ':!docs/*'
   git grep -i "token.*=.*['\"]" -- ':!*.md' ':!docs/*'
   ```

4. **Check git history (if repository exists):**
   ```bash
   git log --all --full-history --source -- "*backup*" "*env*"
   ```

## 📋 Final Checklist

- [ ] `.env` file exists and is NOT tracked by git
- [ ] All backup files are excluded
- [ ] `data/` directory is excluded
- [ ] `ARCHIVE/` directory is excluded
- [ ] No hardcoded secrets in source code
- [ ] `.gitignore` is up to date
- [ ] Security reports don't contain actual tokens (only examples)

## 🚨 If Secrets Were Ever Committed

If you find that secrets were previously committed to git:

1. **Rotate all exposed secrets immediately:**
   - Postmark Account Token
   - Postmark Server Token
   - Twilio Auth Token
   - Stripe Secret Key
   - JWT Secret
   - OpenAI API Key
   - Any other exposed credentials

2. **Remove from git history:**
   ```bash
   git filter-branch --force --index-filter \
     "git rm --cached --ignore-unmatch .env server.js.backup_*" \
     --prune-empty --tag-name-filter cat -- --all
   ```

3. **Force push (coordinate with team):**
   ```bash
   git push origin --force --all
   ```

## ✅ Ready to Push

If all checks pass, the repository is safe to push to git.

