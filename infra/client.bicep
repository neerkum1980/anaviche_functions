// One client's Anaviche stack, deployed into that client's own resource group.
// Everything here belongs to a single client: no resource is shared with another client.
//
// Deployed by infra/new-client.sh, which creates the client's Entra ID apps first and
// passes their ids in.

@description('Short client id: lowercase letters and digits, used in resource names.')
@minLength(3)
@maxLength(12)
param client string

@description('Client display name, stored as a tag.')
param clientName string

@description('Region for the Function App, storage and monitoring.')
param location string = resourceGroup().location

@description('Region for the Static Web App (not every region offers it).')
param frontendLocation string = 'westeurope'

@description('Application (client) id of the client\'s API app registration.')
param apiAppId string

@description('Entra tenant that issues the client\'s tokens.')
param tenantId string = subscription().tenantId

@description('Extra browser origins allowed to call the API, such as a custom domain.')
param extraCorsOrigins array = []

@description('Existing FUNCTIONS_KEY value to keep on redeploy. Empty on a first deploy: the first release creates it.')
@secure()
param functionsKey string = ''

var suffix = take(uniqueString(resourceGroup().id), 5)
var names = {
  functionApp: 'anaviche-${client}-${suffix}'
  plan: 'plan-anaviche-${client}'
  dataStorage: 'stanv${client}d${suffix}'
  auditStorage: 'stanv${client}a${suffix}'
  logs: 'log-anaviche-${client}'
  insights: 'appi-anaviche-${client}'
  frontend: 'swa-anaviche-${client}'
}
var tags = {
  app: 'anaviche'
  client: client
  clientName: clientName
}
var deploymentContainer = 'app-package'
// Storage Blob Data Owner: lets the Function App read its deployment package.
var blobDataOwnerRoleId = 'b7e6dc6d-f1e8-4753-8033-0f276bb0955b'

// ---------------------------------------------------------------------------
// Storage: data (tables, bills, documents, Functions host state) and audit
// ---------------------------------------------------------------------------

resource dataStorage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: names.dataStorage
  location: location
  tags: tags
  kind: 'StorageV2'
  sku: { name: 'Standard_LRS' }
  properties: {
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
    supportsHttpsTrafficOnly: true
  }
}

resource dataBlobs 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: dataStorage
  name: 'default'
}

resource deploymentPackages 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: dataBlobs
  name: deploymentContainer
}

resource auditStorage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: names.auditStorage
  location: location
  tags: tags
  kind: 'StorageV2'
  sku: { name: 'Standard_LRS' }
  properties: {
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
    supportsHttpsTrafficOnly: true
  }
}

var dataConnection = 'DefaultEndpointsProtocol=https;AccountName=${dataStorage.name};AccountKey=${dataStorage.listKeys().keys[0].value};EndpointSuffix=${environment().suffixes.storage}'
var auditConnection = 'DefaultEndpointsProtocol=https;AccountName=${auditStorage.name};AccountKey=${auditStorage.listKeys().keys[0].value};EndpointSuffix=${environment().suffixes.storage}'

// ---------------------------------------------------------------------------
// Monitoring
// ---------------------------------------------------------------------------

resource logs 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: names.logs
  location: location
  tags: tags
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 30
  }
}

resource insights 'Microsoft.Insights/components@2020-02-02' = {
  name: names.insights
  location: location
  tags: tags
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logs.id
  }
}

// ---------------------------------------------------------------------------
// Frontend
// ---------------------------------------------------------------------------

resource frontend 'Microsoft.Web/staticSites@2023-12-01' = {
  name: names.frontend
  location: frontendLocation
  tags: tags
  sku: { name: 'Free', tier: 'Free' }
  properties: {}
}

var frontendOrigin = 'https://${frontend.properties.defaultHostname}'

// ---------------------------------------------------------------------------
// Function App (Flex Consumption)
// ---------------------------------------------------------------------------

resource plan 'Microsoft.Web/serverfarms@2024-04-01' = {
  name: names.plan
  location: location
  tags: tags
  kind: 'functionapp'
  sku: { tier: 'FlexConsumption', name: 'FC1' }
  properties: { reserved: true }
}

resource functionApp 'Microsoft.Web/sites@2024-04-01' = {
  name: names.functionApp
  location: location
  tags: tags
  kind: 'functionapp,linux'
  identity: { type: 'SystemAssigned' }
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    siteConfig: {
      minTlsVersion: '1.2'
      cors: {
        allowedOrigins: concat([frontendOrigin, 'http://localhost:4280'], extraCorsOrigins)
      }
      appSettings: concat([
        { name: 'AzureWebJobsStorage', value: dataConnection }
        { name: 'BILLS_STORAGE_CONNECTION_STRING', value: dataConnection }
        { name: 'AUDIT_STORAGE_CONNECTION_STRING', value: auditConnection }
        { name: 'APPLICATIONINSIGHTS_CONNECTION_STRING', value: insights.properties.ConnectionString }
        { name: 'ANAVICHE_CLIENT', value: client }
      ], empty(functionsKey) ? [] : [
        { name: 'FUNCTIONS_KEY', value: functionsKey }
      ])
    }
    functionAppConfig: {
      deployment: {
        storage: {
          type: 'blobContainer'
          value: '${dataStorage.properties.primaryEndpoints.blob}${deploymentContainer}'
          authentication: { type: 'SystemAssignedIdentity' }
        }
      }
      scaleAndConcurrency: {
        maximumInstanceCount: 40
        instanceMemoryMB: 2048
      }
      runtime: { name: 'python', version: '3.12' }
    }
  }
}

resource packageReader 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(dataStorage.id, functionApp.id, blobDataOwnerRoleId)
  scope: dataStorage
  properties: {
    principalId: functionApp.identity.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', blobDataOwnerRoleId)
  }
}

// Sign-in: the browser path (gateway) needs a token for this client's API app, which
// Entra only issues to users assigned to the client. The APIs and the MCP endpoint are
// excluded here because the Functions host already requires a function key for them.
resource auth 'Microsoft.Web/sites/config@2024-04-01' = {
  parent: functionApp
  name: 'authsettingsV2'
  properties: {
    platform: { enabled: true }
    globalValidation: {
      requireAuthentication: true
      unauthenticatedClientAction: 'Return401'
      excludedPaths: [
        '/api/properties'
        '/api/expenses'
        '/api/DocumentManagement'
        '/api/BillsDownloadApi'
        '/api/mcp'
      ]
    }
    identityProviders: {
      azureActiveDirectory: {
        enabled: true
        registration: {
          clientId: apiAppId
          openIdIssuer: '${environment().authentication.loginEndpoint}${tenantId}/v2.0'
        }
        validation: {
          allowedAudiences: [apiAppId, 'api://${apiAppId}']
        }
      }
    }
    login: { tokenStore: { enabled: false } }
    httpSettings: { requireHttps: true }
  }
}

output functionAppName string = functionApp.name
output functionAppHost string = functionApp.properties.defaultHostName
output frontendName string = frontend.name
output frontendUrl string = frontendOrigin
output dataStorageName string = dataStorage.name
output auditStorageName string = auditStorage.name
output insightsName string = insights.name
