import { useController, type Control, type FieldValues, type Path } from 'react-hook-form';

import {
  PasswordInput,
  type PasswordInputProps,
} from '@/shared/ui/atoms/password-input/password-input';

type ControlledPasswordInputProps<T extends FieldValues> = Omit<
  PasswordInputProps,
  'defaultValue' | 'onChange' | 'name' | 'value'
> & {
  control: Control<T>;
  name: Path<T>;
  onValueChange?: () => void;
};

export function ControlledPasswordInput<T extends FieldValues>({
  control,
  name,
  error,
  onValueChange,
  ...props
}: ControlledPasswordInputProps<T>) {
  const { field, fieldState } = useController({ control, name });
  const { ref, ...rest } = field;
  return (
    <PasswordInput
      {...props}
      {...rest}
      ref={ref}
      value={field.value ?? ''}
      onChange={(event) => {
        field.onChange(event);
        onValueChange?.();
      }}
      error={error ?? fieldState.error?.message}
    />
  );
}
