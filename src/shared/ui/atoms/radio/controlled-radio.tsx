import { useController, type Control, type FieldValues, type Path } from 'react-hook-form';

import { Radio } from '@/shared/ui/atoms/radio/radio';

import type * as React from 'react';

type ControlledRadioProps<T extends FieldValues> = Omit<
  Omit<React.ComponentProps<'input'>, 'type'>,
  'checked' | 'defaultChecked' | 'onChange' | 'name' | 'value'
> & {
  control: Control<T>;
  name: Path<T>;
} & { value: string };

export function ControlledRadio<T extends FieldValues>({
  control,
  name,
  value,
  ...props
}: ControlledRadioProps<T>) {
  const { field, fieldState } = useController({ control, name });
  const { ref, ...rest } = field;
  return (
    <Radio
      {...props}
      {...rest}
      ref={ref}
      checked={field.value === value}
      onChange={() => field.onChange(value)}
      aria-invalid={Boolean(fieldState.error)}
    />
  );
}
