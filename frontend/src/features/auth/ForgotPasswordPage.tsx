import { MailQuestion } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AuthCard } from './AuthCard';

export function ForgotPasswordPage() {
  return (
    <AuthCard
      title="Forgot your password?"
      footer={
        <Link to="/login" className="font-medium text-brand hover:text-brand-hover">
          Back to log in
        </Link>
      }
    >
      <div
        role="status"
        className="flex gap-3 rounded border border-warning/30 bg-warning/10 px-3 py-2 text-body text-ink"
      >
        <MailQuestion size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-warning" />
        <p>
          Password recovery by email is not available yet. Ask a Concord admin to reset your
          password for you.
        </p>
      </div>
    </AuthCard>
  );
}
