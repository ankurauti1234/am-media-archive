# AWS Console Setup Guide - Lambda & API Gateway Migration

This guide details the click-by-click instructions to deploy the migrated RDS-dependent API into an AWS Lambda function running in a private VPC, behind an AWS API Gateway HTTP API.

---

## 1. Architecture Overview

```text
       Next.js (Vercel / Frontend Hosting)
                       │
                       │ HTTPS (Public Internet)
                       ▼
             AWS API Gateway (HTTP API)
                       │
                       │ VPC Integration (Private Network)
                       ▼
              AWS Lambda (Node.js 22.x)
                       │
                       │ Private Subnet
                       ▼
            AWS RDS PostgreSQL Instance
```

### Request Flow
1. **Frontend Request**: The Next.js frontend calls the API Gateway endpoint (configured via `NEXT_PUBLIC_API_BASE_URL`) over HTTPS.
2. **Gateway Routing**: API Gateway parses the URL route, matches the HTTP method, handles CORS preflight options directly or forwards them, and triggers the Lambda proxy integration.
3. **Lambda Execution**: The Lambda function execution environment warms up, establishing or reusing a PostgreSQL pool connection.
4. **VPC Routing**: Database traffic goes through the private elastic network interfaces (ENIs) attached to Lambda within the private VPC subnets.
5. **Database Query**: The private RDS PostgreSQL instance receives the query, filters on `public.upload_videos`, and returns records back through the private subnet to Lambda.
6. **Response**: Lambda wraps the returned rows into a standardized JSON response containing CORS headers and sends it back to the client.

---

## 2. Security Groups Configuration

Before deploying Lambda or RDS, we must configure Security Groups to restrict traffic to the minimum necessary permissions.

### A. Lambda Security Group (`sg-lambda-media-archive`)
- **VPC**: Select your target VPC.
- **Inbound Rules**: None. (No public inbound traffic is allowed directly to Lambda; it is only invoked via the API Gateway integration).
- **Outbound Rules**:
  - **Type**: PostgreSQL (5432) | **Destination**: Custom -> Select your RDS Security Group (`sg-rds-media-archive`).
  - **Type**: HTTPS (443) | **Destination**: `0.0.0.0/0` (Needed if Lambda needs to fetch external APIs, e.g., Supabase token validation).

### B. RDS Security Group (`sg-rds-media-archive`)
- **VPC**: Must be the same VPC as your RDS instance.
- **Inbound Rules**:
  - **Type**: PostgreSQL (5432) | **Source**: Custom -> Select your Lambda Security Group (`sg-lambda-media-archive`).
- **Outbound Rules**: None.

---

## 3. AWS Lambda Function Deployment

### Step 1: Prepare the Zip Package
1. On your local machine, navigate to the `lambda/` directory.
2. Package the files into a `.zip` archive:
   ```bash
   cd lambda
   zip -r lambda-function.zip index.mjs db.mjs package.json node_modules/
   ```

### Step 2: Create the Lambda Function in AWS Console
1. Open the **AWS Console** and search for **Lambda**.
2. Click **Create function**.
3. Choose **Author from scratch**.
4. Configure the following settings:
   - **Function name**: `media-archive-db-query`
   - **Runtime**: **Node.js 22.x**
   - **Architecture**: `x86_64` or `arm64` (recommended for lower cost).
5. Expand **Change default execution role**:
   - Select **Create a new role with basic Lambda permissions**.
6. Click **Create function**.

### Step 3: Configure Network and VPC
1. Inside your Lambda function page, click on the **Configuration** tab.
2. Select **VPC** from the left-hand sidebar, then click **Edit**.
3. Choose the target **VPC** where your RDS database is located.
4. Select the private **Subnets** where the Lambda should run. Choose at least two subnets in different availability zones for high availability.
5. Select the **Security Group** we created: `sg-lambda-media-archive`.
6. Click **Save**. (Note: AWS will take 1-2 minutes to create the Network Interfaces (ENIs) for the subnets).

