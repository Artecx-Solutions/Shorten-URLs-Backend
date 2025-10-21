# Azure Deployment Guide

## Issues Fixed

1. **Package.json Configuration**: Fixed main entry point and start script
2. **TypeScript Configuration**: Updated module system for ES2020
3. **Environment Variables**: Created example file with required variables
4. **Database Configuration**: Improved MongoDB connection settings
5. **Azure Configuration**: Added web.config for Azure App Service

## Required Environment Variables in Azure

Set these in your Azure App Service Configuration:

### Required Variables:
- `MONGODB_URI`: Your MongoDB connection string
- `JWT_SECRET`: A secure secret key for JWT tokens
- `NODE_ENV`: Set to `production`

### Optional Variables:
- `PORT`: Azure will set this automatically
- `CORS_ORIGINS`: Your frontend domain(s)

## MongoDB Setup Options

### Option 1: MongoDB Atlas (Recommended)
1. Create a free MongoDB Atlas account
2. Create a cluster
3. Get your connection string
4. Set `MONGODB_URI` in Azure App Service Configuration

### Option 2: Azure Cosmos DB with MongoDB API
1. Create a Cosmos DB account with MongoDB API
2. Get the connection string
3. Set `MONGODB_URI` in Azure App Service Configuration

## Deployment Steps

1. **Build the application locally**:
   ```bash
   npm run build
   ```

2. **Deploy to Azure** (using Azure CLI or VS Code):
   ```bash
   az webapp deployment source config-zip --resource-group <your-resource-group> --name <your-app-name> --src <path-to-zip>
   ```

3. **Set Environment Variables** in Azure Portal:
   - Go to your App Service
   - Navigate to Configuration > Application settings
   - Add the required environment variables

4. **Test the deployment**:
   - Visit `https://your-app-name.azurewebsites.net/health`
   - Should return database status and app info

## Troubleshooting

If you still get "Application Error":

1. **Check Azure Logs**:
   - Go to Azure Portal > App Service > Log stream
   - Look for error messages

2. **Verify Environment Variables**:
   - Ensure all required variables are set
   - Check that MongoDB URI is correct

3. **Test Database Connection**:
   - Visit `/health` endpoint to check database status

4. **Common Issues**:
   - Missing environment variables
   - Incorrect MongoDB URI
   - CORS configuration issues
   - Missing dependencies in production
