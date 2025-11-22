# Fork Development Guide

## Building & Testing Your Fork

This fork includes enhanced diagnostics for Toggl API v9 connectivity issues. Changes won't affect the upstream repository.

### Quick Local Testing

```powershell
# Build and install directly to your Obsidian vault
npm run build:local
```

This builds the plugin and copies it to:
```
OneDrive - CAZ Consulting\Documents\Obsidian Notes Home\Work-Notes\.obsidian\plugins\obsidian-toggl-integration-zavala-fork\
```

Then in Obsidian:
1. Open Settings → Community Plugins
2. Reload plugins (or restart Obsidian)
3. Enable "Toggl Track (Zavala Fork)"
4. Open Developer Console (Ctrl+Shift+I)
5. Look for `[toggl]` log messages

**Note:** This installs as a separate plugin, so you can keep the original installed for comparison.

### Creating Test Releases (GitHub Actions)

#### Option 1: Manual Trigger (Easiest)
1. Go to your fork's GitHub → Actions tab
2. Select "Build Test Release (Fork)" workflow
3. Click "Run workflow"
4. Enter a version tag like `test-0.11.1-fix`
5. Click "Run workflow" button
6. Wait ~2 minutes for build to complete
7. Go to Releases → find the new draft release
8. Review and publish

#### Option 2: Git Tag (Automated)
```powershell
# Create a test tag (prefix with 'test-' or 'fork-')
git tag test-0.11.1-connectivity-fix
git push origin test-0.11.1-connectivity-fix
```

The workflow will automatically build and create a draft release.

### Installing Test Releases

Download `obsidian-toggl-integration-fork.zip` from the GitHub release:

```powershell
# Extract to your vault's plugins directory
# Example path:
$pluginPath = "$env:USERPROFILE\OneDrive - CAZ Consulting\Documents\Obsidian Notes Home\Work-Notes\.obsidian\plugins"
Expand-Archive -Path obsidian-toggl-integration-fork.zip -DestinationPath $pluginPath -Force
```

Or manually:
1. Download the zip
2. Extract to `.obsidian/plugins/` in your vault
3. Reload Obsidian
4. Enable the plugin

### Environment Variables (Optional)

Set `OBSIDIAN_VAULT_PATH` to override the default vault location for `npm run build:local`:

```powershell
$env:OBSIDIAN_VAULT_PATH = "C:\My Custom Path\Vault"
npm run build:local
```

### Debugging Toggl API Issues

After enabling the fork plugin, check the console for diagnostic logs:

```
[toggl] primary client connection failed ...
[toggl] fallback v9 /me succeeded; library may be outdated for workspaces endpoint.
```

Common scenarios:
- **Fallback succeeds** → `toggl-client` library needs upgrade or baseUrl override
- **Both fail with 401** → API token invalid/expired
- **Both fail with network error** → Firewall blocking `api.track.toggl.com`
- **workspaces.list() works** → Connection restored (check for updated library version)

### Keeping Fork in Sync with Upstream

```powershell
# Add upstream remote (one-time)
git remote add upstream https://github.com/mcndt/obsidian-toggl-integration.git

# Fetch upstream changes
git fetch upstream

# Merge upstream main into your fork
git checkout main
git merge upstream/main

# Push to your fork
git push origin main
```

### Contribution Guidelines

If your fixes prove stable:
1. Document the changes clearly
2. Create a pull request to upstream (mcndt/obsidian-toggl-integration)
3. Reference any related issues about v9 API compatibility
4. Include console log examples showing the fix working

### Differences from Upstream

**manifest.json:**
- `id`: `obsidian-toggl-integration-zavala-fork` (allows side-by-side installation)
- `name`: "Toggl Track (Zavala Fork)"
- `author`: Credits both original author and fork maintainer

**lib/toggl/ApiManager.ts:**
- Added `_rawToken` storage
- Added `_fallbackDirectPing()` method for v9 endpoint testing
- Enhanced error logging with `[toggl]` prefix
- Typed error handlers to satisfy TypeScript strict mode

**GitHub Actions:**
- New `test-release.yml` workflow
- Triggers on `test-*` or `fork-*` tags (won't conflict with upstream releases)
- Creates draft prerelease for review before publishing
- Uses separate plugin name in zip artifact

### Rollback to Official Plugin

If you want to revert to the official plugin:

1. Disable "Toggl Track (Zavala Fork)" in Obsidian settings
2. Delete the fork plugin folder:
   ```powershell
   Remove-Item -Recurse -Force ".obsidian\plugins\obsidian-toggl-integration-zavala-fork"
   ```
3. Enable the official "Toggl Track" plugin (if still installed)
4. Or reinstall official version from Obsidian Community Plugins

---

## Quick Command Reference

```powershell
# Local development cycle
npm install          # First time setup
npm run build:local  # Build and install to vault
# (Reload Obsidian plugins)

# Create test release
git tag test-0.11.1-myfix
git push origin test-0.11.1-myfix
# (Check GitHub Actions → Releases)

# Sync with upstream
git fetch upstream
git merge upstream/main
git push origin main
```
