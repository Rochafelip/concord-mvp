import { Check, Circle } from 'lucide-react';
import { PASSWORD_RULES } from './passwordPolicy';

interface PasswordRequirementsProps {
  value: string;
  id?: string;
}

export function PasswordRequirements({ value, id }: PasswordRequirementsProps) {
  return (
    <ul id={id} className="space-y-1">
      {PASSWORD_RULES.map((rule) => {
        const met = rule.isMet(value);
        const Icon = met ? Check : Circle;

        return (
          <li
            key={rule.label}
            className={`flex items-center gap-2 text-caption ${met ? 'text-success' : 'text-muted'}`}
          >
            <Icon size={14} aria-hidden="true" className="shrink-0" />
            {rule.label}
            <span className="sr-only">{met ? 'atendido' : 'faltando'}</span>
          </li>
        );
      })}
    </ul>
  );
}
