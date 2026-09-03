import { useState } from 'react';
import { IconFolder, IconGoogle } from './icons';

interface Props {
  onSignIn: () => Promise<void>;
}

export function SignIn({ onSignIn }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    setBusy(true);
    setError(null);
    try {
      await onSignIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível entrar');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="folder-setup">
      <div className="folder-setup-card">
        <div className="icon-circle">
          <IconFolder size={26} />
        </div>
        <h1>Gestão Fiscal</h1>
        <p>Entre com sua conta Google para acessar seus documentos, salvos com segurança na nuvem.</p>
        <button className="btn btn-primary btn-block" onClick={handleClick} disabled={busy}>
          <IconGoogle size={18} /> {busy ? 'Entrando…' : 'Entrar com Google'}
        </button>
        {error && (
          <p className="error-banner" style={{ marginTop: 16 }}>
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
