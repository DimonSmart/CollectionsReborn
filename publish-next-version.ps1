param(
    [string] $Remote = "origin",
    [string] $Branch = "main",
    [string] $TagPrefix = "v",
    [string] $FirstVersion = "0.1.0",
    [ValidateSet("patch", "minor", "major")]
    [string] $Bump = "patch",
    [switch] $SkipTests
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$script:VersionFilesModified = $false
$script:ReleaseCommitted = $false

function Invoke-Git {
    param(
        [Parameter(Mandatory = $true)]
        [string[]] $Arguments,
        [switch] $CaptureOutput
    )

    if ($CaptureOutput) {
        $output = & git @Arguments 2>&1
        if ($LASTEXITCODE -ne 0) {
            throw "git $($Arguments -join ' ') failed with exit code $LASTEXITCODE.`n$output"
        }
        return $output
    }

    & git @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "git $($Arguments -join ' ') failed with exit code $LASTEXITCODE."
    }
}

function Invoke-Tool {
    param(
        [Parameter(Mandatory = $true)]
        [string] $Command,
        [Parameter(Mandatory = $true)]
        [string[]] $Arguments
    )

    & $Command @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "$Command $($Arguments -join ' ') failed with exit code $LASTEXITCODE."
    }
}

function Invoke-NodeScript {
    param(
        [Parameter(Mandatory = $true)]
        [string] $Script,
        [string[]] $Arguments = @()
    )

    $scriptPath = [System.IO.Path]::ChangeExtension([System.IO.Path]::GetTempFileName(), ".cjs")
    try {
        [System.IO.File]::WriteAllText($scriptPath, $Script, [System.Text.UTF8Encoding]::new($false))
        $nodeArguments = @($scriptPath) + $Arguments
        Invoke-Tool -Command "node" -Arguments $nodeArguments
    } finally {
        Remove-Item -LiteralPath $scriptPath -Force -ErrorAction SilentlyContinue
    }
}

function Assert-CleanWorkingTree {
    param([string] $Context)

    $status = @(Invoke-Git -Arguments @("status", "--porcelain") -CaptureOutput)
    if ($status.Count -gt 0) {
        throw "Working tree is not clean $Context. Commit, stash, or revert local changes before publishing."
    }
}

function Assert-SemVer {
    param(
        [Parameter(Mandatory = $true)]
        [string] $Version,
        [Parameter(Mandatory = $true)]
        [string] $Name
    )

    if ($Version -notmatch '^\d+\.\d+\.\d+$') {
        throw "$Name must use MAJOR.MINOR.PATCH format. Actual value: $Version"
    }
}

function Get-NextVersion {
    param(
        [Parameter(Mandatory = $true)]
        [string] $Prefix,
        [Parameter(Mandatory = $true)]
        [string] $InitialVersion,
        [Parameter(Mandatory = $true)]
        [string] $BumpKind
    )

    Assert-SemVer -Version $InitialVersion -Name "FirstVersion"

    $escapedPrefix = [regex]::Escape($Prefix)
    $tagPattern = "^$escapedPrefix(?<major>\d+)\.(?<minor>\d+)\.(?<patch>\d+)$"
    $tags = @(Invoke-Git -Arguments @("tag", "--list", "$Prefix*") -CaptureOutput)
    $versions = @()

    foreach ($tag in $tags) {
        if ($tag -match $tagPattern) {
            $versions += [version]::new([int] $Matches.major, [int] $Matches.minor, [int] $Matches.patch)
        }
    }

    if ($versions.Count -eq 0) {
        return $InitialVersion
    }

    $latest = $versions | Sort-Object -Descending | Select-Object -First 1
    switch ($BumpKind) {
        "patch" { return "$($latest.Major).$($latest.Minor).$($latest.Build + 1)" }
        "minor" { return "$($latest.Major).$($latest.Minor + 1).0" }
        "major" { return "$($latest.Major + 1).0.0" }
        default { throw "Unsupported bump kind: $BumpKind" }
    }
}

function Test-GitTagExists {
    param([Parameter(Mandatory = $true)][string] $TagName)

    & git rev-parse -q --verify "refs/tags/$TagName" *> $null
    if ($LASTEXITCODE -eq 0) {
        return $true
    }
    if ($LASTEXITCODE -eq 1) {
        return $false
    }
    throw "git rev-parse failed while checking tag $TagName."
}

function Update-VersionFiles {
    param([Parameter(Mandatory = $true)][string] $Version)

    Invoke-NodeScript -Arguments @($Version) -Script @'
const fs = require('node:fs');

const version = process.argv[2];

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, 'utf8'));
}

