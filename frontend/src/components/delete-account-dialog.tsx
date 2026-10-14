import { useEffect, useRef } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from './ui/button';

export function DeleteAccountDialog({ onClose, onConfirm, pending, error }: {
  onClose: () => void; onConfirm: () => void; pending: boolean; error?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return <dialog ref={ref} className="confirm-dialog" aria-labelledby="delete-title" onCancel={onClose}>
    <Trash2 size={26}/><h2 id="delete-title">Удалить аккаунт DotaRise?</h2>
    <p>Будут удалены аккаунт и все сессии DotaRise. Публичные данные Steam и OpenDota остаются у их владельцев.</p>
    <div><Button autoFocus variant="outline" onClick={onClose} disabled={pending}>Отмена</Button><Button onClick={onConfirm} disabled={pending}>Удалить аккаунт</Button></div>
    {error && <p role="alert">{error}</p>}
  </dialog>;
}
