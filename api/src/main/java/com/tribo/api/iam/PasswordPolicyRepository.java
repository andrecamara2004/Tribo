package com.tribo.api.iam;

import com.google.cloud.datastore.Datastore;
import com.google.cloud.datastore.DatastoreOptions;
import com.google.cloud.datastore.Entity;
import com.google.cloud.datastore.Key;
import com.google.cloud.datastore.KeyFactory;

/**
 * Datastore access for the password policy. Stored as a single well-known
 * entity (kind "Config", key "password-policy"); {@link #get()} falls back to
 * {@link PasswordPolicy#defaults()} when nothing has been saved yet.
 */
public class PasswordPolicyRepository {

    private static final String KIND = "Config";
    private static final String KEY = "password-policy";

    private static final Datastore DATASTORE = DatastoreOptions.getDefaultInstance().getService();
    private static final KeyFactory KEY_FACTORY = DATASTORE.newKeyFactory().setKind(KIND);

    public PasswordPolicy get() {
        Key key = KEY_FACTORY.newKey(KEY);
        Entity e = DATASTORE.get(key);
        if (e == null) {
            return PasswordPolicy.defaults();
        }
        PasswordPolicy d = PasswordPolicy.defaults();
        return new PasswordPolicy(
                e.contains("minLength") ? (int) e.getLong("minLength") : d.minLength(),
                e.contains("requireUppercase") ? e.getBoolean("requireUppercase") : d.requireUppercase(),
                e.contains("requireLowercase") ? e.getBoolean("requireLowercase") : d.requireLowercase(),
                e.contains("requireDigit") ? e.getBoolean("requireDigit") : d.requireDigit(),
                e.contains("requireSpecial") ? e.getBoolean("requireSpecial") : d.requireSpecial());
    }

    public void save(PasswordPolicy p) {
        Key key = KEY_FACTORY.newKey(KEY);
        Entity entity = Entity.newBuilder(key)
                .set("minLength", p.minLength())
                .set("requireUppercase", p.requireUppercase())
                .set("requireLowercase", p.requireLowercase())
                .set("requireDigit", p.requireDigit())
                .set("requireSpecial", p.requireSpecial())
                .build();
        DATASTORE.put(entity);
    }
}