function writeJson(path, value) {
  fs.writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function requireProperty(value, property, path) {
  if (!Object.prototype.hasOwnProperty.call(value, property)) {
    throw new Error(`${path} must contain '${property}'.`);
  }
}

const packageJson = readJson('package.json');
const manifestJson = readJson('manifest.json');

requireProperty(packageJson, 'version', 'package.json');
requireProperty(manifestJson, 'version', 'manifest.json');

packageJson.version = version;
manifestJson.version = version;

writeJson('package.json', packageJson);
writeJson('manifest.json', manifestJson);

if (fs.existsSync('package-lock.json')) {
  const packageLockJson = readJson('package-lock.json');

  if (Object.prototype.hasOwnProperty.call(packageLockJson, 'version')) {
    packageLockJson.version = version;
  }

  const rootPackage = packageLockJson.packages?.[''];
  if (rootPackage && Object.prototype.hasOwnProperty.call(rootPackage, 'version')) {
    rootPackage.version = version;
  }

  writeJson('package-lock.json', packageLockJson);
}
'@

    $script:VersionFilesModified = $true
}

function Assert-VersionFiles {
    param([Parameter(Mandatory = $true)][string] $Version)

    Invoke-NodeScript -Arguments @($Version) -Script @'
const fs = require('node:fs');

const version = process.argv[2];

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, 'utf8'));
}

function requireVersion(path, actual) {
  if (actual !== version) {
    throw new Error(`${path} version does not equal ${version}.`);
  }
}

const packageJson = readJson('package.json');
const manifestJson = readJson('manifest.json');

requireVersion('package.json', packageJson.version);
requireVersion('manifest.json', manifestJson.version);

if (fs.existsSync('package-lock.json')) {
  const packageLockJson = readJson('package-lock.json');

  if (Object.prototype.hasOwnProperty.call(packageLockJson, 'version')) {
    requireVersion('package-lock.json top-level', packageLockJson.version);
  }

  const rootPackage = packageLockJson.packages?.[''];
  if (rootPackage && Object.prototype.hasOwnProperty.call(rootPackage, 'version')) {
    requireVersion("package-lock.json packages['']", rootPackage.version);
  }
}
'@
}

try {
    Get-Command git | Out-Null

    $repoRoot = Invoke-Git -Arguments @("rev-parse", "--show-toplevel") -CaptureOutput | Select-Object -First 1
    Set-Location $repoRoot

    Assert-CleanWorkingTree -Context "before publishing"

    Invoke-Git -Arguments @("fetch", "--prune", "--tags", $Remote)
    Invoke-Git -Arguments @("switch", $Branch)
    Invoke-Git -Arguments @("pull", "--ff-only", $Remote, $Branch)

    Assert-CleanWorkingTree -Context "after pulling $Remote/$Branch"

    $nextVersion = Get-NextVersion -Prefix $TagPrefix -InitialVersion $FirstVersion -BumpKind $Bump
    $tagName = "$TagPrefix$nextVersion"
    $releaseTitle = "Release $tagName"

    if (Test-GitTagExists -TagName $tagName) {
        throw "Tag already exists: $tagName"
    }

    Update-VersionFiles -Version $nextVersion
    Assert-VersionFiles -Version $nextVersion

    Invoke-Git -Arguments @("add", "--", "package.json", "manifest.json", "package-lock.json")

    $stagedFiles = @(Invoke-Git -Arguments @("diff", "--cached", "--name-only", "--", "package.json", "manifest.json", "package-lock.json") -CaptureOutput)
    if ($stagedFiles.Count -eq 0) {
        throw "No version file changes found for $tagName. Existing files may already be at $nextVersion; create the baseline tag manually or pass -FirstVersion with a higher version."
    }

    if ($SkipTests) {
        Invoke-Tool -Command "npm" -Arguments @("ci")
        Invoke-Tool -Command "npm" -Arguments @("run", "check")
        Invoke-Tool -Command "npm" -Arguments @("run", "verify:store-assets")
        Invoke-Tool -Command "node" -Arguments @("scripts/package-extension.mjs")
    } else {
        Invoke-Tool -Command "npm" -Arguments @("ci")
        Invoke-Tool -Command "npm" -Arguments @("run", "package")
    }

    $currentBranch = Invoke-Git -Arguments @("branch", "--show-current") -CaptureOutput | Select-Object -First 1
    if ($currentBranch -ne $Branch) {
        throw "Current branch is '$currentBranch', expected '$Branch'."
    }

    if (Test-GitTagExists -TagName $tagName) {
        throw "Tag already exists: $tagName"
    }

    Invoke-Git -Arguments @("commit", "-m", $releaseTitle)
    $script:ReleaseCommitted = $true

    Invoke-Git -Arguments @("tag", "-a", $tagName, "-m", $releaseTitle)
    Invoke-Git -Arguments @("push", $Remote, $Branch, $tagName)

    Write-Host "Published $tagName."
    Write-Host "GitHub Actions will create the GitHub Release and attach release/collections-reborn-$nextVersion.zip."
} catch {
    if ($script:VersionFilesModified -and -not $script:ReleaseCommitted) {
        [Console]::Error.WriteLine("Publishing failed after version files were modified. Review or revert package.json, manifest.json, and package-lock.json manually.")
    }
    [Console]::Error.WriteLine($_.Exception.Message)
    if ($_.ScriptStackTrace) {
        [Console]::Error.WriteLine($_.ScriptStackTrace)
    }
    exit 1
}
