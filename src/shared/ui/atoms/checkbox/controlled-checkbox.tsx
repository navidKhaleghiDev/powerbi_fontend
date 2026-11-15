import { useController, type Control, type FieldValues, type Path } from 'react-hook-form';

import { Checkbox } from '@/shared/ui/atoms/checkbox/checkbox';

import type * as React from 'react';

type ControlledCheckboxProps<T extends FieldValues> = Omit<
  Omit<React.ComponentProps<'input'>, 'type'>,
  'checked' | 'defaultChecked' | 'onChange' | 'name' | 'value'
> & {
  control: Control<T>;
  name: Path<T>;
};

export function ControlledCheckbox<T extends FieldValues>({
  control,
  name,
  ...props
}: ControlledCheckboxProps<T>) {
  const { field, fieldState } = useController({ control, name });
  const { ref, ...rest } = field;
  return (
    <Checkbox
      {...props}
      {...rest}
      ref={ref}
      checked={Boolean(field.value)}
      onChange={(event) => field.onChange(event.target.checked)}
      aria-invalid={Boolean(fieldState.error)}
    />
  );
}
