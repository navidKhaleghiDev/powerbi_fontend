import { useController, type Control, type FieldValues, type Path } from 'react-hook-form';

import { Textarea } from '@/shared/ui/atoms/textarea/textarea';

import type * as React from 'react';

type ControlledTextareaProps<T extends FieldValues> = Omit<
  React.ComponentProps<'textarea'>,
  'defaultValue' | 'onChange' | 'name' | 'value'
> & {
  control: Control<T>;
  name: Path<T>;
};

export function ControlledTextarea<T extends FieldValues>({
  control,
  name,
  ...props
}: ControlledTextareaProps<T>) {
  const { field, fieldState } = useController({ control, name });
  const { ref, ...rest } = field;
  return (
    <Textarea
      {...props}
      {...rest}
      ref={ref}
      value={field.value ?? ''}
      onChange={field.onChange}
      aria-invalid={Boolean(fieldState.error)}
    />
  );
}
