package com.tribo.api.iam;

/**
 * Serviço responsável por enviar emails de verificação de conta.
 */
public interface VerificationEmailService {

  /**
   * Envia um email com link de verificação de conta.
   *
   * @param recipientEmail    email do utilizador que se está a registar.
   * @param verificationToken token que será usado no link.
   */
  void sendVerificationEmail(String recipientEmail, String verificationToken);
}