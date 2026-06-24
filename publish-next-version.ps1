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

function Read-JsonFile {
    param([Parameter(Mandatory = $true)][string] $Path)
    return Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
}

function Write-JsonFile {
    param(
        [Parameter(Mandatory = $true)]
        [string] $Path,
        [Parameter(Mandatory = $true)]
        [object] $Json
    )

    $content = $Json | ConvertTo-Json -Depth 100
    $resolvedPath = (Resolve-Path -LiteralPath $Path).Path
    [System.IO.File]::WriteAllText($resolvedPath, "$content`n", [System.Text.UTF8Encoding]::new($false))
}

function Get-RequiredJsonProperty {
    param(
        [Parameter(Mandatory = $true)]
        [object] $Object,
        [Parameter(Mandatory = $true)]
        [string] $Name,
        [Parameter(Mandatory = $true)]
        [string] $Path
    )

    $property = $Object.PSObject.Properties[$Name]
    if ($null -eq $property) {
        throw "$Path must contain '$Name'."
    }
    return $property
}

function Set-RequiredJsonProperty {
    param(
        [Parameter(Mandatory = $true)]
        [object] $Object,
        [Parameter(Mandatory = $true)]
        [string] $Name,
        [Parameter(Mandatory = $true)]
        [string] $Value,
        [Parameter(Mandatory = $true)]
        [string] $Path
    )

    $property = Get-RequiredJsonProperty -Object $Object -Name $Name -Path $Path
    $property.Value = $Value
}

function Test-JsonProperty {
    param(
        [Parameter(Mandatory = $true)]
        [object] $Object,
        [Parameter(Mandatory = $true)]
        [string] $Name
    )

    return $null -ne $Object.PSObject.Properties[$Name]
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

    $packageJson = Read-JsonFile -Path "package.json"
    $manifestJson = Read-JsonFile -Path "manifest.json"

    Set-RequiredJsonProperty -Object $packageJson -Name "version" -Value $Version -Path "package.json"
    Set-RequiredJsonProperty -Object $manifestJson -Name "version" -Value $Version -Path "manifest.json"

    Write-JsonFile -Path "package.json" -Json $packageJson
    Write-JsonFile -Path "manifest.json" -Json $manifestJson

    if (Test-Path -LiteralPath "package-lock.json") {
        $packageLockJson = Read-JsonFile -Path "package-lock.json"
        if (Test-JsonProperty -Object $packageLockJson -Name "version") {
            $packageLockJson.PSObject.Properties["version"].Value = $Version
        }

        if (Test-JsonProperty -Object $packageLockJson -Name "packages") {
            $rootPackageProperty = $packageLockJson.packages.PSObject.Properties[""]
            if ($null -ne $rootPackageProperty -and (Test-JsonProperty -Object $rootPackageProperty.Value -Name "version")) {
                $rootPackageProperty.Value.PSObject.Properties["version"].Value = $Version
            }
        }

        Write-JsonFile -Path "package-lock.json" -Json $packageLockJson
    }

    $script:VersionFilesModified = $true
}

function Assert-VersionFiles {
    param([Parameter(Mandatory = $true)][string] $Version)

    $packageJson = Read-JsonFile -Path "package.json"
    $manifestJson = Read-JsonFile -Path "manifest.json"

    if ((Get-RequiredJsonProperty -Object $packageJson -Name "version" -Path "package.json").Value -ne $Version) {
        throw "package.json version does not equal $Version."
    }
    if ((Get-RequiredJsonProperty -Object $manifestJson -Name "version" -Path "manifest.json").Value -ne $Version) {
        throw "manifest.json version does not equal $Version."
    }

    if (Test-Path -LiteralPath "package-lock.json") {
        $packageLockJson = Read-JsonFile -Path "package-lock.json"
        if ((Test-JsonProperty -Object $packageLockJson -Name "version") -and $packageLockJson.PSObject.Properties["version"].Value -ne $Version) {
            throw "package-lock.json top-level version does not equal $Version."
        }

        if (Test-JsonProperty -Object $packageLockJson -Name "packages") {
            $rootPackageProperty = $packageLockJson.packages.PSObject.Properties[""]
            if (($null -ne $rootPackageProperty) -and (Test-JsonProperty -Object $rootPackageProperty.Value -Name "version") -and $rootPackageProperty.Value.PSObject.Properties["version"].Value -ne $Version) {
                throw "package-lock.json packages[''].version does not equal $Version."
            }
        }
    }
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

    Invoke-Git -Arguments @("add", "--", "package.json", "manifest.json", "package-lock.json")

    $stagedFiles = @(Invoke-Git -Arguments @("diff", "--cached", "--name-only", "--", "package.json", "manifest.json", "package-lock.json") -CaptureOutput)
    if ($stagedFiles.Count -eq 0) {
        throw "No staged version changes found."
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
    exit 1
}
