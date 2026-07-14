package com.tribo.api.iam;

import com.google.cloud.datastore.Datastore;
import com.google.cloud.datastore.DatastoreOptions;
import com.google.cloud.datastore.Entity;
import com.google.cloud.datastore.Key;
import com.google.cloud.datastore.KeyFactory;
import com.google.cloud.datastore.Query;
import com.google.cloud.datastore.QueryResults;
import com.google.cloud.datastore.StructuredQuery.PropertyFilter;

import java.time.Instant;
import java.util.Optional;

/**
 * Datastore access for email verification tokens.
 *
 * Kind: EmailVerificationToken
 * Key: token string (UUID ou similar).
 */
public class VerificationTokenRepository {

  static final String KIND = "EmailVerificationToken";

  private static final Datastore DATASTORE = DatastoreOptions.getDefaultInstance().getService();

  private static final KeyFactory KEY_FACTORY = DATASTORE.newKeyFactory().setKind(KIND);

  public record VerificationToken(
      String token,
      String userId,
      Instant expiresAt,
      boolean used) {
  }

  public void save(VerificationToken vt) {
    Key key = KEY_FACTORY.newKey(vt.token());
    Entity.Builder entity = Entity.newBuilder(key)
        .set("userId", vt.userId())
        .set("expiresAt", vt.expiresAt().toString())
        .set("used", vt.used());
    DATASTORE.put(entity.build());
  }

  public Optional<VerificationToken> findByToken(String token) {
    Key key = KEY_FACTORY.newKey(token);
    Entity e = DATASTORE.get(key);
    if (e == null)
      return Optional.empty();
    VerificationToken vt = new VerificationToken(
        e.getKey().getName(),
        e.getString("userId"),
        Instant.parse(e.getString("expiresAt")),
        e.getBoolean("used"));
    return Optional.of(vt);
  }

  public void markUsed(String token) {
    Optional<VerificationToken> found = findByToken(token);
    if (found.isEmpty())
      return;
    VerificationToken vt = found.get();
    if (vt.used())
      return;
    VerificationToken updated = new VerificationToken(
        vt.token(), vt.userId(), vt.expiresAt(), true);
    save(updated);
  }

  public void deleteExpiredTokens(Instant cutoff) {
    Query<Entity> q = Query.newEntityQueryBuilder()
        .setKind(KIND)
        .setFilter(PropertyFilter.lt("expiresAt", cutoff.toString()))
        .build();

    QueryResults<Entity> results = DATASTORE.run(q);
    while (results.hasNext()) {
      Entity e = results.next();
      DATASTORE.delete(e.getKey());
    }
  }
}