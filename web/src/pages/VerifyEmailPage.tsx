// src/pages/VerifyEmailPage.tsx
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ApiError } from "../api/http";
import { verifyEmail } from "../api/auth";

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
        await verifyEmail(token);
        setStatus("success");
        setMessage("Email confirmado com sucesso. Já podes iniciar sessão.");
      } catch (err) {
        if (err instanceof ApiError) {
          setStatus("error");
          setMessage(err.message || "O token é inválido, já foi usado ou expirou.");
          return;
        }

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