### Step 4: Configure Execution Environment Settings
1. Go to the **Configuration** tab, select **General configuration**, and click **Edit**:
   - **Timeout**: Set to `15 seconds` (Allows plenty of headroom for cold-starts and connection pools).
   - **Memory**: Set to `256 MB` or `512 MB`.
   - Click **Save**.
2. Select **Environment variables** from the sidebar, then click **Edit**. Add:
   - `DB_HOST`: The endpoint of your private RDS database.
   - `DB_PORT`: `5432`
   - `DB_NAME`: `labeling_tool`
   - `DB_USER`: `labeling_tool_ec2_user`
   - `DB_PASSWORD`: `LabelingToolEc2User@019283`
   - `ALLOWED_ORIGIN`: Your production Next.js frontend origin (e.g. `https://media-archive.example.com` or `*`).
   - Click **Save**.

### Step 5: Attach Required IAM Policy permissions
1. Go to the **Configuration** tab, select **Permissions**.
2. Click on the **Role name** link to open the IAM Console.
3. Click **Add permissions** -> **Attach policies**.
4. Search for and select the managed policy **`AWSLambdaVPCAccessExecutionRole`**. (This policy grants Lambda the permission to create network interfaces inside a VPC).
5. Click **Add permissions**.

### Step 6: Upload the Code Package
1. Go to the **Code** tab.
2. Click **Upload from** -> select **.zip file**.
3. Choose the `lambda-function.zip` package and click **Save**.
4. In the **Runtime settings** card (bottom of the Code tab), click **Edit**:
   - Verify **Handler** is set to: `index.handler`
   - Click **Save**.

---

## 4. AWS API Gateway Configuration

An HTTP API is recommended as it is lightweight, faster, and integrates directly with Lambda proxy.

### Step 1: Create the API
1. Search for **API Gateway** in the AWS Console.
2. Click **Create API**.
3. Find **HTTP API** and click **Build**.
4. Configure the following:
   - **API name**: `media-archive-http-api`
5. Click **Next** to configure routes.

### Step 2: Configure Routes
1. Click **Add route**:
   - **Method**: `ANY`
   - **Resource path**: `/{proxy+}` (This is a greedy routing mapping forwarding all paths to our Lambda).
2. Click **Next**.

### Step 3: Define Integrations
1. Under **Integration target**, choose **Lambda**.
2. In the **Lambda function** dropdown, select `media-archive-db-query`.
3. Click **Next**.

### Step 4: Configure Stages
1. Leave the stage name as `$default` with **Auto-deploy** enabled.
2. Click **Next** -> click **Create**.

---

## 5. CORS Configuration inside API Gateway

To prevent CORS issues for client requests, configure CORS headers on the API.

1. In the **API Gateway Console**, select your API `media-archive-http-api`.
2. Select **CORS** from the left-hand sidebar.
3. Click **Configure**.
4. Set the following recommended settings:
   - **Access-Control-Allow-Origin**: Add your specific Next.js app URL (e.g., `https://archive.yourdomain.com`). For testing, you can use `*`.
   - **Access-Control-Allow-Methods**: Select `GET` and `OPTIONS`.
   - **Access-Control-Allow-Headers**: Type `content-type`, `authorization`, `x-requested-with` and press enter.
   - **Access-Control-Max-Age**: `86400` (Cache preflight options for 24 hours).
5. Click **Save**.

---

## 6. Authentication Strategy (Supabase JWT Validation)

If you wish to secure your endpoints using Supabase Authentication, follow this strategy:

### JWT Verification Flow
1. **Frontend Header**: In the frontend React `api-client.ts`, append the active Supabase JWT access token to the fetch header:
   ```typescript
   const session = await supabase.auth.getSession();
   const token = session.data.session?.access_token;
   
   // In fetchHeaders:
   headers: {
     'Content-Type': 'application/json',
     'Authorization': `Bearer ${token}`
   }
   ```
