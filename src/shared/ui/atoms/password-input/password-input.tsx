import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/shared/ui/atoms/button/button';
import { Input, type InputProps } from '@/shared/ui/atoms/input/input';

export type PasswordInputProps = Omit<InputProps, 'type' | 'endAdornment'> & {
  showPasswordLabel: string;
  hidePasswordLabel: string;
};

function PasswordInput({
  showPasswordLabel,
  hidePasswordLabel,
  disabled,
  ...props
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <Input
      {...props}
      type={visible ? 'text' : 'password'}
      disabled={disabled}
      endAdornment={
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={disabled}
          onClick={() => setVisible((value) => !value)}
          aria-label={visible ? hidePasswordLabel : showPasswordLabel}
          aria-pressed={visible}
        >
          {visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
        </Button>
      }
    />
  );
}

export { PasswordInput };
