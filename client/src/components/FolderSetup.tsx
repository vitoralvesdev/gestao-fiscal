import { useState } from 'react';
import { IconFolder } from './icons';

interface Props {
  mode: 'pick' | 'reconnect' | 'unsupported';
  folderName?: string;
  onPick: () => Promise<void>;
}

export function FolderSetup({ mode, folderName, onPick }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    setBusy(true);
    setError(null);
    try {
      await onPick();
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Não foi possível acessar a pasta');
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
        {mode === 'unsupported' ? (
          <>
            <h1>Navegador não suportado</h1>
            <p>
              Este app precisa de um navegador baseado em Chromium (Chrome, Edge, Brave) para
              acessar uma pasta do seu computador.
            </p>
          </>
        ) : mode === 'reconnect' ? (
          <>
            <h1>Reconectar pasta</h1>
            <p>
              Sua pasta <strong>{folderName}</strong> já foi escolhida antes. Por segurança, o
              navegador pede para confirmar o acesso novamente a cada sessão.
            </p>
            <button className="btn btn-primary btn-block" onClick={handleClick} disabled={busy}>
              {busy ? 'Conectando…' : 'Permitir acesso à pasta'}
            </button>
          </>
        ) : (
          <>
            <h1>Escolha sua pasta de arquivos</h1>
            <p>
              Selecione (ou crie) uma pasta no seu computador. Cada categoria vira uma subpasta, e
              os arquivos ficam salvos direto ali — sem servidor, sem nuvem.
            </p>
            <button className="btn btn-primary btn-block" onClick={handleClick} disabled={busy}>
              {busy ? 'Abrindo…' : 'Escolher pasta'}
            </button>
          </>
        )}
        {error && <p className="error-banner" style={{ marginTop: 16 }}>{error}</p>}
      </div>
    </div>
  );
}