2. **Lambda Token Extraction**: Inside `lambda/index.mjs`, extract the authorization token:
   ```javascript
   const authHeader = event.headers?.authorization || event.headers?.Authorization;
   if (!authHeader || !authHeader.startsWith('Bearer ')) {
     return buildResponse(401, { error: 'Unauthorized: Missing token' });
   }
   const token = authHeader.split(' ')[1];
   ```
3. **Validation**: Use a library like `jose` in Lambda to verify the signature of the JWT token using your **Supabase JWT Secret** (found in Supabase Dashboard API Settings under JWT Secret):
   ```javascript
   import { jwtVerify } from 'jose';
   
   const jwtSecret = new TextEncoder().encode(process.env.SUPABASE_JWT_SECRET);
   try {
     const { payload } = await jwtVerify(token, jwtSecret);
     // User is authenticated! payload.sub contains the Supabase User ID.
   } catch (err) {
     return buildResponse(401, { error: 'Unauthorized: Invalid token' });
   }
   ```

---

## 7. Custom Domain Configuration (e.g. `api.example.com`)

To map a clean, user-friendly domain to your API Gateway:

1. **Request Certificate**: Go to **AWS Certificate Manager (ACM)** and request a public SSL certificate for `api.example.com` in your region. Add the required CNAME records in Route 53 or your DNS registrar to validate.
2. **Create Custom Domain**: Go to the **API Gateway Console** -> **Custom domain names** -> click **Create**.
   - **Domain name**: `api.example.com`
   - **ACM certificate**: Select the certificate you validated.
   - Click **Create domain name**.
3. **Map Domain to API**: Click on the newly created custom domain:
   - Go to the **API mappings** tab, and click **Configure API mappings**.
   - Click **Add new mapping**:
     - **API**: Select `media-archive-http-api`.
     - **Stage**: Select `$default`.
     - **Path**: (Leave empty for root mapping).
   - Click **Save**.
4. **Update DNS Records**: Copy the **API Gateway domain name** target (e.g., `d-xxxxxxxx.execute-api.ap-south-1.amazonaws.com`). Create a CNAME or Route 53 Alias record pointing `api.example.com` to this target domain.

---

## 8. Monitoring and Logging

### A. Viewing Application Logs in CloudWatch
1. Open the **AWS CloudWatch Console**.
2. Navigate to **Logs** -> **Log groups**.
3. Search for `/aws/lambda/media-archive-db-query`.
4. Click on the latest log stream to view console prints, runtime timings, and database connection reuse logs.

### B. Track Metrics and Failure Alerts
- Monitor **Invocations**, **Duration**, and **Errors** charts directly under the Lambda **Monitor** tab.
- Set up a CloudWatch Alarm if the Error rate exceeds `1%` within a 5-minute period to receive SNS notifications.

---

## 9. Troubleshooting

### 403 Forbidden
- **Cause**: Incorrect CORS configuration or API Gateway policy restrictions.
- **Solution**: Check the CORS tab inside API Gateway. Confirm that the exact origin matches the `Origin` header sent by the client.

### 502 Bad Gateway
- **Cause**: Lambda function threw an unhandled runtime error or configuration is missing.
- **Solution**: Go to CloudWatch Logs for the Lambda function. Look for JS import errors or database connection syntax issues.

### Lambda Timeout
- **Cause**: Lambda failed to execute within the default timeout (3 seconds). This usually happens during a cold start when establishing a new Postgres pool connection, or if network access is blocked.
- **Solution**: Increase timeout in Lambda General Configuration to `15 seconds`. Verify that the database is reachable (check Security Groups and Route Tables).

### RDS Connection Issue
- **Cause**: Lambda is running outside the VPC, or is blocked by security groups, preventing it from reaching the private database IP.
- **Solution**: Confirm that the Lambda function is mapped to the same VPC and subnets as the RDS instance. Ensure the RDS Security Group has an inbound rule permitting PostgreSQL (5432) traffic originating from the Lambda Security Group.
