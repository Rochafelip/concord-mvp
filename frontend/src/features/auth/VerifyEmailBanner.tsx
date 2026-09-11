import { useMutation } from '@tanstack/react-query';
import { MailWarning } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '../../components/Button';
import { resendVerification } from './api';

const COOLDOWN_SECONDS = 60;

export function VerifyEmailBanner() {
  const [cooldown, setCooldown] = useState(0);
  const resendMutation = useMutation({
    mutationFn: resendVerification,
    onSuccess: () => setCooldown(COOLDOWN_SECONDS),
  });

  useEffect(() => {
    if (cooldown === 0) return;
    const timer = setTimeout(() => setCooldown((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  return (
    <div
      role="status"
      className="flex flex-shrink-0 items-center gap-3 border-b border-warning/30 bg-warning/10 px-4 py-2 text-body text-ink"
    >
      <MailWarning size={18} aria-hidden="true" className="shrink-0 text-warning" />
      <p className="flex-1">Confirme seu e-mail para proteger sua conta.</p>
      <Button
        variant="secondary"
        disabled={cooldown > 0 || resendMutation.isPending}
        onClick={() => resendMutation.mutate()}
      >
        {cooldown > 0 ? 'E-mail enviado' : 'Reenviar e-mail'}
      </Button>
    </div>
  );
}
