import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

type Status = "loading" | "success" | "error";

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<Status>("loading");
  const [message, setMessage] = useState("A verificar o teu email...");

  useEffect(() => {
    const token = searchParams.get("token");

    if (!token) {
      setStatus("error");
      setMessage("Token de verificação em falta.");
      return;
    }

    const run = async () => {
      try {
        const response = await fetch(
          `/rest/auth/verify-email?token=${encodeURIComponent(token)}`
        );

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          setStatus("error");
          setMessage(data.message || "O token é inválido, já foi usado ou expirou.");
          return;
        }

        setStatus("success");
        setMessage("Email confirmado com sucesso. Já podes iniciar sessão.");
      } catch {
        setStatus("error");
        setMessage("Ocorreu um erro ao verificar o email. Tenta novamente.");
      }
    };

    run();
  }, [searchParams]);

  return (
    <main style={{ maxWidth: "520px", margin: "80px auto", padding: "24px" }}>
      <h1>Verificação de email</h1>

      {status === "loading" && <p>{message}</p>}

      {status === "success" && (
        <>
          <p>{message}</p>
          <Link to="/login">Ir para login</Link>
        </>
      )}

      {status === "error" && (
        <>
          <p>{message}</p>
          <Link to="/register">Voltar ao registo</Link>
        </>
      )}
    </main>
  );
}