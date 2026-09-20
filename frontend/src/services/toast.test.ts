import { describe, expect, it, vi } from 'vitest';
import { toast as sonnerToast } from 'sonner';
import { toast } from './toast';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

describe('toast', () => {
  it('forwards success messages to sonner', () => {
    toast.success('Convite copiado');

    expect(sonnerToast.success).toHaveBeenCalledWith('Convite copiado');
  });

  it('forwards error messages to sonner', () => {
    toast.error('Falha ao aceitar pedido de amizade');

    expect(sonnerToast.error).toHaveBeenCalledWith('Falha ao aceitar pedido de amizade');
  });
});
