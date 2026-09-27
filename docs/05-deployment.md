# Deployment Architecture

## Overview

The application is deployed on Kubernetes with three components:
- **Frontend** - React static files served by Nginx
- **Backend** - FastAPI Python application
- **Database** - Azure SQL (managed, external to cluster)

```
                         ┌──────────────────────────────────────────────────┐
                         │              Kubernetes Cluster                  │
                         │                                                  │
   Users ───▶ Ingress ───┤──▶┌────────────────┐    ┌────────────────────┐   │
              (HTTPS)    │   │  Frontend Pod  │    │   Backend Pod      │   │
                         │   │  (Nginx)       │    │   (FastAPI/Uvicorn)│   │
                         │   │                │───▶│                    │   │
                         │   │  /             │API │  /api/*            │   │
                         │   │  static files  │    │                    │   │
                         │   └────────────────┘    │  ┌──────────────┐  │   │
                         │                         │  │ Agent Worker │  │   │
                         │                         │  │ (async task) │  │   │
                         │                         │  └──────┬───────┘  │   │
                         │                         └─────────┼──────────┘   │
                         │                                   │              │
                         │   ┌──────────────────┐            │              │
                         │   │ Workspace PVC     │◀──────────┘              │
                         │   │ (Persistent Vol)  │  clone/write/push        │
                         │   └──────────────────┘                           │
                         └──────────────────┬───────────────────────────────┘
                                            │
                              ┌─────────────▼─────────────┐
                              │       Azure SQL            │
                              │  (Managed, external)       │
                              │  aidevagent_db             │
                              └────────────────────────────┘
```

## Kubernetes Resources

### Frontend Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: aidevagent-frontend
spec:
  replicas: 2
  selector:
    matchLabels:
      app: aidevagent-frontend
  template:
    spec:
      containers:
      - name: frontend
        image: aidevagent-frontend:latest
        ports:
        - containerPort: 80
        resources:
          requests: { cpu: 100m, memory: 128Mi }
          limits: { cpu: 200m, memory: 256Mi }
```

**Dockerfile (frontend):**
```dockerfile
FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
```

**Nginx config** proxies `/api/*` requests to the backend service.

### Backend Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: aidevagent-backend
spec:
  replicas: 1        # Single replica - agent workspace is local to pod
  selector:
    matchLabels:
      app: aidevagent-backend
  template:
    spec:
      containers:
      - name: backend
        image: aidevagent-backend:latest
        ports:
        - containerPort: 8000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: aidevagent-secrets
              key: database-url
        - name: ENCRYPTION_KEY
          valueFrom:
            secretKeyRef:
              name: aidevagent-secrets
              key: encryption-key
        volumeMounts:
        - name: workspace
          mountPath: /workspace
        resources:
          requests: { cpu: 500m, memory: 512Mi }
          limits: { cpu: 1000m, memory: 1Gi }
      volumes:
      - name: workspace
        persistentVolumeClaim:
          claimName: aidevagent-workspace
```

**Dockerfile (backend):**
```dockerfile
FROM python:3.11-slim
RUN apt-get update && apt-get install -y git curl gnupg2 \
    && curl https://packages.microsoft.com/keys/microsoft.asc | apt-key add - \
    && curl https://packages.microsoft.com/config/debian/11/prod.list > /etc/apt/sources.list.d/mssql-release.list \
    && apt-get update && ACCEPT_EULA=Y apt-get install -y msodbcsql18 unixodbc-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Workspace PersistentVolumeClaim

The agent clones repos, writes code, and pushes from a local workspace. This requires persistent storage:

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: aidevagent-workspace
spec:
  accessModes: [ ReadWriteOnce ]
  resources:
    requests:
      storage: 10Gi
```

### Secrets

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: aidevagent-secrets
type: Opaque
stringData:
  database-url: "mssql+aioodbc://sqladmin:Pass@server.database.windows.net/aidevagent_db?driver=ODBC+Driver+18+for+SQL+Server"
  encryption-key: "<fernet-key>"
```

### Ingress

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: aidevagent-ingress
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
spec:
  tls:
  - hosts: [ aidevagent.example.com ]
    secretName: aidevagent-tls
  rules:
  - host: aidevagent.example.com
    http:
      paths:
      - path: /api
        pathType: Prefix
        backend:
          service: { name: aidevagent-backend, port: { number: 8000 } }
      - path: /
        pathType: Prefix
        backend:
          service: { name: aidevagent-frontend, port: { number: 80 } }
```

## How Agent Git Operations Work in Kubernetes

```
1. User clicks "Start Task"
       │
2. Backend creates Run record in Azure SQL
       │
3. Agent worker (async task in backend pod):
       │
       ├── Creates workspace: /workspace/task-{id}/repo/
       │
       ├── git clone https://x-access-token:{PAT}@github.com/{owner}/{repo}.git
       │   (uses user's encrypted GitHub PAT from DB)
       │
       ├── git checkout -b devagent/task-{issue_number}
       │
       ├── Claude agent loop: reads files, writes files, runs commands
       │   (all operations scoped to /workspace/task-{id}/repo/)
       │
       ├── git add . && git commit -m "..."
       │   (git config user.name/email set from user profile)
       │
       ├── git push origin devagent/task-{issue_number}
       │   (pushes to GitHub using the PAT in clone URL)
       │
       ├── GitHub API: Create PR (owner/repo, branch, title)
       │
       └── Cleanup: rm -rf /workspace/task-{id}/
```

**Key points:**
- Git clone URL includes the user's PAT for authentication: `https://x-access-token:{PAT}@github.com/...`
- Git identity (user.name, user.email) set per-workspace from user profile
- Workspace is isolated per task and cleaned up after completion
- All git operations run inside the backend pod using the mounted PVC
- No SSH keys needed - HTTPS with PAT handles auth

## Database Connection

Azure SQL is accessed from within the cluster using the connection string in the Kubernetes secret. The backend pod connects over TCP port 1433. For Azure SQL:
- Enable "Allow Azure services" in firewall rules
- Or add the cluster's outbound IP to the SQL firewall
- Connection string uses `ODBC Driver 18 for SQL Server` (installed in the Docker image)

## Scaling Considerations

| Component | Scaling | Notes |
|-----------|---------|-------|
| Frontend | Horizontal (2+ replicas) | Stateless, served by Nginx |
| Backend | Single replica | Agent workspaces are local to pod (PVC is ReadWriteOnce) |
| Database | Vertical (Azure SQL tier) | Managed service, no pod needed |

For multi-agent concurrency, the backend could be refactored to use a shared filesystem (ReadWriteMany) or offload workspace operations to ephemeral Job pods.
