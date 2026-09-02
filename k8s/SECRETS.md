# Secrets

This app has no Secret manifests in this repo. Secrets are created directly in
the cluster via `kubectl` so real values never live in git.

## Create the secrets (run once per cluster / namespace)

```bash
kubectl create secret generic postgres-secret -n lovable \
  --from-literal=POSTGRES_PASSWORD='password'

kubectl create secret generic backend-secret -n lovable \
  --from-literal=BETTER_AUTH_SECRET='<your-secret>' \
  --from-literal=DATABASE_URL='postgresql://postgres:password@postgres:5432/postgres' \
  --from-literal=REDIS_URL='redis://redis:6379' \
  --from-literal=RESEND_API_KEY='<your-key>' \
  --from-literal=E2B_API_KEY='<your-key>' \
  --from-literal=OPENROUTER_API_KEY='<your-key>' \
  --from-literal=GOOGLE_CLIENT_ID='<your-id>' \
  --from-literal=GOOGLE_CLIENT_SECRET='<your-secret>' \
  --from-literal=ARIZE_SPACE_ID='<your-id>' \
  --from-literal=ARIZE_API_KEY='<your-key>' \
  --from-literal=AWS_ACCESS_KEY_ID='<your-id>' \
  --from-literal=AWS_SECRET_ACCESS_KEY='<your-key>' \
  --from-literal=GCS_SERVICE_ACCOUNT_KEY='{...your service account json...}'
```

## Add a new secret key to an existing secret

```bash
kubectl create secret generic backend-secret -n lovable \
  --from-literal=NEW_KEY='value' \
  --dry-run=client -o yaml | kubectl apply -f -
```

This reads the existing secret, merges the new key, and re-applies — it does NOT
wipe the other keys.

## Update an existing key

```bash
kubectl create secret generic backend-secret -n lovable \
  --from-literal=EXISTING_KEY='new-value' \
  --dry-run=client -o yaml | kubectl apply -f -
```

## Verify

```bash
kubectl -n lovable get secrets
kubectl -n lovable get secret backend-secret -o jsonpath='{.data}' | base64 -d
```
