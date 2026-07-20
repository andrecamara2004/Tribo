package com.tribo.api.iam;

import jakarta.mail.Message;
import jakarta.mail.Session;
import jakarta.mail.Transport;
import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeMessage;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Properties;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * Sends account-verification emails over SMTP (Gmail by default). The sending
 * account + password come from Secret Manager (secrets "tribo-smtp-user" and
 * "tribo-smtp-pass"), falling back to SMTP_USER / SMTP_PASS env vars for local
 * dev — so no credentials live in the repo. Non-secret knobs are env vars:
 *
 * SMTP_HOST (default smtp.gmail.com)
 * SMTP_PORT (default 587, STARTTLS)
 * MAIL_FROM From address (default: the SMTP user)
 * WEB_BASE_URL base for the verify link (default: the deployed web service)
 *
 * If the user/password can't be resolved (e.g. local dev without config), it
 * logs the verification link instead of sending — so the flow is still
 * testable.
 */
public class EmailSender {

    private static final Logger LOG = Logger.getLogger(EmailSender.class.getName());

    private static final String HOST = envOr("SMTP_HOST", "smtp.gmail.com");
    private static final String PORT = envOr("SMTP_PORT", "587");
    private static final String WEB_BASE_URL = envOr("WEB_BASE_URL",
            "https://web-dot-tribo-497810.ew.r.appspot.com");

    // Resolved lazily (a Secret Manager call) and cached — never at class load.
    private static volatile String cachedUser;
    private static volatile String cachedPass;

    private static String smtpUser() {
        if (cachedUser == null) {
            cachedUser = Secrets.resolve("tribo-smtp-user", "SMTP_USER");
        }
        return cachedUser;
    }

    private static String smtpPass() {
        if (cachedPass == null) {
            cachedPass = Secrets.resolve("tribo-smtp-pass", "SMTP_PASS");
        }
        return cachedPass;
    }

    private static boolean configured() {
        String u = smtpUser();
        String p = smtpPass();
        return u != null && !u.isBlank() && p != null && !p.isBlank();
    }

    public static String verificationLink(String token) {
        return WEB_BASE_URL + "/verify-email?token="
                + URLEncoder.encode(token, StandardCharsets.UTF_8);
    }

    public static String passwordResetLink(String token) {
        return WEB_BASE_URL + "/reset-password?token="
                + URLEncoder.encode(token, StandardCharsets.UTF_8);
    }

    /**
     * Best-effort send. Never throws — a failure is logged, not propagated, so
     * registration doesn't half-fail; the user can use "resend".
     */
    public static void sendVerificationEmail(String toEmail, String token) {
        String link = verificationLink(token);

        if (!configured()) {
            LOG.warning("SMTP not configured (set SMTP_USER/SMTP_PASS). "
                    + "Verification link for " + toEmail + ": " + link);
            return;
        }

        final String user = smtpUser();
        final String pass = smtpPass();
        final String from = envOr("MAIL_FROM", user);

        // Jakarta Mail loads its provider registry via the thread-context
        // classloader. On Jetty/App Engine that CL doesn't see the webapp's
        // angus-mail, so the default transport lookup fails
        // (NoSuchProviderException). Pin the app classloader and request the
        // "smtp" transport explicitly to make provider resolution deterministic.
        final ClassLoader prev = Thread.currentThread().getContextClassLoader();
        Thread.currentThread().setContextClassLoader(EmailSender.class.getClassLoader());
        try {
            Properties props = new Properties();
            props.put("mail.transport.protocol", "smtp");
            props.put("mail.smtp.auth", "true");
            props.put("mail.smtp.starttls.enable", "true");
            props.put("mail.smtp.host", HOST);
            props.put("mail.smtp.port", PORT);

            Session session = Session.getInstance(props);

            MimeMessage msg = new MimeMessage(session);
            msg.setFrom(new InternetAddress(from, "Tribo"));
            msg.setRecipients(Message.RecipientType.TO, InternetAddress.parse(toEmail));
            msg.setSubject("Confirm your Tribo account");
            msg.setContent(body(link), "text/html; charset=utf-8");

            try (Transport transport = session.getTransport("smtp")) {
                transport.connect(HOST, Integer.parseInt(PORT), user, pass);
                transport.sendMessage(msg, msg.getAllRecipients());
            }
            LOG.info("Verification email sent to " + toEmail);
        } catch (Exception e) {
            LOG.log(Level.SEVERE, "Failed to send verification email to " + toEmail, e);
        } finally {
            Thread.currentThread().setContextClassLoader(prev);
        }
    }

