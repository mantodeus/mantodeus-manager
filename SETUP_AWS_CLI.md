# Setting up AWS CLI for Infomaniak S3

## Step 1: Generate EC2 Credentials

1. Log in to your Infomaniak account: https://www.infomaniak.com
2. Go to **Public Cloud** → Your project (PCP-7LNN6ZO)
3. Navigate to **Access & Security** → **API Access**
4. Find the **EC2 Credentials** section
5. Click **"Create EC2 Credentials"** or **"Download EC2 Credentials"**
6. Copy the **Access Key** and **Secret Key**

## Step 2: Configure AWS CLI

Once you have your EC2 credentials (Access Key ID and Secret Access Key), run:

```bash
aws configure set aws_access_key_id YOUR_ACCESS_KEY_ID --profile infomaniak
aws configure set aws_secret_access_key YOUR_SECRET_ACCESS_KEY --profile infomaniak
```

Or manually edit `C:\Users\Mantodeus\.aws\credentials` and add:

```ini
[infomaniak]
aws_access_key_id = YOUR_ACCESS_KEY_ID
aws_secret_access_key = YOUR_SECRET_ACCESS_KEY
```

## Step 3: Test the Configuration

**Important**: AWS CLI requires the `--endpoint-url` flag for Infomaniak S3. The config file endpoint setting may not work for all commands.

Test your S3 connection:

```bash
aws s3 ls --profile infomaniak --endpoint-url https://s3.pub1.infomaniak.cloud
```

Or list buckets:

```bash
aws s3api list-buckets --profile infomaniak --endpoint-url https://s3.pub1.infomaniak.cloud
```

### Helper Script

For convenience, use the helper script `aws-s3-infomaniak.ps1`:

```powershell
.\aws-s3-infomaniak.ps1 "s3 ls"
.\aws-s3-infomaniak.ps1 "s3api list-buckets"
.\aws-s3-infomaniak.ps1 "s3 cp file.txt s3://bucket-name/"
```

## Configuration Details

- **Profile**: `infomaniak`
- **Region**: `us-east-1` (use this for AWS CLI, even if your OpenStack region is dc3-a)
- **Endpoint**: `https://s3.pub1.infomaniak.cloud` (or `https://s3.pub2.infomaniak.cloud` if your project uses pub2)
- **Config file**: `C:\Users\Mantodeus\.aws\config`
- **Credentials file**: `C:\Users\Mantodeus\.aws\credentials`

## Important Notes

- **S3 Endpoint**: Use `https://s3.pub1.infomaniak.cloud` (or `pub2` if applicable). This is a global endpoint, not region-specific.
- **AWS CLI Region**: Always use `us-east-1` for AWS CLI configuration, regardless of your OpenStack region (dc3-a, dc4-a, etc.)
- **OpenStack Region**: Your OpenStack region (dc3-a) is only used for compute resources, not for S3 configuration

## Alternative: Using Python Script

If you have Python installed, you can use the `generate_ec2_credentials.py` script:

```bash
cd Documents/GitHub/mantodeus-manager
pip install requests pyyaml
python generate_ec2_credentials.py
```

This script will:
1. Authenticate with your OpenStack credentials
2. Generate EC2 credentials automatically
3. Display them for you to add to AWS CLI

