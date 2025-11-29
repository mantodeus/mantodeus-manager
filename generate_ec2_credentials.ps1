# PowerShell script to generate EC2 credentials from Infomaniak OpenStack
# These credentials can be used as S3 Access Key ID and Secret Access Key

$OS_AUTH_URL = "https://api.pub1.infomaniak.cloud/identity/v3"
$OS_PROJECT_NAME = "PCP-7LNN6ZO"
$OS_PROJECT_DOMAIN_NAME = "default"
$OS_USERNAME = "PCU-7LNN6ZO"
$OS_USER_DOMAIN_NAME = "default"
$OS_PROJECT_ID = "b45e6f3c29a34aa6b99cea829122a734"
$OS_REGION_NAME = "dc3-a"

Write-Host "Infomaniak OpenStack EC2 Credentials Generator" -ForegroundColor Cyan
Write-Host ("=" * 50)
Write-Host "Project: $OS_PROJECT_NAME"
Write-Host "Region: $OS_REGION_NAME"
Write-Host "Username: $OS_USERNAME"
Write-Host ""

# Get password securely
$securePassword = Read-Host "Enter your OpenStack password" -AsSecureString
$password = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
)

# Step 1: Authenticate and get token
Write-Host "`nAuthenticating..." -ForegroundColor Yellow

$authBody = @{
    auth = @{
        identity = @{
            methods = @("password")
            password = @{
                user = @{
                    name = $OS_USERNAME
                    domain = @{
                        name = $OS_USER_DOMAIN_NAME
                    }
                    password = $password
                }
            }
        }
        scope = @{
            project = @{
                id = $OS_PROJECT_ID
                domain = @{
                    name = $OS_PROJECT_DOMAIN_NAME
                }
            }
        }
    }
} | ConvertTo-Json -Depth 10

try {
    # Use Invoke-WebRequest to get headers (token is in response headers)
    $authResponseFull = Invoke-WebRequest -Uri "$OS_AUTH_URL/auth/tokens" `
        -Method Post `
        -Body $authBody `
        -ContentType "application/json" `
        -ErrorAction Stop
    
    $token = $authResponseFull.Headers.'X-Subject-Token'
    $tokenData = $authResponseFull.Content | ConvertFrom-Json
    $userId = $tokenData.token.user.id
    
    Write-Host "[OK] Authentication successful!" -ForegroundColor Green
    Write-Host "User ID: $userId"
    Write-Host ""
    
} catch {
    Write-Host "[ERROR] Authentication failed!" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        Write-Host "Details: $($_.ErrorDetails.Message)" -ForegroundColor Red
    }
    exit 1
}

# Step 2: Check existing EC2 credentials
Write-Host "Checking existing EC2 credentials..." -ForegroundColor Yellow

try {
    $listResponse = Invoke-RestMethod -Uri "$OS_AUTH_URL/users/$userId/credentials/OS-EC2" `
        -Method Get `
        -Headers @{
            "X-Auth-Token" = $token
        } `
        -ErrorAction Stop
    
    $existingCreds = $listResponse.credentials
    
    if ($existingCreds -and $existingCreds.Count -gt 0) {
        Write-Host "Found $($existingCreds.Count) existing EC2 credential(s):" -ForegroundColor Yellow
        foreach ($cred in $existingCreds) {
            Write-Host "  - Access Key: $($cred.access)"
        }
        Write-Host ""
        $createNew = Read-Host "Create new credentials? (y/n)"
        if ($createNew -ne "y") {
            Write-Host "`nUsing existing credentials:" -ForegroundColor Cyan
            $cred = $existingCreds[0]
            Write-Host "Access Key ID: $($cred.access)" -ForegroundColor Green
            Write-Host "Secret Access Key: $($cred.secret)" -ForegroundColor Green
            Write-Host "`nAdd these to ~/.aws/credentials under [infomaniak] profile" -ForegroundColor Yellow
            exit 0
        }
    }
} catch {
    Write-Host "Note: Could not list existing credentials (this is okay)" -ForegroundColor Yellow
    Write-Host ""
}

# Step 3: Create new EC2 credentials
Write-Host "Creating new EC2 credentials..." -ForegroundColor Yellow

$ec2Body = @{
    tenant_id = $OS_PROJECT_ID
} | ConvertTo-Json

try {
    $ec2Response = Invoke-RestMethod -Uri "$OS_AUTH_URL/users/$userId/credentials/OS-EC2" `
        -Method Post `
        -Body $ec2Body `
        -ContentType "application/json" `
        -Headers @{
            "X-Auth-Token" = $token
        } `
        -ErrorAction Stop
    
    $credential = $ec2Response.credential
    
    Write-Host "`n[OK] EC2 credentials created successfully!" -ForegroundColor Green
    Write-Host ("=" * 50)
    Write-Host "`nAdd these to your AWS CLI credentials file:" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Access Key ID: $($credential.access)" -ForegroundColor Green
    Write-Host "Secret Access Key: $($credential.secret)" -ForegroundColor Green
    Write-Host ""
    Write-Host "These can be used as S3 credentials for Infomaniak Object Storage." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "To update ~/.aws/credentials automatically, run:" -ForegroundColor Cyan
    Write-Host "  aws configure set aws_access_key_id $($credential.access) --profile infomaniak" -ForegroundColor White
    Write-Host "  aws configure set aws_secret_access_key $($credential.secret) --profile infomaniak" -ForegroundColor White
    
    # Offer to update credentials automatically
    $updateNow = Read-Host "`nUpdate AWS CLI credentials now? (y/n)"
    if ($updateNow -eq "y") {
        Write-Host "`nUpdating AWS CLI credentials..." -ForegroundColor Yellow
        aws configure set aws_access_key_id $($credential.access) --profile infomaniak
        aws configure set aws_secret_access_key $($credential.secret) --profile infomaniak
        Write-Host "[OK] Credentials updated successfully!" -ForegroundColor Green
        Write-Host "`nTest the configuration with:" -ForegroundColor Cyan
        Write-Host "  aws s3 ls --profile infomaniak" -ForegroundColor White
    }
    
} catch {
    Write-Host "[ERROR] Failed to create EC2 credentials!" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        Write-Host "Details: $($_.ErrorDetails.Message)" -ForegroundColor Red
    }
    exit 1
}