    public static void sendPasswordResetEmail(String toEmail, String token) {
        String link = passwordResetLink(token);

        if (!configured()) {
            LOG.warning("SMTP not configured (set SMTP_USER/SMTP_PASS). "
                    + "Password reset link for " + toEmail + ": " + link);
            return;
        }

        final String user = smtpUser();
        final String pass = smtpPass();
        final String from = envOr("MAIL_FROM", user);

        final ClassLoader prev = Thread.currentThread().getContextClassLoader();
        Thread.currentThread().setContextClassLoader(EmailSender.class.getClassLoader());
        try {
            Properties props = new Properties();
            props.put("mail.transport.protocol", "smtp");
            props.put("mail.smtp.auth", "true");
            props.put("mail.smtp.starttls.enable", "true");
            props.put("mail.smtp.host", HOST);
            props.put("mail.smtp.port", PORT);

            Session session = Session.getInstance(props);

            MimeMessage msg = new MimeMessage(session);
            msg.setFrom(new InternetAddress(from, "Tribo"));
            msg.setRecipients(Message.RecipientType.TO, InternetAddress.parse(toEmail));
            msg.setSubject("Reset your Tribo password");
            msg.setContent(resetBody(link), "text/html; charset=utf-8");

            try (Transport transport = session.getTransport("smtp")) {
                transport.connect(HOST, Integer.parseInt(PORT), user, pass);
                transport.sendMessage(msg, msg.getAllRecipients());
            }
            LOG.info("Password reset email sent to " + toEmail);
        } catch (Exception e) {
            LOG.log(Level.SEVERE, "Failed to send password reset email to " + toEmail, e);
        } finally {
            Thread.currentThread().setContextClassLoader(prev);
        }
    }

    private static String body(String link) {
        return "<div style=\"font-family:sans-serif;max-width:480px;margin:auto\">"
                + "<h2>Welcome to Tribo 🏃</h2>"
                + "<p>Confirm your email to activate your account:</p>"
                + "<p><a href=\"" + link + "\" "
                + "style=\"display:inline-block;background:#00B86B;color:#fff;"
                + "padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600\">"
                + "Confirm my email</a></p>"
                + "<p style=\"color:#666;font-size:13px\">Or paste this link into your browser:<br>"
                + link + "</p>"
                + "<p style=\"color:#999;font-size:12px\">If you didn't create a Tribo account, "
                + "you can ignore this email.</p></div>";
    }

    private static String resetBody(String link) {
        return "<div style=\"font-family:sans-serif;max-width:480px;margin:auto\">"
                + "<h2>Reset your Tribo Password 🔒</h2>"
                + "<p>Click the button below to reset your password:</p>"
                + "<p><a href=\"" + link + "\" "
                + "style=\"display:inline-block;background:#00B86B;color:#fff;"
                + "padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600\">"
                + "Reset Password</a></p>"
                + "<p style=\"color:#666;font-size:13px\">Or paste this link into your browser:<br>"
                + link + "</p>"
                + "<p style=\"color:#999;font-size:12px\">If you didn't request a password reset, "
                + "you can safely ignore this email.</p></div>";
    }

    private static String envOr(String name, String fallback) {
        String v = System.getenv(name);
        return (v == null || v.isBlank()) ? fallback : v;
    }

    private EmailSender() {
        // utility
    }
}
