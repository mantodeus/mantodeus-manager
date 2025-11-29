# Helper script for AWS S3 commands with Infomaniak
# Usage: .\aws-s3-infomaniak.ps1 <aws-s3-command>
# Example: .\aws-s3-infomaniak.ps1 "s3 ls"
# Example: .\aws-s3-infomaniak.ps1 "s3api list-buckets"

param(
    [Parameter(Mandatory=$true)]
    [string]$Command
)

$endpoint = "https://s3.pub1.infomaniak.cloud"
$profile = "infomaniak"

# Split the command into parts
$parts = $Command -split '\s+'
$awsCmd = $parts[0]
$args = $parts[1..($parts.Length-1)] -join ' '

# Build the full command
$fullCommand = "aws $awsCmd $args --profile $profile --endpoint-url $endpoint"

Write-Host "Running: $fullCommand" -ForegroundColor Cyan
Invoke-Expression $fullCommand

