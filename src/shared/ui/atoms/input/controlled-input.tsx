import { useController, type Control, type FieldValues, type Path } from 'react-hook-form';

import { Input, type InputProps } from '@/shared/ui/atoms/input/input';

type ControlledInputProps<T extends FieldValues> = Omit<
  InputProps,
  'defaultValue' | 'onChange' | 'name' | 'value'
> & {
  control: Control<T>;
  name: Path<T>;
};

export function ControlledInput<T extends FieldValues>({
  control,
  name,
  error,
  ...props
}: ControlledInputProps<T>) {
  const { field, fieldState } = useController({ control, name });
  const { ref, ...rest } = field;
  return (
    <Input
      {...props}
      {...rest}
      ref={ref}
      value={field.value ?? ''}
      onChange={field.onChange}
      error={error ?? fieldState.error?.message}
    />
  );
}
