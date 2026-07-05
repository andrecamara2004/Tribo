package com.tribo.api.clan;

import java.time.Instant;

public record ClanMessage(
        String id, // UUID
        String clanId, // clan a que pertence
        String userId, // quem enviou
        String fullName, // nome do remetente (desnormalizado para evitar joins)
        String text, // conteúdo da mensagem (máx. 500 chars)
        Instant sentAt // timestamp
) {
}
