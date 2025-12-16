# S3 Environment Variables Setup

## Current Configuration

Your EC2 credentials have been generated and are ready to use:

- **Access Key ID**: `ba794c9e6d034ccc9ac0bb2d3aa55b1b`
- **Secret Access Key**: `e78e5ef0cebb462faf397ea621b1d87a`

## Required Environment Variables

Set these environment variables in your deployment environment (Render, Docker, or local `.env` file):

```bash
S3_ENDPOINT=https://s3.pub1.infomaniak.cloud
S3_REGION=us-east-1
S3_BUCKET=your-bucket-name
S3_ACCESS_KEY_ID=ba794c9e6d034ccc9ac0bb2d3aa55b1b
S3_SECRET_ACCESS_KEY=e78e5ef0cebb462faf397ea621b1d87a
```

## Where to Set These

### For Local Development
Create a `.env` file in the project root with the above variables.

### For Render.com Deployment
1. Go to your Render dashboard
2. Select your service
3. Go to "Environment" tab
4. Add the environment variables listed above
5. **Important**: Make sure `S3_BUCKET` is set to your actual bucket name

### For Docker/Docker Compose
The `docker-compose.yml` already references these variables. Set them in your shell environment or in a `.env` file before running `docker-compose up`.

## Next Steps

1. **Create or verify your S3 bucket exists**:
   ```bash
   aws s3api list-buckets --profile infomaniak --endpoint-url https://s3.pub1.infomaniak.cloud
   ```

2. **Create a bucket if needed**:
   ```bash
   aws s3 mb s3://your-bucket-name --profile infomaniak --endpoint-url https://s3.pub1.infomaniak.cloud
   ```

3. **Update `S3_BUCKET` environment variable** with your actual bucket name

4. **Restart your application** after setting the environment variables

## Testing

After setting the environment variables, test the S3 connection:

```bash
aws s3 ls s3://your-bucket-name --profile infomaniak --endpoint-url https://s3.pub1.infomaniak.cloud
```











