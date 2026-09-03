import { useState } from 'react';
import { Modal } from './Modal';
import { IconCopy, IconDownload, IconExternalLink, IconLinkOff, IconShare } from './icons';
import { shareDocument, unshareDocument, updateSharePermission } from '../lib/documents';
import type { DocumentItem } from '../types';

interface Props {
  doc: DocumentItem;
  uid: string;
  onClose: () => void;
  onUpdate: (updated: DocumentItem) => void;
}

function buildShareUrl(token: string): string {
  return `${window.location.origin}/share/${token}`;
}

export function ShareModal({ doc, uid, onClose, onUpdate }: Props) {
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Estado local do toggle — inicializado com o valor salvo no doc (padrão: false)
  const [allowDownload, setAllowDownload] = useState<boolean>(
    doc.sharedAllowDownload ?? false
  );

  const shareUrl = doc.sharedToken ? buildShareUrl(doc.sharedToken) : null;
  const isShared = !!shareUrl;

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const token = await shareDocument(uid, doc, allowDownload);
      onUpdate({ ...doc, sharedToken: token, sharedAllowDownload: allowDownload });
    } catch {
      setError('Não foi possível gerar o link. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleDownload(next: boolean) {
    setAllowDownload(next);
    if (!isShared) return; // ainda não gerou link — só guarda estado local
    setLoading(true);
    setError(null);
    try {
      await updateSharePermission(uid, doc, next);
      onUpdate({ ...doc, sharedAllowDownload: next });
    } catch {
      setError('Não foi possível atualizar a permissão. Tente novamente.');
      setAllowDownload(!next); // reverte
    } finally {
      setLoading(false);
    }
  }

  async function handleRevoke() {
    setLoading(true);
    setError(null);
    try {
      await unshareDocument(uid, doc);
      onUpdate({ ...doc, sharedToken: undefined, sharedAllowDownload: undefined });
      setCopied(false);
      setAllowDownload(false);
    } catch {
      setError('Não foi possível revogar o link. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <Modal title="Compartilhar arquivo" onClose={onClose}>
      {/* Nome do arquivo */}
      <div className="share-doc-name">
        <IconShare size={16} />
        <span>{doc.name}</span>
      </div>

      {error && <p className="error-banner">{error}</p>}

      {/* Toggle de permissão — aparece sempre, antes e depois de gerar o link */}
      <div className="share-permission">
        <div className="share-permission-info">
          <span className="share-permission-label">
            {allowDownload ? (
              <>
                <IconDownload size={15} /> Pode baixar
              </>
            ) : (
              <>
                <IconExternalLink size={15} /> Só visualizar
              </>
            )}
          </span>
          <span className="share-permission-desc">
            {allowDownload
              ? 'Visitantes poderão baixar o arquivo.'
              : 'Visitantes só poderão visualizar o arquivo online.'}
          </span>
        </div>
        <button
          role="switch"
          aria-checked={allowDownload}
          className={`share-toggle${allowDownload ? ' on' : ''}`}
          onClick={() => handleToggleDownload(!allowDownload)}
          disabled={loading}
          title={allowDownload ? 'Desativar download' : 'Permitir download'}
        >
          <span className="share-toggle-thumb" />
        </button>
      </div>

      {!isShared ? (
        /* ── Ainda não compartilhado ── */
        <div className="share-empty">
          <p>
            Gere um link público para compartilhar este arquivo com qualquer pessoa — mesmo que
            ela não tenha conta no app.
          </p>
          <button className="btn btn-primary" onClick={handleGenerate} disabled={loading}>
            {loading ? 'Gerando…' : 'Gerar link de compartilhamento'}
          </button>
        </div>
      ) : (
        /* ── Link já gerado ── */
        <>
          <div className="share-link-box">
            <input
              readOnly
              value={shareUrl}
              className="share-link-input"
              onFocus={(e) => e.target.select()}
            />
            <button
              className={`btn ${copied ? 'btn-secondary share-copied' : 'btn-primary'}`}
              onClick={handleCopy}
              title="Copiar link"
            >
              <IconCopy size={15} />
              {copied ? 'Copiado!' : 'Copiar'}
            </button>
          </div>

          <p className="share-hint">
            Qualquer pessoa com este link pode acessar o arquivo
            {allowDownload ? ' e baixá-lo' : ', mas não pode baixá-lo'}.
          </p>

          <div className="share-revoke">
            <button className="btn btn-danger" onClick={handleRevoke} disabled={loading}>
              <IconLinkOff size={15} />
              {loading ? 'Revogando…' : 'Revogar link'}
            </button>
            <span className="share-revoke-hint">
              Após revogar, o link anterior para de funcionar imediatamente.
            </span>
          </div>
        </>
      )}
    </Modal>
  );
}
