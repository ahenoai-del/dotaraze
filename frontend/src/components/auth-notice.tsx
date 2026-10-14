import { LogIn, X } from 'lucide-react';
import { Button } from './ui/button';
import { API_URL } from '../services/api';

const messages: Record<string, string> = {
  cancelled: 'Вход через Steam отменён. Вы можете попробовать снова.',
  invalid_state: 'Ссылка входа истекла или уже использована. Начните вход заново.',
  invalid_login: 'Steam не подтвердил вход. Начните авторизацию заново.',
  steam_unavailable: 'Steam временно не отвечает. Повторите вход позже.',
};

export function AuthNotice({ code, onDismiss }: { code: string | null; onDismiss: () => void }) {
  if (!code) return null;
  return <div className="small-notice" role="alert"><span className="flex-1">{messages[code] || 'Не удалось выполнить вход. Попробуйте снова.'}</span><Button asChild variant="outline" size="sm"><a href={`${API_URL}/auth/steam/login`}><LogIn size={14}/>Повторить вход</a></Button><Button variant="ghost" size="icon" aria-label="Закрыть сообщение о входе" onClick={onDismiss}><X size={15}/></Button></div>;
}
