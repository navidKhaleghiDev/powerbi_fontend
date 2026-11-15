import { useController, type Control, type FieldValues, type Path } from 'react-hook-form';

import { NativeSelect } from '@/shared/ui/atoms/native-select/native-select';

import type * as React from 'react';

type ControlledNativeSelectProps<T extends FieldValues> = Omit<
  React.ComponentProps<'select'>,
  'defaultValue' | 'onChange' | 'name' | 'value'
> & {
  control: Control<T>;
  name: Path<T>;
};

export function ControlledNativeSelect<T extends FieldValues>({
  control,
  name,
  ...props
}: ControlledNativeSelectProps<T>) {
  const { field, fieldState } = useController({ control, name });
  const { ref, ...rest } = field;
  return (
    <NativeSelect
      {...props}
      {...rest}
      ref={ref}
      value={field.value ?? ''}
      onChange={field.onChange}
      aria-invalid={Boolean(fieldState.error)}
    />
  );
}
