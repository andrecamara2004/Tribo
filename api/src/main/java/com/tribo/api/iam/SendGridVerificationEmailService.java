package com.tribo.api.iam;

import com.sendgrid.Method;
import com.sendgrid.Request;
import com.sendgrid.Response;
import com.sendgrid.SendGrid;
import com.sendgrid.helpers.mail.Mail;
import com.sendgrid.helpers.mail.objects.Content;
import com.sendgrid.helpers.mail.objects.Email;

import java.io.IOException;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * Implementação de VerificationEmailService usando SendGrid.
 */
public class SendGridVerificationEmailService implements VerificationEmailService {

    private static final Logger LOGGER = Logger.getLogger(SendGridVerificationEmailService.class.getName());

    private final String apiKey;
    private final String fromEmail;
    private final String appPublicBaseUrl;

    public SendGridVerificationEmailService() {
        this.apiKey = System.getenv("SENDGRID_API_KEY");
        this.fromEmail = System.getenv("EMAIL_FROM");
        this.appPublicBaseUrl = System.getenv("APP_PUBLIC_BASE_URL");

        if (apiKey == null || apiKey.isBlank()) {
            throw new IllegalStateException("SENDGRID_API_KEY env var is required.");
        }
        if (fromEmail == null || fromEmail.isBlank()) {
            throw new IllegalStateException("EMAIL_FROM env var is required.");
        }
        if (appPublicBaseUrl == null || appPublicBaseUrl.isBlank()) {
            throw new IllegalStateException("APP_PUBLIC_BASE_URL env var is required.");
        }
    }

    @Override
    public void sendVerificationEmail(String recipientEmail, String verificationToken) {
        String verificationLink = appPublicBaseUrl + "/verify-email?token=" + verificationToken;

        String subject = "Confirmar a tua conta Tribo";

        String plainTextContent = """
                Olá!

                Obrigado por te registares na Tribo.
                Para confirmares o teu email e ativares a conta, clica no link abaixo:

                %s

                Se não foste tu a criar esta conta, podes ignorar este email.
                """.formatted(verificationLink);

        String htmlContent = """
                <html>
                  <body style="font-family: Arial, sans-serif; color: #222;">
                    <p>Olá!</p>
                    <p>Obrigado por te registares na <strong>Tribo</strong>.</p>
                    <p>Para confirmares o teu email e ativares a conta, clica no botão:</p>
                    <p>
                      <a href="%s"
                         style="display:inline-block;padding:10px 18px;
                                background-color:#01696f;color:#ffffff;
                                text-decoration:none;border-radius:4px;">
                        Confirmar conta
                      </a>
                    </p>
                    <p>Se não foste tu a criar esta conta, podes ignorar este email.</p>
                  </body>
                </html>
                """.formatted(verificationLink);

        Mail mail = new Mail(
                new Email(fromEmail),
                subject,
                new Email(recipientEmail),
                new Content("text/plain", plainTextContent));
        mail.addContent(new Content("text/html", htmlContent));

        SendGrid sg = new SendGrid(apiKey);
        Request request = new Request();

        try {
            request.setMethod(Method.POST);
            request.setEndpoint("mail/send");
            request.setBody(mail.build());

            Response response = sg.api(request);
            int statusCode = response.getStatusCode();

            if (statusCode < 200 || statusCode >= 300) {
                LOGGER.log(
                        Level.WARNING,
                        "Failed to send verification email. Status={0} body={1}",
                        new Object[] { statusCode, response.getBody() });
            } else {
                LOGGER.log(
                        Level.INFO,
                        "Verification email sent successfully to {0}",
                        recipientEmail);
            }
        } catch (IOException ex) {
            LOGGER.log(
                    Level.SEVERE,
                    "Error sending verification email to " + recipientEmail,
                    ex);
        }
    }
}