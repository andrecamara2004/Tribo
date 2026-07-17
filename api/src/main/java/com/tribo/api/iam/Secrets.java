package com.tribo.api.iam;

import com.google.cloud.secretmanager.v1.SecretManagerServiceClient;
import com.google.cloud.secretmanager.v1.SecretVersionName;

import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * Resolves runtime secrets the same way {@link JwtIssuer} does for JWT_SECRET:
 * Google Secret Manager in production (keyed off GOOGLE_CLOUD_PROJECT, which App
 * Engine sets), falling back to an environment variable for local dev. Secrets
 * are never stored in source or committed config.
 */
public final class Secrets {

    private static final Logger LOG = Logger.getLogger(Secrets.class.getName());

    /**
     * @param secretId the Secret Manager secret name (e.g. "tribo-smtp-pass")
     * @param envVar   the env-var to fall back to for local dev
     * @return the secret value, or null if neither source has it
     */
    public static String resolve(String secretId, String envVar) {
        String fromSm = fromSecretManager(secretId);
        if (fromSm != null && !fromSm.isBlank()) {
            return fromSm;
        }
        String env = System.getenv(envVar);
        return (env == null || env.isBlank()) ? null : env;
    }

    private static String fromSecretManager(String secretId) {
        String project = System.getenv("GOOGLE_CLOUD_PROJECT");
        if (project == null || project.isBlank()) {
            return null; // not on GCP (local dev)
        }
        try (SecretManagerServiceClient client = SecretManagerServiceClient.create()) {
            SecretVersionName name = SecretVersionName.of(project, secretId, "latest");
            return client.accessSecretVersion(name).getPayload().getData().toStringUtf8();
        } catch (Exception e) {
            LOG.log(Level.WARNING, "Could not read secret '" + secretId + "' from Secret Manager.", e);
            return null;
        }
    }

    private Secrets() {
    }
}
